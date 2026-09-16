// Слой хранения: localStorage + seed из встроенных <script type="application/json">
// в index.html (копии exercise_library.json / training_log.json).
// Источник истины при первом запуске — эти json-файлы; после первого запуска
// приложение работает с localStorage. Экспорт/импорт ниже — ручной механизм
// синхронизации с файлами на диске (см. HANDOVER.md, раздел "Реализация").

export const KEYS = {
  catalog: 'swim_catalog_v1',
  log: 'swim_log_v1',
  settings: 'swim_settings_v1',
};

function readSeed(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    console.error('Не удалось разобрать seed-данные', id, e);
    return null;
  }
}

export function defaultSettings() {
  return {
    pool_length_m: 50,
    style_focus: 'кроль (основной), брасс и спина — для разнообразия',
    frequency_per_week: null,
    session_minutes: 45,
    reserve_mandatory: false,
    deferred_cooldown_sessions: 2,
    default_target_min: 700,
    default_target_max: 900,
  };
}

export function loadCatalog() {
  const raw = localStorage.getItem(KEYS.catalog);
  if (raw) return JSON.parse(raw);
  const seed = readSeed('seed-exercises');
  const exercises = seed ? seed.exercises : [];
  saveCatalog(exercises);
  return exercises;
}

export function saveCatalog(exercises) {
  localStorage.setItem(KEYS.catalog, JSON.stringify(exercises));
}

export function loadLog() {
  const raw = localStorage.getItem(KEYS.log);
  if (raw) return JSON.parse(raw);
  const seed = readSeed('seed-log');
  const entries = seed ? seed.entries : [];
  saveLog(entries);
  return entries;
}

export function saveLog(entries) {
  localStorage.setItem(KEYS.log, JSON.stringify(entries));
}

export function loadSettings() {
  const raw = localStorage.getItem(KEYS.settings);
  if (raw) return JSON.parse(raw);
  const settings = defaultSettings();
  saveSettings(settings);
  return settings;
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCatalog() {
  const exercises = loadCatalog();
  const payload = { $schema_version: '1.0', exercises };
  downloadText('exercise_library.json', JSON.stringify(payload, null, 2));
}

export function exportLog() {
  const entries = loadLog();
  const payload = { $schema_version: '1.0', entries };
  downloadText('training_log.json', JSON.stringify(payload, null, 2));
}

export function importCatalogFile(file) {
  return file.text().then((text) => {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.exercises)) {
      throw new Error('Файл не похож на exercise_library.json — нет массива "exercises".');
    }
    saveCatalog(parsed.exercises);
    return parsed.exercises;
  });
}

const STATUS_LABEL_MD = { mastered: 'освоено', in_progress: 'в процессе', proposed: 'предложено', deferred: 'отложено' };

// HANDOVER.md рекомендует генерировать EXERCISE_LIBRARY.md из json, а не
// держать вручную — чтобы не расходились. Кнопка на вкладке "Каталог".
export function exportExerciseLibraryMd() {
  const exercises = loadCatalog();
  const withEquip = exercises.filter((e) => e.equipment);
  const noEquip = exercises.filter((e) => !e.equipment);

  const equipRows = withEquip
    .map((e) => `| ${e.code} | ${e.name} | ${e.equipment} | ${e.focus} | ${STATUS_LABEL_MD[e.status] || e.status} |`)
    .join('\n');
  const noEquipRows = noEquip
    .map((e) => `| ${e.code} | ${e.name} | ${e.focus} | ${STATUS_LABEL_MD[e.status] || e.status} |`)
    .join('\n');

  const md = `# Каталог упражнений

Сгенерировано из exercise_library.json — не редактировать вручную,
править источник и экспортировать заново.

## С инвентарём (объём кратен 100 м, старт/финиш у стартовой стороны)

| Код | Название | Инвентарь | Фокус | Статус |
|---|---|---|---|---|
${equipRows}

## Без инвентаря (объём кратен 50 м)

| Код | Название | Фокус | Статус |
|---|---|---|---|
${noEquipRows}

Правила добавления упражнения и переходов статуса — см. CATALOG_SCHEMA.md
и PLAN_RULES.md.
`;

  downloadText('EXERCISE_LIBRARY.md', md, 'text/markdown');
}

export function importLogFile(file) {
  return file.text().then((text) => {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.entries)) {
      throw new Error('Файл не похож на training_log.json — нет массива "entries".');
    }
    saveLog(parsed.entries);
    return parsed.entries;
  });
}
