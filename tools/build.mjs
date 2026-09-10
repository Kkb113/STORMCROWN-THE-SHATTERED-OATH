import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'dist');
for (const name of ['index.html', 'src', 'assets', 'vendor/three.module.js', 'vendor/three.core.js']) {
  if (!existsSync(path.join(root, name))) throw new Error(`Missing runtime file: ${name}. Restore tracked assets before building.`);
}
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const name of ['index.html', 'src', 'assets', 'vendor']) await cp(path.join(root, name), path.join(target, name), { recursive: true });
await writeFile(path.join(target, '.nojekyll'), '');
await writeFile(path.join(target, 'build.json'), JSON.stringify({ name: 'STORMCROWN', version: JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version, revision: process.env.GITHUB_SHA || 'local', built: new Date().toISOString() }, null, 2));
console.log('Built self-contained static game in dist/. All runtime dependencies are local.');
