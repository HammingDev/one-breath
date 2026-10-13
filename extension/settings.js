import { request, $ } from './client.js';
try {
  const { settings } = await request('STATUS');
  $('visit').value = settings.visitMinutes;
  $('cooldown').value = settings.cooldownMinutes;
  $('exercise').value = settings.exercise;
} catch (error) { $('error').textContent = error.message; }
$('form').onsubmit = async event => {
  event.preventDefault(); $('saved').textContent = ''; $('error').textContent = '';
  try {
    await request('SAVE', { settings: { visitMinutes: Number($('visit').value), cooldownMinutes: Number($('cooldown').value), exercise: $('exercise').value } });
    $('saved').textContent = '已保存 · 下一次新会话生效';
  } catch (error) { $('error').textContent = error.message; }
};
