#!/usr/bin/env node
// forge — 1 komutla MCP server kurucu. Stdlib only (fs/path/child_process).
// Kullanim:
//   forge create <proje-adi> [--template python|ts] [--dir <hedef-klasor>]
//   forge add tool <arac-adi> [--dir <proje-klasoru>]
//   forge add resource <kaynak-adi> [--dir <proje-klasoru>]
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const TEMPLATES = ["python", "ts"];
const TOOL_RE = /^[a-z][a-z0-9_]*$/;

function usage() {
  console.log(`kullanim:
  forge create <proje-adi> [--template python|ts] [--dir <hedef-klasor>]
  forge add tool <arac-adi> [--dir <proje-klasoru>]
  forge add resource <kaynak-adi> [--dir <proje-klasoru>]
  forge add prompt <prompt-adi> [--dir <proje-klasoru>]
  forge verify [--dir <proje-klasoru>]
  forge --version | --help

ornek:
  forge create benim-server --template python
  cd benim-server && forge add tool ozet && forge add resource notlar
  forge verify   # stdio handshake: initialize/tools/resources/prompts (inspector esdegeri)`);
}

const SKIP = new Set(["__pycache__", "node_modules", ".git"]);
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function toCamel(snake) {
  const parts = snake.split("_").filter(Boolean);
  return parts.map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1))).join("");
}

// block'u anchor satirinin onune ekler; anchor'in kendi girintisi ilk
// satira otomatik eklenir, block'un geri kalan satirlari mutlak girintili
// yazilir. anchor yerinde kaldigi icin 2./3. add de calisir.
function spliceBeforeAnchor(src, anchor, block) {
  const i = src.indexOf(anchor);
  if (i < 0) return src;
  const lineStart = src.lastIndexOf("\n", i) + 1;
  const indent = src.slice(lineStart, i);
  return src.slice(0, i) + block + "\n" + indent + src.slice(i);
}

function addPythonTool(serverFile, name) {
  let src = fs.readFileSync(serverFile, "utf8");
  if (src.includes(`def _${name}(`) || src.includes(`"handler": _${name},`)) {
    console.error(`hata: '${name}' zaten kayitli`);
    process.exit(1);
  }
  const hAnchor = "# forge:handlers anchor - new tool handlers go above this line";
  const tAnchor = '# forge:tools anchor - new tool entries go above this line';
  if (!src.includes(hAnchor) || !src.includes(tAnchor)) {
    console.error("hata: forge anchor satirlari bulunamadi (server.py guncel mi?)");
    process.exit(1);
  }
  const handler = [
    `def _${name}(args):`,
    `    text = (args or {}).get("input", "")`,
    `    return [{"type": "text", "text": f"${name}: {text}"}]`,
    ``,
    ``,
  ].join("\n");
  const entry = [
    `"${name}": {`,
    `        "description": "TODO: describe ${name}.",`,
    `        "inputSchema": {"type": "object",`,
    `                        "properties": {"input": {"type": "string"}}},`,
    `        "handler": _${name},`,
    `    },`,
  ].join("\n");
  src = spliceBeforeAnchor(src, hAnchor, handler);
  src = spliceBeforeAnchor(src, tAnchor, entry);
  fs.writeFileSync(serverFile, src);
}

function addTsTool(serverFile, name) {
  let src = fs.readFileSync(serverFile, "utf8");
  const fn = toCamel(name);
  if (src.includes(`function ${fn}(`) || src.includes(`handler: ${fn},`)) {
    console.error(`hata: '${name}' zaten kayitli`);
    process.exit(1);
  }
  const hAnchor = "// forge:handlers anchor - new tool handlers go above this line";
  const tAnchor = "// forge:tools anchor - new tool entries go above this line";
  if (!src.includes(hAnchor) || !src.includes(tAnchor)) {
    console.error("hata: forge anchor satirlari bulunamadi (server.ts guncel mi?)");
    process.exit(1);
  }
  const handler = [
    `function ${fn}(args: any): unknown[] {`,
    `  const input = args?.input ?? "";`,
    `  return [{ type: "text", text: \`${name}: \${input}\` }];`,
    `}`,
    ``,
  ].join("\n");
  const entry = [
    `${name}: {`,
    `    description: "TODO: describe ${name}.",`,
    `    inputSchema: { type: "object", properties: { input: { type: "string" } } },`,
    `    handler: ${fn},`,
    `  },`,
  ].join("\n");
  src = spliceBeforeAnchor(src, hAnchor, handler);
  src = spliceBeforeAnchor(src, tAnchor, entry);
  fs.writeFileSync(serverFile, src);
}

function addPythonResource(serverFile, name) {
  let src = fs.readFileSync(serverFile, "utf8");
  const uri = `forge://${name}`;
  if (src.includes(`"${uri}"`)) {
    console.error(`hata: '${name}' zaten kayitli`);
    process.exit(1);
  }
  const hAnchor = "# forge:resource-readers anchor - new resource readers go above this line";
  const tAnchor = "# forge:resources anchor - new resource entries go above this line";
  if (!src.includes(hAnchor) || !src.includes(tAnchor)) {
    console.error("hata: forge resource anchor satirlari bulunamadi (server.py guncel mi?)");
    process.exit(1);
  }
  const reader = [
    `def _${name}_resource():`,
    `    return f"TODO: ${name} icerigi."`,
    ``,
    ``,
  ].join("\n");
  const entry = [
    `"${uri}": {`,
    `        "name": "${name}",`,
    `        "mimeType": "text/plain",`,
    `        "reader": _${name}_resource,`,
    `    },`,
  ].join("\n");
  src = spliceBeforeAnchor(src, hAnchor, reader);
  src = spliceBeforeAnchor(src, tAnchor, entry);
  fs.writeFileSync(serverFile, src);
}

function addTsResource(serverFile, name) {
  let src = fs.readFileSync(serverFile, "utf8");
  const uri = `forge://${name}`;
  if (src.includes(`"${uri}"`)) {
    console.error(`hata: '${name}' zaten kayitli`);
    process.exit(1);
  }
  const hAnchor = "// forge:resource-readers anchor - new resource readers go above this line";
  const tAnchor = "// forge:resources anchor - new resource entries go above this line";
  if (!src.includes(hAnchor) || !src.includes(tAnchor)) {
    console.error("hata: forge resource anchor satirlari bulunamadi (server.ts guncel mi?)");
    process.exit(1);
  }
  const fn = toCamel(name) + "Resource";
  const reader = [
    `function ${fn}(): string {`,
    `  return "TODO: ${name} icerigi.";`,
    `}`,
    ``,
  ].join("\n");
  const entry = [
    `"${uri}": {`,
    `    name: "${name}",`,
    `    mimeType: "text/plain",`,
    `    reader: ${fn},`,
    `  },`,
  ].join("\n");
  src = spliceBeforeAnchor(src, hAnchor, reader);
  src = spliceBeforeAnchor(src, tAnchor, entry);
  fs.writeFileSync(serverFile, src);
}

function addPythonPrompt(serverFile, name) {
  let src = fs.readFileSync(serverFile, "utf8");
  if (src.includes(`def _${name}_prompt(`) || src.includes(`"builder": _${name}_prompt,`)) {
    console.error(`hata: '${name}' zaten kayitli`);
    process.exit(1);
  }
  const hAnchor = "# forge:prompt-builders anchor - new prompt builders go above this line";
  const tAnchor = "# forge:prompts anchor - new prompt entries go above this line";
  if (!src.includes(hAnchor) || !src.includes(tAnchor)) {
    console.error("hata: forge prompt anchor satirlari bulunamadi (server.py guncel mi?)");
    process.exit(1);
  }
  const builder = [
    `def _${name}_prompt(args):`,
    `    text = (args or {}).get("input", "")`,
    `    return [{"role": "user",`,
    `             "content": {"type": "text",`,
    `                         "text": f"${name}: {text}"}}]`,
    ``,
    ``,
  ].join("\n");
  const entry = [
    `"${name}": {`,
    `        "description": "TODO: describe ${name}.",`,
    `        "args": [{"name": "input", "required": False}],`,
    `        "builder": _${name}_prompt,`,
    `    },`,
  ].join("\n");
  src = spliceBeforeAnchor(src, hAnchor, builder);
  src = spliceBeforeAnchor(src, tAnchor, entry);
  fs.writeFileSync(serverFile, src);
}

function addTsPrompt(serverFile, name) {
  let src = fs.readFileSync(serverFile, "utf8");
  const fn = toCamel(name) + "Prompt";
  if (src.includes(`function ${fn}(`) || src.includes(`builder: ${fn},`)) {
    console.error(`hata: '${name}' zaten kayitli`);
    process.exit(1);
  }
  const hAnchor = "// forge:prompt-builders anchor - new prompt builders go above this line";
  const tAnchor = "// forge:prompts anchor - new prompt entries go above this line";
  if (!src.includes(hAnchor) || !src.includes(tAnchor)) {
    console.error("hata: forge prompt anchor satirlari bulunamadi (server.ts guncel mi?)");
    process.exit(1);
  }
  const builder = [
    `function ${fn}(args: any): unknown[] {`,
    `  const input = args?.input ?? "";`,
    `  return [{ role: "user", content: { type: "text", text: \`${name}: \${input}\` } }];`,
    `}`,
    ``,
  ].join("\n");
  const entry = [
    `${name}: {`,
    `    description: "TODO: describe ${name}.",`,
    `    args: [{ name: "input", required: false }],`,
    `    builder: ${fn},`,
    `  },`,
  ].join("\n");
  src = spliceBeforeAnchor(src, hAnchor, builder);
  src = spliceBeforeAnchor(src, tAnchor, entry);
  fs.writeFileSync(serverFile, src);
}

function cmdCreate(name, rest) {
  if (!name) {
    console.error("hata: proje adi gerekli (ornek: forge create demo)");
    process.exit(1);
  }
  let template = "python", dir = ".";
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--template") template = rest[++i];
    else if (rest[i] === "--dir") dir = rest[++i];
    else { console.error(`bilinmeyen arg: ${rest[i]}`); process.exit(1); }
  }
  if (!TEMPLATES.includes(template)) {
    console.error(`template '${template}' yok. secenek: ${TEMPLATES.join(", ")}`);
    process.exit(1);
  }
  const src = path.join(__dirname, "..", "templates", template, "hello");
  const dest = path.resolve(dir, name);
  if (fs.existsSync(dest)) { console.error(`hata: ${dest} zaten var`); process.exit(1); }
  copyDir(src, dest);
  console.log(`olustu: ${dest} (template: ${template})`);
  console.log(`calistir: ${template === "python" ? `cd ${name} && python3 server.py` : `cd ${name} && node server.ts`}`);
}

function cmdAdd(rest) {
  const [kind, name, ...tail] = rest;
  if ((kind !== "tool" && kind !== "resource" && kind !== "prompt") || !name) { usage(); process.exit(1); }
  if (!TOOL_RE.test(name)) {
    console.error("hata: ad kucuk harfle baslayip [a-z0-9_] icermeli");
    process.exit(1);
  }
  let dir = ".";
  for (let i = 0; i < tail.length; i++) {
    if (tail[i] === "--dir") dir = tail[++i];
    else { console.error(`bilinmeyen arg: ${tail[i]}`); process.exit(1); }
  }
  const projectDir = path.resolve(dir);
  const py = path.join(projectDir, "server.py");
  const ts = path.join(projectDir, "server.ts");
  if (fs.existsSync(py)) {
    if (kind === "tool") addPythonTool(py, name);
    else if (kind === "resource") addPythonResource(py, name);
    else addPythonPrompt(py, name);
  } else if (fs.existsSync(ts)) {
    if (kind === "tool") addTsTool(ts, name);
    else if (kind === "resource") addTsResource(ts, name);
    else addTsPrompt(ts, name);
  } else {
    console.error(`hata: ${projectDir} icinde server.py/server.ts yok (--dir yanlis?)`);
    process.exit(1);
  }
  console.log(`eklendi: ${name} -> ${projectDir}`);
}

function stdioHandshake(serverCmd, serverArgs) {
  // inspector esdegeri: initialize -> notifications/initialized ->
  // tools/list -> tools/call(hello_world) -> resources/list ->
  // resources/read(forge://readme). Kotu cikti = exit 1.
  const req = (id, method, params) => {
    const m = { jsonrpc: "2.0", id, method };
    if (params !== undefined) m.params = params;
    return JSON.stringify(m);
  };
  const lines = [
    req(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "forge-verify", version: "0" } }),
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    req(2, "tools/list"),
    req(3, "tools/call", { name: "hello_world", arguments: { name: "Forge" } }),
    req(4, "resources/list"),
    req(5, "resources/read", { uri: "forge://readme" }),
    req(6, "prompts/list"),
    req(7, "prompts/get", { name: "greet", arguments: { name: "Forge" } }),
    req(8, "ping"),
    req(9, "no/such_method"),
    req(10, "tools/call", { name: "no_such_tool", arguments: {} }),
    req(11, "resources/read", { uri: "forge://yok" }),
    req(12, "prompts/get", { name: "no_such_prompt" }),
  ].join("\n") + "\n";
  const r = spawnSync(serverCmd, serverArgs, { input: lines, encoding: "utf8", timeout: 30000 });
  if (r.error || r.status !== 0) {
    console.error(`hata: sunucu calismadi (${serverCmd}): ${r.error ? r.error.message : r.stderr}`);
    process.exit(1);
  }
  const byId = {};
  for (const line of String(r.stdout).split("\n")) {
    if (!line.trim()) continue;
    try { const m = JSON.parse(line); if (m.id !== undefined) byId[m.id] = m; } catch { /* skip */ }
  }
  const checks = [
    ["initialize", byId[1] && byId[1].result && byId[1].result.serverInfo && byId[1].result.serverInfo.name === "hello-forge"],
    ["tools/list has hello_world", byId[2] && byId[2].result && (byId[2].result.tools || []).some((t) => t.name === "hello_world")],
    ["tools/call hello_world", byId[3] && byId[3].result && String(((byId[3].result.content || [])[0] || {}).text || "").includes("Hello, Forge!")],
    ["resources/list has forge://readme", byId[4] && byId[4].result && (byId[4].result.resources || []).some((t) => t.uri === "forge://readme")],
    ["resources/read forge://readme", byId[5] && byId[5].result && String((((byId[5].result.contents || [])[0] || {}).text) || "").includes("hello-forge")],
    ["prompts/list has greet", byId[6] && byId[6].result && (byId[6].result.prompts || []).some((t) => t.name === "greet")],
    ["prompts/get greet", byId[7] && byId[7].result && String((((byId[7].result.messages || [])[0] || {}).content || {}).text || "").includes("Forge")],
    ["ping ok", byId[8] && byId[8].result && !byId[8].error],
    ["unknown method -32601", byId[9] && byId[9].error && byId[9].error.code === -32601],
    ["unknown tool -32602", byId[10] && byId[10].error && byId[10].error.code === -32602],
    ["unknown resource -32602", byId[11] && byId[11].error && byId[11].error.code === -32602],
    ["unknown prompt -32602", byId[12] && byId[12].error && byId[12].error.code === -32602],
  ];
  let fail = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "ok" : "FAIL"} - ${name}`);
    if (!ok) fail++;
  }
  if (fail) { console.error(`${fail} kontrol basarisiz`); process.exit(1); }
  console.log("verify: tum kontroller gecti (inspector ile de acabilirsin: npx @modelcontextprotocol/inspector python3 server.py)");
}

function cmdVerify(rest) {
  let dir = ".";
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--dir") dir = rest[++i];
    else { console.error(`bilinmeyen arg: ${rest[i]}`); process.exit(1); }
  }
  const projectDir = path.resolve(dir);
  const py = path.join(projectDir, "server.py");
  const ts = path.join(projectDir, "server.ts");
  if (fs.existsSync(py)) return stdioHandshake("python3", [py]);
  if (fs.existsSync(ts)) {
    // Node >=22.18 TS'i native calistirir (type stripping) — bagimlilik yok
    return stdioHandshake("node", [ts]);
  }
  console.error(`hata: ${projectDir} icinde server.py/server.ts yok`);
  process.exit(1);
}

function cmdVersion() {
  let version = "0.0.0";
  try {
    version = require("../package.json").version || version;
  } catch { /* fallback */ }
  console.log(`forge v${version}`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-V") return cmdVersion();
  if (cmd === "--help" || cmd === "-h" || cmd === "help") return usage();
  if (cmd === "create") return cmdCreate(rest[0], rest.slice(1));
  if (cmd === "add") return cmdAdd(rest);
  if (cmd === "verify") return cmdVerify(rest);
  usage();
  process.exit(cmd ? 1 : 0);
}

main();
