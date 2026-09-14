#!/usr/bin/env python3
"""Minimal MCP stdio server — stdlib only, no dependencies.

Speaks newline-delimited JSON-RPC 2.0 over stdio (MCP stdio transport).
Supports: initialize, notifications/*, ping, tools/list, tools/call.

New tools: `forge add tool <name>` inserts a handler + registry entry
at the forge: anchors below. Never delete the anchor lines.
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


# forge:handlers anchor - new tool handlers go above this line
def _hello_world(args):
    name = (args or {}).get("name", "world")
    return [{"type": "text", "text": f"Hello, {name}!"}]


TOOLS = {
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


def handle(msg):
    method = msg.get("method")
    id_ = msg.get("id")
    params = msg.get("params", {}) or {}

    if method == "initialize":
        reply(id_, {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
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
