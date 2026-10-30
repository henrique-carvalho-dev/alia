/* ---------- PWA: instalar no celular, abrir sem internet e avisar de versão nova ----------
   O service worker (sw.js) guarda o app no aparelho. Aqui ficam o botão de instalar (Perfil) e o aviso
   "Há uma versão nova" (o app só troca de versão quando a pessoa aceita). */
let promptInstalacao = null;       // evento beforeinstallprompt (Chrome no Android e no computador)
let esperandoAtualizar = null;     // service worker novo esperando a pessoa aceitar
let atualizacaoPedida = false;

const SEGURO = h => ['localhost', '127.0.0.1', '[::1]'].includes(h);

/* Decide o que mostrar em Perfil → Instalar no celular. Pura: recebe o ambiente, devolve o estado. */
function estadoInstalacao(env) {
  if (env.emApp) return { tipo: 'instalada', texto: 'A Ália já está instalada neste aparelho.' };
  if (env.prompt) return { tipo: 'botao', texto: 'Instale a Ália na tela inicial para abrir como um aplicativo, até sem internet.' };
  if (!env.seguro) return { tipo: 'inseguro', texto: 'Para instalar, abra a Ália pelo endereço seguro (https) em que ela foi publicada. Aqui ela funciona, mas não dá para instalar.' };
  if (env.ios) return { tipo: 'ios', texto: 'No iPhone ou iPad, de preferência no Safari: toque em Compartilhar (o quadrado com a seta) e depois em "Adicionar à Tela de Início".' };
  return { tipo: 'manual', texto: 'No Android (Chrome), abra o menu ⋮ e toque em "Instalar app" ou "Adicionar à tela inicial". No computador, use o ícone de instalar na barra de endereço.' };
}
function ambienteInstalacao() {
  return {
    emApp: (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    seguro: location.protocol === 'https:' || SEGURO(location.hostname),
    prompt: !!promptInstalacao
  };
}
function renderInstalar() {
  const box = document.getElementById('instalarBox');
  if (!box) return;
  const e = estadoInstalacao(ambienteInstalacao());
  box.innerHTML = `<p class="note" data-instalar="${e.tipo}">${esc(e.texto)}</p>` + (e.tipo === 'botao' ? '<button type="button" class="primary" onclick="instalarApp()">Instalar a Ália</button>' : '');
}
async function instalarApp() {
  if (!promptInstalacao) return;
  promptInstalacao.prompt();
  try { await promptInstalacao.userChoice; } catch (e) { /* a pessoa fechou */ }
  promptInstalacao = null;
  renderInstalar();
}

function mostrarAtualizacao(worker, texto) {
  esperandoAtualizar = worker;
  const el = document.getElementById('atualizacao');
  if (!el) return;
  document.getElementById('atualizacaoTexto').textContent = texto || 'Há uma versão nova da Ália.';
  el.hidden = false;
}
function dispensarAtualizacao() { const el = document.getElementById('atualizacao'); if (el) el.hidden = true; }   // volta a aparecer na próxima vez que abrir
function atualizarApp() {
  atualizacaoPedida = true;
  // o worker novo ainda está esperando: manda assumir e a página recarrega em "controllerchange"; senão, só recarrega
  if (esperandoAtualizar && esperandoAtualizar.state === 'installed') esperandoAtualizar.postMessage('pular-espera');
  else if (esperandoAtualizar && esperandoAtualizar.state === 'installing') dispensarAtualizacao();   // ainda instalando: recarregar não troca de versão
  else location.reload();
}

/* No computador de desenvolvimento (Live Server) o service worker fica desligado: remove SÓ o da Ália (e os caches dela),
   sem mexer nos de outros projetos servidos na mesma porta. */
async function desligarServiceWorkerDeDesenvolvimento() {
  const escopo = new URL('./', location.href).href;
  for (const r of await navigator.serviceWorker.getRegistrations()) {
    const w = r.active || r.waiting || r.installing;
    if (w && /\/sw\.js$/.test(w.scriptURL) && r.scope === escopo) await r.unregister();
  }
  for (const k of await caches.keys()) if (k.startsWith('alia-')) await caches.delete(k);
}

function iniciarPwa() {
  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); promptInstalacao = ev; renderInstalar(); });
  window.addEventListener('appinstalled', () => { promptInstalacao = null; renderInstalar(); });
  renderInstalar();
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;   // file:// não tem service worker
  if (!(location.protocol === 'https:' || SEGURO(location.hostname))) return;            // http fora do localhost também não
  if (SEGURO(location.hostname) && !/[?&]sw=1(&|$)/.test(location.search)) { desligarServiceWorkerDeDesenvolvimento().catch(() => {}); return; }
  const tinhaControle = !!navigator.serviceWorker.controller;   // na 1ª instalação o worker "assume" a página sem que isso seja versão nova
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (atualizacaoPedida) location.reload();
    else if (tinhaControle) mostrarAtualizacao(null, 'A Ália foi atualizada em outra janela. Recarregue para usar a versão nova.');   // outra aba aceitou a atualização
  });
  // updateViaCache:'none': nem o sw.js nem o version.js que ele importa passam pelo cache HTTP do servidor (GitHub Pages guarda 10 min)
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    const avisar = () => { if (reg.waiting && navigator.serviceWorker.controller) mostrarAtualizacao(reg.waiting); };   // 1ª instalação não é "versão nova"
    avisar();
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (novo) novo.addEventListener('statechange', () => { if (novo.state === 'installed') avisar(); });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });   // volta ao app: confere se há versão nova
  }).catch(() => { /* sem service worker o app funciona igual, só não abre offline */ });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') iniciarPwa();
