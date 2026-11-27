import { expandToRestSegments } from './rulesEngine.js';
import { guidanceFor, restSecPer50 } from './guidance.js';

const BLOCK_LABEL = {
  warmup: 'Разминка',
  equipment: 'С инвентарём',
  no_equipment: 'Без инвентаря',
  cooldown: 'Заминка',
  reserve: 'Резерв',
};

const svg = (p) =>
  `<svg class="block-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const BLOCK_ICON = {
  // разминка — термометр/огонёк
  warmup: svg('<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/>'),
  // с инвентарём — доска для плавания
  equipment: svg('<path d="M7 3h10a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2z"/><path d="M9 7h6"/>'),
  // без инвентаря — волны
  no_equipment: svg('<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>'),
  // заминка — луна/спокойствие
  cooldown: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  reserve: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
};

const EQUIP_LABEL = {
  board: 'доска',
  pull_buoy: 'колобашка',
  board_optional: 'доска (по желанию)',
};
function equipLabel(eq) {
  if (!eq) return 'без инвентаря';
  return esc(EQUIP_LABEL[eq] || eq);
}

function unitFor(ex) {
  return ex && ex.equipment ? 100 : 50;
}

function formatVolume(volume_m, ex) {
  const unit = unitFor(ex);
  const reps = Math.round(volume_m / unit);
  if (reps <= 1) return `${volume_m}м`;
  return `${reps}×${unit}м (${volume_m}м)`;
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

// «пловец» / «пловчиха» по полу из «Параметров пловца».
export function swimmerWord(gender) {
  return gender === 'f' ? 'пловчиха' : 'пловец';
}

// Объём пункта: «3×400м (1200м)», «лесенка 100+200+100м (400м)», «2×50м (100м)».
function itemVolumeLabel(item, ex) {
  if (item.set) return `${item.set.label} (${item.volume_m}м)`;
  return formatVolume(item.volume_m, ex);
}

export function renderPlan(plan, catalogByCode, level = 'beginner', gender = 'm') {
  const who = swimmerWord(gender);
  const { items, targetMin, targetMax, totalVolume, mandatoryVolume, withinRange, multipleOf100, reserve } = plan;

  const shortLines = items
    .map((item) => {
      if (item.combo && item.combo.length > 2) {
        const names = [...new Set(item.combo.map((h) => (catalogByCode[h.code] ? catalogByCode[h.code].name : h.code)))];
        const vol = item.combo.reduce((s, h) => s + h.volume_m, 0);
        return `<li>${item.combo.length}×50м (${vol}м) — чередование: ${names.map(esc).join(' / ')}</li>`;
      }
      if (item.combo) {
        const parts = item.combo
          .map((h) => `${h.volume_m}м ${esc(catalogByCode[h.code] ? catalogByCode[h.code].name : h.code)}`)
          .join(' + ');
        return `<li>${parts}${item.is_new ? ' <span class="badge badge-new">новое</span>' : ''}</li>`;
      }
      const ex = catalogByCode[item.code];
      const name = ex ? ex.name : item.code;
      const badges =
        (item.is_new ? ' <span class="badge badge-new">новое</span>' : '') +
        (item.is_reserve ? ' <span class="badge badge-reserve">резерв</span>' : '');
      return `<li>${itemVolumeLabel(item, ex)} — ${esc(name)}${badges}</li>`;
    })
    .join('');

  const detailRows = items
    .map((item, idx) => {
      const num = `<span class="plan-num">${idx + 1}</span>`;
      if (item.combo) {
        const shown = item.combo.length > 2
          ? [...new Map(item.combo.map((h) => [h.code, h])).values()]
          : item.combo;
        const halvesHtml = shown
          .map((h) => {
            const hEx = catalogByCode[h.code];
            if (!hEx) return '';
            return `
            <div class="plan-detail-combo-half">
              <strong>${item.combo.length > 2 ? '' : `${h.volume_m}м — `}${esc(hEx.name)}</strong>
              <div>Инвентарь: ${equipLabel(hEx.equipment)}</div>
              <div>Фокус: ${esc(hEx.focus)}</div>
              <div class="plan-tempo"><b>Темп:</b> ${esc(guidanceFor(hEx, h.volume_m, level).tempo)}</div>
            </div>`;
          })
          .join(`<div class="plan-detail-combo-plus">${item.combo.length > 2 ? '/' : '+'}</div>`);
        const comboVolume = item.combo.reduce((s, h) => s + h.volume_m, 0);
        const comboTitle =
          item.combo.length > 2
            ? `Сет ${comboVolume}м — чередование стилей (${item.combo.length}×50м, по кругу, меняя стиль каждые 50 м)`
            : `Круг ${comboVolume}м из двух упражнений`;
        return `
        <div class="plan-detail-row block-${item.block} plan-detail-combo">
          <div class="plan-detail-head">
            ${num}
            <span class="block-tag">${BLOCK_ICON[item.block] || ""}${BLOCK_LABEL[item.block] || item.block}</span>
            <strong>${esc(comboTitle)}</strong>
            ${item.is_new ? '<span class="badge badge-new">новое, уменьшенный объём</span>' : ''}
          </div>
          <div class="plan-detail-combo-halves">${halvesHtml}</div>
          <div class="plan-rest"><b>Отдых:</b> ${Math.max(...item.combo.map((h) => restSecPer50(catalogByCode[h.code], level)))} с у борта после каждых 50 м.</div>
        </div>`;
      }
      const ex = catalogByCode[item.code];
      if (!ex) return '';
      const g = guidanceFor(ex, item.volume_m, level, item.set);
      return `
        <div class="plan-detail-row block-${item.block}">
          <div class="plan-detail-head">
            ${num}
            <span class="block-tag">${BLOCK_ICON[item.block] || ""}${BLOCK_LABEL[item.block] || item.block}</span>
            <strong>${esc(ex.name)}</strong>
            ${item.is_new ? '<span class="badge badge-new">новое, уменьшенный объём</span>' : ''}
            ${item.is_reserve ? '<span class="badge badge-reserve">резерв — обязательный объём</span>' : ''}
          </div>
          <div class="plan-detail-meta">
            <span>Объём: ${itemVolumeLabel(item, ex)}</span>
            <span>Инвентарь: ${equipLabel(ex.equipment)}</span>
          </div>
          <div class="plan-detail-focus"><b>Фокус:</b> ${esc(ex.focus)}</div>
          <div class="plan-tempo"><b>Темп:</b> ${esc(g.tempo)}</div>
          <div class="plan-rest"><b>Отдых:</b> ${esc(g.rest)}</div>
        </div>`;
    })
    .join('');

  // Когда резерв обязательный, он уже вставлен в items (перед заминкой) и
  // виден в кратком плане/подробностях с меткой "резерв" — отдельный блок
  // внизу тогда не нужен, иначе один и тот же пункт дублируется на экране.
  const reserveBlock = reserve.mandatory
    ? ''
    : `
    <div class="plan-reserve">
      <strong>Резерв (${esc(reserve.label)})</strong> —
      ${catalogByCode[reserve.exercise_code] ? esc(catalogByCode[reserve.exercise_code].name) : reserve.exercise_code},
      ${reserve.volume_m}м, тот же стиль и фокус, что в основной серии — для сравнимости прогресса.
      <div class="hint">Выполняется "если успевает", в общий объём не входит.</div>
    </div>`;

  let rangeNote;
  if (withinRange && multipleOf100) {
    rangeNote = `<span class="ok">В диапазоне ${targetMin}–${targetMax} м, кратно 100 м — ${who} заканчивает у старта</span>`;
  } else if (!multipleOf100) {
    rangeNote = `<span class="warn">Объём ${mandatoryVolume} м не кратен 100 м — ${who} не закончит тренировку у старта (PLAN_RULES.md, "Позиция у борта"). Попробуйте другой диапазон.</span>`;
  } else {
    rangeNote = `<span class="warn">Не удалось точно попасть в диапазон ${targetMin}–${targetMax} м доступными упражнениями — объём ${mandatoryVolume} м. Добавьте упражнение или измените диапазон.</span>`;
  }

  return `
    <div class="plan-summary">
      <div class="plan-total">Объём (обязательный): <strong>${mandatoryVolume} м</strong> ${rangeNote}</div>
      ${reserve.mandatory ? `<div class="plan-total-with-reserve">Итого с резервом: <strong>${totalVolume} м</strong></div>` : ''}
    </div>
    <h3 class="plan-h">Краткий план</h3>
    <ol class="plan-short-list">${shortLines}</ol>
    <h3 class="plan-h">Подробности</h3>
    <div class="plan-details">${detailRows}</div>
    ${reserveBlock}
    <details class="rest-segments">
      <summary>Показать по отрезкам (маркеры отдыха)</summary>
      ${renderRestSegments(items, catalogByCode)}
    </details>
  `;
}

function renderRestSegments(items, catalogByCode) {
  const segments = expandToRestSegments(items);
  const parts = segments.map((seg, idx) => {
    const ex = catalogByCode[seg.code];
    const name = ex ? ex.name : seg.code;
    return `<span class="segment">${esc(name)} ${seg.segment_m}м</span>` + (idx < segments.length - 1 ? '<span class="rest-marker">↴ отдых</span>' : '');
  });
  return `<div class="segments-flow">${parts.join('')}</div>`;
}
