<div align="center">

# ⚡ mcp-forge

**Zero-overhead, production-grade MCP server scaffolding and validation engine.**  
*Ship compliant Model Context Protocol servers in 60 seconds with native Python & TypeScript runtimes.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](https://www.python.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-orange.svg)](https://modelcontextprotocol.io/)
[![CI](https://img.shields.io/badge/tests-35%20passed-success.svg)](tests/)

---

[Quickstart](#-quickstart-in-60s) •
[Features](#-core-features) •
[CLI Commands](#-cli-reference) •
[Claude Desktop Setup](#-claude-desktop-integration) •
[Architecture](#-architecture) •
[Examples](#-production-examples)

</div>

---

## 🚀 Quickstart in 60s

```bash
# Install globally or run directly via node
npm install -g mcp-forge

# 1. Create a modern Python or TypeScript MCP server
forge create my-mcp-server --template python
cd my-mcp-server

# 2. Add custom capabilities instantly
forge add tool summarize
forge add resource memory_store
forge add prompt system_eval

# 3. Verify protocol compliance via automated stdio handshake
forge verify
```

### ⚡ Direct Test via JSON-RPC Stdio Handshake

```bash
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"hello_world","arguments":{"name":"Ege"}}}' \
 | python3 server.py
```

Output:
```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{},"resources":{},"prompts":{}},"serverInfo":{"name":"hello-forge","version":"0.1.0"}}}
{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"hello_world","description":"Selamla veya basit mesaj dondur","inputSchema":{"type":"object","properties":{"name":{"type":"string"}},"required":[]}}]}}
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Hello, Ege!"}]}}
```

---

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| **Zero External Deps** | Pure stdlib implementation. No bloated runtime, instant startup (<5ms). |
| **Bilingual Runtime** | Full native support for **Python 3.10+** and **TypeScript** (Node.js >= 22.18 type stripping). |
| **Full MCP Spec** | Implements `tools/*`, `resources/*`, `prompts/*`, and protocol ping/error handling. |
| **Automated Verification** | Built-in `forge verify` executes full JSON-RPC 2.0 handshake suites against stdio. |
| **Docker Ready** | Production-ready lightweight Dockerfile and Docker Compose included out of the box. |
| **Inspector Compatible** | Seamless compatibility with official `@modelcontextprotocol/inspector`. |

---

## 🛠️ CLI Reference

### Project Generation
```bash
forge create <project-name> [--template python|ts] [--dir <target-dir>]
```

### Component Injection
Add components into your active server codebase with deterministic AST/anchor insertion:
```bash
# Add a new callable tool
forge add tool <tool-name>

# Add a readable resource URI (forge://<resource-name>)
forge add resource <resource-name>

# Add a reusable agent prompt template
forge add prompt <prompt-name>
```

### Protocol Compliance Suite
```bash
forge verify [--dir <project-dir>]
```
Verifies:
- `initialize` & `notifications/initialized` handshake
- Tool discovery (`tools/list`) and invocation (`tools/call`)
- Resource lookup (`resources/list`) and content retrieval (`resources/read`)
- Prompt templating (`prompts/list` & `prompts/get`)
- Error specification adherence (`-32601 Method not found`, `-32602 Invalid params`)

---

## 🔌 Claude Desktop Integration

Add your generated server directly to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-forge-server": {
      "command": "python3",
      "args": ["/absolute/path/to/my-mcp-server/server.py"]
    }
  }
}
```

Restart Claude Desktop, and your tools/resources are immediately available in chat!

---

## 📦 Production Examples

- **[`examples/calculator`](examples/calculator)**: Production math engine demonstrating multi-method tool routing (`topla`, `carp`) with robust parameter validation.
- **[`examples/notes`](examples/notes)**: Hybrid pattern showcasing stateful tool mutations (`not_ekle`) paired with real-time resource observation (`forge://notlar`).

---

## 🧪 Testing & Quality Guarantee

Strict regression lock with stdlib-only checks:
```bash
npm test
```
Runs:
1. TypeScript & JavaScript syntax validation (`node --check`)
2. Python bytecode compilation (`python3 -m py_compile`)
3. Full integration test suite with 35 assertion checkpoints (`python3 -m unittest discover -s tests`)

---

<div align="center">
Built with precision for autonomous agents and developer tooling.
</div>
