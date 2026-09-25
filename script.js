const PHONE = "5511957547374";
const SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbztSlQ_dmKyvaQ4zAO95IRni2G3ZESlGRiaaJqtsbZww6-Jrf1k4g1yS5fThXKrqlgr-w/exec";
const PUBLIC_CACHE_KEY = "studio_jessica_public_data_v2";
const PENDING_LEADS_KEY = "studio_jessica_pending_leads_v1";

// Conteúdo visual local. PREÇOS NÃO ficam mais salvos no site: vêm somente do painel/planilha.
const FALLBACK = {
  micropigmentacao: {
    title: "Micropigmentação de Sobrancelhas",
    price: null,
    priceText: "",
    priceOriginal: null,
    priceOriginalText: "",
    discountPercent: null,
    priceNote: "sobrancelhas",
    priceMode: "A partir de",
    description: "Preenchimento e definição com desenho personalizado para valorizar o formato do rosto.",
    images: []
  },
  design: {
    title: "Design de Sobrancelhas",
    price: null,
    priceText: "",
    priceOriginal: null,
    priceOriginalText: "",
    discountPercent: null,
    priceNote: "sobrancelhas",
    priceMode: "A partir de",
    description: "Mapeamento e acabamento para deixar as sobrancelhas mais harmônicas e bem definidas.",
    images: []
  },
  cilios: {
    title: "Extensão de Cílios",
    price: null,
    priceText: "",
    priceOriginal: null,
    priceOriginalText: "",
    discountPercent: null,
    priceNote: "extensão de cílios",
    priceMode: "A partir de",
    description: "Técnicas para um olhar delicado ou mais marcante, escolhidas de acordo com o efeito que você deseja.",
    images: []
  },
  browlamination: {
    title: "Brow Lamination",
    price: null,
    priceText: "",
    priceOriginal: null,
    priceOriginalText: "",
    discountPercent: null,
    priceNote: "sobrancelhas alinhadas e modeladas",
    priceMode: "A partir de",
    description: "Técnica para alinhar, modelar e valorizar os fios naturais das sobrancelhas.",
    images: []
  }
};

function wa(text){
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
}

function formatMoney(value){
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", {style:"currency", currency:"BRL"}) : "";
}

function normalizeImageUrl(url){
  if(!url) return "";
  const value = String(url).trim();
  if(!value) return "";
  const driveMatch = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i) || value.match(/[?&]id=([^&]+)/i);
  return driveMatch ? `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1200` : value;
}

function getCleanImages(images){
  return (images || []).map(normalizeImageUrl).filter(Boolean).slice(0,10);
}

function renderCardCover(key, images){
  const cover = getCleanImages(images)[0] || "";
  document.querySelectorAll(`[data-service-card="${key}"] .price-card-image`).forEach(box => {
    const img = box.querySelector("img");
    const bg = box.querySelector(".price-card-backdrop");
    if(!img) return;
    if(!cover){
      box.hidden = true;
      img.hidden = true;
      img.removeAttribute("src");
      if(bg) bg.style.backgroundImage = "none";
      return;
    }
    box.hidden = false;
    img.hidden = false;
    img.src = cover;
    if(bg) bg.style.backgroundImage = `url("${cover.replace(/"/g, "%22")}")`;
    img.onerror = () => {
      box.hidden = true;
      img.hidden = true;
      if(bg) bg.style.backgroundImage = "none";
    };
  });
}

function renderGallery(key, images){
  const gallery = document.querySelector(`[data-gallery="${key}"]`);
  if(!gallery) return;
  const clean = getCleanImages(images);
  gallery.innerHTML = "";
  gallery.hidden = clean.length === 0;
  if(clean.length === 0) return;

  clean.forEach((src,index) => {
    const item = document.createElement("figure");
    item.className = "photo-item";

    const backdrop = document.createElement("span");
    backdrop.className = "photo-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.style.backgroundImage = `url("${src.replace(/"/g, "%22")}")`;

    const img = document.createElement("img");
    img.src = src;
    img.alt = `Resultado ${index + 1}`;
    img.loading = index === 0 ? "eager" : "lazy";
    if(index === 0) img.fetchPriority = "high";
    img.decoding = "async";
    img.onerror = () => item.remove();

    item.append(backdrop, img);
    gallery.appendChild(item);
  });
}

function calculateDiscount(original, current){
  const a = Number(original), b = Number(current);
  if(!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b < 0 || b >= a) return null;
  return Math.round((1 - (b / a)) * 100);
}

function renderPriceLoading(block){
  if(!block) return;
  block.className = "price-display is-loading";
  block.innerHTML = '<span class="price-loading">Carregando valor...</span>';
}

function renderPriceBlock(block, data){
  if(!block) return;
  block.innerHTML = "";
  block.classList.remove("is-loading");

  const originalValue = data.priceOriginal == null || data.priceOriginal === "" ? null : Number(data.priceOriginal);
  const currentValue = data.price == null || data.price === "" ? null : Number(data.price);
  const discount = Number.isFinite(Number(data.discountPercent))
    ? Number(data.discountPercent)
    : calculateDiscount(originalValue, currentValue);
  const hasCurrent = Number.isFinite(currentValue);
  const hasDiscount = Number.isFinite(originalValue) && hasCurrent && originalValue > currentValue && discount > 0;
  block.classList.toggle("has-discount", hasDiscount);

  if(hasDiscount){
    const oldRow = document.createElement("div");
    oldRow.className = "price-old";
    const from = document.createElement("span");
    from.textContent = "De";
    const del = document.createElement("del");
    del.textContent = data.priceOriginalText || formatMoney(originalValue);
    const badge = document.createElement("b");
    badge.className = "discount-badge";
    badge.textContent = `${discount}% OFF`;
    oldRow.append(from, del, badge);
    block.appendChild(oldRow);
  }

  const currentRow = document.createElement("div");
  currentRow.className = "price-current";
  if(hasCurrent){
    const label = document.createElement("span");
    label.textContent = data.priceMode || data.tipoPreco || "A partir de";
    currentRow.appendChild(label);
  }
  const strong = document.createElement("strong");
  strong.textContent = hasCurrent ? (data.priceText || formatMoney(currentValue)) : "Valor em atualização";
  currentRow.appendChild(strong);
  block.appendChild(currentRow);
}

function procedureLabel(key, data){
  if(key === "micropigmentacao") return "Micropigmentação";
  if(key === "design") return "Design de sobrancelhas";
  if(key === "cilios") return "Cílios";
  if(key === "browlamination") return "Brow Lamination";
  return data.title || data.nome || "Procedimento";
}
function ensureLeadOption(data){
  const value=data.title||data.nome||"Procedimento";
  document.querySelectorAll('[data-lead-form] select[name="procedimento"]').forEach(select=>{
    if([...select.options].some(o=>o.value===value)) return;
    const orientacao=[...select.options].find(o=>o.value==="Quero orientação");
    const option=document.createElement("option");option.value=value;option.textContent=procedureLabel(data.key||"",data);
    if(orientacao) select.insertBefore(option,orientacao); else select.appendChild(option);
  });
}
function ensureProcedureUI(key, data={}, index=0){
  const title=data.title||data.nome||procedureLabel(key,data);
  const label=procedureLabel(key,{...data,title});
  const desc=data.description||data.descricao||"Procedimento personalizado.";
  const showcase=document.getElementById("servicos");
  if(showcase && !showcase.querySelector(`[data-service-card="${key}"]`)){
    const card=document.createElement("article");card.className="price-card";card.dataset.serviceCard=key;
    const image=document.createElement("div");image.className="price-card-image";image.hidden=true;image.innerHTML='<span class="price-card-backdrop" aria-hidden="true"></span><img hidden>';
    image.querySelector("img").alt=title;
    const content=document.createElement("div");content.className="price-card-content";
    const name=document.createElement("span");name.textContent=label;
    const price=document.createElement("div");price.className="price-display is-loading";price.dataset.priceBlock=key;price.innerHTML='<span class="price-loading">Carregando valor...</span>';
    const note=document.createElement("small");note.dataset.priceNote=key;note.textContent=data.priceNote||"";
    const link=document.createElement("a");link.className="price-link service-link";link.href="#";link.dataset.service=title;link.textContent="Quero agendar";
    content.append(name,price,note,link);card.append(image,content);showcase.appendChild(card);
  }
  const selector=document.querySelector(".service-selector");
  if(selector && !selector.querySelector(`[data-tab="${key}"]`)){
    const tab=document.createElement("button");tab.className="service-tab";tab.type="button";tab.dataset.tab=key;tab.setAttribute("role","tab");tab.setAttribute("aria-selected","false");
    const num=document.createElement("span");num.className="service-tab-number";num.textContent=String(index+1).padStart(2,"0");
    const copy=document.createElement("span");copy.className="service-tab-copy";const strong=document.createElement("strong");strong.textContent=label;const small=document.createElement("small");small.textContent=desc;copy.append(strong,small);
    const arrow=document.createElement("span");arrow.className="service-tab-arrow";arrow.textContent="→";tab.append(num,copy,arrow);selector.appendChild(tab);
  }
  const stage=document.querySelector(".results-stage");
  if(stage && !stage.querySelector(`[data-panel="${key}"]`)){
    const panel=document.createElement("div");panel.className="gallery-panel";panel.dataset.panel=key;
    panel.innerHTML=`<div class="service-intro"><div class="service-intro-main"><span class="kicker"></span><h3 data-title="${key}"></h3><p data-description="${key}"></p></div><div class="service-price-box"><span>Valor atualizado</span><div class="price-display is-loading" data-price-block="${key}"><span class="price-loading">Carregando valor...</span></div><a class="service-link" data-service="" href="#">Quero agendar <b>→</b></a></div></div><div class="photo-grid" data-gallery="${key}"></div>`;
    panel.querySelector(".kicker").textContent=label;stage.appendChild(panel);
  }
  ensureLeadOption({...data,key,title});
}

function setProcedureVisibility(key, active){
  document.querySelectorAll(`[data-service-card="${key}"]`).forEach(el => el.hidden = !active);
  document.querySelectorAll(`.service-tab[data-tab="${key}"]`).forEach(el => el.hidden = !active);
  document.querySelectorAll(`[data-panel="${key}"]`).forEach(el => el.hidden = !active);
}

function ensureActiveTab(){
  const visibleTabs = [...document.querySelectorAll(".service-tab")].filter(t => !t.hidden);
  if(!visibleTabs.length) return;
  let active = visibleTabs.find(t => t.classList.contains("active")) || visibleTabs[0];
  if(active.hidden) active = visibleTabs[0];
  document.querySelectorAll(".service-tab").forEach(t => {
    const on = t === active && !t.hidden;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".gallery-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.panel === active.dataset.tab && !panel.hidden);
  });
}

function applyProcedure(key, incoming, {live=false}={}){
  const base = FALLBACK[key] || {title:incoming?.title||incoming?.nome||"Procedimento",price:null,priceText:"",priceOriginal:null,priceOriginalText:"",discountPercent:null,priceNote:"",priceMode:"A partir de",description:incoming?.description||incoming?.descricao||"",images:[]};
  const data = {...base, ...(incoming || {}), key};
  ensureProcedureUI(key,data,Object.keys({...FALLBACK}).indexOf(key));
  const active = data.active !== false;
  setProcedureVisibility(key, active);
  if(!active) return;

  const title = data.title || base.title;
  const note = data.priceNote ?? base.priceNote;
  const description = data.description || base.description;

  if(live || incoming){
    document.querySelectorAll(`[data-price-block="${key}"]`).forEach(el => renderPriceBlock(el, data));
  }
  document.querySelectorAll(`[data-price-note="${key}"]`).forEach(el => el.textContent = note || "");
  document.querySelectorAll(`[data-title="${key}"]`).forEach(el => el.textContent = title);
  document.querySelectorAll(`[data-description="${key}"]`).forEach(el => el.textContent = description);
  document.querySelectorAll(`[data-service-card="${key}"] .service-link`).forEach(el => el.dataset.service = title);
  document.querySelectorAll(`[data-panel="${key}"] .service-link`).forEach(el => el.dataset.service = title);

  // Foto 1 da planilha vira a capa; sem foto na planilha, nenhuma imagem local aparece.
  renderCardCover(key, data.images || []);
  renderGallery(key, data.images || []);
}

function renderBaseContent(){
  Object.entries(FALLBACK).forEach(([key,data],index) => {
    ensureProcedureUI(key,{...data,key},index);
    document.querySelectorAll(`[data-price-block="${key}"]`).forEach(renderPriceLoading);
    renderCardCover(key, []);
    renderGallery(key, []);
  });
}

function savePublicCache(payload){
  try{ localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify({savedAt:Date.now(), payload})); }catch(_){ }
}
function readPublicCache(){
  try{
    const x = JSON.parse(localStorage.getItem(PUBLIC_CACHE_KEY) || "null");
    if(!x?.payload?.procedures) return null;
    if(Date.now() - Number(x.savedAt || 0) > 24*60*60*1000) return null;
    return x.payload;
  }catch(_){ return null; }
}
function applyPayload(payload){
  if(!payload || !payload.success || !payload.procedures) throw new Error("Resposta inválida");
  const entries=Object.entries(payload.procedures);
  entries.forEach(([key,data],index)=>{ensureProcedureUI(key,{...data,key},index);applyProcedure(key,data,{live:true});});
  Object.keys(FALLBACK).forEach(key=>{if(!payload.procedures[key]) setProcedureVisibility(key,false);});
  ensureActiveTab();
  document.documentElement.classList.add("prices-ready");
}

async function fetchJson(){
  const separator = SHEETS_API_URL.includes("?") ? "&" : "?";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try{
    const response = await fetch(`${SHEETS_API_URL}${separator}acao=dados&t=${Date.now()}`, {
      cache:"no-store", redirect:"follow", signal:controller.signal
    });
    if(!response.ok) throw new Error("Erro ao carregar dados");
    return await response.json();
  } finally { clearTimeout(timer); }
}

function fetchJsonp(){
  return new Promise((resolve,reject) => {
    const callback = `studioJessicaData_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const separator = SHEETS_API_URL.includes("?") ? "&" : "?";
    let done = false;
    const clean = () => { try{delete window[callback]}catch(_){window[callback]=undefined} script.remove(); };
    const timer = setTimeout(() => { if(done) return; done=true; clean(); reject(new Error("Tempo esgotado")); }, 5500);
    window[callback] = payload => { if(done) return; done=true; clearTimeout(timer); clean(); resolve(payload); };
    script.onerror = () => { if(done) return; done=true; clearTimeout(timer); clean(); reject(new Error("Falha ao carregar dados")); };
    script.src = `${SHEETS_API_URL}${separator}acao=dados&callback=${encodeURIComponent(callback)}&t=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function loadSheetData(){
  // Mostra apenas estrutura vazia e busca os dados atuais da planilha imediatamente.
  renderBaseContent();
  if(!SHEETS_API_URL || SHEETS_API_URL.includes("COLE_AQUI")) return;

  let lastError;

  // JSONP é mais rápido e estável para Web App do Apps Script hospedado fora do Google.
  try{
    const payload = await fetchJsonp();
    applyPayload(payload);
    return;
  }catch(err){
    lastError = err;
  }

  // Uma única tentativa via fetch como contingência. Antes eram 3 tentativas sequenciais.
  try{
    const payload = await fetchJson();
    applyPayload(payload);
    return;
  }catch(err){
    lastError = err;
  }

  console.warn("Não foi possível sincronizar os dados agora.", lastError);
  document.querySelectorAll(".price-display.is-loading").forEach(block => {
    block.classList.remove("is-loading");
    block.innerHTML = '<div class="price-current"><strong>Atualizando...</strong></div>';
  });
  Object.keys(FALLBACK).forEach(key => {
    renderCardCover(key, []);
    renderGallery(key, []);
  });
  setTimeout(loadSheetData, 5000);
}

function initTabs(){
  document.addEventListener("click",event=>{
    const tab=event.target.closest(".service-tab");if(!tab)return;
    const target=tab.dataset.tab;
    document.querySelectorAll(".service-tab").forEach(t=>{const active=t===tab;t.classList.toggle("active",active);t.setAttribute("aria-selected",String(active));});
    document.querySelectorAll(".gallery-panel").forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===target));
  });
}

function initMenu(){
  const button = document.querySelector(".menu-button");
  const menu = document.querySelector(".menu");
  if(!button || !menu) return;
  button.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
    menu.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }));
}

function initFaq(){
  document.querySelectorAll(".faq-item button").forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const open = item.classList.toggle("active");
      button.querySelector("span").textContent = open ? "−" : "+";
    });
  });
}

function getUtm(){
  const q = new URLSearchParams(location.search);
  return {
    utmSource:q.get("utm_source")||"",
    utmMedium:q.get("utm_medium")||"",
    utmCampaign:q.get("utm_campaign")||"",
    utmTerm:q.get("utm_term")||"",
    utmContent:q.get("utm_content")||""
  };
}

function makeLeadId(){
  return `LEAD-${Date.now()}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
}
function readPendingLeads(){ try{return JSON.parse(localStorage.getItem(PENDING_LEADS_KEY)||"[]")}catch(_){return []} }
function writePendingLeads(items){ try{localStorage.setItem(PENDING_LEADS_KEY,JSON.stringify(items.slice(-20)))}catch(_){ } }
function queueLead(lead){ const items=readPendingLeads(); if(!items.some(x=>x.id===lead.id)) items.push(lead); writePendingLeads(items); }

async function postLead(lead, timeout=7000){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeout);
  try{
    const response = await fetch(SHEETS_API_URL, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({acao:"capturarLead", ...lead}),
      cache:"no-store",
      redirect:"follow",
      signal:controller.signal
    });
    const result = await response.json();
    if(!result.ok) throw new Error(result.erro || "Falha ao registrar contato");
    return true;
  } finally { clearTimeout(timer); }
}

async function flushPendingLeads(){
  const items = readPendingLeads();
  if(!items.length) return;
  const remaining=[];
  for(const lead of items){
    try{ await postLead(lead,5000); }catch(_){ remaining.push(lead); }
  }
  writePendingLeads(remaining);
}

function setSelectedProcedure(service){
  const select = document.querySelector('#leadForm select[name="procedimento"]');
  if(!select) return;
  const normalized = String(service || "").toLowerCase();
  const option = [...select.options].find(o => {
    const v = o.value.toLowerCase();
    if(!v) return false;
    if(normalized.includes("micro")) return v.includes("micro");
    if(normalized.includes("design")) return v.includes("design");
    if(normalized.includes("cílios") || normalized.includes("cilios")) return v.includes("cílios") || v.includes("cilios");
    if(normalized.includes("brow")) return v.includes("brow");
    return v === normalized || v.includes(normalized) || normalized.includes(v);
  });
  select.value = option ? option.value : "";
}

function openLeadModal(service="atendimento"){
  const modal = document.getElementById("leadModal");
  if(!modal) return;
  modal.dataset.sourceService = service;
  setSelectedProcedure(service);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  setTimeout(()=>modal.querySelector('input[name="nome"]')?.focus(),100);
}
function closeLeadModal(){
  const modal = document.getElementById("leadModal");
  if(!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}

function initLeadCapture(){
  document.querySelectorAll("a.whatsapp, a.service-link").forEach(link => {
    const service = link.dataset.service || "atendimento";
    link.href = wa(`Olá! Vi o site do Studio Jessica Leite e tenho interesse em ${service === "atendimento" ? "um atendimento" : service}.`);
  });

  document.addEventListener("click", event => {
    const link = event.target.closest("a.whatsapp, a.service-link");
    if(!link) return;
    event.preventDefault();
    const service = link.dataset.service || "atendimento";
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({event:"lead_form_open", service});
    openLeadModal(service);
  });

  document.querySelectorAll("[data-close-lead-modal]").forEach(el => el.addEventListener("click", closeLeadModal));
  document.addEventListener("keydown", e => { if(e.key === "Escape") closeLeadModal(); });

  document.querySelectorAll('[data-lead-form] input[name="telefone"]').forEach(phoneInput => {
    phoneInput.addEventListener("input", e => {
      let d = e.target.value.replace(/\D/g,"").slice(0,11);
      if(d.length > 10) d = d.replace(/(\d{2})(\d{5})(\d{0,4})/,"($1) $2-$3");
      else if(d.length > 6) d = d.replace(/(\d{2})(\d{4})(\d{0,4})/,"($1) $2-$3");
      else if(d.length > 2) d = d.replace(/(\d{2})(\d+)/,"($1) $2");
      else if(d.length) d = d.replace(/(\d{0,2})/,"($1");
      e.target.value = d;
    });
  });

  document.querySelectorAll('[data-lead-form]').forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const msg = form.querySelector(".lead-form-message");
      const btn = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      const nome = String(fd.get("nome")||"").trim();
      const telefone = String(fd.get("telefone")||"").replace(/\D/g,"");
      const procedimento = String(fd.get("procedimento")||"").trim();
      if(nome.length < 2){ msg.textContent="Digite seu nome."; form.elements.nome.focus(); return; }
      if(telefone.length < 10){ msg.textContent="Digite um WhatsApp válido com DDD."; form.elements.telefone.focus(); return; }
      if(!procedimento){ msg.textContent="Selecione o procedimento de interesse."; form.elements.procedimento.focus(); return; }

      const lead = {
        id:makeLeadId(), nome, telefone, procedimento,
        origem: form.classList.contains("lead-form-inline") ? "Site - formulário principal" : "Site - formulário antes do WhatsApp",
        pagina:location.href,
        referencia:document.referrer || "",
        ...getUtm()
      };

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = "Salvando contato...";
      msg.textContent = "";
      let saved = false;
      try{
        await postLead(lead);
        saved = true;
      }catch(_){
        queueLead(lead);
        try{
          if(navigator.sendBeacon){
            const blob = new Blob([JSON.stringify({acao:"capturarLead",...lead})], {type:"text/plain;charset=utf-8"});
            navigator.sendBeacon(SHEETS_API_URL, blob);
          }
        }catch(__){ }
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({event:"lead_whatsapp", service:procedimento, lead_saved:saved});
      const text = `Olá! Meu nome é ${nome}. Vi o site do Studio Jessica Leite e tenho interesse em ${procedimento}. Meu telefone é ${form.elements.telefone.value}. Gostaria de ver os horários disponíveis.`;
      window.location.href = wa(text);
      setTimeout(()=>{btn.disabled=false;btn.textContent=originalText;},1800);
    });
  });

  document.querySelector(".hero-contact-close")?.addEventListener("click", () => {
    document.querySelector(".hero-contact-card")?.classList.add("hidden-card");
  });
}

const year = document.getElementById("year");
if(year) year.textContent = new Date().getFullYear();
initMenu();
initTabs();
initFaq();
initLeadCapture();
loadSheetData();
flushPendingLeads();
