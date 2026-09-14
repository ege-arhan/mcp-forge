// Minimal MCP stdio server — zero deps (node builtins only).
// Newline-delimited JSON-RPC 2.0 over stdio. Run: npx tsx server.ts
// New tools: `forge add tool <name>` inserts a handler + registry entry
// at the forge: anchors below. Never delete the anchor lines.
import * as readline from "node:readline";

function reply(id: unknown, result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function err(id: unknown, code: number, message: string) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
  );
}

type ToolSpec = {
  description: string;
  inputSchema: unknown;
  handler: (args: any) => unknown[];
};

// forge:handlers anchor - new tool handlers go above this line
function helloWorld(args: any): unknown[] {
  const name = args?.name ?? "world";
  return [{ type: "text", text: `Hello, ${name}!` }];
}

const TOOLS: Record<string, ToolSpec> = {
  // forge:tools anchor - new tool entries go above this line
  hello_world: {
    description: "Returns a greeting. Optional 'name' argument.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Who to greet" } },
    },
    handler: helloWorld,
  },
};

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
    reply(id, {
      tools: Object.entries(TOOLS).map(([name, spec]) => ({
        name,
        description: spec.description,
        inputSchema: spec.inputSchema,
      })),
    });
  } else if (method === "tools/call") {
    const spec = TOOLS[params.name];
    if (!spec) {
      err(id, -32602, `unknown tool: ${params.name}`);
    } else {
      try {
        reply(id, { content: spec.handler(params.arguments ?? {}) });
      } catch (e) {
        err(id, -32603, `tool failed: ${e}`);
      }
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
