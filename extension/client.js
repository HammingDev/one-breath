export async function request(type, fields = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...fields });
  if (!response?.ok) throw new Error(response?.error || '暂时无法连接插件，请刷新页面重试。');
  return response;
}
export const $ = id => document.getElementById(id);
export function timeLabel(at) { return new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
