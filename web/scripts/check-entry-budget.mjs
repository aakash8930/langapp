import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(webRoot, 'dist');
const html = await readFile(path.join(distRoot, 'index.html'), 'utf8');
const assetPattern = /(?:src|href)="\.\/(assets\/[^"]+\.(?:js|css))"/g;
const assets = [...new Set([...html.matchAll(assetPattern)].map((match) => match[1]))];

const bytes = { js: 0, css: 0 };
let gzipBytes = 0;
for (const asset of assets) {
  const extension = path.extname(asset).slice(1);
  const file = path.join(distRoot, asset);
  const contents = await readFile(file);
  bytes[extension] += (await stat(file)).size;
  gzipBytes += gzipSync(contents).byteLength;
}

const limits = {
  js: 450 * 1024,
  css: 80 * 1024,
  gzip: 160 * 1024,
};

const eagerFeaturePattern = /(admin|courses|dashboard|practice|review|reading|speaking|writing|signup|signin|verify-email|onboarding)-/;
const eagerFeatures = assets.filter((asset) => eagerFeaturePattern.test(path.basename(asset)));
const failures = [];
if (bytes.js > limits.js) failures.push(`entry JavaScript is ${bytes.js} bytes (limit ${limits.js})`);
if (bytes.css > limits.css) failures.push(`entry CSS is ${bytes.css} bytes (limit ${limits.css})`);
if (gzipBytes > limits.gzip) failures.push(`entry assets gzip to ${gzipBytes} bytes (limit ${limits.gzip})`);
if (eagerFeatures.length) failures.push(`feature chunks are eager: ${eagerFeatures.join(', ')}`);

console.log(
  `Entry budget: ${(bytes.js / 1024).toFixed(1)} KiB JS, ` +
    `${(bytes.css / 1024).toFixed(1)} KiB CSS, ${(gzipBytes / 1024).toFixed(1)} KiB gzip`,
);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
