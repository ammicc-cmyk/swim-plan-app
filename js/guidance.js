// Темп (интенсивность) и отдых для каждого пункта плана.
//
// Зависит от вида упражнения и уровня пловца из «Параметров пловца».
// Отдых считается у борта после отрезка 50 м (PLAN_RULES.md); для длинного
// основного кроля предлагается разбивка на серии.

const CRAWL_WARMUP = 'ne_warmup';
const CRAWL_MAIN = 'ne_main_crawl';
const COOLDOWN = 'ne_cooldown';

export function exerciseKind(ex) {
  if (!ex) return 'drill';
  if (ex.code === CRAWL_WARMUP) return 'warmup';
  if (ex.code === CRAWL_MAIN) return 'main';
  if (ex.code === COOLDOWN) return 'cooldown';
  if (!ex.equipment && ex.tier === 'base') return 'style';
  return 'drill';
}

// Отдых (секунд) после каждых 50 м по виду упражнения и уровню.
const REST = {
  beginner: { warmup: 20, drill: 25, style: 25, main: 20, cooldown: 0 },
  intermediate: { warmup: 15, drill: 20, style: 15, main: 15, cooldown: 0 },
  advanced: { warmup: 10, drill: 15, style: 10, main: 10, cooldown: 0 },
};

export function restSecPer50(ex, level) {
  const table = REST[level] || REST.beginner;
  return table[exerciseKind(ex)];
}

const TEMPO = {
  warmup: 'Легко, 4–5 из 10 по ощущениям: можно было бы разговаривать. Разогреться, выровнять дыхание.',
  drill: 'Медленно, на технику. Скорость не важна — важно делать каждое движение правильно.',
  style: 'Спокойно-умеренно, 5 из 10. Плавно и длинно, без рывков.',
  main: 'Умеренно и ровно, 6 из 10: так, чтобы могли проплыть ещё столько же. Все отрезки примерно за одно время — не ускоряйтесь на первых.',
  cooldown: 'Очень легко, 3 из 10. Медленно, растянуто, восстановить дыхание.',
};

/**
 * Подсказки по пункту плана.
 * @returns {{ tempo: string, rest: string }}
 */
export function guidanceFor(ex, volume_m, level) {
  const kind = exerciseKind(ex);
  const sec = restSecPer50(ex, level);
  const reps = Math.round(volume_m / 50);

  let rest;
  if (kind === 'cooldown') {
    rest = `Без остановок: ${volume_m} м подряд, отдых не нужен.`;
  } else if (reps <= 1) {
    rest = `После отрезка — ${sec} с у борта.`;
  } else if (kind === 'main' && reps >= 6) {
    const perSet = level === 'beginner' || !level ? 4 : 6;
    const sets = Math.ceil(reps / perSet);
    rest =
      `${sec} с у борта после каждых 50 м. Удобно разбить на ${sets} ` +
      `сер${sets === 1 ? 'ию' : sets < 5 ? 'ии' : 'ий'} по ${perSet}×50 м с отдыхом 1 мин между сериями. ` +
      'Если 50 м даются легко — можно плыть по 100 м без остановки.';
  } else {
    rest = `${sec} с у борта после каждых 50 м — дыхание должно успокоиться.`;
  }
  return { tempo: TEMPO[kind], rest };
}

/** Секунды отдыха на пункт плана целиком (для оценки времени). */
export function restSecForItem(ex, volume_m, level) {
  const kind = exerciseKind(ex);
  const reps = Math.round(volume_m / 50);
  if (kind === 'cooldown' || reps <= 0) return 0;
  let total = reps * restSecPer50(ex, level);
  if (kind === 'main' && reps >= 6) {
    const perSet = level === 'beginner' || !level ? 4 : 6;
    total += (Math.ceil(reps / perSet) - 1) * 40; // длинная пауза между сериями (~1 мин вместо обычной)
  }
  return total;
}
