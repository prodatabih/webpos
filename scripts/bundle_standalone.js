/**
 * WebPOS — Skripta za pakovanje samostalne (single-file) HTML aplikacije
 * Spaja src/public/index.html + src/public/css/styles.css + src/public/js/app.js
 * u jedan 100% samostalni HTML fajl (WebPOS_Aplikacija.html) koji radi
 * dvoklikom na bilo kojem računaru bez pokretanja terminala ili servera,
 * kao i kada je povezan na Node.js/SQLite server.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'src', 'public', 'index.html');
const cssPath = path.join(rootDir, 'src', 'public', 'css', 'styles.css');
const jsPath = path.join(rootDir, 'src', 'public', 'js', 'app.js');
const outPath = path.join(rootDir, 'WebPOS_Aplikacija.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const bundled = html
  .replace('<link rel="stylesheet" href="css/styles.css" />', `<style>\n${css}\n  </style>`)
  .replace('<script src="js/app.js"></script>', `<script>\n${js}\n  </script>`);

fs.writeFileSync(outPath, bundled, 'utf8');
console.log(`Uspješno generisan samostalni fajl: ${outPath} (${bundled.length} bajtova)`);
