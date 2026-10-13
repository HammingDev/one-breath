export const DEFAULTS = Object.freeze({ visitMinutes: 5, cooldownMinutes: 60, exercise: 'breath' });
export function isTarget(raw) {
  try {
    const u = new URL(raw);
    return ['https:', 'http:'].includes(u.protocol) && ['x.com', 'twitter.com'].some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return false; }
}
export function safeTarget(raw) { return isTarget(raw) ? raw : 'https://x.com/'; }
export function validateSettings(input) {
  const { visitMinutes, cooldownMinutes, exercise } = input;
  if (!Number.isInteger(visitMinutes) || visitMinutes < 1 || visitMinutes > 120) throw new Error('单次浏览时长应为 1–120 分钟的整数。');
  if (!Number.isInteger(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 1440) throw new Error('冷却间隔应为 1–1440 分钟的整数。');
  if (!['breath', 'eyes'].includes(exercise)) throw new Error('请选择呼吸或眼睛休息。');
  return { visitMinutes, cooldownMinutes, exercise };
}
export const TEMPORARY_MS = 3 * 60000;
export function accessState(state) {
  return state.temporary ? { phase: 'active', endsAt: state.temporary.endsAt, temporary: true } : state;
}
export function startTemporary(state, now, tabId) {
  state = settle(state, now);
  if (state.temporary) return state;
  if (state.phase !== 'cooldown') throw new Error('临时访问仅在休息期间可用。');
  return { ...state, temporary: { endsAt: now + TEMPORARY_MS, tabIds: [tabId] } };
}
export function settle(state, now) {
  if (state.temporary && now >= state.temporary.endsAt) { const { temporary, ...rest } = state; state = rest; }
  if (state.phase === 'active' && now >= state.endsAt) return settle(finish(state, state.endsAt), now);
  if (state.phase === 'cooldown' && now >= state.readyAt) return { phase: 'ready', ...(state.temporary ? { temporary: state.temporary } : {}) };
  return state;
}
export function start(state, settings, now, tabId) {
  state = settle(state, now);
  if (state.phase !== 'ready' || state.temporary) return state;
  return { phase: 'active', startedAt: now, endsAt: now + settings.visitMinutes * 60000, cooldownMs: settings.cooldownMinutes * 60000, tabIds: [tabId] };
}
export function finish(state, now) {
  if (state.temporary) { const { temporary, ...rest } = state; return settle(rest, now); }
  if (state.phase !== 'active') return state;
  const endedAt = Math.min(now, state.endsAt);
  return { phase: 'cooldown', endedAt, readyAt: endedAt + state.cooldownMs };
}
export function duration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
