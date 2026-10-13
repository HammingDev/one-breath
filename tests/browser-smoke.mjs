import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, 'output/playwright'), { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'one-breath-test-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`]
});
const errors = [];
context.on('weberror', e => errors.push(e.error().message));
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const base = `chrome-extension://${id}/`;
  const page = await context.newPage();
  await page.goto(base + 'gate.html#https://x.com/search?q=design&f=live');
  await page.getByRole('heading', { name: '先呼吸，再决定。' }).waitFor();
  assert.equal(await page.locator('#begin').isDisabled(), true);
  const premature = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'BEGIN', target: 'https://x.com/' }));
  assert.equal(premature.ok, false);
  console.log('PASS: gate requires completed exercise');
  await page.screenshot({ path: `${root}/output/playwright/breath.png`, fullPage: false });
  const settings = await context.newPage();
  await settings.goto(base + 'settings.html');
  await settings.locator('#visit').fill('3');
  await settings.locator('#cooldown').fill('20');
  await settings.getByRole('button', { name: '保存偏好' }).click();
  await settings.getByText('已保存 · 下一次新会话生效').waitFor();
  await settings.screenshot({ path: `${root}/output/playwright/settings.png`, fullPage: false });
  // Synthetic responses exercise extension behavior without accessing an X account.
  await context.route(/^https:\/\/([^/]+\.)?(x\.com|twitter\.com)\//, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body><h1>Mock feed</h1><a href="/second">Next post</a><video></video></body></html>'
  }));
  await page.getByRole('button', { name: '开始浏览 3 分钟' }).waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('begin').disabled);
  await page.locator('#begin').click();
  await page.waitForURL('https://x.com/search?q=design&f=live');
  await page.getByRole('heading', { name: 'Mock feed' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-one-breath-allowed'), '');
  let snapshot = await settings.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  const deadline = snapshot.state.endsAt;
  assert.equal(snapshot.state.cooldownMs, 20 * 60000);
  const second = await context.newPage();
  await second.goto('https://twitter.com/');
  await second.getByRole('heading', { name: 'Mock feed' }).waitFor();
  await second.reload();
  snapshot = await settings.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(snapshot.state.endsAt, deadline);
  await page.close();
  snapshot = await settings.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(snapshot.state.phase, 'active');
  await settings.locator('#cooldown').fill('1');
  await settings.getByRole('button', { name: '保存偏好' }).click();
  await second.goto('https://x.com/second');
  snapshot = await settings.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(snapshot.state.endsAt, deadline);
  console.log('PASS: deep link, multiple tabs, reload and domain switching share one deadline');
  await second.close();
  await settings.waitForFunction(async () => (await chrome.runtime.sendMessage({ type: 'STATUS' })).state.phase === 'cooldown');
  snapshot = await settings.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(snapshot.state.readyAt - snapshot.state.endedAt, 20 * 60000);
  console.log('PASS: closing last target starts cooldown; settings do not alter snapshot');
  const blocked = await context.newPage();
  await blocked.goto('https://x.com/home');
  await blocked.waitForURL(base + 'gate.html**');
  await blocked.getByRole('heading', { name: '休息一下。' }).waitFor();
  await blocked.screenshot({ path: `${root}/output/playwright/cooldown.png`, fullPage: false });
  assert.equal(await blocked.locator('#begin').isVisible(), false);
  console.log('PASS: cooldown intercepts network navigation');
  assert.deepEqual(errors, []);
  console.log('PASS: no uncaught browser errors');
} finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
