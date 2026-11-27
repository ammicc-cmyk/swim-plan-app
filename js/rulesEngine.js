// Детерминированный генератор плана тренировки. Никаких вызовов AI — вся логика
// основана на каталоге (exercise_library.json) и правилах (PLAN_RULES.md).
//
// Порядок блоков (PLAN_RULES.md): разминка -> инвентарь -> без инвентаря ->
// заминка -> резерв. Разминка — первый пункт (как и ожидает тренер), сразу
// за ней блок с инвентарём — это допустимо, т.к. правило требует не "ноль
// метров перед инвентарём", а "объём перед инвентарём кратен 100" (см. ниже).
//
// КЛЮЧЕВОЙ ИНВАРИАНТ (PLAN_RULES.md, "Позиция у борта"): бассейн 50м без
// разделителя, план "живёт" у старта — КАЖДЫЙ пункт плана должен начинаться
// у старта, не только блок с инвентарём и не только итоговая сумма. Значит
// каждый пункт плана сам по себе должен быть кратен 100м — это либо одно
// упражнение, проплытое 2×50 (100м), либо "круг" из двух РАЗНЫХ упражнений
// по 50м каждое (combo-пункт, например "50м кроль на кулаках + 50м обычный
// кроль" — пример пользователя). Одиночный необёрнутый пункт в 50м допустим
// только как половина такого круга, никогда сам по себе. Это гарантируется
// на этапе построения плана (ниже), а не проверкой суммы после — более
// ранняя версия проверяла только итоговую кратность 100 и пропускала
// одиночные 50м-пункты (разминка/брасс/спина/заминка) посередине плана, из-за
// чего следующее упражнение стартовало не с той стороны. Отдельно: разминку
// сначала поставили ПОСЛЕ блока с инвентарём (чтобы точно не было ничего
// перед ним) — из-за этого она "терялась" где-то в середине краткого списка
// (шаг 4), что сбивало с толку читающего план. Вернули на привычное место
// первым пунктом, раз она и так уже 100м (баги найдены по фидбэку
// пользователя 2026-09-16, см. HANDOVER.md).

const STATUS_RANK = { mastered: 0, in_progress: 1, proposed: 2, deferred: 3 };

function unitFor(ex) {
  return ex.equipment ? 100 : 50;
}

function byStatusRank(a, b) {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status];
}

// ---------- Стили (добавлено 2026-11-27) ----------
// Стиль упражнения: поле style из каталога, иначе по коду/названию.
// 'mixed' — упражнения без привязки к одному стилю (переключение, скаллинг).
export const STYLES = ['crawl', 'breast', 'back'];
export const STYLE_LABEL = { crawl: 'Кроль', breast: 'Брасс', back: 'Спина' };
const STYLE_BY_CODE = {
  ne_switch33: 'mixed',
  ne_scull: 'mixed',
  ne_cooldown: 'mixed',
};
export function styleOf(ex) {
  if (!ex) return 'crawl';
  if (ex.style) return ex.style;
  if (STYLE_BY_CODE[ex.code]) return STYLE_BY_CODE[ex.code];
  const n = (ex.name || '').toLowerCase();
  if (n.includes('брасс')) return 'breast';
  if (n.includes('спин')) return 'back';
  return 'crawl';
}
// Упражнение «стиль целиком» — им плывётся основная серия и стилевой сет.
export const FULL_STYLE_CODE = { crawl: 'ne_main_crawl', breast: 'ne_breast_full', back: 'ne_back_pause' };
const STRUCTURAL = new Set(['ne_warmup', 'ne_cooldown', 'ne_main_crawl']);

// ---------- Основная серия ----------
// Самый длинный отрезок без остановки: по уровню, но не меньше, чем
// подразумевает сам объём тренировки (3000 м — это не начинающий по 50 м).
function maxRepeatFor(level, aim) {
  const byLevel = { beginner: 50, intermediate: 200, advanced: 400 }[level] || 50;
  const byVolume = aim >= 2000 ? 400 : aim >= 1200 ? 200 : 50;
  return Math.max(byLevel, byVolume);
}

const LADDERS = [
  [100, 200, 100],
  [200, 400, 200],
  [100, 200, 300, 200, 100],
  [100, 200, 300, 400],
  [400, 300, 200, 100],
  [100, 200, 300, 400, 300, 200, 100],
  [200, 400, 600, 400, 200],
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function repeatsLabel(n, d) {
  return n === 1 ? `${d}м` : `${n}×${d}м`;
}

/**
 * Структура основной серии объёмом vol (кратен 100).
 * @returns {{ parts:number[], label:string, kind:'repeats'|'ladder'|'mixed' }}
 */
export function buildMainSet(vol, maxRep) {
  if (maxRep <= 50 || vol <= 100) {
    const n = Math.round(vol / 50);
    return { parts: Array(n).fill(50), label: repeatsLabel(n, 50), kind: 'repeats' };
  }
  const candidates = [];
  for (const d of [100, 200, 300, 400, 500, 600, 800]) {
    if (d > maxRep || vol % d !== 0) continue;
    const n = vol / d;
    if (n >= 2 && n <= 10) candidates.push({ parts: Array(n).fill(d), label: repeatsLabel(n, d), kind: 'repeats' });
  }
  for (const ladder of LADDERS) {
    if (Math.max(...ladder) > maxRep) continue;
    const lsum = ladder.reduce((a, b) => a + b, 0);
    const ladderLabel = `лесенка ${ladder.join('+')}м`;
    if (lsum === vol) {
      candidates.push({ parts: ladder, label: ladderLabel, kind: 'ladder' });
    } else if (lsum < vol) {
      const rest = vol - lsum;
      for (const d of [100, 200]) {
        const n = rest / d;
        if (rest % d === 0 && n >= 1 && n <= 6 && d <= maxRep) {
          candidates.push({
            parts: [...ladder, ...Array(n).fill(d)],
            label: `${ladderLabel} + ${repeatsLabel(n, d)}`,
            kind: 'mixed',
          });
        }
      }
    }
  }
  if (candidates.length) return pick(candidates);
  const n = vol / 100;
  return { parts: Array(n).fill(100), label: repeatsLabel(n, 100), kind: 'repeats' };
}

// Настоящая случайность (Math.random), не история из журнала — по прямому
// запросу пользователя (2026-09-16): чередование "не повторять прошлую
// тренировку" давало слишком мало вариативности (правило работает только
// если тренер сохраняет каждую тренировку в журнал, и даже тогда меняло
// от силы 1 пункт из 10 — пул кандидатов слишком маленький). Детерминизм
// из HANDOVER.md был про "не нужен AI/LLM в рантайме", не про "один и тот
// же результат при каждом клике" — сами ПРАВИЛА (кратность, порядок
// блоков, лимит новых упражнений) остаются жёстко детерминированными,
// случайно выбирается только ЧТО из уже разрешённого правилами набора
// попадёт в конкретный план. Fisher–Yates.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/**
 * @param {object} params
 * @param {Array} params.catalog - exercise_library.json exercises
 * @param {Array} params.log - training_log.json entries (хронологический порядок, старые первыми)
 * @param {number} params.targetMin
 * @param {number} params.targetMax
 * @param {object} params.settings
 * @param {object} [params.overrides] - { forceExclude:[code], forceInclude:[code],
 *   forceVolume:{code:meters}, allowDeferred:[code], maxNewItems:number, noNewItem:bool }
 */
export function generatePlan({ catalog, log, targetMin, targetMax, settings, overrides = {} }) {
  const forceExclude = overrides.forceExclude || [];
  const forceInclude = overrides.forceInclude || [];
  const forceVolume = overrides.forceVolume || {};
  const allowDeferred = overrides.allowDeferred || [];
  const maxNewItems = overrides.noNewItem ? 0 : overrides.maxNewItems ?? 1;

  const byCode = Object.fromEntries(catalog.map((e) => [e.code, e]));

  // deferred упражнения генератор сам никогда не предлагает — это единственный
  // надёжный способ выполнить "не предлагать deferred сразу после неудачной попытки"
  // без привязки к точным датам последней попытки (last_attempt_date часто ещё не
  // проставлена). Возврат из deferred — осознанное действие тренера в каталоге,
  // либо ручной allowDeferred-оверрайд здесь.
  // Инвентарь из «Параметров пловца»: упражнение с доской/колобашкой не
  // предлагается, если этого инвентаря нет. board_optional можно делать и без доски.
  const availableEquipment = Array.isArray(settings && settings.available_equipment)
    ? settings.available_equipment
    : null;
  const equipmentMissing = (ex) =>
    availableEquipment !== null &&
    ex.equipment &&
    ex.equipment !== 'board_optional' &&
    !availableEquipment.includes(ex.equipment);

  // Стили из «Параметров пловца»: упражнения только отмеченных стилей
  // (основных и дополнительных) + упражнения без привязки к стилю.
  const level = (settings && settings.swimmer_level) || 'beginner';
  const mainStyles = (settings && settings.main_styles && settings.main_styles.length ? settings.main_styles : ['crawl']).filter((s) => STYLES.includes(s));
  const extraStyles = ((settings && settings.extra_styles) || []).filter((s) => STYLES.includes(s) && !mainStyles.includes(s));
  const allowedStyles = new Set([...mainStyles, ...extraStyles, 'mixed']);

  const eligible = catalog.filter((ex) => {
    if (forceExclude.includes(ex.code)) return false;
    if (equipmentMissing(ex)) return false;
    if (!STRUCTURAL.has(ex.code) && !allowedStyles.has(styleOf(ex))) return false;
    if (ex.status === 'deferred' && !allowDeferred.includes(ex.code)) return false;
    return true;
  });
  const eligibleByCode = Object.fromEntries(eligible.map((e) => [e.code, e]));

  const warmup = eligible.find((e) => e.code === 'ne_warmup');
  const cooldown = eligible.find((e) => e.code === 'ne_cooldown');

  // Основной стиль: случайный из отмеченных, у которого в каталоге есть
  // упражнение «стиль целиком» (кроль → кроль в полной координации и т.д.).
  const mainStyleCandidates = mainStyles.filter((s) => eligibleByCode[FULL_STYLE_CODE[s]]);
  const mainStyle = mainStyleCandidates.length ? shuffle(mainStyleCandidates)[0] : 'crawl';
  const mainEx = eligibleByCode[FULL_STYLE_CODE[mainStyle]] || byCode['ne_main_crawl'];
  const mainCode = mainEx ? mainEx.code : null;

  const equipmentPool = eligible
    .filter((e) => e.equipment && e.code !== 'ne_warmup' && e.code !== 'ne_cooldown')
    .sort(byStatusRank);

  const noEquipBasePool = eligible.filter(
    (e) => !e.equipment && e.tier === 'base' && !STRUCTURAL.has(e.code) && e.code !== mainCode
  );

  // Технические упражнения: сначала основного стиля, потом дополнительных
  // (внутри каждой группы — случайный порядок).
  const noEquipMediumPool = eligible.filter(
    (e) => !e.equipment && (e.tier === 'medium' || e.tier === 'advanced') && !STRUCTURAL.has(e.code)
  );
  const isMainStyle = (ex) => mainStyles.includes(styleOf(ex)) || styleOf(ex) === 'mixed';
  const orderedMedium = [
    ...shuffle(noEquipMediumPool.filter(isMainStyle)),
    ...shuffle(noEquipMediumPool.filter((e) => !isMainStyle(e))),
  ];

  const items = [];

  function volumeFor(ex) {
    if (forceVolume[ex.code]) return forceVolume[ex.code];
    return unitFor(ex);
  }

  // requires (CATALOG_SCHEMA.md, добавлено 2026-09-22): упражнение из
  // пошаговой прогрессии (например 5 шагов кроля на спине) не должно
  // всплывать раньше своего предшественника. Пока предшественник не
  // "в процессе"/"освоено" — генератор сам его не предложит; ручной
  // forceInclude это правило обходит осознанно (тренер решил сам).
  function prerequisiteMet(ex) {
    if (!ex.requires) return true;
    const prereq = byCode[ex.requires];
    return !!prereq && (prereq.status === 'mastered' || prereq.status === 'in_progress');
  }

  // Какое (если есть) новое/предложенное упражнение попадёт в этот план —
  // решается один раз, заранее, случайным выбором из ВСЕХ подходящих
  // кандидатов (инвентарь + drills вместе). Не больше 1 продвинутого.
  const proposedCandidates = [...equipmentPool, ...noEquipMediumPool].filter((ex) => ex.status === 'proposed');
  const chosenNewCodes = new Set();
  if (maxNewItems > 0 && proposedCandidates.length) {
    const forced = proposedCandidates.filter((ex) => forceInclude.includes(ex.code));
    const rest = shuffle(proposedCandidates.filter((ex) => !forceInclude.includes(ex.code) && prerequisiteMet(ex)));
    let advancedUsed = false;
    for (const ex of [...forced, ...rest]) {
      if (chosenNewCodes.size >= maxNewItems) break;
      if (ex.tier === 'advanced' && advancedUsed) continue;
      chosenNewCodes.add(ex.code);
      if (ex.tier === 'advanced') advancedUsed = true;
    }
  }

  function canIncludeNew(ex) {
    if (ex.status !== 'proposed') return true;
    return chosenNewCodes.has(ex.code);
  }

  // Объём любого пункта плана (обычного или combo из половинок).
  function itemVolume(item) {
    return item.combo ? item.combo.reduce((s, h) => s + h.volume_m, 0) : item.volume_m;
  }

  // Новое упражнение — первая попытка уменьшенным объёмом (50 м), в паре с
  // 50 м основного стиля: один круг 100 м у старта.
  function newItemCombo(ex) {
    const fillerCode = mainCode || (cooldown ? cooldown.code : ex.code);
    return {
      combo: [
        { code: ex.code, volume_m: forceVolume[ex.code] || unitFor(ex) },
        { code: fillerCode, volume_m: 50 },
      ],
      block: 'no_equipment',
      is_new: true,
    };
  }

  // Упражнение с always_include:false чередуется случайно (~50/50).
  function rotationEligible(ex) {
    if (ex.status === 'proposed') return true;
    if (ex.always_include === false) return Math.random() < 0.5;
    return true;
  }

  // ---------- Масштаб под объём (добавлено 2026-11-27) ----------
  // Длинная тренировка — это не один бесконечный основной кроль: растут
  // разминка/заминка, упражнения с инвентарём, число технических упражнений
  // и стилевой сет; основная серия ограничена ~третью объёма и строится как
  // серия (3×400) или лесенка (100+200+300+…), а не 40×50.
  const aim = Math.max(200, Math.round((targetMin + targetMax) / 200) * 100);
  const warmupVol = forceVolume.ne_warmup || (aim < 1200 ? 100 : aim < 2200 ? 200 : 300);
  const cooldownVol = forceVolume.ne_cooldown || (aim < 1500 ? 100 : 200);
  const equipVol = aim >= 2000 ? 200 : 100;
  const baseDrillVol = aim >= 2000 ? 200 : 100;
  const maxDrills = 6;
  const mainCap = Math.max(200, Math.round((aim * 0.35) / 100) * 100);

  // Разминка — первым пунктом (объём кратен 100 → пловец у старта перед инвентарём).
  if (warmup) {
    items.push({ code: warmup.code, volume_m: warmupVol, block: 'warmup', is_new: false });
  }

  // Блок с инвентарём — целиком, сразу после разминки.
  for (const ex of equipmentPool) {
    if (!canIncludeNew(ex)) continue;
    if (!rotationEligible(ex)) continue;
    const isNew = ex.status === 'proposed';
    items.push({ code: ex.code, volume_m: forceVolume[ex.code] || (isNew ? volumeFor(ex) : equipVol), block: 'equipment', is_new: isNew });
  }

  // Стилевой сет: «стиль целиком» для всех отмеченных стилей по кругу, по 50 м.
  const stylePool = [];
  for (const s of [...mainStyles, ...extraStyles]) {
    const ex = eligibleByCode[FULL_STYLE_CODE[s]];
    if (!ex || stylePool.includes(ex)) continue;
    if (ex.code !== mainCode && !rotationEligible(ex)) continue;
    stylePool.push(ex);
  }
  for (const extra of noEquipBasePool.filter((e) => !Object.values(FULL_STYLE_CODE).includes(e.code))) {
    if (styleOf(extra) === 'mixed' && rotationEligible(extra)) stylePool.push(extra);
  }
  let styleItem = null;
  if (stylePool.length >= 2) {
    const minSeg = aim < 1200 ? 2 : aim < 2200 ? 4 : 6;
    const segCount = shuffle([minSeg, minSeg + 2])[0];
    styleItem = { combo: [], block: 'no_equipment', is_new: false, style_set: true, pool: shuffle(stylePool) };
    setStyleSegments(styleItem, segCount);
    items.push(styleItem);
  }
  function setStyleSegments(item, count) {
    item.combo = Array.from({ length: count }, (_, i) => ({ code: item.pool[i % item.pool.length].code, volume_m: 50 }));
  }

  // Технические упражнения: стартово 2, дальше добавляются, пока основная
  // серия не уложится в mainCap.
  const drillQueue = orderedMedium.filter((ex) => canIncludeNew(ex));
  const drillItems = [];
  function addDrill() {
    const ex = drillQueue.shift();
    if (!ex) return false;
    const item =
      ex.status === 'proposed'
        ? newItemCombo(ex)
        : { code: ex.code, volume_m: forceVolume[ex.code] || baseDrillVol, block: 'no_equipment', is_new: false };
    drillItems.push(item);
    items.push(item);
    return true;
  }
  addDrill();
  addDrill();

  // Основная серия — пока заглушка, объём и структура считаются ниже.
  const mainItem = mainCode
    ? { code: mainCode, volume_m: 100, block: 'no_equipment', is_new: false, flexible: true, main_set: true }
    : null;
  if (mainItem) items.push(mainItem);

  if (cooldown) {
    items.push({ code: cooldown.code, volume_m: cooldownVol, block: 'cooldown', is_new: false });
  }

  const sum = () => items.reduce((s, i) => s + itemVolume(i), 0);
  const fixedSum = () => items.reduce((s, i) => (i.flexible ? s : s + itemVolume(i)), 0);

  // Рост: если на основную серию остаётся больше mainCap — добавляем
  // упражнения, удлиняем их и стилевой сет, а не основную серию.
  let growGuard = 0;
  while (aim - fixedSum() > mainCap && growGuard < 40) {
    growGuard += 1;
    if (drillItems.length < maxDrills && drillQueue.length && addDrillBeforeMain()) continue;
    const shortDrill = drillItems.find((d) => !d.combo && d.volume_m < 300);
    if (shortDrill) {
      shortDrill.volume_m += 100;
      continue;
    }
    if (styleItem && styleItem.combo.length < 12) {
      setStyleSegments(styleItem, styleItem.combo.length + 2);
      continue;
    }
    const eqItem = items.find((i) => i.block === 'equipment' && !i.is_new && i.volume_m < 300);
    if (eqItem) {
      eqItem.volume_m += 100;
      continue;
    }
    break;
  }
  function addDrillBeforeMain() {
    const before = items.length;
    if (!addDrill()) return false;
    // addDrill кладёт в конец — переносим перед основной серией/заминкой.
    const added = items.splice(before, 1)[0];
    const idx = mainItem ? items.indexOf(mainItem) : items.findIndex((i) => i.block === 'cooldown');
    items.splice(idx === -1 ? items.length : idx, 0, added);
    return true;
  }

  // Подрезка: если даже 100 м основной серии не влезают в верхнюю границу —
  // убираем новое упражнение, затем технические с конца, затем укорачиваем
  // стилевой сет.
  let trimGuard = 0;
  while (fixedSum() + (mainItem ? 100 : 0) > targetMax && trimGuard < 20) {
    trimGuard += 1;
    const newIdx = items.findIndex((i) => i.is_new);
    if (newIdx !== -1) {
      const removed = items.splice(newIdx, 1)[0];
      const di = drillItems.indexOf(removed);
      if (di !== -1) drillItems.splice(di, 1);
      continue;
    }
    if (drillItems.length) {
      items.splice(items.indexOf(drillItems.pop()), 1);
      continue;
    }
    if (styleItem && styleItem.combo.length > 2) {
      setStyleSegments(styleItem, styleItem.combo.length - 2);
      continue;
    }
    // Короткая тренировка: оставляем одно упражнение с инвентарём.
    const eqItems = items.filter((i) => i.block === 'equipment');
    if (eqItems.length > 1) {
      items.splice(items.lastIndexOf(eqItems[eqItems.length - 1]), 1);
      continue;
    }
    break;
  }
  if (styleItem) delete styleItem.pool;

  // Основная серия: добор до диапазона, шагом 100 м.
  if (mainItem) {
    const fs = fixedSum();
    let mainVol = forceVolume[mainCode] || Math.max(100, aim - fs);
    if (!forceVolume[mainCode]) {
      while (fs + mainVol < targetMin) mainVol += 100;
      while (fs + mainVol > targetMax && mainVol > 100) mainVol -= 100;
    }
    mainItem.volume_m = mainVol;
    mainItem.set = buildMainSet(mainVol, maxRepeatFor(level, aim));
  }

  const totalVolume = sum();
  const withinRange = totalVolume >= targetMin && totalVolume <= targetMax;
  const multipleOf100 = totalVolume % 100 === 0;

  const reserve = {
    exercise_code: mainCode || 'ne_main_crawl',
    volume_m: forceVolume['reserve'] || 100,
    mandatory: !!settings.reserve_mandatory,
    label: settings.reserve_mandatory ? 'обязательный объём' : 'если успевает',
  };
  if (reserve.mandatory) {
    // Заминка обязана оставаться последним пунктом (PLAN_RULES.md) — если
    // резерв стал обязательным, он встаёт ПЕРЕД заминкой, а не после нее
    // (более ранняя версия push'ила резерв в самый конец, уже после
    // заминки — баг найден по фидбэку пользователя 2026-09-16).
    const reserveItem = {
      code: reserve.exercise_code,
      volume_m: reserve.volume_m,
      block: 'reserve',
      is_new: false,
      is_reserve: true,
    };
    const cooldownIdx = items.findIndex((i) => i.block === 'cooldown');
    if (cooldownIdx !== -1) {
      items.splice(cooldownIdx, 0, reserveItem);
    } else {
      items.push(reserveItem);
    }
  }

  return {
    items,
    byCode,
    mainStyle,
    totalVolume: reserve.mandatory ? totalVolume + reserve.volume_m : totalVolume,
    mandatoryVolume: totalVolume,
    targetMin,
    targetMax,
    withinRange,
    multipleOf100,
    reserve,
  };
}

// Разворачивает список пунктов плана в 50-метровые сегменты со сквозным маркером
// отдыха после каждого сегмента (PLAN_RULES.md: "отдых после каждых 50 м,
// независимо от того, где заканчивается конкретное упражнение" — то есть и
// посреди 100-метрового упражнения с инвентарём тоже).
export function expandToRestSegments(items) {
  const segments = [];
  for (const item of items) {
    if (item.set) {
      for (const part of item.set.parts) {
        segments.push({ code: item.code, block: item.block, segment_m: part, exercise_total_m: item.volume_m });
      }
      continue;
    }
    const halves = item.combo || [{ code: item.code, volume_m: item.volume_m }];
    for (const half of halves) {
      const segCount = Math.round(half.volume_m / 50);
      for (let i = 0; i < segCount; i += 1) {
        segments.push({ code: half.code, block: item.block, segment_m: 50, exercise_total_m: half.volume_m });
      }
    }
  }
  return segments;
}
