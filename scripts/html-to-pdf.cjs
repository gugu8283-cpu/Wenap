const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const html = path.resolve(__dirname, '..', 'docs', 'wenap-tax-guide.html');
  const pdf = path.resolve(__dirname, '..', 'docs', 'wenap-tax-guide.pdf');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdf,
    format: 'A4',
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    printBackground: true,
  });
  await browser.close();
  console.log('PDF:', pdf);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
