import { DEFAULTS, isTarget, safeTarget, validateSettings, settle, start, finish } from './model.js';
const gate = chrome.runtime.getURL('gate.html');
let state, settings, ruleMode;
let queue = Promise.resolve();
function serial(fn) {
  const task = queue.then(async () => { await init(); await normalize(); return fn(); });
  queue = task.catch(error => console.error('One Breath:', error));
  return task;
}
const isGate = url => typeof url === 'string' && (url === gate || url.startsWith(gate + '#'));
async function init() {
  if (state) return;
  const saved = await chrome.storage.local.get(['state', 'settings']);
  settings = saved.settings ? validateSettings(saved.settings) : { ...DEFAULTS };
  state = settle(saved.state || { phase: 'ready' }, Date.now());
  await chrome.storage.local.set({ state, settings });
  await syncRules();
  await schedule();
}
async function syncRules() {
  const active = state.phase === 'active';
  if (ruleMode === active) return;
  const addRules = [{ id: 10, priority: 2,
    action: { type: 'redirect', redirect: { regexSubstitution: gate + '#\\0' } },
    condition: { regexFilter: '^https?://([a-zA-Z0-9-]+\\.)*(x\\.com|twitter\\.com)(/.*)?$', resourceTypes: ['main_frame'] }
  }];
  if (active) addRules.push({ id: 11, priority: 3, action: { type: 'allow' }, condition: { requestDomains: ['x.com', 'twitter.com'], resourceTypes: ['main_frame'] } });
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [10, 11], addRules });
  ruleMode = active;
}
async function schedule() {
  await chrome.alarms.clear('boundary');
  const when = state.phase === 'active' ? state.endsAt : state.phase === 'cooldown' ? state.readyAt : null;
  if (when) await chrome.alarms.create('boundary', { when });
  await chrome.action.setBadgeBackgroundColor({ color: '#252525' });
  await chrome.action.setBadgeText({ text: state.phase === 'active' ? '浏览' : state.phase === 'cooldown' ? '休息' : '' });
}
async function persist() {
  await chrome.storage.local.set({ state });
  await syncRules();
  await schedule();
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(t => isTarget(t.url)).map(async t => {
    if (state.phase !== 'active' && !isGate(t.pendingUrl)) await chrome.tabs.update(t.id, { url: gate + '#' + t.url });
    else await chrome.tabs.sendMessage(t.id, { type: 'STATE', state });
  }));
}
async function normalize() {
  const next = settle(state, Date.now());
  if (next !== state) { state = next; await persist(); }
}
async function reconcile() {
  if (state.phase !== 'active') return;
  const tabs = await chrome.tabs.query({});
  const ids = tabs.filter(t => isTarget(t.pendingUrl || t.url) || (isGate(t.url) && state.tabIds.includes(t.id))).map(t => t.id);
  if (!ids.length) { state = finish(state, Date.now()); await persist(); }
  else if (JSON.stringify(ids) !== JSON.stringify(state.tabIds)) {
    state = { ...state, tabIds: ids }; await chrome.storage.local.set({ state });
  }
}
function extensionUI(sender) { return sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('')); }
async function handle(msg, sender) {
  if (sender.id !== chrome.runtime.id) throw new Error('无法识别请求来源。');
  if (msg.type === 'STATUS') return { state, settings };
  if (msg.type === 'END') {
    if (!extensionUI(sender) && !isTarget(sender.url)) throw new Error('无法结束会话。');
    state = finish(state, Date.now()); await persist(); return { state, settings };
  }
  if (!extensionUI(sender)) throw new Error('请从插件页面操作。');
  if (msg.type === 'SAVE') {
    settings = validateSettings(msg.settings); await chrome.storage.local.set({ settings }); return { state, settings };
  }
  if (msg.type === 'PREPARE') {
    if (!isGate(sender.url) || !sender.tab) throw new Error('请从访问提醒页开始。');
    const challenge = { token: crypto.randomUUID(), at: Date.now(), exercise: settings.exercise, duration: settings.exercise === 'eyes' ? 20000 : 12000 };
    await chrome.storage.session.set({ ['challenge' + sender.tab.id]: challenge });
    return { challenge, state, settings };
  }
  if (msg.type === 'BEGIN') {
    if (!isGate(sender.url) || !sender.tab) throw new Error('请从访问提醒页开始。');
    if (state.phase === 'cooldown') throw new Error('还在休息时间，稍后再来。');
    if (state.phase === 'ready') {
      const key = 'challenge' + sender.tab.id;
      const c = (await chrome.storage.session.get(key))[key];
      if (!c || c.token !== msg.token || Date.now() - c.at < c.duration || Date.now() - c.at > 300000) throw new Error('请先完成这次休息练习。');
      state = start(state, settings, Date.now(), sender.tab.id);
      await persist();
      await chrome.storage.session.remove(key);
    }
    // A second tab joins the existing session; never grants additional time.
    if (!state.tabIds.includes(sender.tab.id)) { state = { ...state, tabIds: [...state.tabIds, sender.tab.id] }; await chrome.storage.local.set({ state }); }
    await chrome.tabs.update(sender.tab.id, { url: safeTarget(msg.target) });
    return { state, settings };
  }
  throw new Error('未知操作。');
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  serial(() => handle(msg, sender)).then(data => reply({ ok: true, ...data }), error => reply({ ok: false, error: error.message }));
  return true;
});
chrome.alarms.onAlarm.addListener(() => { void serial(async () => {}); });
chrome.tabs.onRemoved.addListener(id => { void serial(async () => { await chrome.storage.session.remove('challenge' + id); await reconcile(); }); });
chrome.tabs.onUpdated.addListener((id, change) => { if (change.url || change.status === 'complete') void serial(reconcile); });
chrome.tabs.onReplaced.addListener(() => { void serial(reconcile); });
chrome.tabs.onActivated.addListener(() => { void serial(async () => {}); });
chrome.runtime.onStartup.addListener(() => { void serial(async () => { await syncRules(); await schedule(); }); });
chrome.runtime.onInstalled.addListener(() => { void serial(persist); });
