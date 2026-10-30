/* ---------- Perfil: memória da Ália (preferências, apelidos, o que aprendeu) e backup ----------
   Ids e chaves vêm do armazenamento: nunca vão dentro de onclick, só em data-* lidos por ouvintes. */
let backupPendente=null;

function renderPerfil(){
  const p=lerPerfil();
  $('#prefsBox').innerHTML=PREFS.map(([k,rot])=>`<label class="pref"><span>${esc(rot)}</span><input class="pref-in" data-pref="${k}" value="${esc(p.prefs[k]||'')}" placeholder="Definir" maxlength="60"></label>`).join('');
  const padrao=Object.entries(NAME_MAP).map(([k,v])=>`<div class="pref"><span>${esc(k)} → ${esc(v)}</span><small class="note">padrão</small></div>`);
  const meus=Object.entries(p.apelidos).map(([k,v])=>`<div class="pref"><span>${esc(k)} → ${esc(v)}</span><button class="mini-btn" data-rem-apelido="${esc(k)}">Remover</button></div>`);
  $('#apelidosBox').innerHTML=padrao.concat(meus).join('');
  const apr=Object.entries(p.categorias);
  const rot=Object.entries(p.rotinas);
  $('#rotinasBox').innerHTML=rot.length
    ?rot.map(([k,r])=>`<div class="pref"><span>${esc(r.titulo)} · ${hhmm(r.hora)} <small class="note">${r.dias.map(d=>DIAS_ABREV[d]).join(', ')} · ${r.estado==='sim'?'rotina':'descartada'}</small></span><button class="mini-btn" data-esquecer-rotina="${esc(k)}">Esquecer</button></div>`).join('')
    :'<p class="note">Ainda não notei nenhuma rotina. Quando um compromisso se repetir em alguns dias, eu pergunto na tela Hoje.</p>';
  $('#aprendidoBox').innerHTML=apr.length
    ?apr.map(([k,a])=>`<div class="pref"><span>${esc(k.slice(2))} → ${esc(a.cat)} <small class="note">${a.tipo==='d'?'despesa':'receita'} · ${a.n}×</small></span><button class="mini-btn" data-esquecer="${esc(k)}">Esquecer</button></div>`).join('')
    :'<p class="note">Ainda não aprendi nada. Quando você trocar a categoria de um lançamento no chat, eu anoto aqui.</p>';
}

$('#prefsBox').addEventListener('change',e=>{
  const i=e.target.closest('input[data-pref]');if(i)salvarPref(i.dataset.pref,i.value);
});
$('#apelidosBox').addEventListener('click',e=>{
  const b=e.target.closest('button[data-rem-apelido]');if(!b)return;
  removerApelido(b.dataset.remApelido);limparCaches();renderPerfil();
});
$('#aprendidoBox').addEventListener('click',e=>{
  const b=e.target.closest('button[data-esquecer]');if(!b)return;
  esquecerCategoria(b.dataset.esquecer);renderPerfil();
});
$('#rotinasBox').addEventListener('click',e=>{
  const b=e.target.closest('button[data-esquecer-rotina]');if(!b)return;
  esquecerRotina(b.dataset.esquecerRotina);renderPerfil();
});
function submitApelido(ev){
  ev.preventDefault();
  const r=addApelido($('#apDe').value,$('#apPara').value);
  if(!r.ok){modal('Não consegui adicionar',r.erro);return}
  $('#apDe').value='';$('#apPara').value='';limparCaches();renderPerfil();
}

/* backup */
function exportar(){
  const blob=new Blob([JSON.stringify(montarBackup(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const hoje=new Date();   // não usa `now`: a página pode estar aberta desde ontem
  a.download='alia-backup-'+isoD(hoje.getFullYear(),hoje.getMonth(),hoje.getDate())+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('#arquivo').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';
  if(!f)return;
  if(f.size>2*1024*1024){modal('Arquivo grande demais','Um backup da Ália tem poucos KB. Esse arquivo passa de 2 MB.');return}
  let texto;
  try{texto=await f.text()}catch(err){modal('Não consegui importar','Não consegui abrir o arquivo. Tente de novo.');return}
  const r=lerBackup(texto);
  if(!r.ok){backupPendente=null;$('#importBox').innerHTML='';modal('Não consegui importar',r.erro);return}
  backupPendente=r;
  const s=r.resumo;
  const semDados=IN_GAS||!r.dados;   // o arquivo não traz compromissos e lançamentos (ou o app roda no Apps Script): os seus não são tocados
  const itens=s.apelidos+' apelido(s), '+s.aprendidos+' item(ns) aprendido(s), '+s.rotinas+' rotina(s)'+(IN_GAS?'':(r.dados?', '+s.eventos+' compromisso(s) e '+s.financas+' lançamento(s)':'; sem compromissos nem lançamentos (os seus continuam como estão)'));
  const alvo=!r.perfil?'os compromissos e lançamentos deste aparelho (as preferências, os apelidos e o que a Ália aprendeu continuam como estão)':(semDados?'as preferências, os apelidos e o que a Ália aprendeu':'o que a Ália tem agora neste aparelho');
  $('#importBox').innerHTML=`<div class="okbox"><strong>Backup de ${esc(r.quando||'data desconhecida')}</strong>${itens}.<br>Importar <b>substitui</b> ${alvo}.<div class="btns"><button class="btn-ok" onclick="confirmarImport()">Substituir tudo</button><button class="btn-no" onclick="cancelarImport()">Cancelar</button></div></div>`;
});
function cancelarImport(){backupPendente=null;$('#importBox').innerHTML=''}
function confirmarImport(){
  const r=backupPendente;if(!r)return;
  backupPendente=null;$('#importBox').innerHTML='';
  let salvou=true;
  if(r.perfil)salvou=gravarPerfil(r.perfil)&&salvou;
  if(r.dados&&!IN_GAS)salvou=gravarBanco(r.dados)&&salvou;
  limparCaches();renderPerfil();
  modal('Backup importado',salvou
    ?(IN_GAS?'As preferências, os apelidos e o que a Ália aprendeu já estão valendo.':'As preferências, apelidos e dados do arquivo já estão valendo.')
    :'Importei, mas o navegador não deixou salvar: vale só enquanto esta página estiver aberta. Libere o armazenamento do site e importe de novo.');
}
