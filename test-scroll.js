const page = require('playwright').chromium;
(async () => {
  const browser = await page.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8888/journal');
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => window.scrollBy(0, 800));
  await p.screenshot({ path: '/tmp/filters.png' });
  await browser.close();
})();
