import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, isTarget, safeTarget, validateSettings, settle, start, finish } from '../extension/model.js';
const ready = { phase: 'ready' };
test('cooldown begins at natural end, not session start or wake-up', () => {
  const active = start(ready, DEFAULTS, 1000, 1);
  const cooldown = settle(active, 900000);
  assert.equal(cooldown.endedAt, 301000);
  assert.equal(cooldown.readyAt, 3901000);
  assert.equal(settle(active, 3901000).phase, 'ready');
});
test('early finish begins cooldown immediately and cannot be extended by repeated end', () => {
  const result = finish(start(ready, DEFAULTS, 0, 1), 120000);
  assert.equal(result.readyAt, 3720000);
  assert.deepEqual(finish(result, 180000), result);
});
test('multiple starts share one session, including cooldown refusal', () => {
  const active = start(ready, DEFAULTS, 0, 1);
  assert.deepEqual(start(active, DEFAULTS, 20000, 2), active);
  const cooling = finish(active, 100000);
  assert.deepEqual(start(cooling, DEFAULTS, 200000, 2), cooling);
});
test('changed preferences do not alter an existing session', () => {
  const active = start(ready, DEFAULTS, 0, 1);
  const settings = { ...DEFAULTS, visitMinutes: 20, cooldownMinutes: 1 };
  assert.equal(start(active, settings, 10000, 2).endsAt, 300000);
  assert.equal(finish(active, 20000).readyAt, 3620000);
});
test('deadlines survive serialization and exact boundary transitions', () => {
  const active = JSON.parse(JSON.stringify(start(ready, DEFAULTS, 0, 1)));
  assert.equal(settle(active, 299999).phase, 'active');
  assert.equal(settle(active, 300000).phase, 'cooldown');
  assert.equal(settle(active, 3900000).phase, 'ready');
});
test('only real target domains accepted, preserving deep links', () => {
  for (const url of ['https://x.com/home', 'http://twitter.com/', 'https://mobile.twitter.com/search?q=a&f=b']) assert.equal(isTarget(url), true);
  for (const url of ['https://x.com.evil.com', 'https://notx.com', 'javascript:alert(1)', 'https://x.com@evil.com', 'invalid']) assert.equal(isTarget(url), false);
  assert.equal(safeTarget('https://x.com/search?q=a&f=b'), 'https://x.com/search?q=a&f=b');
});
test('invalid settings fail instead of disabling restriction', () => {
  for (const v of [0,-1,NaN,Infinity,1.5,121,'5']) assert.throws(() => validateSettings({ ...DEFAULTS, visitMinutes: v }));
  assert.throws(() => validateSettings({ ...DEFAULTS, cooldownMinutes: 0 }));
  assert.throws(() => validateSettings({ ...DEFAULTS, exercise: 'skip' }));
});
