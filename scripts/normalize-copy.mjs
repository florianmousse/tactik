import fs from 'node:fs';
import path from 'node:path';
import { parsers } from 'prettier/plugins/typescript';
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) walk(p);
    else if (/\.(tsx?|md|json|css|mjs|yml)$/.test(p)) files.push(p);
  }
}
for (const dir of ['src', 'tests', 'docs', 'scripts']) walk(dir);
files.push('README.md', 'AGENTS.md');
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  if (/\.tsx?$/.test(file)) {
    const source = await parsers.typescript.parse(text, { filepath: file }),
      edits = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Literal' && typeof node.value === 'string') {
        const start = node.range[0],
          end = node.range[1],
          raw = text.slice(start, end);
        edits.push({
          start,
          end,
          value: raw.replaceAll('\u2019', raw[0] === "'" ? "\\'" : "'").replaceAll('\u2014', '-'),
        });
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'loc' || key === 'range') continue;
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    }
    visit(source);
    for (const edit of edits.sort((a, b) => b.start - a.start))
      text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
  }
  text = text.replaceAll('\u2019', "'").replaceAll('\u2014', '-');
  fs.writeFileSync(file, text);
}
