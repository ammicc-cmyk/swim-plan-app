import { loadSettings, saveSettings } from '../storage.js';
import { PACES, recommendVolume, estimateVolumeMinutes, FACTOR_DRILL, FACTOR_OTHER_STYLE, REST_SEC_PER_50 } from '../pace.js';

const LEVELS = [
  ['beginner', 'Начинающий'],
  ['intermediate', 'Средний'],
  ['advanced', 'Продвинутый'],
];

const SESSION_MINUTES = [30, 45, 60, 75, 90];
const VOLUMES = Array.from({ length: 48 }, (_, i) => 300 + i * 100); // 300–5000 м

const EQUIPMENT = [
  ['board', 'Доска'],
  ['pull_buoy', 'Колобашка'],
  ['fins', 'Ласты'],
  ['snorkel', 'Трубка'],
  ['paddles', 'Лопатки'],
];

function options(list, selected) {
  return list
    .map(([value, label]) => `<option value="${value}" ${String(selected) === String(value) ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function estimateHtml(volume, paceKey, sessionMinutes) {
  const rec = recommendVolume(sessionMinutes, paceKey);
  if (!rec) return 'Выберите темп кроля — покажем рекомендуемую дистанцию на тренировку.';
  const minutes = estimateVolumeMinutes(volume, paceKey);
  const fit =
    minutes > sessionMinutes
      ? ` <span class="warn">— больше, чем ${sessionMinutes} мин</span>`
      : '';
  return `
    Рекомендуемая дистанция на ${sessionMinutes} мин: <strong>~${rec} м</strong>
    <button type="button" id="p-apply-rec" class="btn-small">Подставить</button><br>
    Выбранные ${volume} м займут ≈${minutes} мин${fit}.
    <span class="hint">Учтено: упражнения плывутся в ${FACTOR_DRILL}× медленнее кроля (1.5–1.8),
    другие стили — в ${FACTOR_OTHER_STYLE}×, отдых в среднем ${REST_SEC_PER_50} с после каждых 50 м.</span>`;
}

export function initSettingsTab(root) {
  const settings = loadSettings();
  const equip = settings.available_equipment || [];
  const minuteOptions = SESSION_MINUTES.includes(settings.session_minutes)
    ? SESSION_MINUTES
    : [...SESSION_MINUTES, settings.session_minutes].sort((a, b) => a - b);
  const volumeOptions =VOLUMES.includes(settings.target_volume_m)
    ? VOLUMES
    : [...VOLUMES, settings.target_volume_m].sort((a, b) => a - b);

  root.innerHTML = `
    <section class="panel">
      <h2>Параметры пловца</h2>
      <div class="profile-grid">
        <label>Возраст, лет
          <input type="number" id="p-age" min="5" max="100" placeholder="не указан" value="${settings.swimmer_age ?? ''}">
        </label>
        <label>Уровень плавания
          <select id="p-level">${options(LEVELS, settings.swimmer_level)}</select>
        </label>
        <label>Темп кроль на 100 м
          <select id="p-pace"><option value="">— не выбран —</option>${options(PACES, settings.pace_100_crawl)}</select>
        </label>
        <label>Длительность тренировки
          <select id="p-minutes">${options(minuteOptions.map((m) => [m, `${m} мин`]), settings.session_minutes)}</select>
        </label>
        <label>Объём тренировки, м
          <select id="p-volume">${options(volumeOptions.map((v) => [v, `${v} м`]), settings.target_volume_m)}</select>
        </label>
        <fieldset class="choice-group">
          <legend>Бассейн</legend>
          ${[25, 50]
            .map(
              (len) =>
                `<label class="chip"><input type="radio" name="p-pool" value="${len}" ${settings.pool_length_m === len ? 'checked' : ''}> ${len} м</label>`
            )
            .join('')}
        </fieldset>
        <fieldset class="choice-group">
          <legend>Доступный инвентарь</legend>
          ${EQUIPMENT.map(
            ([value, label]) =>
              `<label class="chip"><input type="checkbox" class="p-equip" value="${value}" ${equip.includes(value) ? 'checked' : ''}> ${label}</label>`
          ).join('')}
        </fieldset>
      </div>
      <div id="p-estimate" class="estimate-box">${estimateHtml(settings.target_volume_m, settings.pace_100_crawl, settings.session_minutes)}</div>
      <div class="hint">
        Объём тренировки задаёт диапазон по умолчанию на вкладке «Генератор плана» (±100 м).
        Упражнения с доской или колобашкой не попадают в план, если этот инвентарь не отмечен.
        Данные хранятся только в этом браузере.
      </div>
    </section>

    <section class="panel">
      <h2>Настройки генератора</h2>
      <div class="stack-form">
        <label>Стиль-фокус <input type="text" id="s-style" value="${settings.style_focus}"></label>
        <label>Частота тренировок в неделю <input type="number" id="s-freq" value="${settings.frequency_per_week ?? ''}"></label>
        <label>Диапазон объёма по умолчанию: от <input type="number" id="s-min" step="50" value="${settings.default_target_min}"> до <input type="number" id="s-max" step="50" value="${settings.default_target_max}"></label>
        <label>Сколько тренировок ждать перед повторной попыткой deferred-упражнения <input type="number" id="s-cooldown" value="${settings.deferred_cooldown_sessions}"></label>
        <label><input type="checkbox" id="s-reserve-mandatory" ${settings.reserve_mandatory ? 'checked' : ''}> Резерв — обязательный объём (а не "если успевает")</label>
        <div class="hint">Открытый вопрос из HANDOVER.md: переводить резерв в обязательный, только если причина всех исключений в недавних тренировках — не техническая усталость к концу.</div>
      </div>
    </section>

    <div class="save-bar">
      <button id="save-settings">Сохранить</button>
      <span id="settings-saved" class="hint ok" style="display:none;">Сохранено.</span>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);

  const refreshEstimate = () => {
    $('#p-estimate').innerHTML = estimateHtml(Number($('#p-volume').value), $('#p-pace').value, Number($('#p-minutes').value));
  };
  $('#p-pace').addEventListener('change', refreshEstimate);
  $('#p-minutes').addEventListener('change', refreshEstimate);
  // «Подставить» — выставить рекомендуемую дистанцию в поле объёма.
  $('#p-estimate').addEventListener('click', (e) => {
    if (e.target.id !== 'p-apply-rec') return;
    const rec = recommendVolume(Number($('#p-minutes').value), $('#p-pace').value);
    if (!rec) return;
    $('#p-volume').value = String(rec);
    $('#p-volume').dispatchEvent(new Event('change'));
  });
  $('#p-volume').addEventListener('change', () => {
    const v = Number($('#p-volume').value);
    $('#s-min').value = Math.max(100, v - 100);
    $('#s-max').value = v + 100;
    refreshEstimate();
  });

  $('#save-settings').addEventListener('click', () => {
    const ageRaw = $('#p-age').value;
    const pool = root.querySelector('input[name="p-pool"]:checked');
    const updated = {
      ...settings,
      swimmer_age: ageRaw ? Number(ageRaw) : null,
      swimmer_level: $('#p-level').value,
      pace_100_crawl: $('#p-pace').value || null,
      target_volume_m: Number($('#p-volume').value),
      session_minutes: Number($('#p-minutes').value),
      pool_length_m: pool ? Number(pool.value) : settings.pool_length_m,
      available_equipment: Array.from(root.querySelectorAll('.p-equip:checked')).map((cb) => cb.value),
      style_focus: $('#s-style').value,
      frequency_per_week: $('#s-freq').value ? Number($('#s-freq').value) : null,
      default_target_min: Number($('#s-min').value),
      default_target_max: Number($('#s-max').value),
      deferred_cooldown_sessions: Number($('#s-cooldown').value),
      reserve_mandatory: $('#s-reserve-mandatory').checked,
    };
    saveSettings(updated);
    const savedNote = $('#settings-saved');
    savedNote.style.display = 'inline';
    setTimeout(() => (savedNote.style.display = 'none'), 1500);
  });
}
