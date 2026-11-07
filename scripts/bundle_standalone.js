const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, '..', 'src', 'WebPos.Web', 'dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtmlPath = path.join(distDir, 'index.html');
const standaloneOutPath = path.join(__dirname, '..', 'WebPOS_Aplikacija.html');

if (!fs.existsSync(assetsDir)) {
  console.error('Nedostaje dist/assets direktorij. Prvo pokrenite Vite build.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('Nisu pronađeni kompilirani .css i .js fajlovi u dist/assets.');
  process.exit(1);
}

const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

// Escape </script> inside JS string literals so inline <script> never breaks
const safeJsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');

const inlinedHtml = `<!doctype html>
<html lang="bs" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebPOS ERP</title>
    <style>${cssContent}</style>
  </head>
  <body class="h-full bg-background text-foreground antialiased selection:bg-primary/20 selection:bg-primary">
    <div id="root" class="h-full"></div>
    <script type="module">${safeJsContent}</script>
  </body>
</html>
`;

fs.writeFileSync(indexHtmlPath, inlinedHtml, 'utf8');
fs.writeFileSync(standaloneOutPath, inlinedHtml, 'utf8');
console.log('Uspješno spakovan produkcijski React build u dist/index.html i WebPOS_Aplikacija.html (' + inlinedHtml.length + ' bajtova)');
