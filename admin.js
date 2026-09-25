const API_URL = "https://script.google.com/macros/s/AKfycbztSlQ_dmKyvaQ4zAO95IRni2G3ZESlGRiaaJqtsbZww6-Jrf1k4g1yS5fThXKrqlgr-w/exec";
const SESSION_KEY = "studio_jessica_admin_session_v1";
const MAX_UPLOAD = 5;
const state = {token:"",user:null,procedures:{},currentKey:"micropigmentacao",selectedFiles:[],leads:[]};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function money(v){
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "Consultar";
}
function parseMoney(v){
  let s = String(v ?? "").trim();
  if(!s) return null;
  s = s.replace(/R\$/gi,"").replace(/\s/g,"");
  if(s.includes(",")) s = s.replace(/\./g,"").replace(",",".");
  s = s.replace(/[^0-9.-]/g,"");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function inputMoney(v){
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
}
function discount(a,b){
  a = Number(a); b = Number(b);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<0||b>=a) return null;
  return Math.round((1-b/a)*100);
}
function esc(s){return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2600);}
function setMsg(el,msg,success=false){el.textContent=msg||"";el.classList.toggle("success",!!success);}
function normalizeImageUrl(url){
  const value=String(url||"").trim();
  const m=value.match(/drive\.google\.com\/file\/d\/([^/]+)/i)||value.match(/[?&]id=([^&]+)/i);
  return m?`https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`:value;
}

async function api(acao,dados={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),45000);
  try{
    const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({acao,token:state.token,...dados}),cache:"no-store",redirect:"follow",signal:controller.signal});
    const j=await r.json();
    if(!j.ok){
      const erro=j.erro||"Não foi possível concluir a operação.";
      if(/sessão expirada/i.test(erro)){clearSession();showLogin("Sua sessão expirou. Entre novamente.");}
      throw new Error(erro);
    }
    return j;
  }catch(err){
    if(err.name==="AbortError") throw new Error("O servidor demorou para responder. Tente novamente.");
    throw err;
  }finally{clearTimeout(timer)}
}

async function apiGet(acao,dados={}){
  const url=new URL(API_URL);
  url.searchParams.set("acao",acao);
  url.searchParams.set("token",state.token||"");
  Object.entries(dados||{}).forEach(([k,v])=>url.searchParams.set(k,String(v??"")));
  url.searchParams.set("t",Date.now());
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(url.toString(),{cache:"no-store",redirect:"follow",signal:controller.signal});
    const j=await r.json();
    if(!j.ok) throw new Error(j.erro||"Não foi possível concluir a operação.");
    return j;
  }finally{clearTimeout(timer)}
}

let leadRefreshTimer=null;
function startLeadAutoRefresh(){
  if(leadRefreshTimer) clearInterval(leadRefreshTimer);
  leadRefreshTimer=setInterval(()=>{
    if(state.token && !document.hidden) loadLeads(true);
  },20000);
}

function saveSession(){localStorage.setItem(SESSION_KEY,JSON.stringify({token:state.token,user:state.user}));}
function restoreSession(){try{const x=JSON.parse(localStorage.getItem(SESSION_KEY)||"{}");state.token=x.token||"";state.user=x.user||null;return !!state.token}catch(_){return false}}
function clearSession(){state.token="";state.user=null;localStorage.removeItem(SESSION_KEY)}
function showLogin(msg=""){ $("#app").classList.add("hidden");$("#loginScreen").classList.remove("hidden");setMsg($("#loginMsg"),msg); }
function showApp(){ $("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#userInfo").textContent=state.user?`${state.user.nome} • ${state.user.perfil}`:"";loadProcedures();loadLeads();startLeadAutoRefresh(); }

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); const f=new FormData(e.currentTarget); setMsg($("#loginMsg"),"Entrando...");
  try{const j=await api("login",{usuario:f.get("usuario"),senha:f.get("senha")});state.token=j.token;state.user=j.usuario;saveSession();setMsg($("#loginMsg"),"");showApp();}
  catch(err){setMsg($("#loginMsg"),err.message)}
});
$("#logoutBtn").addEventListener("click",()=>{if(leadRefreshTimer)clearInterval(leadRefreshTimer);clearSession();showLogin();});

async function loadProcedures(){
  setMsg($("#formMsg"),"");
  try{
    $("#saveStatus").textContent="Carregando...";
    const j=await api("listarProcedimentos");
    state.procedures=j.procedures||{};
    if(!state.procedures[state.currentKey]) state.currentKey=Object.keys(state.procedures)[0]||"micropigmentacao";
    renderAll();
    $("#saveStatus").textContent="Dados sincronizados";
  }catch(err){$("#saveStatus").textContent="Falha na sincronização";setMsg($("#formMsg"),err.message);}
}

function renderAll(){renderSummary();renderSwitcher();renderEditor();}
function renderSummary(){
  const list=Object.values(state.procedures);
  const images=list.reduce((s,p)=>s+(p.imagesDetailed?.length||0),0);
  const promos=list.filter(p=>Number.isFinite(Number(p.discountPercent))&&Number(p.discountPercent)>0).length;
  $("#summaryCards").innerHTML=`
    <article class="summary-card"><div><span>Procedimentos ativos</span><strong>${list.filter(p=>p.active).length} de ${list.length}</strong></div><b>${list.filter(p=>p.active).length}</b></article>
    <article class="summary-card"><div><span>Fotos publicadas</span><strong>Galeria do site</strong></div><b>${images}</b></article>
    <article class="summary-card"><div><span>Ofertas com desconto</span><strong>Desconto automático</strong></div><b>${promos}</b></article>`;
}
function renderSwitcher(){
  $("#serviceSwitcher").innerHTML=Object.entries(state.procedures).map(([k,p])=>`<button type="button" class="service-btn ${k===state.currentKey?"active":""}" data-key="${esc(k)}"><strong>${esc(p.nome||p.title||"Procedimento")}</strong><span>${p.active?"Visível no site":"Oculto"} • ${p.imagesDetailed?.length||0} foto(s)</span></button>`).join("");
  $$(".service-btn").forEach(b=>b.onclick=()=>{state.currentKey=b.dataset.key;state.selectedFiles=[];renderAll();});
}
function current(){return state.procedures[state.currentKey]||{};}
function renderEditor(){
  const p=current(),f=$("#procedureForm");
  $("#editorTitle").textContent=p.nome||"Procedimento";
  f.elements.nome.value=p.nome||"";
  f.elements.precoOriginal.value=inputMoney(p.precoOriginal);
  f.elements.precoPromocional.value=inputMoney(p.precoPromocional);
  f.elements.tipoPreco.value=p.tipoPreco||p.priceMode||"A partir de";
  f.elements.observacaoPreco.value=p.observacaoPreco||"";
  f.elements.descricao.value=p.descricao||"";
  f.elements.ativo.checked=p.ativo!==false;
  updatePreview();renderPhotos();renderSelectedFiles();
}
function updatePreview(){
  const f=$("#procedureForm");
  const o=parseMoney(f.elements.precoOriginal.value),p=parseMoney(f.elements.precoPromocional.value),d=discount(o,p);
  $("#discountPreview").textContent=d?`${d}% OFF`:"—";
  $("#discountHelper").textContent=d?`Economia calculada automaticamente: ${d}%.`:"O desconto aparece quando o valor original é maior que o promocional.";
  $("#previewName").textContent=f.elements.nome.value.trim()||"Procedimento";
  $("#previewOld").textContent=d?money(o):"";
  const tipo=f.elements.tipoPreco.value||"A partir de";
  $("#previewCurrent").textContent=p===null?"Consultar":`${tipo} ${money(p)}`;
  $("#previewBadge").textContent=d?`${d}% OFF`:"";
  $("#previewBadge").style.display=d?"inline":"none";
  $("#previewNote").textContent=f.elements.observacaoPreco.value.trim();
}
["nome","precoOriginal","precoPromocional","observacaoPreco"].forEach(n=>$("#procedureForm").elements[n].addEventListener("input",updatePreview));
$("#procedureForm").elements.tipoPreco.addEventListener("change",updatePreview);

$("#procedureForm").addEventListener("submit",async e=>{
  e.preventDefault(); const f=e.currentTarget; const button=f.querySelector('button[type="submit"]');button.disabled=true;setMsg($("#formMsg"),"Salvando...");$("#saveStatus").textContent="Salvando...";
  try{
    const j=await api("salvarProcedimento",{key:state.currentKey,nome:f.elements.nome.value,precoOriginal:f.elements.precoOriginal.value,precoPromocional:f.elements.precoPromocional.value,tipoPreco:f.elements.tipoPreco.value,observacaoPreco:f.elements.observacaoPreco.value,descricao:f.elements.descricao.value,ativo:f.elements.ativo.checked});
    state.procedures[state.currentKey]=j.procedure;renderAll();setMsg($("#formMsg"),"Alterações salvas no site.",true);$("#saveStatus").textContent="Dados sincronizados";toast("Procedimento atualizado");
  }catch(err){setMsg($("#formMsg"),err.message);$("#saveStatus").textContent="Não salvo";}finally{button.disabled=false}
});

function renderPhotos(){
  const p=current(),photos=p.imagesDetailed||[];$("#photoCount").textContent=photos.length;
  $("#photoGrid").innerHTML=photos.length?photos.map(x=>`<figure class="photo-admin-item"><img src="${esc(normalizeImageUrl(x.url))}" alt="Foto ${x.slot}" loading="lazy"><button type="button" data-slot="${x.slot}" title="Excluir foto">×</button></figure>`).join(""):`<div class="photo-empty">Nenhuma foto cadastrada ainda.</div>`;
  $$("#photoGrid button[data-slot]").forEach(b=>b.onclick=()=>deletePhoto(Number(b.dataset.slot)));
  $("#imageInput").disabled=photos.length>=10;$("#uploadBtn").disabled=!state.selectedFiles.length||photos.length>=10;
}
async function deletePhoto(slot){
  if(!confirm("Excluir esta foto da galeria?"))return;
  try{const j=await api("excluirImagem",{key:state.currentKey,slot});state.procedures[state.currentKey]=j.procedure;renderAll();toast("Foto removida");}catch(err){setMsg($("#uploadMsg"),err.message)}
}

$("#imageInput").addEventListener("change",e=>{
  const files=[...e.target.files]; const available=10-(current().imagesDetailed?.length||0);
  if(files.length>MAX_UPLOAD){setMsg($("#uploadMsg"),"Escolha no máximo 5 imagens por vez.");e.target.value="";return;}
  if(files.length>available){setMsg($("#uploadMsg"),`Há espaço para apenas ${available} imagem(ns).`);e.target.value="";return;}
  state.selectedFiles=files;setMsg($("#uploadMsg"),"");renderSelectedFiles();$("#uploadBtn").disabled=!files.length;
});
function renderSelectedFiles(){
  $("#selectedFiles").textContent=state.selectedFiles.length?`${state.selectedFiles.length} arquivo(s) selecionado(s): ${state.selectedFiles.map(f=>f.name).join(", ")}`:"";
  $("#uploadBtn").disabled=!state.selectedFiles.length;
}

async function compressImage(file){
  if(!file.type.startsWith("image/")) throw new Error("Selecione apenas imagens.");
  const img=await new Promise((resolve,reject)=>{const i=new Image();const u=URL.createObjectURL(file);i.onload=()=>{URL.revokeObjectURL(u);resolve(i)};i.onerror=()=>{URL.revokeObjectURL(u);reject(new Error("Não foi possível ler uma das imagens."))};i.src=u;});
  const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));
  if(!blob) throw new Error("Não foi possível preparar uma das imagens.");
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("Falha ao preparar a imagem."));r.readAsDataURL(blob)});
  return {nome:(file.name||"foto").replace(/\.[^.]+$/,"")+".jpg",mime:"image/jpeg",base64:String(dataUrl).split(",")[1]};
}

$("#uploadBtn").addEventListener("click",async()=>{
  if(!state.selectedFiles.length)return;
  const btn=$("#uploadBtn");btn.disabled=true;setMsg($("#uploadMsg"),"Otimizando imagens...");
  try{
    const imagens=[]; for(let i=0;i<state.selectedFiles.length;i++){setMsg($("#uploadMsg"),`Preparando ${i+1} de ${state.selectedFiles.length}...`);imagens.push(await compressImage(state.selectedFiles[i]));}
    setMsg($("#uploadMsg"),"Enviando para o Google Drive...");
    const j=await api("adicionarImagens",{key:state.currentKey,imagens});state.procedures[state.currentKey]=j.procedure;state.selectedFiles=[];$("#imageInput").value="";renderAll();setMsg($("#uploadMsg"),"Fotos publicadas com sucesso.",true);toast("Fotos adicionadas ao site");
  }catch(err){setMsg($("#uploadMsg"),err.message)}finally{btn.disabled=false}
});


async function loadLeads(silent=false){
  const list = $("#leadList");
  const msg = $("#leadsMsg");
  if(!list) return;
  if(!silent) list.innerHTML='<div class="lead-empty">Carregando clientes...</div>';
  setMsg(msg,"");
  try{
    let j;
    try{ j=await api("listarLeads"); }
    catch(postErr){ j=await apiGet("listarLeads"); }
    state.leads=Array.isArray(j.leads)?j.leads:[];
    renderLeads();
  }catch(err){
    if(!silent) list.innerHTML='<div class="lead-empty">Não foi possível carregar os clientes.</div>';
    setMsg(msg,err.message);
  }
}
function formatLeadDate(v){
  if(!v) return "";
  const d=new Date(v);
  if(Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function renderLeads(){
  const q=String($("#leadSearch")?.value||"").trim().toLowerCase();
  const status=String($("#leadStatusFilter")?.value||"");
  const all=state.leads||[];
  const filtered=all.filter(l=>{
    const hay=[l.nome,l.telefone,l.procedimento,l.origem].join(" ").toLowerCase();
    return (!q||hay.includes(q))&&(!status||String(l.status||"Novo")===status);
  });
  $("#leadTotal").textContent=all.length;
  $("#leadNew").textContent=all.filter(l=>String(l.status||"Novo")==="Novo").length;
  $("#leadScheduled").textContent=all.filter(l=>String(l.status||"")==="Agendado").length;
  const list=$("#leadList");
  if(!filtered.length){list.innerHTML='<div class="lead-empty">Nenhum cliente encontrado.</div>';return;}
  list.innerHTML=filtered.map(l=>{
    const digits=String(l.telefone||"").replace(/\D/g,"");
    const phone=digits.startsWith("55")?digits:`55${digits}`;
    const msg=`Olá ${l.nome||""}! Aqui é do Studio Jessica Leite. Vi que você demonstrou interesse em ${l.procedimento||"um procedimento"}. Posso te ajudar com os horários disponíveis?`;
    const wa=`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    const st=String(l.status||"Novo");
    return `<article class="lead-row" data-id="${esc(l.id)}">
      <div class="lead-person"><strong>${esc(l.nome||"Sem nome")}</strong><small>${esc(formatLeadDate(l.data))}</small></div>
      <div class="lead-phone">${esc(l.telefone||"")}</div>
      <div class="lead-meta"><div class="lead-procedure">${esc(l.procedimento||"")}</div><small>${esc(l.origem||"Site")}</small></div>
      <select class="lead-status" data-lead-status>
        ${["Novo","Contatado","Agendado","Sem resposta"].map(x=>`<option value="${x}" ${x===st?"selected":""}>${x}</option>`).join("")}
      </select>
      <div class="lead-actions"><a class="lead-wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a></div>
    </article>`;
  }).join("");
  list.querySelectorAll("[data-lead-status]").forEach(sel=>sel.addEventListener("change",async e=>{
    const row=e.target.closest(".lead-row");
    const id=row?.dataset.id;
    if(!id)return;
    const before=(state.leads.find(x=>x.id===id)||{}).status||"Novo";
    e.target.disabled=true;
    try{
      await api("atualizarStatusLead",{id,status:e.target.value});
      const lead=state.leads.find(x=>x.id===id);if(lead)lead.status=e.target.value;
      renderLeads();toast("Status do cliente atualizado");
    }catch(err){e.target.value=before;setMsg($("#leadsMsg"),err.message);}finally{e.target.disabled=false}
  }));
}

function openProcedureModal(){const m=$("#procedureModal");m.classList.add("open");m.setAttribute("aria-hidden","false");setMsg($("#newProcedureMsg"),"");setTimeout(()=>$("#newProcedureForm").elements.nome.focus(),80)}
function closeProcedureModal(){const m=$("#procedureModal");m.classList.remove("open");m.setAttribute("aria-hidden","true")}
$("#addProcedureBtn")?.addEventListener("click",openProcedureModal);
$$('[data-close-procedure-modal]').forEach(x=>x.addEventListener("click",closeProcedureModal));
$("#newProcedureForm")?.addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button[type="submit"]');btn.disabled=true;setMsg($("#newProcedureMsg"),"Criando nova aba...");
  try{
    const j=await api("criarProcedimento",{nome:f.elements.nome.value,descricao:f.elements.descricao.value});
    state.procedures[j.procedure.key]=j.procedure;state.currentKey=j.procedure.key;f.reset();closeProcedureModal();renderAll();toast("Novo procedimento criado");
  }catch(err){setMsg($("#newProcedureMsg"),err.message)}finally{btn.disabled=false}
});

$("#refreshBtn").addEventListener("click",loadProcedures);
$("#refreshLeadsBtn")?.addEventListener("click",loadLeads);
$("#leadSearch")?.addEventListener("input",renderLeads);
$("#leadStatusFilter")?.addEventListener("change",renderLeads);
$("#passwordForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),btn=e.currentTarget.querySelector("button");btn.disabled=true;setMsg($("#passwordMsg"),"Alterando...");
  try{await api("alterarMinhaSenha",{senhaAtual:f.get("senhaAtual"),novaSenha:f.get("novaSenha"),confirmarSenha:f.get("confirmarSenha")});e.currentTarget.reset();setMsg($("#passwordMsg"),"Senha alterada. Entre novamente.",true);toast("Senha alterada");setTimeout(()=>{clearSession();showLogin("Senha alterada. Faça login novamente.")},900);}catch(err){setMsg($("#passwordMsg"),err.message)}finally{btn.disabled=false}
});

$$(".nav-btn").forEach(b=>b.addEventListener("click",()=>{const view=b.dataset.view;$$('.nav-btn').forEach(x=>x.classList.toggle('active',x===b));$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));if(view==='clientes'&&!state.leads.length)loadLeads();$("#sidebar").classList.remove("open");}));
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));

autoStart();
async function autoStart(){
  if(!restoreSession()){showLogin();return;}
  setMsg($("#loginMsg"),"Restaurando sessão...");
  try{const j=await api("verificarToken");state.user=j.usuario||state.user;saveSession();showApp();}catch(_){clearSession();showLogin("Faça login para continuar.")}
}
