#!/usr/bin/env python3
"""Minimal MCP stdio server — stdlib only, no dependencies.

Speaks newline-delimited JSON-RPC 2.0 over stdio (MCP stdio transport).
Supports: initialize, notifications/*, ping, tools/list, tools/call,
resources/list, resources/read, prompts/list, prompts/get.

New tools: `forge add tool <name>` inserts a handler + registry entry
at the forge: anchors below. New resources: `forge add resource <name>`
inserts a reader + registry entry at the forge:resource anchors below.
New prompts: `forge add prompt <name>` inserts a builder + registry
entry at the forge:prompt anchors below.
Never delete the anchor lines.
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


# forge:resource-readers anchor - new resource readers go above this line
def _readme_resource():
    return "hello-forge v0.1.0 - `forge add resource <name>` ile yeni kaynak ekle."


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


RESOURCES = {
    # forge:resources anchor - new resource entries go above this line
    "forge://readme": {
        "name": "readme",
        "mimeType": "text/plain",
        "reader": _readme_resource,
    },
}

# forge:prompt-builders anchor - new prompt builders go above this line
def _greet_prompt(args):
    name = (args or {}).get("name", "world")
    return [{"role": "user",
             "content": {"type": "text",
                         "text": f"Greet {name} warmly in one sentence."}}]

PROMPTS = {
    # forge:prompts anchor - new prompt entries go above this line
    "greet": {
        "description": "Warm greeting prompt. Optional 'name' argument.",
        "args": [{"name": "name", "required": False}],
        "builder": _greet_prompt,
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
            "capabilities": {"tools": {}, "resources": {}, "prompts": {}},
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
    elif method == "prompts/list":
        reply(id_, {"prompts": [
            {"name": name, "description": spec["description"],
             "args": spec["args"]}
            for name, spec in PROMPTS.items()
        ]})
    elif method == "prompts/get":
        spec = PROMPTS.get(params.get("name"))
        if spec is None:
            error(id_, -32602, f"unknown prompt: {params.get('name')}")
        else:
            try:
                reply(id_, {"description": spec["description"],
                             "messages": spec["builder"](params.get("arguments") or {})})
            except Exception as e:  # never crash the stdio loop on a prompt bug
                error(id_, -32603, f"prompt failed: {e}")
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
