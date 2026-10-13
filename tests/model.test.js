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

import { startTemporary, TEMPORARY_MS, accessState } from '../extension/model.js';
test('temporary access retains original cooldown, including after early end', () => {
  const cooling = finish(start(ready, DEFAULTS, 0, 1), 1000);
  const temp = startTemporary(cooling, 2000, 2);
  assert.equal(temp.readyAt, cooling.readyAt);
  assert.equal(accessState(temp).endsAt, 2000 + TEMPORARY_MS);
  assert.deepEqual(finish(temp, 3000), cooling);
  assert.deepEqual(settle(temp, 2000 + TEMPORARY_MS), cooling);
});
test('temporary access cannot be extended by multiple starts or normal BEGIN', () => {
  const temp = startTemporary({ phase: 'cooldown', endedAt: 0, readyAt: 3600000 }, 1000, 1);
  assert.deepEqual(startTemporary(temp, 2000, 2), temp);
  assert.deepEqual(start(temp, DEFAULTS, 2000, 2), temp);
  assert.throws(() => startTemporary(ready, 0, 1));
});
test('cooldown can finish during temporary access without discarding its timer', () => {
  const temp = startTemporary({ phase: 'cooldown', endedAt: 0, readyAt: 10000 }, 1000, 1);
  const afterCooldown = settle(temp, 10000);
  assert.equal(afterCooldown.phase, 'ready');
  assert.equal(afterCooldown.temporary.endsAt, 901000);
  assert.deepEqual(settle(afterCooldown, 901000), ready);
  assert.deepEqual(finish(afterCooldown, 12000), ready);
});

import { extendTemporary } from '../extension/model.js';
test('legacy settings migrate to 15 minutes and custom duration is validated', () => {
  assert.equal(validateSettings({ visitMinutes: 5, cooldownMinutes: 60, exercise: 'breath' }).temporaryMinutes, 15);
  for (const temporaryMinutes of [0, 121, 1.5, '15']) assert.throws(() => validateSettings({ ...DEFAULTS, temporaryMinutes }));
  const temp = startTemporary({ phase: 'cooldown', readyAt: 3600000 }, 0, 1, 20);
  assert.equal(temp.temporary.endsAt, 1200000);
});
test('extension adds five minutes once per observed deadline and retains cooldown', () => {
  const temp = startTemporary({ phase: 'cooldown', readyAt: 3600000 }, 0, 1);
  const extended = extendTemporary(temp, 850000, temp.temporary.endsAt);
  assert.equal(extended.temporary.endsAt, 1200000);
  assert.equal(extended.readyAt, temp.readyAt);
  assert.deepEqual(extendTemporary(extended, 850001, temp.temporary.endsAt), extended);
  assert.throws(() => extendTemporary(temp, 900000, 900000));
});
