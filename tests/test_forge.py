"""forge e2e lock — stdlib only (unittest + subprocess).

Covers: create (python/ts) -> add tool -> py_compile/node --check ->
stdio JSON-RPC e2e (initialize, tools/list, tools/call ok + unknown).
Run: python3 -m unittest discover -s tests -v
"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FORGE = ROOT / "cli" / "forge.js"
PY_SERVER = ROOT / "templates" / "python" / "hello" / "server.py"


def run_server(server_py, messages):
    stdin = "\n".join(json.dumps(m) for m in messages) + "\n"
    p = subprocess.run(
        [sys.executable, str(server_py)], input=stdin,
        capture_output=True, text=True, timeout=30,
    )
    assert p.returncode == 0, p.stderr
    return [json.loads(line) for line in p.stdout.splitlines() if line.strip()]


def rpc(id_, method, params=None):
    m = {"jsonrpc": "2.0", "id": id_, "method": method}
    if params is not None:
        m["params"] = params
    return m


class ForgeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="forge-test-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def forge(self, *args):
        p = subprocess.run(["node", str(FORGE), *args],
                           capture_output=True, text=True, timeout=30)
        return p

    def test_create_python_add_tool_e2e(self):
        r = self.forge("create", "demo", "--template", "python",
                       "--dir", str(self.tmp))
        self.assertEqual(r.returncode, 0, r.stderr)
        proj = self.tmp / "demo"
        r = self.forge("add", "tool", "ozet", "--dir", str(proj))
        self.assertEqual(r.returncode, 0, r.stderr)
        r = self.forge("add", "resource", "notlar", "--dir", str(proj))
        self.assertEqual(r.returncode, 0, r.stderr)
        server = proj / "server.py"

        cp = subprocess.run([sys.executable, "-m", "py_compile", str(server)],
                            capture_output=True, text=True, timeout=30)
        self.assertEqual(cp.returncode, 0, cp.stderr)

        out = run_server(server, [
            rpc(1, "initialize", {"protocolVersion": "2024-11-05",
                                 "capabilities": {}, "clientInfo": {}}),
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            rpc(2, "tools/list"),
            rpc(3, "tools/call", {"name": "hello_world",
                                  "arguments": {"name": "Ege"}}),
            rpc(4, "tools/call", {"name": "ozet",
                                  "arguments": {"input": "merhaba"}}),
            rpc(5, "tools/call", {"name": "yok"}),
            rpc(6, "resources/list"),
            rpc(7, "resources/read", {"uri": "forge://readme"}),
            rpc(8, "resources/read", {"uri": "forge://notlar"}),
            rpc(9, "resources/read", {"uri": "forge://yok"}),
        ])
        by_id = {m["id"]: m for m in out}
        self.assertEqual(by_id[1]["result"]["serverInfo"]["name"], "hello-forge")
        names = {t["name"] for t in by_id[2]["result"]["tools"]}
        self.assertEqual(names, {"hello_world", "ozet"})
        self.assertIn("Hello, Ege!",
                      by_id[3]["result"]["content"][0]["text"])
        self.assertIn("ozet: merhaba",
                      by_id[4]["result"]["content"][0]["text"])
        self.assertEqual(by_id[5]["error"]["code"], -32602)
        uris = {t["uri"] for t in by_id[6]["result"]["resources"]}
        self.assertEqual(uris, {"forge://readme", "forge://notlar"})
        self.assertIn("hello-forge",
                      by_id[7]["result"]["contents"][0]["text"])
        self.assertIn("notlar",
                      by_id[8]["result"]["contents"][0]["text"])
        self.assertEqual(by_id[9]["error"]["code"], -32602)

    def test_create_ts_add_tool_syntax(self):
        r = self.forge("create", "demo-ts", "--template", "ts",
                       "--dir", str(self.tmp))
        self.assertEqual(r.returncode, 0, r.stderr)
        proj = self.tmp / "demo-ts"
        r = self.forge("add", "tool", "ozet", "--dir", str(proj))
        self.assertEqual(r.returncode, 0, r.stderr)
        src = (proj / "server.ts").read_text()
        self.assertIn("function ozet(", src)
        self.assertIn("ozet: {", src)
        # anchor lines survive for the next add
        self.assertIn("forge:handlers anchor", src)
        self.assertIn("forge:tools anchor", src)
        r = self.forge("add", "resource", "notlar", "--dir", str(proj))
        self.assertEqual(r.returncode, 0, r.stderr)
        src = (proj / "server.ts").read_text()
        self.assertIn("forge://notlar", src)
        self.assertIn("forge:resources anchor", src)

    def test_add_tool_rejects_bad_names_and_duplicates(self):
        self.forge("create", "demo", "--template", "python",
                   "--dir", str(self.tmp))
        proj = str(self.tmp / "demo")
        bad = self.forge("add", "tool", "Ozet!", "--dir", proj)
        self.assertNotEqual(bad.returncode, 0)
        ok = self.forge("add", "tool", "ozet", "--dir", proj)
        self.assertEqual(ok.returncode, 0, ok.stderr)
        dup = self.forge("add", "tool", "ozet", "--dir", proj)
        self.assertNotEqual(dup.returncode, 0)

    def test_template_server_hello_still_ok(self):
        out = run_server(PY_SERVER, [
            rpc(1, "tools/list"),
            rpc(2, "tools/call", {"name": "hello_world"}),
        ])
        by_id = {m["id"]: m for m in out}
        self.assertEqual([t["name"] for t in by_id[1]["result"]["tools"]],
                         ["hello_world"])
        self.assertIn("Hello, world!",
                      by_id[2]["result"]["content"][0]["text"])


if __name__ == "__main__":
    unittest.main()
