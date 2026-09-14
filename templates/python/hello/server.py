#!/usr/bin/env python3
"""Minimal MCP stdio server — stdlib only, no dependencies.

Speaks newline-delimited JSON-RPC 2.0 over stdio (MCP stdio transport).
Supports: initialize, notifications/*, ping, tools/list, tools/call hello_world.
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


HELLO_TOOL = {
    "name": "hello_world",
    "description": "Returns a greeting. Optional 'name' argument.",
    "inputSchema": {
        "type": "object",
        "properties": {"name": {"type": "string", "description": "Who to greet"}},
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
        reply(id_, {"tools": [HELLO_TOOL]})
    elif method == "tools/call":
        if params.get("name") == "hello_world":
            args = params.get("arguments", {}) or {}
            name = args.get("name", "world")
            reply(id_, {"content": [{"type": "text", "text": f"Hello, {name}!"}]})
        else:
            error(id_, -32602, f"unknown tool: {params.get('name')}")
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
