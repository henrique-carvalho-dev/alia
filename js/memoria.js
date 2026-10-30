/* ---------- memória pessoal da Ália ----------
   Tudo o que a Ália sabe sobre você: preferências, apelidos e o que aprendeu com o uso.
   Fica só neste aparelho (localStorage, chave aila_perfil), é editável, apagável e exportável.
   Só aprende com o que você faz (correções e escolhas suas). */
const PERFIL_CHAVE='aila_perfil';
const PREFS=[['aerea','Companhia aérea'],['assento','Assento'],['hotel','Hotel'],['aeroporto','Aeroporto']];
const MAX_APELIDOS=100,MAX_APRENDIDOS=500,MAX_ROTINAS=50,MIN_DIAS_ROTINA=3;
const DIAS_ABREV=['dom','seg','ter','qua','qui','sex','sáb'];
const perfilVazio=()=>({v:1,prefs:{},apelidos:{},categorias:{},rotinas:{}});
let perfilAtual=null;

const textoCurto=(v,max)=>typeof v==='string'?cortar(v.trim(),max):'';
const eObjeto=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
/* categorias aprendidas: a chave é "tipo:descrição" (d:feira bairro), então despesa e receita não se misturam */
const chaveCat=(tipo,desc)=>tipo+':'+strip(textoCurto(desc,60));

/* rotinas: a chave é o título sem acento e em minúsculas */
const chaveRotina=t=>strip(textoCurto(t,60)).split(' ').filter(Boolean).join(' ');
const diaDaSemana=iso=>new Date(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10)).getDay();

/* o que vem do armazenamento ou de um arquivo é sempre saneado: só entra o que tem o formato esperado */
function sanearPerfil(p){
  if(!eObjeto(p)||p.v!==1)return null;
  const o=perfilVazio();
  if(eObjeto(p.prefs))for(const [k] of PREFS){const v=textoCurto(p.prefs[k],60);if(v)o.prefs[k]=v}
  if(eObjeto(p.apelidos))for(const k of Object.keys(p.apelidos)){
    if(Object.keys(o.apelidos).length>=MAX_APELIDOS)break;
    const a=textoCurto(k,30).toUpperCase(),b=textoCurto(p.apelidos[k],60);
    if(a&&b&&a!=='__PROTO__'&&!(a in NAME_MAP))o.apelidos[a]=b;
  }
  if(eObjeto(p.categorias))for(const k of Object.keys(p.categorias)){
    if(Object.keys(o.categorias).length>=MAX_APRENDIDOS)break;
    const c=p.categorias[k];
    if(!eObjeto(c)||(c.tipo!=='d'&&c.tipo!=='r')||!CATS[c.tipo].includes(c.cat))continue;
    const m=/^([dr]):(.+)$/.exec(strip(textoCurto(k,62)));
    if(!m||m[1]!==c.tipo||!m[2].trim()||m[2].trim()==='__proto__')continue;
    o.categorias[c.tipo+':'+m[2].trim()]={cat:c.cat,tipo:c.tipo,n:Math.max(1,Math.min(9999,parseInt(c.n,10)||1))};
  }
  if(eObjeto(p.rotinas))for(const k of Object.keys(p.rotinas)){
    if(Object.keys(o.rotinas).length>=MAX_ROTINAS)break;
    const r=p.rotinas[k],ch=chaveRotina(k);
    if(!eObjeto(r)||!ch||ch==='__proto__')continue;
    const titulo=textoCurto(r.titulo,60),hora=parseInt(r.hora,10),dur=parseInt(r.dur,10);
    const dias=Array.isArray(r.dias)?[...new Set(r.dias.filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].sort():[];
    if(!titulo||!(hora>=0&&hora<1440)||!dias.length)continue;
    o.rotinas[ch]={titulo,hora,dur:dur>=5&&dur<=720?dur:60,dias,estado:r.estado==='nao'?'nao':'sim',n:Math.max(1,Math.min(9999,parseInt(r.n,10)||1))};
  }
  return o;
}
function sincronizarApelidos(p){
  for(const k of Object.keys(apelidosExtra))delete apelidosExtra[k];
  Object.assign(apelidosExtra,p.apelidos);
}
function lerPerfil(){
  if(perfilAtual)return perfilAtual;
  let p=null;
  try{p=sanearPerfil(JSON.parse(localStorage.getItem(PERFIL_CHAVE)||'null'))}catch(e){}
  perfilAtual=p||perfilVazio();
  sincronizarApelidos(perfilAtual);
  return perfilAtual;
}
function gravarPerfil(p){   // devolve false quando o navegador não deixou gravar (vale só nesta página)
  perfilAtual=p;sincronizarApelidos(p);
  try{localStorage.setItem(PERFIL_CHAVE,JSON.stringify(p));return true}
  catch(e){marcarArmazenamento(false);return false}
}

/* preferências */
function salvarPref(k,v){
  if(!PREFS.some(x=>x[0]===k))return;
  const p=lerPerfil(),t=textoCurto(v,60);
  if(t)p.prefs[k]=t;else delete p.prefs[k];
  gravarPerfil(p);
}

/* apelidos: "AYO" aparece como "Treino diário" */
function addApelido(de,para){
  const a=textoCurto(de,30).toUpperCase(),b=textoCurto(para,60);
  if(!a||!b)return {ok:false,erro:'Preencha os dois campos.'};
  if(a==='__PROTO__'||a in NAME_MAP)return {ok:false,erro:'Esse apelido já existe como padrão da Ália.'};
  const p=lerPerfil();
  if(!(a in p.apelidos)&&Object.keys(p.apelidos).length>=MAX_APELIDOS)return {ok:false,erro:'Você chegou ao limite de '+MAX_APELIDOS+' apelidos. Remova algum antes.'};
  p.apelidos[a]=b;gravarPerfil(p);
  return {ok:true};
}
function removerApelido(a){const p=lerPerfil();delete p.apelidos[a];gravarPerfil(p)}

/* o que a Ália aprendeu: descrição de lançamento → categoria */
const categoriasAprendidas=()=>lerPerfil().categorias;
function aprenderCategoria(desc,tipo,cat){
  if((tipo!=='d'&&tipo!=='r')||!CATS[tipo].includes(cat))return false;
  if(String(desc).trim().length>60)return false;   // a chave guarda 60 letras; cortada, nunca mais casaria por palavra inteira
  const k=chaveCat(tipo,desc);
  if(k.length<=2||k==='d:__proto__'||k==='r:__proto__')return false;
  const p=lerPerfil(),a=Object.prototype.hasOwnProperty.call(p.categorias,k)?p.categorias[k]:null;
  if(a&&a.cat===cat)a.n=Math.min(9999,a.n+1);
  else{
    if(!a&&Object.keys(p.categorias).length>=MAX_APRENDIDOS)return false;
    p.categorias[k]={cat,tipo,n:1};
  }
  gravarPerfil(p);return true;
}
/* a sugestão aprendida foi confirmada sem troca: conta mais um uso */
function reforcarCategoria(k){
  const p=lerPerfil();
  if(!Object.prototype.hasOwnProperty.call(p.categorias,k))return;
  p.categorias[k].n=Math.min(9999,p.categorias[k].n+1);gravarPerfil(p);
}
function esquecerCategoria(k){const p=lerPerfil();delete p.categorias[k];gravarPerfil(p)}

/* rotinas: compromissos que se repetem em vários dias, por volta da mesma hora (ex.: AYO, o treino diário).
   A Ália só PROPÕE (detectarRotinas); vira rotina quando a pessoa confirma. Dá para esquecer em Perfil. */
function rotinasAtivas(){const r=lerPerfil().rotinas;return Object.keys(r).filter(k=>r[k].estado==='sim').map(k=>Object.assign({chave:k},r[k]))}
function detectarRotinas(eventos){
  const jaSabe=lerPerfil().rotinas,grupos=new Map();
  for(const e of eventos||[]){
    if(!e||e.allDay||typeof e.title!=='string'||typeof e.date!=='string'||!Number.isFinite(e.s)||!Number.isFinite(e.e))continue;
    const k=chaveRotina(e.title);
    if(!k||k==='__proto__'||Object.prototype.hasOwnProperty.call(jaSabe,k))continue;
    if(!grupos.has(k))grupos.set(k,{titulo:textoCurto(e.title,60),dias:new Map()});
    const g=grupos.get(k).dias;
    if(!g.has(e.date)||e.s<g.get(e.date).s)g.set(e.date,e);   // um por dia
  }
  const achadas=[];
  for(const [k,g] of grupos){
    const lista=[...g.dias.values()],ss=lista.map(e=>e.s).sort((a,b)=>a-b),med=ss[ss.length>>1];
    const perto=lista.filter(e=>Math.abs(e.s-med)<=30);   // "por volta da mesma hora": até 30 min de diferença
    if(perto.length<MIN_DIAS_ROTINA)continue;
    const hora=Math.max(0,Math.min(1439,Math.round(perto.reduce((t,e)=>t+e.s,0)/perto.length)));
    const durs=perto.map(e=>e.e-e.s).filter(d=>d>=5&&d<=720).sort((a,b)=>a-b);
    achadas.push({chave:k,titulo:grupos.get(k).titulo,hora,dur:durs.length?durs[durs.length>>1]:60,
      dias:[...new Set(perto.map(e=>diaDaSemana(e.date)))].sort(),n:perto.length});
  }
  return achadas.sort((a,b)=>b.n-a.n||(a.chave<b.chave?-1:1));
}
function guardarRotina(r,estado){
  if(!r||typeof r.chave!=='string'||!r.chave||r.chave==='__proto__')return false;
  const p=lerPerfil();
  if(!Object.prototype.hasOwnProperty.call(p.rotinas,r.chave)&&Object.keys(p.rotinas).length>=MAX_ROTINAS)return false;
  p.rotinas[r.chave]={titulo:r.titulo,hora:r.hora,dur:r.dur,dias:r.dias.slice(),estado,n:r.n};
  return gravarPerfil(p);
}
const aceitarRotina=r=>guardarRotina(r,'sim');
const descartarRotina=r=>guardarRotina(r,'nao');
function esquecerRotina(k){const p=lerPerfil();delete p.rotinas[k];gravarPerfil(p)}

/* backup: perfil + dados deste aparelho num arquivo .json */
function montarBackup(){
  const d=new Date();
  return {app:'alia',v:1,exportadoEm:d.toISOString(),dia:isoD(d.getFullYear(),d.getMonth(),d.getDate()),perfil:lerPerfil(),dados:IN_GAS?null:lerBanco()};
}
function lerBackup(texto){
  let o;
  try{o=JSON.parse(texto)}catch(e){return {ok:false,erro:'O arquivo não é um backup da Ália (não consegui ler).'}}
  if(!eObjeto(o)||o.app!=='alia')return {ok:false,erro:'Esse arquivo não é um backup da Ália.'};
  if(o.v!==1)return {ok:false,erro:'Esse backup é de uma versão que esta Ália não conhece.'};
  const perfil=sanearPerfil(o.perfil),dados=IN_GAS?null:sanearBanco(o.dados);   // dentro do Apps Script os dados são do servidor
  if(!perfil&&!dados)return {ok:false,erro:'O backup está vazio ou danificado.'};
  const quando=typeof o.dia==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(o.dia)?o.dia:(typeof o.exportadoEm==='string'?o.exportadoEm.slice(0,10):'');
  return {ok:true,perfil,dados,quando,
    resumo:{apelidos:perfil?Object.keys(perfil.apelidos).length:0,aprendidos:perfil?Object.keys(perfil.categorias).length:0,rotinas:perfil?Object.keys(perfil.rotinas).length:0,eventos:dados?dados.eventos.length:0,financas:dados?dados.financas.length:0}};
}

lerPerfil();   // já carrega os apelidos antes da primeira tela
