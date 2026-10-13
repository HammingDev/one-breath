import { request, $, timeLabel } from './client.js';
import { duration } from './model.js';
let state, settings;
async function refresh() {
  try { ({ state, settings } = await request('STATUS')); render(); }
  catch (error) { $('error').textContent = error.message; }
}
function render() {
  if (!state) return;
  $('end').hidden = state.phase !== 'active';
  $('title').textContent = state.phase === 'active' ? '正在浏览' : state.phase === 'cooldown' ? '正在休息' : '可以开始新的一次';
  $('count').textContent = state.phase === 'active' ? duration(state.endsAt - Date.now()) : state.phase === 'cooldown' ? duration(state.readyAt - Date.now()) : `${settings.visitMinutes} 分钟`;
  $('description').textContent = state.phase === 'active' ? '所有推特标签页共用这份时间。' : state.phase === 'cooldown' ? `${timeLabel(state.readyAt)} 后可以开始下一次。` : `浏览结束后，休息 ${settings.cooldownMinutes} 分钟。`;
  if ((state.phase === 'active' && Date.now() >= state.endsAt) || (state.phase === 'cooldown' && Date.now() >= state.readyAt)) void refresh();
}
$('end').onclick = async () => { try { await request('END'); await refresh(); } catch (error) { $('error').textContent = error.message; } };
$('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('gate.html') });
chrome.storage.onChanged.addListener(() => void refresh());
setInterval(render, 1000);
void refresh();
