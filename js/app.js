/* ---------- telas ---------- */
function go(id){
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  $('#'+id).classList.add('active');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
  if(id==='agenda')renderCalendar();
  if(id==='today')renderToday();
  if(id==='finance')renderFinance();
  if(id==='profile')renderPerfil();
  scrollTo(0,0);
}
function modal(t,x){$('#modalTitle').textContent=t;$('#modalText').textContent=x;$('#modal').classList.add('show')}
function closeModal(){$('#modal').classList.remove('show')}
function newEvent(){go('assistant');setTimeout(()=>{$('#msg').value='Criar novo compromisso: ';$('#msg').focus()},50)}
function travelSearch(){modal('Organizar viagem','Em breve a Ália vai montar a busca no Google Voos e no Google Hotéis já preenchida com as datas da sua agenda. Nada será reservado sem a sua aprovação.')}

function marcarTema(t){document.querySelectorAll('#temaSeg button').forEach(b=>b.classList.toggle('on',b.dataset.tema===t))}
function setTema(t){
  try{localStorage.setItem(TEMA_CHAVE,t)}catch(e){}
  aplicarTema(t);marcarTema(t);
}

function limparCaches(){
  for(const k in cache)delete cache[k];
  for(const k in finCache)delete finCache[k];
}

/* apagar os dados deste aparelho: dois toques, como a exclusão de lançamento */
let armadoTimer=null;
function apagarDados(){
  const b=$('#btnApagar');
  const desarmar=()=>{clearTimeout(armadoTimer);b.classList.remove('armado');b.textContent='Apagar dados deste aparelho'};
  if(!b.classList.contains('armado')){
    b.classList.add('armado');b.textContent='Tem certeza? Volta aos exemplos';
    armadoTimer=setTimeout(desarmar,5000);
    return;
  }
  desarmar();
  apagarDadosLocais();
  limparCaches();
  modal('Dados apagados','Os compromissos e lançamentos deste aparelho foram apagados e a Ália voltou aos exemplos. Suas preferências e o que ela aprendeu continuam.');
}

/* "hoje" depois da meia-noite: com o app aberto de um dia para o outro, o que era "hoje" (dia selecionado, mês das telas,
   data do formulário) acompanha o novo dia e a tela atual é desenhada de novo */
const hojeISO=()=>{const d=new Date();return isoD(d.getFullYear(),d.getMonth(),d.getDate())};
let diaVisto=hojeISO();
function verificarVirada(redesenhaHoje){
  const h=hojeISO();
  if(h===diaVisto){const t=document.querySelector('.screen.active');if(redesenhaHoje&&t&&t.id==='today')renderToday();return}   // mesmo dia: ao voltar ao app, atualiza saudação, próximo compromisso e atenções
  const antes=diaVisto,d=new Date();diaVisto=h;
  const mesDe=iso=>iso.slice(0,7),mesNovo=new Date(d.getFullYear(),d.getMonth(),1);
  if(selected===antes)selected=h;
  if(mkey(view.getFullYear(),view.getMonth())===mesDe(antes))view=mesNovo;
  if(mkey(finView.getFullYear(),finView.getMonth())===mesDe(antes))finView=mesNovo;
  if($('#fDate').value===antes)$('#fDate').value=h;
  limparCaches();
  const tela=document.querySelector('.screen.active');
  if(tela&&tela.id==='today')renderToday();
  else if(tela&&tela.id==='agenda')renderCalendar();
  else if(tela&&tela.id==='finance')renderFinance();
}
setInterval(()=>verificarVirada(false),30000);
addEventListener('focus',()=>verificarVirada(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)verificarVirada(true)});

/* ---------- início ---------- */
marcarTema(lerTema());
if(IN_GAS)$('#dadosLocais').hidden=true;   // no Apps Script os dados são do servidor, não deste aparelho
$('#fDate').value=isoD(now.getFullYear(),now.getMonth(),now.getDate());
setTipo('d');

renderToday();
// atalhos do ícone instalado (manifest) abrem direto na tela: index.html#agenda, #assistant, #finance
const irParaRota=()=>{const r=location.hash.slice(1);if(['today','agenda','assistant','finance','trips','profile'].includes(r)){go(r);history.replaceState(null,'',location.pathname+location.search)}};   // consome a âncora: recarregar não volta para ela
if(location.hash)irParaRota();
addEventListener('hashchange',irParaRota);   // atalho tocado com o app já aberto
