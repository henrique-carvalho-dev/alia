/* ---------- memória pessoal da Ália ----------
   Tudo o que a Ália sabe sobre você: preferências, apelidos e o que aprendeu com o uso.
   Fica só neste aparelho (localStorage, chave aila_perfil), é editável, apagável e exportável.
   Só aprende com o que você faz (correções e escolhas suas). */
const PERFIL_CHAVE='aila_perfil';
const PREFS=[['aerea','Companhia aérea'],['assento','Assento'],['hotel','Hotel'],['aeroporto','Aeroporto']];
const MAX_APELIDOS=100,MAX_APRENDIDOS=500;
const perfilVazio=()=>({v:1,prefs:{},apelidos:{},categorias:{}});
let perfilAtual=null;

const textoCurto=(v,max)=>typeof v==='string'?cortar(v.trim(),max):'';
const eObjeto=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
/* categorias aprendidas: a chave é "tipo:descrição" (d:feira bairro), então despesa e receita não se misturam */
const chaveCat=(tipo,desc)=>tipo+':'+strip(textoCurto(desc,60));

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
    resumo:{apelidos:perfil?Object.keys(perfil.apelidos).length:0,aprendidos:perfil?Object.keys(perfil.categorias).length:0,eventos:dados?dados.eventos.length:0,financas:dados?dados.financas.length:0}};
}

lerPerfil();   // já carrega os apelidos antes da primeira tela
