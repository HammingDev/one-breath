import { request, $, timeLabel } from './client.js';
import { duration, safeTarget } from './model.js';
let state, settings, challenge, busy = false, refreshing = false;
// The full original address lives in the fragment, including query parameters.
const target = safeTarget(location.hash.slice(1));
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    ({ state, settings } = await request('STATUS'));
    if (state.phase === 'ready' && !state.temporary && (!challenge || Date.now() - challenge.at > 300000)) {
      ({ state, settings, challenge } = await request('PREPARE'));
    }
    render();
  } catch (error) { $('error').textContent = error.message; $('begin').disabled = true; }
  finally { refreshing = false; }
}
function render() {
  if (!state) return;
  const now = Date.now();
  $('visual').classList.toggle('resting', state.phase === 'cooldown' && !state.temporary);
  $('visual').classList.toggle('eyes', state.phase === 'ready' && (challenge?.exercise || settings.exercise) === 'eyes');
  if (state.phase !== 'ready') $('visual').classList.remove('breathing');
  $('begin').hidden = false;
  $('temporary').hidden = state.phase !== 'cooldown' || !!state.temporary;
  $('temporary-note').hidden = $('temporary').hidden;
  if (state.phase === 'cooldown' && !state.temporary) {
    challenge = null;
    $('visual').classList.add('resting');
    $('phase').textContent = duration(state.readyAt - now);
    $('phase').className = 'phase count';
    $('title').textContent = '休息一下。';
    $('description').textContent = `${timeLabel(state.readyAt)} 后，可以开始下一次浏览。`;
    $('begin').hidden = true;
    $('detail').textContent = '休息结束后，也由你决定是否开始。';
    if (now >= state.readyAt) void refresh();
  } else if (state.phase === 'active' || state.temporary) {
    const endsAt = state.temporary?.endsAt || state.endsAt;
    challenge = null;
    $('phase').textContent = duration(endsAt - now);
    $('phase').className = 'phase count';
    $('title').textContent = state.temporary ? '临时访问中。' : '继续本次浏览。';
    $('description').textContent = '所有推特标签页，共享这段剩余时间。';
    $('begin').textContent = '继续本次浏览';
    $('begin').disabled = busy;
    $('detail').textContent = `${timeLabel(endsAt)} 结束 · 本页不会增加浏览额度`;
    if (now >= endsAt) void refresh();
  } else {
    $('phase').className = 'phase';
    const elapsed = challenge ? now - challenge.at : 0;
    const ready = challenge && elapsed >= challenge.duration;
    const eyes = (challenge?.exercise || settings.exercise) === 'eyes';
    $('visual').classList.toggle('eyes', eyes);
    $('visual').classList.toggle('breathing', !eyes && !ready);
    $('phase').textContent = ready ? '准备好了' : eyes ? `${Math.max(0, Math.ceil((20000 - elapsed) / 1000))} 秒` : elapsed % 6000 < 3000 ? '轻轻吸气' : '缓缓呼气';
    $('title').textContent = eyes ? '让眼睛休息一下。' : '先呼吸，再决定。';
    $('description').textContent = ready ? '现在，还想打开推特吗？' : eyes ? '看看远处，让视线离开屏幕 20 秒。' : '跟着圆环，慢慢吸气，再呼气。';
    $('begin').textContent = ready ? `开始浏览 ${settings.visitMinutes} 分钟 →` : eyes ? '休息结束后，可继续浏览' : '完成呼吸后，可继续浏览';
    $('begin').disabled = !ready || busy;
    $('detail').textContent = `${settings.visitMinutes} 分钟浏览 · ${settings.cooldownMinutes} 分钟休息`;
  }
}
$('begin').onclick = async () => {
  busy = true; render(); $('error').textContent = '';
  try { await request('BEGIN', { token: challenge?.token, target }); }
  catch (error) { $('error').textContent = error.message; challenge = null; await refresh(); }
  finally { busy = false; render(); }
};
$('leave').onclick = async () => {
  const tab = await chrome.tabs.getCurrent();
  if (tab) await chrome.tabs.remove(tab.id);
};
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.state || changes.settings)) void refresh(); });
window.addEventListener('pageshow', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
setInterval(render, 250);
void refresh();

$('temporary').onclick = async () => {
  $('temporary').disabled = true;
  try { await request('TEMPORARY', { target }); }
  catch (error) { $('error').textContent = error.message; }
  finally { $('temporary').disabled = false; }
};
