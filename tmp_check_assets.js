const fs = require('fs');
const http = require('http');

const html = fs.readFileSync('studio_page.html', 'utf8');
const assetRegex = /(href|src)=\"([^\"]*\/_next\/static\/[^"]+)\"/g;
const assets = [];
let match;
while ((match = assetRegex.exec(html)) !== null) {
  assets.push(match[2]);
}

const unique = [...new Set(assets)].slice(0, 8);
console.log('assets', unique.length);

let pending = unique.length;
if (!pending) process.exit(0);

for (const asset of unique) {
  const url = `http://localhost:3001${asset}`;
  http.get(url, (res) => {
    res.resume();
    console.log(res.statusCode, asset);
    pending -= 1;
    if (pending === 0) process.exit(0);
  }).on('error', (error) => {
    console.log('ERR', asset, error.message);
    pending -= 1;
    if (pending === 0) process.exit(0);
  });
}
