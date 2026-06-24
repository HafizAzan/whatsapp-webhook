import fs from "fs";
import path from "path";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function fix(content) {
  let out = content;
  out = out.replace(/\[var\((--[^)]+)\)\]/g, "($1)");
  out = out.replace(/!py-(\d+(?:\.\d+)?)/g, "py-$1!");
  out = out.replace(/!px-(\d+(?:\.\d+)?)/g, "px-$1!");
  out = out.replace(/!text-(\[[^\]]+\]|[^\s"']+)/g, "text-$1!");
  out = out.replace(/!w-auto/g, "w-auto!");
  out = out.replace(/flex-\[2\]/g, "flex-2");
  out = out.replace(/bg-gradient-to-br/g, "bg-linear-to-br");
  out = out.replace(/bg-gradient-to-r/g, "bg-linear-to-r");
  return out;
}

const root = path.join(process.cwd(), "src");
for (const file of walk(root)) {
  const raw = fs.readFileSync(file, "utf8");
  const next = fix(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next);
    console.log("fixed:", file);
  }
}
