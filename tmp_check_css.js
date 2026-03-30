const fs = require('fs');
const http = require('http');

const html = fs.readFileSync('studio_page.html', 'utf8');
const match = html.match(/href=\"([^\"]*app\/layout\.css\?v=[^\"]+)\"/);

if (!match) {
  console.log('no-link');
  process.exit(0);
}

const url = `http://localhost:3001${match[1]}`;
console.log('url', url);

http.get(url, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log('content-type', res.headers['content-type'] || '');
    console.log('head', body.slice(0, 120).replace(/\n/g, ' '));
  });
}).on('error', (error) => {
  console.error('request-error', error.message);
});
