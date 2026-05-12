const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://platzi.com/cursos/programacion-basica/programacion-basica-fundamentos-y-creaci/', { waitUntil: 'networkidle' });
  const html = await page.content();
  const raw = html.match(/https?:\/\/[^\s"'}]+\.vtt[^\s"'}]*/g) || [];
  const escaped = html.match(/https?:\\\/\\\/[^"']+?\.vtt[^"']*/g) || [];
  console.log('raw_vtt', raw.length);
  console.log('escaped_vtt', escaped.length);
  console.log('sample_raw', raw.slice(0, 3));
  console.log('sample_escaped', escaped.slice(0, 3));
  await browser.close();
})();
