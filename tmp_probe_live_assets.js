const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

(async () => {
  const page = await get('http://localhost:3001/studio');
  console.log('studio', page.status);

  const assetRegex = /(href|src)=\"([^\"]*\/_next\/static\/[^"]+)\"/g;
  const assets = [];
  let m;
  while ((m = assetRegex.exec(page.body)) !== null) {
    assets.push(m[2]);
  }

  const uniqueAssets = [...new Set(assets)];
  console.log('asset_count', uniqueAssets.length);

  for (const asset of uniqueAssets) {
    const res = await get(`http://localhost:3001${asset}`);
    console.log(res.status, asset, (res.headers['content-type'] || '').split(';')[0]);
  }
})();
