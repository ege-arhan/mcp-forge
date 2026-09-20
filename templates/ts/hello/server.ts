// Minimal MCP stdio server — zero deps (node builtins only).
// Newline-delimited JSON-RPC 2.0 over stdio. Run: node server.ts (Node >=22.18)
// New tools: `forge add tool <name>` inserts a handler + registry entry
// at the forge: anchors below. New resources: `forge add resource <name>`
// inserts a reader + registry entry at the forge:resource anchors below.
// New prompts: `forge add prompt <name>` inserts a builder + registry
// entry at the forge:prompt anchors below.
// Never delete the anchor lines.
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

type ResourceSpec = {
  name: string;
  mimeType: string;
  reader: () => string;
};

type PromptSpec = {
  description: string;
  args: { name: string; required: boolean }[];
  builder: (args: any) => unknown[];
};


// forge:handlers anchor - new tool handlers go above this line
function helloWorld(args: any): unknown[] {
  const name = args?.name ?? "world";
  return [{ type: "text", text: `Hello, ${name}!` }];
}

// forge:resource-readers anchor - new resource readers go above this line
function readmeResource(): string {
  return "hello-forge v0.1.0 - `forge add resource <name>` ile yeni kaynak ekle.";
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

const RESOURCES: Record<string, ResourceSpec> = {
  // forge:resources anchor - new resource entries go above this line
  "forge://readme": {
    name: "readme",
    mimeType: "text/plain",
    reader: readmeResource,
  },
};

// forge:prompt-builders anchor - new prompt builders go above this line
function greetPrompt(args: any): unknown[] {
  const name = args?.name ?? "world";
  return [{ role: "user", content: { type: "text", text: `Greet ${name} warmly in one sentence.` } }];
}

const PROMPTS: Record<string, PromptSpec> = {
  // forge:prompts anchor - new prompt entries go above this line
  greet: {
    description: "Warm greeting prompt. Optional 'name' argument.",
    args: [{ name: "name", required: false }],
    builder: greetPrompt,
  },
};

function handle(msg: any) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return;
  const method: string = msg.method;
  const id = msg.id;
  const params = msg.params ?? {};
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    if (id !== undefined) err(id, -32602, "invalid params");
    return;
  }

  if (method === "initialize") {
    reply(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {}, resources: {}, prompts: {} },
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
  } else if (method === "resources/list") {
    reply(id, {
      resources: Object.entries(RESOURCES).map(([uri, spec]) => ({
        uri,
        name: spec.name,
        mimeType: spec.mimeType,
      })),
    });
  } else if (method === "resources/read") {
    const spec = RESOURCES[params.uri];
    if (!spec) {
      err(id, -32602, `unknown resource: ${params.uri}`);
    } else {
      try {
        reply(id, {
          contents: [{ uri: params.uri, mimeType: spec.mimeType, text: spec.reader() }],
        });
      } catch (e) {
        err(id, -32603, `resource failed: ${e}`);
      }
    }
  } else if (method === "prompts/list") {
    reply(id, {
      prompts: Object.entries(PROMPTS).map(([name, spec]) => ({
        name,
        description: spec.description,
        args: spec.args,
      })),
    });
  } else if (method === "prompts/get") {
    const spec = PROMPTS[params.name];
    if (!spec) {
      err(id, -32602, `unknown prompt: ${params.name}`);
    } else {
      try {
        reply(id, { description: spec.description, messages: spec.builder(params.arguments ?? {}) });
      } catch (e) {
        err(id, -32603, `prompt failed: ${e}`);
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
