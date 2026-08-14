import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const pages = ['g-brain','org-chart','dashboard','sales-subgraph','comms',
               'funnel','workflows','connections','personas','hero'];
const only = process.argv.slice(2);
const list = only.length ? only : pages;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1680, height: 945 }, deviceScaleFactor: 2 });
for (const p of list) {
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(`file://${process.cwd()}/${p}.html`);
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `out/${p}.png` });
  console.log(p, errs.length ? 'JS-ERRORS: ' + errs.join(' | ') : 'ok');
  await pg.close();
}
await b.close();
