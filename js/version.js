// Fonte única da versão exibida no app e do cache do service worker (sw.js carrega este arquivo). Atualize junto com o CHANGELOG.md.
const APP_VERSION = '0.5.0';
if (typeof document !== 'undefined') document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = APP_VERSION; });
