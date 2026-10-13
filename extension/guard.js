(() => {
  let deadline = 0, timer, checking = false, blocking = false, temporary = false;
  const gate = chrome.runtime.getURL('gate.html');
  function block() {
    if (blocking) return;
    blocking = true;
    clearTimeout(timer);
    document.documentElement?.removeAttribute('data-one-breath-allowed');
    document.querySelectorAll('video,audio').forEach(el => el.pause());
    location.replace(gate + '#' + location.href);
  }
  function apply(state) {
    clearTimeout(timer);
    if (state.phase !== 'active' || state.endsAt <= Date.now()) { block(); return; }
    deadline = state.endsAt;
    temporary = !!state.temporary;
    document.documentElement?.setAttribute('data-one-breath-allowed', '');
    timer = setTimeout(block, Math.max(0, deadline - Date.now()));
    mount();
  }
  async function check() {
    if (checking) return;
    if (deadline && Date.now() >= deadline) { block(); return; }
    checking = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'STATUS' });
      if (!result?.ok) block(); else apply(result.accessState);
    } catch { block(); } finally { checking = false; }
  }
  let label, host;
  function mount() {
    if (!document.documentElement || host?.isConnected) return;
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>:host{all:initial}div{display:flex;align-items:center;gap:16px;padding:12px 16px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#252525;font:13px system-ui}span{font-variant-numeric:tabular-nums}button{background:none;border:0;color:#252525;cursor:pointer;font:inherit;text-decoration:underline;text-underline-offset:4px}button:focus-visible{outline:2px solid #777}</style><div><span></span><button>结束浏览</button></div>`;
    label = shadow.querySelector('span');
    shadow.querySelector('button').onclick = async () => { try { await chrome.runtime.sendMessage({ type: 'END' }); } finally { block(); } };
    document.documentElement.append(host);
    tick();
  }
  function tick() {
    if (deadline && Date.now() >= deadline) { block(); return; }
    if (label) {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      label.textContent = `一息 · ${temporary ? '临时访问' : '剩余'} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }
  chrome.runtime.onMessage.addListener(msg => { if (msg.type === 'STATE') apply(msg.state); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.state?.newValue) void check(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); void check(); } });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  document.addEventListener('DOMContentLoaded', () => { mount(); void check(); });
  for (const event of ['pointerdown', 'keydown', 'wheel', 'play']) document.addEventListener(event, e => {
    if (!deadline || Date.now() >= deadline) { e.preventDefault(); e.stopImmediatePropagation(); block(); }
  }, true);
  setInterval(tick, 1000);
  void check();
})();
