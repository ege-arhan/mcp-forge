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

    def test_create_python_add_prompt_e2e(self):
        r = self.forge("create", "pdem", "--template", "python",
                       "--dir", str(self.tmp))
        self.assertEqual(r.returncode, 0, r.stderr)
        proj = self.tmp / "pdem"
        r = self.forge("add", "prompt", "ozet", "--dir", str(proj))
        self.assertEqual(r.returncode, 0, r.stderr)
        server = proj / "server.py"
        src = server.read_text()
        self.assertIn("forge:prompt-builders anchor", src)
        self.assertIn("forge:prompts anchor", src)
        self.assertIn("ozet", src)

        cp = subprocess.run([sys.executable, "-m", "py_compile", str(server)],
                            capture_output=True, text=True, timeout=30)
        self.assertEqual(cp.returncode, 0, cp.stderr)

        out = run_server(server, [
            rpc(1, "prompts/list"),
            rpc(2, "prompts/get", {"name": "greet",
                                   "arguments": {"name": "Ege"}}),
            rpc(3, "prompts/get", {"name": "ozet",
                                   "arguments": {"input": "merhaba"}}),
            rpc(4, "prompts/get", {"name": "yok"}),
        ])
        by_id = {m["id"]: m for m in out}
        names = {t["name"] for t in by_id[1]["result"]["prompts"]}
        self.assertEqual(names, {"greet", "ozet"})
        self.assertIn("Greet Ege",
                      by_id[2]["result"]["messages"][0]["content"]["text"])
        self.assertIn("ozet: merhaba",
                      by_id[3]["result"]["messages"][0]["content"]["text"])
        self.assertEqual(by_id[4]["error"]["code"], -32602)

        v = subprocess.run(["node", str(FORGE), "verify",
                            "--dir", str(proj)],
                           capture_output=True, text=True, timeout=30)
        self.assertEqual(v.returncode, 0, v.stdout + v.stderr)
        self.assertIn("prompts/list has greet", v.stdout)

    def test_add_prompt_rejects_bad_names_and_duplicates(self):
        self.forge("create", "pdem", "--template", "python",
                   "--dir", str(self.tmp))
        proj = str(self.tmp / "pdem")
        bad = self.forge("add", "prompt", "Ozet!", "--dir", proj)
        self.assertNotEqual(bad.returncode, 0)
        ok = self.forge("add", "prompt", "ozet", "--dir", proj)
        self.assertEqual(ok.returncode, 0, ok.stderr)
        dup = self.forge("add", "prompt", "ozet", "--dir", proj)
        self.assertNotEqual(dup.returncode, 0)

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
        # node --check: TS syntax kilidi (tsx yok)
        ck = subprocess.run(["node", "--check", str(proj / "server.ts")],
                            capture_output=True, text=True, timeout=30)
        self.assertEqual(ck.returncode, 0, ck.stderr)
        # native runtime e2e: node >=22.18 type stripping, bagimlilik yok
        stdin = "\n".join(json.dumps(m) for m in [
            rpc(1, "initialize", {"protocolVersion": "2024-11-05",
                                     "capabilities": {}, "clientInfo": {}}),
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            rpc(2, "tools/list"),
            rpc(3, "tools/call", {"name": "hello_world",
                                      "arguments": {"name": "Ege"}}),
            rpc(4, "tools/call", {"name": "ozet",
                                      "arguments": {"input": "merhaba"}}),
            rpc(5, "resources/read", {"uri": "forge://notlar"}),
        ]) + "\n"
        p = subprocess.run(["node", str(proj / "server.ts")], input=stdin,
                           capture_output=True, text=True, timeout=30)
        self.assertEqual(p.returncode, 0, p.stderr)
        by_id = {m["id"]: m for m in
                   (json.loads(l) for l in p.stdout.splitlines()
                    if l.strip())}
        self.assertEqual(by_id[1]["result"]["serverInfo"]["name"],
                         "hello-forge")
        names = {t["name"] for t in by_id[2]["result"]["tools"]}
        self.assertEqual(names, {"hello_world", "ozet"})
        self.assertIn("Hello, Ege!",
                      by_id[3]["result"]["content"][0]["text"])
        self.assertIn("ozet: merhaba",
                      by_id[4]["result"]["content"][0]["text"])
        self.assertIn("notlar",
                      by_id[5]["result"]["contents"][0]["text"])
        # forge verify TS'te de calisir (tsx'siz, node native)
        v = subprocess.run(["node", str(FORGE), "verify",
                            "--dir", str(proj)],
                           capture_output=True, text=True, timeout=30)
        self.assertEqual(v.returncode, 0, v.stdout + v.stderr)
        self.assertIn("tum kontroller gecti", v.stdout)

    def test_ts_malformed_input_never_crashes(self):
        ts_server = ROOT / "templates" / "ts" / "hello" / "server.ts"
        raw = ('12\n"just a string"\nnull\n[1,2]\n' + json.dumps(
            rpc(1, "tools/list")) + "\n")
        p = subprocess.run(
            ["node", str(ts_server)], input=raw,
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(p.returncode, 0, p.stderr)
        out = [json.loads(l) for l in p.stdout.splitlines() if l.strip()]
        self.assertEqual(len(out), 1)
        self.assertIn("hello_world",
                      [t["name"] for t in out[0]["result"]["tools"]])

        bad_params = json.dumps(
            rpc(7, "tools/call", "bozuk")) + "\n" + json.dumps(
            rpc(8, "tools/list")) + "\n"
        p = subprocess.run(
            ["node", str(ts_server)], input=bad_params,
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(p.returncode, 0, p.stderr)
        by_id = {m["id"]: m for m in
                   (json.loads(l) for l in p.stdout.splitlines()
                    if l.strip())}
        self.assertEqual(by_id[7]["error"]["code"], -32602)
        self.assertIn("hello_world",
                      [t["name"] for t in by_id[8]["result"]["tools"]])

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

    def test_verify_passes_on_fresh_template(self):
        proj = self.tmp / "vdemo"
        r = self.forge("create", "vdemo", "--template", "python",
                       "--dir", str(self.tmp))
        self.assertEqual(r.returncode, 0, r.stderr)
        v = subprocess.run(["node", str(FORGE), "verify",
                            "--dir", str(proj)],
                           capture_output=True, text=True, timeout=30)
        self.assertEqual(v.returncode, 0, v.stdout + v.stderr)
        self.assertIn("tum kontroller gecti", v.stdout)
        self.assertIn("ping ok", v.stdout)
        self.assertIn("unknown method -32601", v.stdout)
        self.assertIn("unknown tool -32602", v.stdout)
        self.assertIn("unknown resource -32602", v.stdout)
        self.assertIn("unknown prompt -32602", v.stdout)

    def test_version_and_help(self):
        v = self.forge("--version")
        self.assertEqual(v.returncode, 0, v.stderr)
        self.assertIn("forge v", v.stdout)
        h = self.forge("--help")
        self.assertEqual(h.returncode, 0, h.stderr)
        self.assertIn("forge create", h.stdout)

    def test_malformed_input_never_crashes(self):
        raw = '12\n"just a string"\nnull\n[1,2]\n' + json.dumps(
            rpc(1, "tools/list")) + "\n"
        p = subprocess.run(
            [sys.executable, str(PY_SERVER)], input=raw,
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(p.returncode, 0, p.stderr)
        out = [json.loads(l) for l in p.stdout.splitlines() if l.strip()]
        self.assertEqual(len(out), 1)
        self.assertIn("hello_world",
                      [t["name"] for t in out[0]["result"]["tools"]])

        bad_params = json.dumps(
            rpc(7, "tools/call", "bozuk")) + "\n" + json.dumps(
            rpc(8, "tools/list")) + "\n"
        p = subprocess.run(
            [sys.executable, str(PY_SERVER)], input=bad_params,
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(p.returncode, 0, p.stderr)
        by_id = {m["id"]: m for m in
                   (json.loads(l) for l in p.stdout.splitlines()
                    if l.strip())}
        self.assertEqual(by_id[7]["error"]["code"], -32602)
        self.assertIn("hello_world",
                      [t["name"] for t in by_id[8]["result"]["tools"]])

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


    def test_create_rejects_missing_name(self):
        r = self.forge("create")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("proje adi gerekli", r.stderr)

    def test_ci_node_version_supports_ts_template(self):
        # TS sablon native type stripping ister (>=22.18); CI daha
        # dusuk node'da kosarsa TS e2e sessizce kirilir. Kilit burada.
        import re
        ci = (ROOT / ".github" / "workflows" / "verify.yml").read_text()
        m = re.search(r"node-version:\s*(\d+)", ci)
        self.assertIsNotNone(m, "CI node-version bulunamadi")
        self.assertGreaterEqual(int(m.group(1)), 22,
                                "CI node TS sablonu calistiramaz (<22)")

if __name__ == "__main__":
    unittest.main()
