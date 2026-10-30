/* ---------- assistente (chat) ---------- */
let pendingFin=null;
const DATA_INVALIDA='Essa data não existe. Confira o dia e o mês, por exemplo "15/10".';
// Só o pedido mais recente pode ser confirmado: botões de balões anteriores ficam desativados.
function fecharBotoes(){document.querySelectorAll('#chat .btns button, #chat .catsel').forEach(b=>b.disabled=true)}
// A pessoa pode trocar a categoria sugerida antes de confirmar; se trocar, a Ália aprende (ver confirmFin).
function mudarCatFin(c){if(pendingFin&&CATS[pendingFin.tipo].includes(c))pendingFin.cat=c}
async function confirmFin(){
  fecharBotoes();
  if(!pendingFin)return;const f=pendingFin;pendingFin=null;
  try{
    await run('addFinance',f.date,f.desc,f.cat,f.tipo,f.val,f.pago);
    const y=+f.date.slice(0,4),m=+f.date.slice(5,7)-1;delete finCache[mkey(y,m)];finView=new Date(y,m,1);
    let aviso='';
    if(f.cat!==f.catSugerida){
      // trocou a categoria: aprende (menos quando a descrição foi inventada por falta de uma, que não serve de chave)
      if(!f.semDescricao&&aprenderCategoria(f.desc,f.tipo,f.cat))aviso=' Anotei: "'+esc(f.desc)+'" vai para '+esc(f.cat)+'. Você pode conferir ou esquecer isso em Perfil.';
      else if(!f.semDescricao)aviso=' Não consegui anotar isso para a próxima vez (a descrição passa de 60 letras ou a memória de categorias está cheia; dá para esquecer itens em Perfil).';
    }else if(f.chaveAprendida)reforcarCategoria(f.chaveAprendida);   // confirmou o que já tinha aprendido: conta mais um uso
    say('Lançado em Finanças: '+esc(f.desc)+' ('+brl(f.val)+').'+aviso,'ai');
  }catch(err){say(err&&err.limite?esc(err.message):(IN_GAS?'Não consegui lançar. Verifique a autorização do Google Planilhas e tente de novo.':'Não consegui lançar. Tente de novo.'),'ai')}
}
function cancelFin(){fecharBotoes();pendingFin=null;say('Tudo bem, não lancei nada.','ai')}

let pending=null;
function say(html,cls){const c=$('#chat');c.insertAdjacentHTML('beforeend',`<div class="bubble ${cls}">${html}</div>`);c.scrollTop=c.scrollHeight}
let seqEnvio=0;   // cada envio ganha um número: se outro chegar durante a leitura da agenda, o mais antigo é descartado
async function send(){
  const i=$('#msg'),v=i.value.trim();if(!v)return;
  const meu=++seqEnvio;
  fecharBotoes();say(esc(v),'me');i.value='';pending=null;pendingFin=null;
  const f=parseFin(v,categoriasAprendidas());
  if(f){
    if(f.dataInvalida){say(DATA_INVALIDA,'ai');return}
    if(f.valorGrande){say('Esse valor passa de R$ 1 bilhão. Confira os zeros e tente de novo.','ai');return}
    if(f.val===null){say('Qual foi o valor? Ex.: "gastei 80 no mercado ontem".','ai');return}
    f.catSugerida=f.cat;pendingFin=f;
    const isR=f.tipo==='r',st=f.pago?(isR?'recebida':'paga'):(isR?'a receber':'a pagar');
    const dt=new Date(f.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'});
    say(`Posso lançar esta ${isR?'receita':'despesa'}?<br><br><b>${esc(f.desc)}</b><br>${brl(f.val)} · <select class="catsel" aria-label="Categoria" onchange="mudarCatFin(this.value)">${CATS[f.tipo].map(c=>`<option${c===f.cat?' selected':''}>${esc(c)}</option>`).join('')}</select><br>${esc(dt)} · ${st}<div class="btns"><button class="btn-ok" onclick="confirmFin()">Confirmar</button><button class="btn-no" onclick="cancelFin()">Cancelar</button></div>`,'ai');
    return;
  }
  const p=parseCmd(v);
  if(p.dataInvalida){say(DATA_INVALIDA,'ai');return}
  if(!p.date){say('Para qual dia? Ex.: "amanhã", "quinta" ou "15/10".','ai');return}
  if(!p.valid){say('Que horas? Ex.: "às 14h" ou "14:30".','ai');return}
  const y=p.date.getFullYear(),m=p.date.getMonth(),d=p.date.getDate(),k=isoD(y,m,d);
  await loadMonth(y,m,false,true);   // se falhar, o aviso vai no próprio cartão (abaixo)
  if(meu!==seqEnvio)return;
  const s=p.hh*60+p.mi,e=Math.min(s+p.dur,1439);   // o compromisso termina, no máximo, às 23:59 (é o que fica gravado)
  const virt=rotinasVirtuais(k).filter(x=>chaveRotina(x.title)!==chaveRotina(p.title));   // rotina confirmada que costuma cair nesse dia da semana, mesmo fora da agenda
  const clash=eventsOn(k).filter(x=>!x.allDay&&s<x.e&&x.s<e).concat(virt.filter(x=>s<x.e&&x.s<e));
  const dt=p.date.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'});
  let html=`<b>${esc(p.title)}</b><br>${esc(dt)}, ${hhmm(s)}–${hhmm(e)}`;
  if(clash.length){
    const alt=freeSlot(k,p.dur,0,virt);
    html+=`<br><br>⚠️ Conflita com: ${clash.map(x=>esc(x.title)+' ('+hhmm(x.s)+(ehRotina(x)?', sua rotina':'')+')').join(', ')}.`+(clash.some(x=>x.virtual)?' Você costuma ter essa rotina nesse dia da semana, mesmo sem ela estar na agenda.':'')+(alt!==null?` Horário livre mais próximo: ${hhmm(alt)}.`:'');
  }
  if(new Date(y,m,d,p.hh,p.mi)<new Date())html+='<br><br>🕘 Esse horário já passou. Confirme só se quiser registrar mesmo assim.';
  if(falhaAgenda)html+='<br><br>⚠️ Não consegui ler a agenda, então não sei se há conflito nesse horário.';
  pending={title:p.title,y,m,d,h:p.hh,mi:p.mi,dur:p.dur};
  html+='<div class="btns"><button class="btn-ok" onclick="confirmEv()">Confirmar</button><button class="btn-no" onclick="cancelEv()">Cancelar</button></div>';
  say('Posso criar este compromisso?<br><br>'+html,'ai');
}
async function confirmEv(){
  fecharBotoes();
  if(!pending)return;const p=pending;pending=null;
  try{
    await run('createEvent',p.title,p.y,p.m+1,p.d,p.h,p.mi,p.dur);
    delete cache[mkey(p.y,p.m)];await loadMonth(p.y,p.m,true,true);
    say('Pronto, criei "'+esc(p.title)+'" '+(IN_GAS?'no seu Google Agenda.':'na sua agenda.'),'ai');
  }catch(err){say(err&&err.limite?esc(err.message):(IN_GAS?'Não consegui criar o evento. Verifique a autorização do Google Agenda e tente de novo.':'Não consegui criar o evento. Tente de novo.'),'ai')}
}
function cancelEv(){fecharBotoes();pending=null;say('Tudo bem, não criei nada.','ai')}
$('#msg').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send()}});

function voice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){$('#voiceNote').textContent='O reconhecimento de voz não está disponível neste navegador. Você pode usar o campo de texto normalmente.';return}
  const r=new SR();r.lang='pt-BR';r.interimResults=false;
  r.onstart=()=>$('#voiceNote').textContent='Ouvindo…';
  r.onresult=e=>{$('#msg').value=e.results[0][0].transcript;$('#voiceNote').textContent='Texto capturado. Revise e toque em enviar.'};
  r.onerror=()=>$('#voiceNote').textContent='Não consegui acessar o microfone. Verifique a permissão do navegador.';
  r.onend=()=>{if($('#voiceNote').textContent==='Ouvindo…')$('#voiceNote').textContent='Toque no microfone para falar.'};
  r.start();
}
