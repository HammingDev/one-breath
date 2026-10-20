(() => {
  let deadline = 0, timer, checking = false, blocking = false, temporary = false, work = false;
  const gate = chrome.runtime.getURL('gate.html');
  let protectedDraft = false, snoozeUntil = 0, postingUntil = 0;
  const composerSelector = '[contenteditable="true"][role="textbox"], [contenteditable="true"][data-testid^="tweetTextarea"], textarea';
  function hasDraft() {
    return Date.now() < postingUntil || [...document.querySelectorAll(composerSelector)].some(el =>
      (el.value || el.textContent || '').trim().length > 0 || el === document.activeElement || el.contains(document.activeElement)
    );
  }
  function block(force = false) {
    if (blocking) return;
    if (!force && (protectedDraft || hasDraft())) {
      protectedDraft = true;
      work = false;
      if (host) host.style.removeProperty('display');
      clearTimeout(timer);
      document.documentElement?.setAttribute('data-one-breath-allowed', '');
      mount();
      renderProtection();
      return;
    }
    blocking = true;
    clearTimeout(timer);
    document.documentElement?.removeAttribute('data-one-breath-allowed');
    document.querySelectorAll('video,audio').forEach(el => el.pause());
    location.replace(gate + '#' + location.href);
  }
  function apply(state) {
    clearTimeout(timer);
    work = !!state.work;
    if (host) host.style.removeProperty('display');
    if (state.phase !== 'active' || state.endsAt <= Date.now()) { block(); return; }
    protectedDraft = false; snoozeUntil = 0;
    deadline = state.endsAt;
    temporary = !!state.temporary;
    document.documentElement?.setAttribute('data-one-breath-allowed', '');
    timer = setTimeout(() => block(), Math.max(0, deadline - Date.now()));
    mount();
    tick();
  }
  async function check() {
    if (checking) return;
    checking = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'STATUS' });
      if (!result?.ok) block(); else apply(result.accessState);
    } catch { block(); } finally { checking = false; }
  }
  let label, host, extendButton, notice, endButton, keepButton, noticeError = '';
  function renderProtection() {
    if (!label) return;
    label.textContent = '一息 · 写作保护';
    notice.hidden = Date.now() < snoozeUntil;
    notice.textContent = '时间到了，还在写吗？页面会保留，直到你确认离开。离开前请发布或自行保存。';
    extendButton.hidden = true;
    keepButton.hidden = notice.hidden;
    endButton.textContent = '已保存，确认离开';
  }
  function mount() {
    if (work) { if (host) host.style.setProperty('display', 'none', 'important'); return; }
    if (!document.documentElement || host?.isConnected) return;
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>:host{all:initial}div{display:flex;flex-wrap:wrap;max-width:calc(100vw - 72px);align-items:center;gap:16px;padding:12px 16px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#252525;font:13px system-ui}span{font-variant-numeric:tabular-nums}button{background:none;border:0;color:#252525;cursor:pointer;font:inherit;text-decoration:underline;text-underline-offset:4px}[hidden]{display:none}strong{font-weight:500}button:focus-visible{outline:2px solid #777}</style><div><span></span><strong role="status" hidden>即将结束</strong><button id="extend" hidden>再加 5 分钟</button><button id="keep" hidden>继续写作 · 5 分钟后提醒</button><button id="end">结束浏览</button></div>`;
    label = shadow.querySelector('span');
    endButton = shadow.querySelector('#end');
    keepButton = shadow.querySelector('#keep');
    keepButton.onclick = () => { snoozeUntil = Date.now() + 300000; renderProtection(); };
    endButton.onclick = async () => {
      if (!protectedDraft && hasDraft()) { protectedDraft = true; renderProtection(); return; }
      try { await chrome.runtime.sendMessage({ type: 'END' }); } finally { block(true); }
    };
    extendButton = shadow.querySelector('#extend');
    notice = shadow.querySelector('strong');
    extendButton.onclick = async () => {
      extendButton.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'EXTEND_TEMPORARY', endsAt: deadline });
        if (result?.ok) { noticeError = ''; apply(result.accessState); }
        else noticeError = result?.error || '续时失败，请重试';
      } catch { noticeError = '续时失败，请重试'; }
      finally { extendButton.disabled = false; tick(); }
    };
    document.documentElement.append(host);
    if (!protectedDraft) tick();
  }
  function tick() {
    if (work && deadline > Date.now()) { if (host) host.style.setProperty('display', 'none', 'important'); return; }
    if (host) host.style.removeProperty('display');
    if (protectedDraft) { renderProtection(); return; }
    if (deadline && Date.now() >= deadline) { block(); return; }
    if (label) {
      keepButton.hidden = true;
      endButton.textContent = '结束浏览';
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      extendButton.hidden = !temporary || seconds > 60;
      notice.hidden = !temporary || seconds > 60;
      if (!notice.hidden) notice.textContent = noticeError || '即将结束 · 需要更多时间？';
      label.textContent = `一息 · ${temporary ? '临时访问' : '剩余'} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }
  chrome.runtime.onMessage.addListener(msg => { if (msg.type === 'STATE') apply(msg.state); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.state?.newValue) void check(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); void check(); } });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  document.addEventListener('DOMContentLoaded', () => { mount(); void check(); });
  document.addEventListener('click', e => {
    if (e.target.closest?.('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]')) postingUntil = Date.now() + 30000;
  }, true);
  for (const event of ['pointerdown', 'keydown', 'wheel', 'play']) document.addEventListener(event, e => {
    if (protectedDraft) return;
    if (!deadline || Date.now() >= deadline) {
      block();
      if (!protectedDraft) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
  }, true);
  setInterval(tick, 1000);
  void check();
})();
