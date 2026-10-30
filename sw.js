/* Service worker da Ália: guarda o app no aparelho para abrir sem internet e poder ser instalado.
   A versão vem de js/version.js (fonte única): subiu a versão, o cache muda e os aparelhos oferecem a atualização.
   Estratégia: tudo do próprio app vem do cache primeiro (o app não usa nada de fora); a rede só entra se faltar algo. */
importScripts('js/version.js');

const CACHE = 'alia-' + APP_VERSION;
// Tudo o que o app precisa para abrir sem internet. Nada do index.html pode ficar de fora desta lista.
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/aila.css',
  'js/version.js', 'js/tema.js', 'js/util.js', 'js/memoria.js', 'js/ponte.js', 'js/agenda.js', 'js/interprete.js',
  'js/assistente.js', 'js/financas.js', 'js/perfil.js', 'js/app.js', 'js/pwa.js',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png'
];

// Não pula a espera sozinho: a pessoa decide quando atualizar (aviso "Atualizar" no app), para não trocar o app no meio do uso.
// cache:'reload' ignora o cache HTTP do servidor (o GitHub Pages guarda 10 min): sem isso a versão nova podia gravar arquivos velhos.
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' }))))));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('alia-') && k !== CACHE) await caches.delete(k);   // versões antigas
  await self.clients.claim();
})()));

self.addEventListener('message', e => { if (e.data === 'pular-espera') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // só o que é do app
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: true });   // ?sw=1, #atalhos e afins não mudam o arquivo
    if (guardado) return guardado;
    try { return await fetch(req); }
    catch (err) {
      if (req.mode === 'navigate') return cache.match('index.html');   // sem internet e fora do cache: abre o app mesmo assim
      throw err;
    }
  })());
});
