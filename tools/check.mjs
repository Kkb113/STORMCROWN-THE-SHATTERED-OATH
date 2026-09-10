/** Packaging checks added for the recovered source archive.
 * These checks do not constitute a campaign or gameplay regression suite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = data => createHash('sha256').update(data).digest('hex');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : entry.isFile() ? [filename] : [];
  });
}
function requireFile(filename) {
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) throw new Error(`Missing file: ${filename}`);
}

export function auditSnapshot(root = projectRoot) {
  const entry = path.join(root, 'src/main.js');
  const visited = new Set();
  const pending = [entry];
  while (pending.length) {
    const filename = pending.pop();
    if (visited.has(filename)) continue;
    requireFile(filename);
    visited.add(filename);
    const source = fs.readFileSync(filename, 'utf8');
    const imports = source.matchAll(/(?:^\s*(?:import|export)\s+(?:[^;]*?\s+from\s*)?|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm);
    for (const match of imports) {
      const spec = match[1];
      let target;
      if (spec === 'three') target = path.join(root, 'vendor/three.module.js');
      else if (spec.startsWith('three/addons/')) target = path.join(root, 'vendor/addons', spec.slice(13));
      else if (spec.startsWith('.')) target = path.resolve(path.dirname(filename), spec);
      else if (spec.startsWith('node:')) continue;
      else throw new Error(`Unresolved module ${spec} in ${filename}`);
      if (!target.startsWith(root + path.sep)) throw new Error(`Import outside project: ${target}`);
      pending.push(target);
    }
  }
  const originals = JSON.parse(fs.readFileSync(path.join(root, 'docs/recovery/original-sandbox-files.json'), 'utf8'));
  let unchangedRecoveredFiles = 0;
  const modifiedRecoveredFiles = [];
  // The recovery manifest is historical provenance, not a freeze on development.
  for (const item of originals) {
    const filename = path.join(root, item.path);
    requireFile(filename);
    if (hash(fs.readFileSync(filename)) === item.sha256) unchangedRecoveredFiles++;
    else modifiedRecoveredFiles.push(item.path);
  }
  const assets = JSON.parse(fs.readFileSync(path.join(root, 'assets/provenance.json'), 'utf8'));
  for (const item of assets) {
    const filename = path.join(root, item.path);
    requireFile(filename);
    if (hash(fs.readFileSync(filename)) !== item.sha256) throw new Error(`Asset checksum mismatch: ${item.path}`);
  }
  for (const relative of ['index.html', 'src/styles.css', 'assets/ui/crown.svg', 'vendor/THREE-LICENSE.txt']) {
    requireFile(path.join(root, relative));
  }
  const scripts = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'tools'))].filter(f => /\.(?:mjs|js)$/.test(f));
  for (const filename of scripts) {
    const result = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Syntax check failed: ${filename}\n${result.stderr || result.error}`);
  }
  return {
    status: 'passed',
    recoveryFilesPresent: originals.length,
    unchangedRecoveredFiles,
    modifiedRecoveredFiles,
    verifiedPBRAssets: assets.length,
    reachableBrowserModules: visited.size,
    syntaxCheckedScripts: scripts.length,
    scope: 'File recovery, runtime import resolution, asset checksums, and JavaScript syntax only; not full gameplay verification.'
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(auditSnapshot(), null, 2)); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}
