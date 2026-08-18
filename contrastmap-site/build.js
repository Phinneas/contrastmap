const fs = require('fs');

const providers = require('./providers.json').filter(x => !x._note);
const products = require('./catalog.json').filter(x => !x._note);

// Monetization: mark paid "featured" studios and "sponsored" products
const FEATURED = new Set(['CØNTRAST', 'RVIVL', 'Othership Flatiron', 'SWTHZ Belterra']);
const SPONSORED = new Set([
  'Plunge All-In Gen 2',
  'Sun Home Equinox 2-Person Full-Spectrum Infrared Sauna',
  'HigherDOSE Infrared Sauna Blanket'
]);

providers.forEach(p => { p.featured = FEATURED.has(p.name); });
products.forEach(p => { p.sponsored = SPONSORED.has(p.name); });

let html = fs.readFileSync('./index.template.html', 'utf8');
// function replacements => no special-char ($&, $1, $$) interpretation from JSON contents
html = html.replace('__PROVIDERS__', () => JSON.stringify(providers));
html = html.replace('__PRODUCTS__', () => JSON.stringify(products));
fs.writeFileSync('./index.html', html);

console.log('Built index.html');
console.log('  providers:', providers.length, '| featured:', providers.filter(p => p.featured).length);
console.log('  products :', products.length, '| sponsored:', products.filter(p => p.sponsored).length);
console.log('  size     :', (html.length / 1024).toFixed(1), 'KB');
// sanity: ensure markers were replaced
console.log('  markers left:', (html.includes('__PROVIDERS__') || html.includes('__PRODUCTS__')) ? 'YES (ERROR)' : 'none ✓');
