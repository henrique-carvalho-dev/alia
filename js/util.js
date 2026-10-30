/* Utilidades: seletor, datas, texto, moeda e nome inteligente. */
const $=s=>document.querySelector(s);
const NAME_MAP = {"AYO":"Treino diário"};           // nome inteligente
const months=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const pad=n=>String(n).padStart(2,'0');
const isoD=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toMin=t=>+t.slice(11,13)*60+ +t.slice(14,16);
const hhmm=m=>pad(Math.floor(m/60))+':'+pad(m%60);
const apelidosExtra={};                           // apelidos criados pela pessoa (js/memoria.js preenche)
const CATS={d:["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Outros"],r:["Honorários","Salário","Outros"]};
const smart=t=>{const u=t.trim().toUpperCase();for(const k in NAME_MAP){if(u===k)return NAME_MAP[k]}for(const [k,v] of Object.entries(apelidosExtra)){if(u===k)return v}return t};
const now=new Date();
function mkey(y,m){return y+'-'+pad(m+1)}
// Sem acento e em minúscula, MANTENDO o tamanho (um caractere vira um caractere): as posições achadas no
// texto limpo valem no texto original. Caractere que mudaria de tamanho (hangul, por exemplo) fica como está.
const strip=s=>{let o='';for(const c of String(s).normalize('NFC')){const b=c.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();o+=b.length===c.length?b:c}return o};
// limites que o armazenamento aceita (ver sanearBanco em ponte.js)
const VALOR_MAX=1e9,TEXTO_MAX=120;
// corta em n caracteres sem deixar meia letra de emoji (par substituto) no fim
const cortar=(s,n)=>String(s).slice(0,n).replace(/[\ud800-\udbff]$/,'');
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

/* Se o navegador não deixar gravar, a pessoa precisa saber: o que ela cria passa a valer só nesta página. */
let armazenamentoOk=true;
function marcarArmazenamento(ok){
  if(ok||!armazenamentoOk)return;
  armazenamentoOk=false;
  const b=document.querySelector('#demoBar');
  if(b){b.textContent='Atenção: o navegador não deixou salvar. O que você criar vale só enquanto esta página estiver aberta.';b.style.display='block'}
}
