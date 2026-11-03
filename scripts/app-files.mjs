// The files that make up the app: everything the service worker must precache
// and everything GitHub Pages publishes. design/, docs/, tests/ and scripts/ are not app files.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const APP_DIRS = ['css', 'js', 'assets', 'icons'];
export const APP_ROOT_FILES = ['index.html', 'manifest.webmanifest'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    .filter((f) => !f.endsWith('.DS_Store') && !f.endsWith('.gitkeep'));
}

export function appFiles(root = '.') {
  const rel = (f) => (root === '.' ? f : f.slice(root.length + 1)).split('\\').join('/');
  return [...APP_ROOT_FILES, ...APP_DIRS.flatMap((d) => walk(join(root, d)).map(rel))].sort();
}
