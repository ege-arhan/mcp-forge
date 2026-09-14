#!/usr/bin/env node
// forge — 1 komutla MCP server kurucu. Stdlib only (fs/path).
// Kullanim: node cli/forge.js create <proje-adi> [--template python|ts] [--dir .]
const fs = require("fs");
const path = require("path");

const TEMPLATES = ["python", "ts"];

function usage() {
  console.log(`kullanim:
  forge create <proje-adi> [--template python|ts] [--dir <hedef-klasor>]

ornek:
  forge create benim-server --template python`);
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

function main() {
  const [cmd, name, ...rest] = process.argv.slice(2);
  if (cmd !== "create" || !name) { usage(); process.exit(cmd ? 1 : 0); }

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

main();
