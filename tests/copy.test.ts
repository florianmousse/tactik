import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
test('textes du projet : apostrophe droite et tiret simple', () => {
  const files = ['README.md', 'AGENTS.md'];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(tsx?|md|css)$/.test(file)) files.push(file);
    }
  }
  walk('src');
  walk('docs');
  for (const file of files)
    assert.equal(/[\u2014\u2019]/.test(fs.readFileSync(file, 'utf8')), false, file);
});
