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


def run(messages):
    stdin = "\n".join(json.dumps(m) for m in messages) + "\n"
    p = subprocess.run([sys.executable, str(CALC)], input=stdin,
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


if __name__ == "__main__":
    unittest.main()
