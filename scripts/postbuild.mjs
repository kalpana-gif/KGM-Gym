import { readFile, writeFile, readdir } from 'node:fs/promises';
const assets=(await readdir('dist/assets')).map(name=>`/assets/${name}`);
const shell=['/','/index.html','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png',...assets];
const template=await readFile('public/sw.js','utf8');
const worker=template.replaceAll('__LANKAFIT_BUILD__',assets.join('').replace(/[^a-z0-9]/gi,'').slice(-100)).replaceAll('__LANKAFIT_ASSETS__',JSON.stringify(shell));
if (worker.includes('__LANKAFIT_')) throw new Error('Unresolved service-worker build token.');
await writeFile('dist/sw.js',worker);
