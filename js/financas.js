/* ---------- finanças ---------- */
let finView=new Date(now.getFullYear(),now.getMonth(),1),finTipo='d',armed=null;
const finCache={};
async function loadFin(y,m,force){
  const k=mkey(y,m);if(finCache[k]&&!force)return finCache[k];
  try{
    const ny=m===11?y+1:y,nm=(m+1)%12;
    const list=await run('getFinance',isoD(y,m,1),isoD(ny,nm,1));
    list.forEach(x=>x.valor=+x.valor);
    list.sort((a,b)=>b.date.localeCompare(a.date));
    finCache[k]=list;
  }catch(err){finCache[k]=[];modal('Não consegui abrir as finanças',IN_GAS?'Verifique se você autorizou o acesso ao Google Planilhas ao abrir o app.':'Tente de novo em instantes.')}
  return finCache[k];
}
function setTipo(t){
  finTipo=t;$('#tpD').classList.toggle('on',t==='d');$('#tpR').classList.toggle('on',t==='r');
  $('#fCat').innerHTML=CATS[t].map(c=>`<option>${c}</option>`).join('');
}
function moveFin(n){finView=new Date(finView.getFullYear(),finView.getMonth()+n,1);renderFinance()}
async function renderFinance(){
  const y=finView.getFullYear(),m=finView.getMonth();
  $('#finMonth').textContent=months[m][0].toUpperCase()+months[m].slice(1)+' '+y;
  const list=await loadFin(y,m);
  const sum=(t,p)=>list.filter(x=>x.tipo===t&&(p===undefined||x.pago===p)).reduce((s,x)=>s+x.valor,0);
  const rec=sum('r'),desp=sum('d'),saldo=rec-desp,aPagar=sum('d',false),aReceber=sum('r',false);
  $('#finSum').innerHTML=
   `<div class="card"><small>Receitas</small><div class="big pos">${brl(rec)}</div><div class="meta">a receber ${brl(aReceber)}</div></div>`+
   `<div class="card"><small>Despesas</small><div class="big neg">${brl(desp)}</div><div class="meta">a pagar ${brl(aPagar)}</div></div>`+
   `<div class="card wide"><small>Saldo do mês</small><div class="big ${saldo<0?'neg':'pos'}">${brl(saldo)}</div></div>`;
  const byCat={};list.filter(x=>x.tipo==='d').forEach(x=>byCat[x.cat]=(byCat[x.cat]||0)+x.valor);
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  $('#finCats').innerHTML=cats.length?'<div class="card">'+cats.map(([c,v])=>`<div class="cat"><div class="row"><span class="grow">${esc(c)}</span><span class="val">${brl(v)}</span></div><div class="bar"><i style="width:${Math.round(v/desp*100)}%"></i></div></div>`).join('')+'</div>':'<div class="card"><div class="meta">Sem despesas neste mês.</div></div>';
  renderFinList(list);
}
function renderFinList(list){
  list=list||finCache[mkey(finView.getFullYear(),finView.getMonth())]||[];
  $('#finList').innerHTML=list.length?list.map(x=>{
    const d=x.date.slice(8,10)+'/'+x.date.slice(5,7),isR=x.tipo==='r';
    const st=x.pago?(isR?'recebido':'pago'):(isR?'a receber':'a pagar');
    return `<div class="card fin-item"><div class="row"><div class="time">${d}</div><div class="grow"><div class="title">${esc(x.desc)}</div><div class="meta">${esc(x.cat)} · ${st}</div></div><div class="val ${isR?'pos':'neg'}">${isR?'+':'−'} ${brl(x.valor)}</div></div>`+
      `<div class="fin-actions"><button data-acao="pago" data-id="${esc(x.id)}">${x.pago?'Marcar pendente':(isR?'Marcar recebido':'Marcar pago')}</button><button data-acao="excluir" data-id="${esc(x.id)}">${armed===x.id?'Tem certeza?':'Excluir'}</button></div></div>`;
  }).join(''):'<div class="card"><div class="meta">Nenhum lançamento neste mês.</div></div>';
}
async function addFin(ev){
  ev.preventDefault();
  const desc=$('#fDesc').value.trim(),val=parseValor($('#fVal').value),date=$('#fDate').value,cat=$('#fCat').value,pago=$('#fPago').checked;
  if(!desc||!date)return;
  if(val===null){modal('Valor inválido','Digite um valor entre R$ 0,01 e R$ 1.000.000.000, assim: 1250,50');return}
  if(date<'2000-01-01'||date>'2100-12-31'){modal('Data inválida','Escolha uma data entre 2000 e 2100.');return}
  try{
    await run('addFinance',date,desc,cat,finTipo,val,pago);
    const y=+date.slice(0,4),m=+date.slice(5,7)-1;
    delete finCache[mkey(y,m)];
    finView=new Date(y,m,1);
    $('#fDesc').value='';$('#fVal').value='';
    await renderFinance();
  }catch(err){modal('Não consegui salvar',err&&err.limite?err.message:(IN_GAS?'Verifique a autorização do Google Planilhas e tente de novo.':'Tente de novo.'))}
}
// o id vem do armazenamento: nunca vai dentro de onclick, só em data-id lido por um ouvinte
$('#finList').addEventListener('click',e=>{
  const b=e.target.closest('button[data-acao]');if(!b)return;
  if(b.dataset.acao==='pago')togglePago(b.dataset.id);else delFin(b.dataset.id);
});
async function togglePago(id){
  const k=mkey(finView.getFullYear(),finView.getMonth()),x=(finCache[k]||[]).find(z=>z.id===id);if(!x)return;
  try{await run('setFinancePaid',id,!x.pago);x.pago=!x.pago;renderFinance()}catch(e){modal('Não consegui atualizar','Tente de novo em instantes.')}
}
async function delFin(id){
  if(armed!==id){armed=id;renderFinList();return}
  armed=null;
  try{await run('deleteFinance',id);delete finCache[mkey(finView.getFullYear(),finView.getMonth())];renderFinance()}catch(e){modal('Não consegui excluir','Tente de novo em instantes.')}
}
