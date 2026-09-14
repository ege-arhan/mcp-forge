// Minimal MCP stdio server — zero deps (node builtins only).
// Newline-delimited JSON-RPC 2.0 over stdio. Run: npx tsx server.ts
import * as readline from "node:readline";

const HELLO_TOOL = {
  name: "hello_world",
  description: "Returns a greeting. Optional 'name' argument.",
  inputSchema: {
    type: "object",
    properties: { name: { type: "string", description: "Who to greet" } },
  },
};

function reply(id: unknown, result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function err(id: unknown, code: number, message: string) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
  );
}

function handle(msg: any) {
  const method: string = msg.method;
  const id = msg.id;
  const params = msg.params ?? {};

  if (method === "initialize") {
    reply(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "hello-forge", version: "0.1.0" },
    });
  } else if (method === "ping") {
    reply(id, {});
  } else if (method === "tools/list") {
    reply(id, { tools: [HELLO_TOOL] });
  } else if (method === "tools/call") {
    if (params.name === "hello_world") {
      const name = params.arguments?.name ?? "world";
      reply(id, { content: [{ type: "text", text: `Hello, ${name}!` }] });
    } else {
      err(id, -32602, `unknown tool: ${params.name}`);
    }
  } else if (method?.startsWith("notifications/")) {
    // no response
  } else if (id !== undefined) {
    err(id, -32601, `unknown method: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    handle(JSON.parse(line));
  } catch {
    // skip malformed lines
  }
});
