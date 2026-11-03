// Rewrites the PRECACHE list in sw.js from the files on disk.
// Run after adding or removing app files: npm run precache
import { readFileSync, writeFileSync } from 'node:fs';
import { appFiles } from './app-files.mjs';

const sw = readFileSync('sw.js', 'utf8');
const files = appFiles();
const list = ['./', ...files].map((f) => `  '${f}',`).join('\n');
writeFileSync('sw.js', sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n${list}\n];`));
console.log(`sw.js precaches ${files.length + 1} entries`);
