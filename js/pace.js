// Оценка времени тренировки и рекомендуемой дистанции по темпу кроля.
//
// Темп задаётся для обычного кроля в полной координации. Остальное плывётся
// медленнее:
//  - упражнения (drills, работа с инвентарём, прогрессии) — в 1.5–1.8 раза,
//    берём середину 1.65;
//  - другие стили целиком (брасс, спина) — в 1.3 раза.
// Отдых — после каждых 50 м (PLAN_RULES.md). В оценке плана — паузы из
// js/guidance.js по виду упражнения и уровню; в рекомендации дистанции — 20 с в среднем.

import { restSecForItem } from './guidance.js';

// Темп кроль на 100 м: ключ → подпись → середина диапазона в секундах.
export const PACES = [
  ['lt_1_30', '1:30 и быстрее', 85],
  ['1_30_2_00', '1:30–2:00', 105],
  ['2_00_2_30', '2:00–2:30', 135],
  ['2_30_3_00', '2:30–3:00', 165],
  ['3_00_4_00', '3:00–4:00', 210],
  ['gt_4_00', '4:00 и медленнее', 255],
];

export const FACTOR_DRILL = 1.65;
export const FACTOR_OTHER_STYLE = 1.3;
export const REST_SEC_PER_50 = 20;

// Обычный кроль: разминка, основной кроль, заминка.
const CRAWL_CODES = new Set(['ne_warmup', 'ne_main_crawl', 'ne_cooldown']);

// Типичный состав плана для рекомендации дистанции (доли объёма).
const TYPICAL_MIX = { crawl: 0.4, otherStyle: 0.2, drill: 0.4 };

export function paceSeconds(paceKey) {
  const p = PACES.find((x) => x[0] === paceKey);
  return p ? p[2] : null;
}

export function speedFactor(ex) {
  if (!ex || CRAWL_CODES.has(ex.code)) return 1;
  // Базовые упражнения без инвентаря кроме кроля — это другие стили целиком.
  if (!ex.equipment && ex.tier === 'base') return FACTOR_OTHER_STYLE;
  return FACTOR_DRILL;
}

/** Минуты на план: плавание с учётом коэффициентов + отдых после каждых 50 м. */
export function estimatePlanMinutes(items, byCode, paceKey, level = 'beginner') {
  const sec100 = paceSeconds(paceKey);
  if (!sec100) return null;
  let swimSec = 0;
  let restSec = 0;
  for (const item of items) {
    const parts = item.combo || [{ code: item.code, volume_m: item.volume_m }];
    for (const part of parts) {
      swimSec += (part.volume_m / 100) * sec100 * speedFactor(byCode[part.code]);
      restSec += restSecForItem(byCode[part.code], part.volume_m, level, item.combo ? null : item.set);
    }
  }
  return Math.round((swimSec + restSec) / 60);
}

// Секунд на метр при типичном составе плана, с отдыхом.
function typicalSecPerMeter(paceKey) {
  const sec100 = paceSeconds(paceKey);
  if (!sec100) return null;
  const avgFactor =
    TYPICAL_MIX.crawl * 1 + TYPICAL_MIX.otherStyle * FACTOR_OTHER_STYLE + TYPICAL_MIX.drill * FACTOR_DRILL;
  return (sec100 / 100) * avgFactor + REST_SEC_PER_50 / 50;
}

/** Рекомендуемая дистанция (кратно 100 м) на заданное число минут. */
export function recommendVolume(minutes, paceKey) {
  const spm = typicalSecPerMeter(paceKey);
  if (!spm || !minutes) return null;
  return Math.max(100, Math.floor((minutes * 60) / spm / 100) * 100);
}

/** Примерное время (мин) на дистанцию при типичном составе плана. */
export function estimateVolumeMinutes(volume, paceKey) {
  const spm = typicalSecPerMeter(paceKey);
  if (!spm || !volume) return null;
  return Math.round((volume * spm) / 60);
}
