"""examples/ kilidi — hesap makinesi ornegi gercekten toplar/carpar.

Dogfooding garantisi: ornek server'lar forge create+add ile uretildi,
buradaki e2e basarisizsa ornekler curumus demektir.
"""
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CALC = ROOT / "examples" / "calculator" / "python" / "server.py"
NOTES = ROOT / "examples" / "notes" / "python" / "server.py"


def run(messages, server=CALC):
    stdin = "\n".join(json.dumps(m) for m in messages) + "\n"
    p = subprocess.run([sys.executable, str(server)], input=stdin,
                       capture_output=True, text=True, timeout=30)
    assert p.returncode == 0, p.stderr
    return {m["id"]: m for m in
            (json.loads(l) for l in p.stdout.splitlines() if l.strip())}


def rpc(id_, method, params=None):
    m = {"jsonrpc": "2.0", "id": id_, "method": method}
    if params is not None:
        m["params"] = params
    return m


class CalculatorExampleTest(unittest.TestCase):
    def test_topla_ve_carp(self):
        out = run([
            rpc(1, "tools/list"),
            rpc(2, "tools/call", {"name": "topla",
                                  "arguments": {"sayilar": [2, 3, 5]}}),
            rpc(3, "tools/call", {"name": "carp",
                                  "arguments": {"sayilar": [2, 3, 5]}}),
            rpc(4, "tools/call", {"name": "topla",
                                  "arguments": {"sayilar": "x"}}),
        ])
        names = {t["name"] for t in out[1]["result"]["tools"]}
        self.assertIn("topla", names)
        self.assertIn("carp", names)
        self.assertIn("toplam: 10", out[2]["result"]["content"][0]["text"])
        self.assertIn("carpim: 30", out[3]["result"]["content"][0]["text"])
        # kotu girdi sunucuyu cokertmez, hata mesaji doner
        self.assertIn("hata:", out[4]["result"]["content"][0]["text"])


class NotesExampleTest(unittest.TestCase):
    def test_ekle_listele_kurallar(self):
        out = run([
            rpc(1, "tools/list"),
            rpc(2, "tools/call", {"name": "not_ekle",
                                  "arguments": {"not": "sut al"}}),
            rpc(3, "tools/call", {"name": "not_ekle",
                                  "arguments": {"not": "ekmek al"}}),
            rpc(4, "resources/list"),
            rpc(5, "resources/read", {"uri": "forge://notlar"}),
            rpc(6, "tools/call", {"name": "not_ekle",
                                  "arguments": {"not": "  "}}),
        ], server=NOTES)
        names = {t["name"] for t in out[1]["result"]["tools"]}
        self.assertIn("not_ekle", names)
        self.assertIn("eklendi (1): sut al",
                      out[2]["result"]["content"][0]["text"])
        self.assertIn("eklendi (2): ekmek al",
                      out[3]["result"]["content"][0]["text"])
        uris = {t["uri"] for t in out[4]["result"]["resources"]}
        self.assertIn("forge://notlar", uris)
        text = out[5]["result"]["contents"][0]["text"]
        self.assertIn("1. sut al", text)
        self.assertIn("2. ekmek al", text)
        # bos not reddedilir, sunucu cokmez
        self.assertIn("hata:",
                      out[6]["result"]["content"][0]["text"])


class TemplatePromptTest(unittest.TestCase):
    def test_python_template_prompts(self):
        out = run([
            rpc(1, "initialize", {"protocolVersion": "2024-11-05",
                                 "capabilities": {}, "clientInfo": {}}),
            rpc(2, "prompts/list"),
            rpc(3, "prompts/get", {"name": "greet",
                                   "arguments": {"name": "Ege"}}),
            rpc(4, "prompts/get", {"name": "yok"}),
        ], server=ROOT / "templates" / "python" / "hello" / "server.py")
        caps = out[1]["result"]["capabilities"]
        self.assertIn("prompts", caps)
        names = {t["name"] for t in out[2]["result"]["prompts"]}
        self.assertIn("greet", names)
        msg = out[3]["result"]["messages"][0]
        self.assertEqual(msg["role"], "user")
        self.assertIn("Greet Ege", msg["content"]["text"])
        self.assertEqual(out[4]["error"]["code"], -32602)


if __name__ == "__main__":
    unittest.main()
