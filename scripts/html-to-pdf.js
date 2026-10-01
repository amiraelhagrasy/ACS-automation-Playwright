// One-off helper: renders a local HTML report file to PDF using Playwright's bundled Chromium.
// Usage: node scripts/html-to-pdf.js <input.html> <output.pdf>
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/html-to-pdf.js <input.html> <output.pdf>');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(inputPath)).toString());
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
  });
  await browser.close();
  console.log(`Wrote ${outputPath}`);
}

main();
