import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, 'output/playwright'), { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'one-breath-lifecycle-'));
const options = { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`] };
let context = await chromium.launchPersistentContext(profile, options);
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const base = `chrome-extension://${new URL(worker.url()).host}/`;
  const control = await context.newPage();
  await control.goto(base + 'settings.html');
  await control.locator('#visit').fill('1');
  await control.locator('#cooldown').fill('1');
  await control.getByRole('button', { name: '保存偏好' }).click();
  await control.getByText('已保存 · 下一次新会话生效').waitFor();
  await context.route(/^https:\/\/([^/]+\.)?(x\.com|twitter\.com)\//, route => route.fulfill({ contentType: 'text/html', body: '<h1>Mock feed</h1><video></video>' }));
  const a = await context.newPage();
  await a.goto(base + 'gate.html');
  await a.waitForFunction(() => !document.getElementById('begin').disabled, { }, { timeout: 20000 });
  await a.locator('#begin').click();
  await a.waitForURL('https://x.com/');
  const b = await context.newPage();
  await b.goto('https://twitter.com/home');
  const writing = await context.newPage();
  await writing.goto('https://x.com/compose/post');
  await writing.evaluate(() => { const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox'); editor.textContent = 'Keep this draft'; document.body.append(editor); });
  const snapshot = await control.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  const deadline = snapshot.state.endsAt;
  await control.bringToFront();
  console.log('Running real 60-second session with two background target tabs.');
  const waitUntil = Date.now() + 75000;
  while (![a, b].every(p => p.url().startsWith(base + 'gate.html'))) {
    assert.ok(Date.now() < waitUntil, 'all pages must be replaced at expiry');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await Promise.all([a, b].map(p => p.getByRole('heading', { name: '休息一下。' }).waitFor()));
  const cooled = await control.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(cooled.state.phase, 'cooldown');
  assert.equal(cooled.state.endedAt, deadline);
  assert.equal(cooled.state.readyAt, deadline + 60000);
  assert.ok(Date.now() - deadline < 3000, 'deadline interception should be prompt');
  console.log('PASS: continuous browsing expires in both tabs without navigating; cooldown uses original deadline');
  assert.equal(writing.url(), 'https://x.com/compose/post');
  assert.equal(await writing.locator('[role=textbox]').textContent(), 'Keep this draft');
  const draftCdp = await context.newCDPSession(writing);
  const { root: draftDom } = await draftCdp.send('DOM.getDocument', { depth: -1, pierce: true });
  function findButton(node, id) {
    if (node.nodeName === 'BUTTON' && node.attributes?.includes(id)) return node;
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) { const found = findButton(child, id); if (found) return found; }
  }
  async function clickProtected(id) {
    const node = findButton(draftDom, id); assert.ok(node);
    const { object } = await draftCdp.send('DOM.resolveNode', { nodeId: node.nodeId });
    const { result } = await draftCdp.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: 'function() { const visible = !this.hidden; this.click(); return visible; }', returnByValue: true });
    assert.equal(result.value, true);
  }
  await clickProtected('keep');
  assert.equal(writing.url(), 'https://x.com/compose/post');
  await clickProtected('end');
  await writing.waitForURL(base + 'gate.html**');
  console.log('PASS: natural expiry preserves draft, continue keeps page, explicit confirmation leaves');
  await context.close();
  context = await chromium.launchPersistentContext(profile, options);
  const restored = await context.newPage();
  await restored.goto(base + 'gate.html');
  await restored.getByRole('heading', { name: '休息一下。' }).waitFor();
  const restoredState = await restored.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(restoredState.state.readyAt, cooled.state.readyAt);
  console.log('PASS: browser restart preserves exact cooldown deadline');
  // Shorten only the test fixture's persisted cooldown, then restart to simulate wake-up.
  await restored.evaluate(async () => {
    const { state } = await chrome.storage.local.get('state');
    await chrome.storage.local.set({ state: { ...state, readyAt: Date.now() - 1 } });
  });
  await context.close();
  context = await chromium.launchPersistentContext(profile, options);
  const ready = await context.newPage();
  await ready.goto(base + 'gate.html');
  await ready.getByRole('heading', { name: '先呼吸，再决定。' }).waitFor();
  assert.equal(await ready.locator('#begin').isDisabled(), true);
  console.log('PASS: expired cooldown restores ready state, without automatic access');
  await ready.setViewportSize({ width: 390, height: 844 });
  await ready.screenshot({ path: `${root}/output/playwright/mobile.png`, fullPage: true });
  await ready.locator('#leave').click();
  const preferences = await context.newPage();
  await preferences.goto(base + 'settings.html');
  const afterLeave = await preferences.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(afterLeave.state.phase, 'ready');
  await preferences.locator('#exercise').selectOption('eyes');
  await preferences.getByRole('button', { name: '保存偏好' }).click();
  await preferences.getByText('已保存 · 下一次新会话生效').waitFor();
  const eyes = await context.newPage();
  await eyes.goto(base + 'gate.html');
  await eyes.getByRole('heading', { name: '让眼睛休息一下。' }).waitFor();
  assert.equal(await eyes.locator('#begin').isDisabled(), true);
  console.log('PASS: leaving exercise consumes no session; eye-rest preference applies');
  await preferences.evaluate(() => chrome.runtime.sendMessage({ type: 'START_WORK', minutes: 60 }));
  const work = await preferences.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  // Shortened persisted fixture tests restart and the actual work-mode alarm without waiting an hour.
  const workDeadline = Date.now() + 12000;
  await preferences.evaluate(async endsAt => {
    const { state } = await chrome.storage.local.get('state');
    await chrome.storage.local.set({ state: { ...state, endsAt } });
  }, workDeadline);
  await context.close();
  context = await chromium.launchPersistentContext(profile, options);
  await context.route(/^https:\/\/([^/]+\.)?(x\.com|twitter\.com)\//, route => route.fulfill({ contentType: 'text/html', body: '<h1>Work feed</h1>' }));
  const workControl = await context.newPage();
  await workControl.goto(base + 'popup.html');
  await workControl.getByRole('heading', { name: '工作模式中' }).waitFor();
  const restoredWork = await workControl.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(restoredWork.state.endsAt, workDeadline);
  const workTab = await context.newPage();
  await workTab.goto('https://x.com/home');
  await workTab.getByRole('heading', { name: 'Work feed' }).waitFor();
  await workTab.waitForURL(base + 'gate.html**', { timeout: 20000 });
  const workCooled = await workControl.evaluate(() => chrome.runtime.sendMessage({ type: 'STATUS' }));
  assert.equal(workCooled.state.readyAt, workDeadline + work.state.cooldownMs);
  console.log('PASS: work mode survives browser restart and automatically ends at original deadline');
} finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
