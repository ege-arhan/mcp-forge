#!/usr/bin/env python3
"""Ornek: not defteri — forge create + add ile uretildi, gercek is yapar.

Bellek ici not listesi: `not_ekle` tool'u ekler, `forge://notlar`
kaynagi listeler. Tek islem omurlu (restart sifirlar); kalici
depolama bir sonraki ornekte.
"""
import json
import sys

def reply(id_, result):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": id_, "result": result}) + "\n")
    sys.stdout.flush()

def error(id_, code, message):
    sys.stdout.write(json.dumps(
        {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}}
    ) + "\n")
    sys.stdout.flush()

_NOTLAR = []

def _not_ekle(args):
    text = str((args or {}).get("not", "")).strip()
    if not text:
        return [{"type": "text", "text": "hata: not bos olamaz."}]
    if len(text) > 500:
        return [{"type": "text", "text": "hata: not en fazla 500 karakter."}]
    _NOTLAR.append(text)
    return [{"type": "text", "text": f"eklendi ({len(_NOTLAR)}): {text}"}]

# forge:handlers anchor - new tool handlers go above this line
def _hello_world(args):
    name = (args or {}).get("name", "world")
    return [{"type": "text", "text": f"Hello, {name}!"}]

def _notlar_resource():
    if not _NOTLAR:
        return "(henuz not yok - not_ekle ile ekle.)"
    return "\n".join(f"{i + 1}. {n}" for i, n in enumerate(_NOTLAR))

# forge:resource-readers anchor - new resource readers go above this line
def _readme_resource():
    return "not-defteri ornegi - `not_ekle` ile ekle, `forge://notlar` ile oku."

TOOLS = {
    "not_ekle": {
        "description": "Bellek ici listeye not ekler.",
        "inputSchema": {"type": "object",
                        "properties": {"not": {"type": "string"}},
                        "required": ["not"]},
        "handler": _not_ekle,
    },
    # forge:tools anchor - new tool entries go above this line
    "hello_world": {
        "description": "Returns a greeting. Optional 'name' argument.",
        "inputSchema": {
            "type": "object",
            "properties": {"name": {"type": "string", "description": "Who to greet"}},
        },
        "handler": _hello_world,
    },
}

RESOURCES = {
    "forge://notlar": {
        "name": "notlar",
        "mimeType": "text/plain",
        "reader": _notlar_resource,
    },
    # forge:resources anchor - new resource entries go above this line
    "forge://readme": {
        "name": "readme",
        "mimeType": "text/plain",
        "reader": _readme_resource,
    },
}

def handle(msg):
    if not isinstance(msg, dict):
        return  # id bilinmez, yanit verilemez — sessiz gec
    method = msg.get("method")
    id_ = msg.get("id")
    params = msg.get("params", {}) or {}
    if not isinstance(params, dict):
        if id_ is not None:
            error(id_, -32602, "invalid params")
        return

    if method == "initialize":
        reply(id_, {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}, "resources": {}},
            "serverInfo": {"name": "hello-forge", "version": "0.1.0"},
        })
    elif method == "ping":
        reply(id_, {})
    elif method == "tools/list":
        reply(id_, {"tools": [
            {"name": name, "description": spec["description"],
             "inputSchema": spec["inputSchema"]}
            for name, spec in TOOLS.items()
        ]})
    elif method == "tools/call":
        spec = TOOLS.get(params.get("name"))
        if spec is None:
            error(id_, -32602, f"unknown tool: {params.get('name')}")
        else:
            try:
                reply(id_, {"content": spec["handler"](params.get("arguments") or {})})
            except Exception as e:  # never crash the stdio loop on a tool bug
                error(id_, -32603, f"tool failed: {e}")
    elif method == "resources/list":
        reply(id_, {"resources": [
            {"uri": uri, "name": spec["name"],
             "mimeType": spec["mimeType"]}
            for uri, spec in RESOURCES.items()
        ]})
    elif method == "resources/read":
        spec = RESOURCES.get(params.get("uri"))
        if spec is None:
            error(id_, -32602, f"unknown resource: {params.get('uri')}")
        else:
            try:
                text = spec["reader"]()
                reply(id_, {"contents": [{"uri": params.get("uri"),
                                          "mimeType": spec["mimeType"],
                                          "text": text}]})
            except Exception as e:
                error(id_, -32603, f"resource failed: {e}")
    elif method and method.startswith("notifications/"):
        pass  # no response to notifications
    elif id_ is not None:
        error(id_, -32601, f"unknown method: {method}")

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            handle(json.loads(line))
        except json.JSONDecodeError:
            continue

if __name__ == "__main__":
    main()
