// Give a new app made from this template its own identity, in one go.
// Usage: npm run rename -- "Tide Times" tide-times
//   name : shown to people (title, home-screen label, manifest)
//   id   : lower-case-with-dashes; used for storage keys, cache names and backups.
//          Keep it the same for ever once people are using the app, or their data
//          won't be found.
import { readFileSync, writeFileSync } from 'node:fs';

const [name, id] = process.argv.slice(2);
if (!name || !id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run rename -- "App Name" app-id   (id: lower-case letters, numbers and dashes)');
  process.exit(1);
}
const shortName = name.length > 12 ? name.split(' ')[0] : name; // home-screen labels truncate around 12 chars

const cur = readFileSync('js/config.js', 'utf8');
const oldId = cur.match(/APP_ID = '([^']+)'/)[1];
const oldName = cur.match(/APP_NAME = '([^']+)'/)[1];
const js = (s) => s.replace(/'/g, "\\'");

const edit = (file, fn) => { writeFileSync(file, fn(readFileSync(file, 'utf8'))); console.log('updated', file); };

edit('js/config.js', (s) => s.replace(/APP_ID = '[^']+'/, `APP_ID = '${id}'`).replace(/APP_NAME = '[^']+'/, `APP_NAME = '${js(name)}'`));
edit('sw.js', (s) => s.replace(/const APP_ID = '[^']+'/, `const APP_ID = '${id}'`));
edit('manifest.webmanifest', (s) => {
  const m = JSON.parse(s);
  m.name = name;
  m.short_name = shortName;
  return JSON.stringify(m, null, 2) + '\n';
});
edit('index.html', (s) => s
  .replace(/<title>[^<]*<\/title>/, `<title>${name}</title>`)
  .replace(/(name="apple-mobile-web-app-title" content=")[^"]*"/, `$1${shortName}"`));
edit('package.json', (s) => {
  const p = JSON.parse(s);
  p.name = id;
  return JSON.stringify(p, null, 2) + '\n';
});
edit('README.md', (s) => s.split(oldName).join(name).split(oldId).join(id));
console.log(`\nNow "${name}" (${id}). Next: replace the icon art in assets/app/, then npm run icons && npm run precache.`);
