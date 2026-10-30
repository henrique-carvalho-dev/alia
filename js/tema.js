/* Tema: "auto" segue o sistema; "light" e "dark" fixam. Carregado no <head> para a tela não piscar. */
const TEMA_CHAVE='aila_tema';
const TEMA_BARRA={light:'#A0666F',dark:'#1C1517'};   // cor da barra do navegador no celular
const temaSistemaEscuro=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
function lerTema(){try{return localStorage.getItem(TEMA_CHAVE)||'auto'}catch(e){return 'auto'}}
function aplicarTema(t){
  if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);
  else document.documentElement.removeAttribute('data-theme');
  const escuro=t==='dark'||(t!=='light'&&!!temaSistemaEscuro&&temaSistemaEscuro.matches);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=escuro?TEMA_BARRA.dark:TEMA_BARRA.light;
}
aplicarTema(lerTema());
if(temaSistemaEscuro&&temaSistemaEscuro.addEventListener)temaSistemaEscuro.addEventListener('change',()=>aplicarTema(lerTema()));
