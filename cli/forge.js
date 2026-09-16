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
  forge verify [--dir <proje-klasoru>]

ornek:
  forge create benim-server --template python
  cd benim-server && forge add tool ozet && forge add resource notlar
  forge verify   # stdio handshake: initialize/tools/resources (inspector esdegeri)`);
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
  if (src.includes(`"${name}"`)) {
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
  if (src.includes(`${name}: {`) || src.includes(`"${name}"`)) {
    console.error(`hata: '${name}' zaten kayitli`);
    process.exit(1);
  }
  const hAnchor = "// forge:handlers anchor - new tool handlers go above this line";
  const tAnchor = "// forge:tools anchor - new tool entries go above this line";
  if (!src.includes(hAnchor) || !src.includes(tAnchor)) {
    console.error("hata: forge anchor satirlari bulunamadi (server.ts guncel mi?)");
    process.exit(1);
  }
  const fn = toCamel(name);
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

function cmdCreate(name, rest) {
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
  console.log(`calistir: ${template === "python" ? `cd ${name} && python3 server.py` : `cd ${name} && npm install && npm start`}`);
}

function cmdAdd(rest) {
  const [kind, name, ...tail] = rest;
  if ((kind !== "tool" && kind !== "resource") || !name) { usage(); process.exit(1); }
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
    else addPythonResource(py, name);
  } else if (fs.existsSync(ts)) {
    if (kind === "tool") addTsTool(ts, name);
    else addTsResource(ts, name);
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
    // ts calistirmak icin tsx gerekir; yoksa py esdegerini oner
    const r = spawnSync("npx", ["--yes", "tsx", ts, "--version"], { encoding: "utf8", timeout: 60000 });
    if (r.error || r.status !== 0) {
      console.error("hata: TS verify icin tsx gerekli (npm install -g tsx veya proje icinde npm install). Python sablonunda dogrudan calisir.");
      process.exit(1);
    }
    return stdioHandshake("npx", ["--yes", "tsx", ts]);
  }
  console.error(`hata: ${projectDir} icinde server.py/server.ts yok`);
  process.exit(1);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "create") return cmdCreate(rest[0], rest.slice(1));
  if (cmd === "add") return cmdAdd(rest);
  if (cmd === "verify") return cmdVerify(rest);
  usage();
  process.exit(cmd ? 1 : 0);
}

main();
