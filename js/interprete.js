/* ---------- leitura das frases do chat (funções puras) ---------- */
// Date "rola" datas inexistentes (31/02 vira 03/03); aqui confere se o dia/mês digitado continua o mesmo.
const dataExiste=(d,dia,mes)=>d.getDate()===dia&&(mes===undefined||d.getMonth()===mes);
function parseCmd(text){
  text=String(text).normalize('NFC');   // acento solto (colado de um Mac) vira acento junto: as posições do texto limpo batem com as do original
  let t=strip(text);const spans=[];
  const mask=(re)=>{const m=t.match(re);if(!m)return null;spans.push([m.index,m.index+m[0].length]);t=t.slice(0,m.index)+' '.repeat(m[0].length)+t.slice(m.index+m[0].length);return m};
  const base=new Date();base.setHours(0,0,0,0);
  while(mask(/\b(novo compromisso|marca(r)?|agenda(r)?|cria(r)?|adiciona(r)?|compromisso)\b:?/));
  let dur=60,dm=mask(/\bpor\s+(\d+)\s*(h|horas?|min|minutos?)\b/);
  if(dm)dur=/^h/.test(dm[2])?+dm[1]*60:+dm[1];
  let date=null,dataInvalida=false,m;
  if(m=mask(/\bdepois de amanha\b/))date=addDays(base,2);
  else if(m=mask(/\bamanha\b/))date=addDays(base,1);
  else if(m=mask(/\bhoje\b/))date=base;
  else if(m=mask(/\b(\d{1,2})\/(\d{1,2})\b/)){
    date=new Date(base.getFullYear(),+m[2]-1,+m[1]);
    if(!dataExiste(date,+m[1],+m[2]-1)){date=null;dataInvalida=true}
    else if(date<base)date.setFullYear(date.getFullYear()+1);
  }
  else{
    const wd=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    for(let i=0;i<7&&!date;i++){if(m=mask(new RegExp('\\b(proxima\\s+)?'+wd[i]+'(-feira)?\\b'))){date=addDays(base,((i-base.getDay()+7)%7)||7)}}
  }
  let hh=null,mi=0;
  // "14h", "14hs", "14:30", "14h30", "8 horas". Os minutos só valem colados ao "h" ("14h 30 pessoas" não é 14:30) ou depois de ":";
  // "horas" vem antes de "h" (senão "8 horas" deixa "oras" no título); "h" só vale fora de palavra ("2 hotel"); "2: revisar" não é hora.
  if(m=mask(/(?:\bas\s+)?\b(\d{1,2})(?:\s*:\s*(\d{2})\b|\s*(?:horas?|hs?)(?![a-z])(\d{2})?)/)){hh=+m[1];mi=+(m[2]||m[3]||0)}
  else if(m=mask(/\bas\s+(\d{1,2})\b/)){hh=+m[1]}
  spans.sort((a,b)=>a[0]-b[0]);
  // Palavra de ligação colada ANTES do dia ou da hora sai do título ("... no dia 15/11", "... para sexta", "... em hoje").
  // "dia" só sai na primeira palavra removida e logo antes de uma data dd/mm ("dia 15/11"); "o"/"a" só saem depois de outra ligação ("para o dia 15/11").
  // Limite conhecido: "Almoço do dia 15/11" é ambíguo (do dia = no dia?) e perde o "dia" do título.
  const ligacao=/(^|[\s:,.\-])(de|para|pra|no|na|em|dia|as|às|até|ate|o|a)[\s:,.\-]*$/i;
  let title='',pos=0;
  for(const s of spans){
    let gap=text.slice(pos,s[0]);const numero=/^\s*\d{1,2}\/\d{1,2}/.test(text.slice(s[0],s[1]));   // só data dd/mm: "dia 15/11" (já "Bom dia 14h" mantém o "dia")
    for(let i=0;i<3;i++){
      const g=ligacao.exec(gap);if(!g)break;
      if(/^dia$/i.test(g[2])&&(!numero||i>0))break;
      if(/^[oa]$/i.test(g[2])&&i===0)break;
      gap=gap.slice(0,g.index)+g[1];
    }
    title+=gap+' ';pos=s[1];
  }
  title+=text.slice(pos);
  title=title.replace(/\s+/g,' ').replace(/^[\s:,.\-]*(de|para|no|na|em|o|a)?\s+/i,'').replace(/[\s:,.\-]+$/,'').trim();
  title=cortar(title,TEXTO_MAX).trim();
  if(!title)title='Compromisso';
  title=title[0].toUpperCase()+title.slice(1);
  return {title,date,dataInvalida,hh,mi,dur,valid:hh!==null&&hh<24&&mi<60};
}
/* ---------- lançamentos financeiros por frase ---------- */
const FINCAT_D=[['Alimentação',/mercado|supermercado|restaurante|lanche|almoco|jantar|padaria|ifood|feira|cafe/],['Transporte',/gasolina|combustivel|uber|\b99\b|estacionamento|pedagio|onibus|passagem/],['Moradia',/aluguel|condominio|\bluz\b|energia|\bagua\b|internet|iptu|\bgas\b/],['Saúde',/farmacia|medico|consulta|plano de saude|dentista|laserterapia|exame|remedio/],['Educação',/curso|livro|escola|faculdade|mensalidade|pos-?graduacao/],['Lazer',/cinema|viagem|\bbar\b|netflix|spotify|show|passeio|streaming/]];
const FINCAT_R=[['Honorários',/honorario|consultoria|palestra|mentoria|pericia|assessoria/],['Salário',/salario|pro-?labore/]];
const FILLER=new Set(['de','do','da','dos','das','no','na','nos','nas','em','com','um','uma','o','a','os','as','por','pra','para','reais','real','r$','que','conta']);
// O que a Ália aprendeu: chaves "tipo:descrição" (ver memoria.js). Devolve a chave que casa com a descrição
// (palavra inteira; a mais longa vence) ou null.
function chaveAprendida(desc,tipo,aprendidas){
  const d=strip(desc),pal=' '+d+' ',pre=tipo+':';let melhor=null;
  for(const k in aprendidas||{}){
    if(!k.startsWith(pre)||!aprendidas[k])continue;
    const p=k.slice(pre.length);
    if((d===p||pal.includes(' '+p+' '))&&(melhor===null||p.length>melhor.length))melhor=p;
  }
  return melhor===null?null:pre+melhor;
}
// Categoria de um lançamento: primeiro o que a Ália aprendeu com você, depois as palavras-chave padrão.
function categoriaDe(desc,tipo,aprendidas){
  const k=chaveAprendida(desc,tipo,aprendidas);
  if(k)return aprendidas[k].cat;
  const d=strip(desc);
  return ((tipo==='d'?FINCAT_D:FINCAT_R).find(c=>c[1].test(d))||['Outros'])[0];
}
function parseFin(text,aprendidas){
  text=String(text).normalize('NFC');
  let t=strip(text);
  if(/\b(marca(r)?|agenda(r)?|compromisso|reuniao)\b/.test(t))return null;
  const past=/\b(gastei|paguei|comprei|despesa)\b/.test(t)?'d':/\b(recebi|ganhei|receita|entrou)\b/.test(t)?'r':null;
  const pend=/\b(preciso pagar|tenho que pagar|a pagar|vence|vencimento|boleto)\b/.test(t)?'d':/\b(a receber|vou receber|vai entrar)\b/.test(t)?'r':null;
  const tipo=pend||past;if(!tipo)return null;
  const spans=[];
  const mask=re=>{const m=t.match(re);if(!m)return null;spans.push([m.index,m.index+m[0].length]);t=t.slice(0,m.index)+' '.repeat(m[0].length)+t.slice(m.index+m[0].length);return m};
  while(mask(/\b(preciso pagar|tenho que pagar|vou receber|vai entrar|a pagar|a receber|vencimento|vence|boleto|gastei|paguei|comprei|recebi|ganhei|despesa|receita|entrou)\b/));
  const base=new Date();base.setHours(0,0,0,0);let date=base,m;
  if(mask(/\banteontem\b/))date=addDays(base,-2);
  else if(mask(/\bontem\b/))date=addDays(base,-1);
  else if(mask(/\bamanha\b/))date=addDays(base,1);
  else if(mask(/\bhoje\b/))date=base;
  else if(m=mask(/\b(\d{1,2})\/(\d{1,2})\b/)){date=new Date(base.getFullYear(),+m[2]-1,+m[1]);if(!dataExiste(date,+m[1],+m[2]-1))return {tipo,dataInvalida:true}}
  else if(m=mask(/\bdia\s+(\d{1,2})\b/)){date=new Date(base.getFullYear(),base.getMonth(),+m[1]);if(pend&&date<base)date=new Date(base.getFullYear(),base.getMonth()+1,+m[1]);if(!dataExiste(date,+m[1]))return {tipo,dataInvalida:true}}
  let val=null;
  if(m=mask(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2})(?!\d))?\s*(?:reais|real)?/))val=parseFloat(m[1].replace(/\./g,'')+(m[2]?'.'+m[2]:''));
  if(val!==null&&val>VALOR_MAX)return {tipo,valorGrande:true};   // o armazenamento não aceita; melhor avisar do que perder depois
  spans.sort((a,b)=>a[0]-b[0]);
  let rest='',pos=0;spans.forEach(s=>{rest+=text.slice(pos,s[0])+' ';pos=s[1]});rest+=text.slice(pos);
  let desc=rest.split(/\s+/).filter(w=>w&&!FILLER.has(strip(w))).join(' ').replace(/[.,;:!?]+$/,'').trim();
  desc=cortar(desc,TEXTO_MAX).trim();
  const cat=categoriaDe(desc,tipo,aprendidas),chave=chaveAprendida(desc,tipo,aprendidas);
  const semDescricao=!desc;   // a descrição abaixo é inventada: não serve de chave para a Ália aprender
  if(!desc)desc=cat!=='Outros'?cat:(tipo==='d'?'Despesa':'Receita');
  desc=desc[0].toUpperCase()+desc.slice(1);
  return {tipo,pago:!pend,date:isoD(date.getFullYear(),date.getMonth(),date.getDate()),desc,cat,chaveAprendida:chave,semDescricao,val:(val!==null&&Math.round(val*100)>0)?Math.round(val*100)/100:null};
}
function parseValor(s){
  s=String(s).replace(/[rR$\s]/g,'');
  // vírgula = decimal brasileiro; sem vírgula, "1.250" (ponto + 3 dígitos) é milhar e "12.5" é decimal
  s=s.includes(',')||/^\d{1,3}(\.\d{3})+$/.test(s)?s.replace(/\./g,'').replace(',','.'):s;
  if(!/^(\d+(\.\d+)?|\.\d+)$/.test(s))return null;   // "1.2.3", "1,2,3", "1e3", "abc" não são valores
  const v=parseFloat(s),r=Math.round(v*100)/100;return isFinite(v)&&r>0&&r<=VALOR_MAX?r:null;   // "0,001" arredonda para 0: não é valor
}
