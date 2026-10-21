// オフライン用のファイル一覧（sw.js）に、アプリのファイルがすべて入っているか
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name).split(path.sep).join('/')],
  );
}

test('sw.js の FILES とアプリのファイルが一致する', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'((?:js|css|icons)\/[^']+)'/g)].map((m) => m[1]));
  const actual = ['js', 'css', 'icons'].flatMap(listFiles);
  assert.deepEqual([...listed].sort(), actual.sort());
});
