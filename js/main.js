import { initPlanTab } from './tabs/planTab.js';
import { initCatalogTab } from './tabs/catalogTab.js';
import { initLogTab } from './tabs/logTab.js';
import { initSettingsTab } from './tabs/settingsTab.js';

const ICON = {
  plan: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l2 2 3-4"/>',
  catalog: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  log: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};
const icon = (id) =>
  `<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg>`;

const TABS = [
  { id: 'plan', label: 'Генератор плана', init: initPlanTab },
  { id: 'catalog', label: 'Каталог упражнений', init: initCatalogTab },
  { id: 'log', label: 'Журнал тренировок', init: initLogTab },
  { id: 'settings', label: 'Настройки', init: initSettingsTab },
];

function main() {
  const tabButtons = document.getElementById('tab-buttons');
  const tabRoot = document.getElementById('tab-root');

  tabButtons.innerHTML = TABS.map((t, i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" data-id="${t.id}">${icon(t.id)}<span>${t.label}</span></button>`).join('');

  function activate(id) {
    const tab = TABS.find((t) => t.id === id);
    if (!tab) return;
    tabButtons.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    tabRoot.innerHTML = '';
    tab.init(tabRoot);
  }

  tabButtons.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.id));
  });

  activate(TABS[0].id);
}

main();
