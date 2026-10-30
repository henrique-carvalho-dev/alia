/* ---------- ponte com o Apps Script (com modo demonstração) ----------
   Único ponto de acesso a dados. Dentro do Apps Script chama o servidor; fora dele, usa um banco
   local no navegador (localStorage, chave aila_dados). Para ligar a infraestrutura de verdade,
   só este arquivo muda. */
const IN_GAS = typeof google!=='undefined' && google.script && google.script.run;
const BANCO_CHAVE='aila_dados';
let bancoMemoria=null;   // plano B quando o navegador bloqueia o localStorage

/* exemplos criados a partir de hoje, para a agenda e as finanças nunca abrirem vazias */
function dadosExemplo(){
  const hj=new Date(),base=new Date(hj.getFullYear(),hj.getMonth(),hj.getDate());
  const dia=n=>{const d=addDays(base,n);return isoD(d.getFullYear(),d.getMonth(),d.getDate())};
  const grade={0:[["09:00","10:00","AYO"],["09:00","10:00","Saúde"],["10:30","11:30","Reforma Tributária"],["10:30","11:30","Bloco Executivo"],["13:00","13:30","Conversa com a Ana"],["13:30","14:30","Operacional e Pendências"],["16:00","17:00","Laserterapia"]],
    1:[["09:00","10:00","AYO"],["10:30","11:30","Processos e Indicadores"],["10:30","11:30","Bloco Executivo"],["18:40","20:00","Curso Conselho Empresarial"]],
    2:[["09:00","10:00","AYO"],["10:30","11:30","Reforma Tributária na Prática"],["12:00","13:00","Laserterapia"]]};
  const eventos=[];let n=0;
  for(const off in grade)grade[off].forEach(e=>eventos.push({id:'x'+(++n),title:e[2],start:dia(+off)+'T'+e[0],end:dia(+off)+'T'+e[1],allDay:false}));
  const y=hj.getFullYear(),m=hj.getMonth(),D=d=>isoD(y,m,Math.min(d,new Date(y,m+1,0).getDate()));
  const financas=[
    {id:'f1',date:D(5),desc:'Consultoria (exemplo)',cat:'Honorários',tipo:'r',valor:3200,pago:true},
    {id:'f2',date:D(5),desc:'Aluguel',cat:'Moradia',tipo:'d',valor:1800,pago:true},
    {id:'f3',date:D(8),desc:'Mercado',cat:'Alimentação',tipo:'d',valor:420.5,pago:true},
    {id:'f4',date:D(9),desc:'Combustível',cat:'Transporte',tipo:'d',valor:260,pago:true},
    {id:'f5',date:D(15),desc:'Plano de saúde',cat:'Saúde',tipo:'d',valor:650,pago:false},
    {id:'f6',date:D(20),desc:'Curso',cat:'Educação',tipo:'d',valor:390,pago:false},
    {id:'f7',date:D(25),desc:'Palestra (exemplo)',cat:'Honorários',tipo:'r',valor:1500,pago:false}];
  return {v:1,eventos,financas};
}
/* O armazenamento (ou um arquivo importado) pode estar editado ou corrompido: só entra item com o formato
   esperado, data que existe, valor razoável e só os campos conhecidos. */
const BANCO_MAX_ITENS=5000;
const eTexto=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const dataReal=s=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);if(!m)return false;
  const a=+m[1],mo=+m[2],d=+m[3];if(a<2000||a>2100)return false;
  const t=new Date(a,mo-1,d);return t.getFullYear()===a&&t.getMonth()===mo-1&&t.getDate()===d;
};
const horaOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(s)&&dataReal(s);
const evOk=x=>x&&typeof x==='object'&&eTexto(x.id,40)&&eTexto(x.title,120)&&horaOk(x.start)&&horaOk(x.end);
const finOk=x=>x&&typeof x==='object'&&eTexto(x.id,40)&&typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&dataReal(x.date)&&eTexto(x.desc,120)&&(x.tipo==='d'||x.tipo==='r')&&CATS[x.tipo].includes(x.cat)&&typeof x.valor==='number'&&x.valor>0&&x.valor<=VALOR_MAX&&typeof x.pago==='boolean';
function unicos(lista){const vistos=new Set();return lista.filter(x=>!vistos.has(x.id)&&vistos.add(x.id))}
function sanearBanco(b){
  if(!b||typeof b!=='object'||b.v!==1||!Array.isArray(b.eventos)||!Array.isArray(b.financas))return null;
  return {v:1,
    eventos:unicos(b.eventos.filter(evOk)).slice(0,BANCO_MAX_ITENS).map(x=>({id:x.id,title:x.title,start:x.start,end:x.end,allDay:false})),
    financas:unicos(b.financas.filter(finOk)).slice(0,BANCO_MAX_ITENS).map(x=>({id:x.id,date:x.date,desc:x.desc,cat:x.cat,tipo:x.tipo,valor:x.valor,pago:x.pago}))};
}
function lerBanco(){
  if(bancoMemoria)return bancoMemoria;
  try{
    const b=sanearBanco(JSON.parse(localStorage.getItem(BANCO_CHAVE)||'null'));
    if(b)return b;
  }catch(e){}
  const novo=dadosExemplo();gravarBanco(novo);return novo;
}
function gravarBanco(b){   // devolve false quando o navegador não deixou gravar (vale só nesta página)
  try{localStorage.setItem(BANCO_CHAVE,JSON.stringify(b));bancoMemoria=null;return true}
  catch(e){bancoMemoria=b;marcarArmazenamento(false);return false}
}
// Passou de BANCO_MAX_ITENS o armazenamento descartaria os mais novos ao recarregar: melhor recusar já, dizendo por quê.
const erroDeLimite=o=>Object.assign(new Error('Você chegou ao limite de '+BANCO_MAX_ITENS+' '+o+' neste aparelho. '+(o==='lançamentos'?'Exclua lançamentos antigos em Finanças':'Exporte um backup em Perfil e use "Apagar dados deste aparelho" (apaga compromissos e lançamentos)')+' para continuar.'),{limite:true});
const novoId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
/* apaga o que foi criado neste aparelho e volta aos exemplos */
function apagarDadosLocais(){
  try{localStorage.removeItem(BANCO_CHAVE)}catch(e){}
  bancoMemoria=null;
  const novo=dadosExemplo();gravarBanco(novo);
}

function run(fn,...a){
  return new Promise((res,rej)=>{
    if(!IN_GAS){
      $('#demoBar').style.display='block';
      const b=lerBanco();
      if(fn==='getEvents')return res(b.eventos.filter(x=>x.start.slice(0,10)>=a[0]&&x.start.slice(0,10)<a[1]).map(x=>({...x})));
      if(fn==='createEvent'){
        if(b.eventos.length>=BANCO_MAX_ITENS)return rej(erroDeLimite('compromissos'));
        // a=[título, ano, mês(1-12), dia, hora, minuto, duração em min]; fim limitado a 23:59
        const [t,y,m,d,h,mi,dur]=a,s=h*60+mi,e=Math.min(s+dur,1439),dt=y+'-'+pad(m)+'-'+pad(d)+'T';
        b.eventos.push({id:novoId('e'),title:t,start:dt+hhmm(s),end:dt+hhmm(e),allDay:false});
        gravarBanco(b);return res({ok:true});
      }
      if(fn==='getFinance')return res(b.financas.filter(x=>x.date>=a[0]&&x.date<a[1]).map(x=>({...x})));
      if(fn==='addFinance'){if(b.financas.length>=BANCO_MAX_ITENS)return rej(erroDeLimite('lançamentos'));const id=novoId('f');b.financas.push({id,date:a[0],desc:a[1],cat:a[2],tipo:a[3],valor:a[4],pago:a[5]});gravarBanco(b);return res(id)}
      if(fn==='setFinancePaid'){const x=b.financas.find(z=>z.id===a[0]);if(x){x.pago=a[1];gravarBanco(b)}return res(true)}
      if(fn==='deleteFinance'){const i=b.financas.findIndex(z=>z.id===a[0]);if(i>=0){b.financas.splice(i,1);gravarBanco(b)}return res(true)}
      return res(null);
    }
    google.script.run.withSuccessHandler(res).withFailureHandler(e=>rej(e)) [fn](...a);
  });
}
