# mcp-forge

1 komutla MCP server kurucu. Python/TS şablonlar, Docker, inspector doğrulamalı.

## Hızlı demo (60 sn)

```bash
git clone https://github.com/ege-arhan/mcp-forge.git
cd mcp-forge
node cli/forge.js create demo --template python
cd demo
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"hello_world","arguments":{"name":"Ege"}}}' \
 | python3 server.py
```

Beklenen çıktı: `serverInfo.name = hello-forge`, `tools/list` içinde `hello_world`, call sonucu `Hello, Ege!`.

## Gerçek kullanım örneği

Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hello-forge": {
      "command": "python3",
      "args": ["/tam/yol/demo/server.py"]
    }
  }
}
```

Claude'u yeniden başlat → `hello_world` tool'u belirir → "Ege'ye selam ver" de, `{"name":"Ege"}` ile çağrılır.

Docker:

```bash
docker build -t hello-forge .
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | docker run -i hello-forge
```

TS şablon:

```bash
node cli/forge.js create demo-ts --template ts
cd demo-ts && npm install && npm start
```

mcp-inspector ile doğrulama: `npx @modelcontextprotocol/inspector python3 server.py` (stdio modu).
