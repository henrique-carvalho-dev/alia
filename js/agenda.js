/* ---------- estado e agenda ---------- */
let view=new Date(now.getFullYear(),now.getMonth(),1);
let selected=isoD(now.getFullYear(),now.getMonth(),now.getDate());
const cache={};   // "yyyy-mm" -> eventos

async function loadMonth(y,m,force){
  const k=mkey(y,m);
  if(cache[k]&&!force)return cache[k];
  try{
    const ny=m===11?y+1:y, nm=(m+1)%12;
    const list=await run('getEvents',isoD(y,m,1),isoD(ny,nm,1));
    list.forEach(e=>{e.title=smart(e.title);e.date=e.start.slice(0,10);e.s=e.allDay?0:toMin(e.start);e.e=e.allDay?0:toMin(e.end)});
    list.sort((a,b)=>a.date.localeCompare(b.date)||a.s-b.s);
    cache[k]=list;
  }catch(err){cache[k]=[];modal('Não consegui ler a agenda',IN_GAS?'Verifique se você autorizou o acesso ao Google Agenda ao abrir o app pela primeira vez.':'Tente de novo em instantes.')}
  return cache[k];
}
function eventsOn(date){
  const [y,m]=date.split('-');const list=cache[mkey(+y,+m-1)]||[];
  return list.filter(e=>e.date===date);
}
function conflictsOn(date){
  const timed=eventsOn(date).filter(e=>!e.allDay).sort((a,b)=>a.s-b.s);const pairs=[];
  for(let i=0;i<timed.length;i++)for(let j=i+1;j<timed.length;j++){
    if(timed[i].s<timed[j].e&&timed[j].s<timed[i].e)pairs.push([timed[i],timed[j]]);
  }
  return pairs;
}
function freeSlot(date,dur,after){
  const busy=eventsOn(date).filter(e=>!e.allDay).sort((a,b)=>a.s-b.s);
  for(let t=Math.max(8*60,after||0);t+dur<=19*60;t+=30){
    if(!busy.some(e=>t<e.e&&e.s<t+dur))return t;
  }
  return null;
}

async function renderToday(){
  const h=new Date().getHours();
  $('#greet').innerHTML=(h<12?'Bom dia':h<18?'Boa tarde':'Boa noite')+', Loh.<br>Seu dia está organizado.';
  const t=new Date(),k=isoD(t.getFullYear(),t.getMonth(),t.getDate());
  await loadMonth(t.getFullYear(),t.getMonth());
  const list=eventsOn(k),nowMin=t.getHours()*60+t.getMinutes();
  const next=list.find(e=>!e.allDay&&e.e>nowMin);
  if(next){
    $('#heroTitle').textContent=hhmm(next.s)+' · '+next.title;
    $('#heroChips').innerHTML=`<span class="chip">⏱ ${next.e-next.s} min</span>`+(next.cal?`<span class="chip">📅 ${esc(next.cal)}</span>`:'');
  }else{
    $('#heroTitle').textContent=list.length?'Nada mais por hoje':'Dia livre';
    $('#heroChips').innerHTML='<span class="chip">✨ Aproveite o tempo</span>';
  }
  $('#todayList').innerHTML=list.length?list.map(rowHTML).join(''):'<div class="card"><div class="meta">Nenhum compromisso hoje.</div></div>';
}
function rowHTML(e){
  const conf=!e.allDay&&conflictsOn(e.date).some(p=>p.includes(e));
  return `<div class="card row"><div class="time">${e.allDay?'Dia':hhmm(e.s)}</div><div class="grow"><div class="title">${esc(e.title)}</div><div class="meta">${e.allDay?'Dia inteiro':hhmm(e.s)+' – '+hhmm(e.e)}${e.cal?' · '+esc(e.cal):''}</div></div>${conf?'<span class="badge warn">conflito</span>':''}</div>`;
}

async function renderCalendar(){
  const y=view.getFullYear(),m=view.getMonth();
  $('#monthTitle').textContent=months[m][0].toUpperCase()+months[m].slice(1)+' '+y;
  await loadMonth(y,m);
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),td=new Date();
  const todayK=isoD(td.getFullYear(),td.getMonth(),td.getDate());
  let h='',confDays=[];
  for(let i=0;i<first;i++)h+='<button class="day muted"></button>';
  for(let d=1;d<=days;d++){
    const k=isoD(y,m,d),has=eventsOn(k).length>0,cf=conflictsOn(k).length>0;
    if(cf)confDays.push(k);
    h+=`<button class="day${has?' has':''}${cf?' conf':''}${k===todayK?' today':''}${k===selected?' selected':''}" onclick="selectDay('${k}')">${d}</button>`;
  }
  $('#calendar').innerHTML=h;
  $('#conflictBox').innerHTML=confDays.length
    ?`<div class="warning"><strong>⚠️ Conflitos identificados</strong>${confDays.length} dia(s) neste mês com compromissos sobrepostos (marcados em vermelho).<br><button class="secondary" onclick="reorganize()">Reorganizar o dia selecionado</button></div>`
    :'<div class="okbox"><strong>✓ Sem conflitos</strong> neste mês.</div>';
  renderEvents();
}
function moveMonth(n){view=new Date(view.getFullYear(),view.getMonth()+n,1);renderCalendar()}
function selectDay(k){selected=k;renderCalendar()}
function renderEvents(){
  const [y,m,d]=selected.split('-');$('#selectedTitle').textContent=`${d}/${m} · Compromissos`;
  const arr=eventsOn(selected);
  $('#events').innerHTML=arr.length?arr.map(rowHTML).join(''):'<div class="card"><div class="meta">Nenhum compromisso neste dia.</div></div>';
}
function reorganize(){
  const pairs=conflictsOn(selected);
  if(!pairs.length){modal('Sem conflitos neste dia','O dia selecionado não tem compromissos sobrepostos. Toque em um dia marcado em vermelho para ver as sugestões.');return}
  const seen=new Set(),lines=[];
  pairs.forEach(p=>{
    const mv=p[1];if(seen.has(mv.id))return;seen.add(mv.id);
    const dur=mv.e-mv.s,slot=freeSlot(selected,dur);
    lines.push(`• "${p[0].title}" e "${mv.title}" se sobrepõem às ${hhmm(mv.s)}.`+(slot!==null?` Sugestão: mover "${mv.title}" para ${hhmm(slot)}.`:' Não achei horário livre hoje.'));
  });
  modal('Sugestão da Ália',lines.join('\n\n')+(IN_GAS?'\n\nEu só altero o Google Agenda depois da sua confirmação. Nesta versão, ajuste direto no Google Agenda.':'\n\nEu só altero a agenda depois da sua confirmação. Nesta versão, ajuste direto na agenda.'));
}
