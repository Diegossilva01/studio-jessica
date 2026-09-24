/**
 * STUDIO JESSICA LEITE — SITE + PAINEL ADMINISTRATIVO
 * Arquitetura inspirada no painel ADONESCELL enviado pelo usuário:
 * - site/admin hospedados no Git/Vercel
 * - API JSON via Google Apps Script
 * - dados persistidos na Planilha Google
 * - fotos enviadas pelo painel e armazenadas no Google Drive
 * - login com senha armazenada como hash + token de sessão
 *
 * PLANILHA FIXA:
 * https://docs.google.com/spreadsheets/d/1JAF9NUtpuZcCOKaW7xkfShjzHS1YEw7s09I36LBjb8E/edit
 *
 * INSTALAÇÃO:
 * 1) Cole este arquivo inteiro no Code.gs.
 * 2) Salve e execute INSTALAR() uma vez.
 * 3) Autorize Planilhas e Google Drive.
 * 4) Em Implantar > Gerenciar implantações, edite a implantação atual,
 *    selecione Nova versão e clique em Implantar.
 * 5) Mantenha o acesso do Web App como "Qualquer pessoa".
 *
 * LOGIN INICIAL DO PAINEL:
 * usuário: admin
 * senha: 123456
 */

const CFG = {
  SPREADSHEET_ID: '1JAF9NUtpuZcCOKaW7xkfShjzHS1YEw7s09I36LBjb8E',
  TOKEN_HORAS: 720,
  ABA_USUARIOS: 'Usuarios',
  ABA_LOG: 'Log',
  ABA_LEADS: 'Leads',
  PASTA_FOTOS: 'Studio Jessica Leite - Galeria do Site',
  MAX_IMAGENS: 10,
  PROCEDIMENTOS: [
    {
      key: 'micropigmentacao',
      sheet: 'Micropigmentação',
      nome: 'Micropigmentação de Sobrancelhas',
      precoPromocional: '',
      observacaoPreco: 'sobrancelhas',
      descricao: 'Preenchimento e definição com desenho personalizado para valorizar o formato do rosto.'
    },
    {
      key: 'design',
      sheet: 'Design',
      nome: 'Design de Sobrancelhas',
      precoPromocional: '',
      observacaoPreco: 'sobrancelhas',
      descricao: 'Mapeamento e acabamento para deixar as sobrancelhas mais harmônicas e bem definidas.'
    },
    {
      key: 'cilios',
      sheet: 'Cílios',
      nome: 'Extensão de Cílios',
      precoPromocional: '',
      observacaoPreco: 'extensão de cílios',
      descricao: 'Técnicas para um olhar delicado ou mais marcante, escolhidas de acordo com o efeito que você deseja.'
    }
  ]
};

const PUBLIC_CACHE_KEY = 'STUDIO_PUBLIC_V26';
const PUBLIC_CACHE_SECONDS = 45;

function limparCachePublico_(){
  try{ CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY); }catch(_){ }
}

function dadosPublicos_(){
  const cache = CacheService.getScriptCache();
  try{
    const cached = cache.get(PUBLIC_CACHE_KEY);
    if(cached) return JSON.parse(cached);
  }catch(_){ }

  // Abre a planilha uma única vez e lê as três abas em sequência.
  const ss = planilha_();
  const procedures = {};
  CFG.PROCEDIMENTOS.forEach(cfg => {
    procedures[cfg.key] = procedimentoPublico_(lerProcedimento_(cfg.key, ss));
  });
  const payload = {
    success:true,
    ok:true,
    updatedAt:new Date().toISOString(),
    procedures:procedures
  };
  try{ cache.put(PUBLIC_CACHE_KEY, JSON.stringify(payload), PUBLIC_CACHE_SECONDS); }catch(_){ }
  return payload;
}

function planilha_(){
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}

function INSTALAR(){
  const props = PropertiesService.getScriptProperties();
  if(!props.getProperty('HASH_SALT')) props.setProperty('HASH_SALT', Utilities.getUuid() + Utilities.getUuid());

  const ss = planilha_();
  CFG.PROCEDIMENTOS.forEach(configurarAbaProcedimento_);

  criarAba_(ss, CFG.ABA_USUARIOS, [
    'ID','Nome','Usuário','Senha Hash','Perfil','Status','Token','Validade token','Data de cadastro'
  ]);
  criarAba_(ss, CFG.ABA_LOG, ['Data','Ação','Detalhe','Usuário']);
  criarAba_(ss, CFG.ABA_LEADS, ['ID','Data','Nome','Telefone','Procedimento','Origem','Página','Referência','UTM Source','UTM Medium','UTM Campaign','UTM Term','UTM Content','Status']);

  const usuarios = ss.getSheetByName(CFG.ABA_USUARIOS);
  if(usuarios.getLastRow() < 2){
    usuarios.appendRow([
      uid_('USR'),'Administrador','admin',hash_('123456'),'Administrador','Ativo','','',new Date()
    ]);
  }

  const pasta = pastaFotosRaiz_();
  SpreadsheetApp.flush();
  limparCachePublico_();

  const retorno = {
    ok: true,
    mensagem: 'Painel do Studio Jessica Leite configurado.',
    planilha: ss.getUrl(),
    pastaFotos: pasta.getUrl(),
    loginInicial: 'admin',
    senhaInicial: '123456'
  };
  Logger.log(JSON.stringify(retorno, null, 2));
  return retorno;
}

function configurarPlanilha(){
  return INSTALAR();
}

function configurarAbaProcedimento_(config){
  const ss = planilha_();
  let sh = ss.getSheetByName(config.sheet);
  if(!sh) sh = ss.insertSheet(config.sheet);

  const atual = lerMapaAba_(sh);
  const precoAntigo = primeiroValor_(atual, ['preço promocional','preco promocional','preço','preco']);
  const precoPromo = precoAntigo !== '' ? precoAntigo : config.precoPromocional;
  const precoOriginal = primeiroValor_(atual, ['preço original','preco original']);

  const rows = [
    ['CAMPO','VALOR','COMO PREENCHER'],
    ['Nome', valorOuPadrao_(atual,['nome'],config.nome), 'Editável pelo painel'],
    ['Preço original', precoOriginal, 'Valor normal/mais alto. Ex.: 1000'],
    ['Preço promocional', precoPromo, 'Valor da oferta. Ex.: 500'],
    ['Desconto calculado', '', 'Automático'],
    ['Observação do preço', valorOuPadrao_(atual,['observação do preço','observacao do preco'],config.observacaoPreco), 'Ex.: por sessão'],
    ['Descrição', valorOuPadrao_(atual,['descrição','descricao'],config.descricao), 'Texto curto exibido no site'],
    ['Ativo', valorOuPadrao_(atual,['ativo'],'SIM'), 'SIM mostra / NÃO oculta']
  ];

  for(let i=1;i<=CFG.MAX_IMAGENS;i++){
    rows.push([
      `Link imagem ${i}`,
      valorOuPadrao_(atual,[`link imagem ${i}`],''),
      'Preenchido automaticamente pelo painel'
    ]);
  }

  sh.getRange(1,1,18,3).clearContent().clearFormat();
  sh.getRange(1,1,rows.length,3).setValues(rows);
  sh.getRange('B5').setFormula('=IF(OR(B3="",B4="",B3<=B4),"",ROUND((1-B4/B3)*100,0)&"% OFF")');

  sh.setFrozenRows(1);
  sh.setColumnWidth(1,190);
  sh.setColumnWidth(2,480);
  sh.setColumnWidth(3,410);
  sh.setRowHeights(1,18,30);
  sh.getRange('A1:C1').setBackground('#17130F').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('A2:A18').setBackground('#F5EFE8').setFontWeight('bold');
  sh.getRange('B2:B18').setBackground('#FFF8E8');
  sh.getRange('B5').setBackground('#E9F6E8').setFontWeight('bold').setFontColor('#27632A');
  sh.getRange('A1:C18').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true,true,true,true,true,true,'#E6D8C8',SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('B3:B4').setNumberFormat('R$ #,##0.00');
}

function doGet(e){
  try{
    const acao = String(e && e.parameter && e.parameter.acao || '').trim();
    if(acao === 'ping') return respostaGet_({ok:true,success:true,sistema:'Studio Jessica Leite'}, e);
    if(acao === 'listarLeads'){
      const u = auth_(String(e && e.parameter && e.parameter.token || ''));
      return respostaGet_(listarLeads_(u), e);
    }

    return respostaGet_(dadosPublicos_(), e);
  }catch(err){
    return respostaGet_({success:false,ok:false,error:msg_(err),erro:msg_(err)}, e);
  }
}

function doPost(e){
  try{
    const d = JSON.parse(e && e.postData && e.postData.contents || '{}');
    const acao = String(d.acao || '').trim();

    if(acao === 'capturarLead') return json_(capturarLead_(d));
    if(acao === 'login') return json_(login_(d));

    const u = auth_(d.token);
    const mapa = {
      verificarToken: () => ({ok:true,usuario:publicUser_(u)}),
      listarProcedimentos: () => listarProcedimentos_(u),
      listarLeads: () => listarLeads_(u),
      atualizarStatusLead: () => atualizarStatusLead_(u,d),
      salvarProcedimento: () => salvarProcedimento_(u,d),
      adicionarImagens: () => adicionarImagens_(u,d),
      excluirImagem: () => excluirImagem_(u,d),
      alterarMinhaSenha: () => alterarMinhaSenha_(u,d)
    };

    if(!mapa[acao]) throw new Error('Ação inválida.');
    return json_(mapa[acao]());
  }catch(err){
    return json_({ok:false,erro:msg_(err)});
  }
}

function capturarLead_(d){
  const id = clean_(d.id,80) || uid_('LEAD');
  const nome = clean_(d.nome,80);
  const telefone = String(d.telefone || '').replace(/\D/g,'').slice(0,15);
  const procedimento = clean_(d.procedimento,120);
  if(nome.length < 2) throw new Error('Informe seu nome.');
  if(telefone.length < 10) throw new Error('Informe um WhatsApp válido com DDD.');
  if(!procedimento) throw new Error('Informe o procedimento de interesse.');

  const ss = planilha_();
  let sh = ss.getSheetByName(CFG.ABA_LEADS);
  if(!sh){
    sh = criarAba_(ss, CFG.ABA_LEADS, ['ID','Data','Nome','Telefone','Procedimento','Origem','Página','Referência','UTM Source','UTM Medium','UTM Campaign','UTM Term','UTM Content','Status']);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    if(sh.getLastRow() >= 2){
      const achado = sh.getRange(2,1,sh.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();
      if(achado) return {ok:true,duplicado:true,id:id};
    }
    sh.appendRow([
      id,
      new Date(),
      nome,
      telefone,
      procedimento,
      clean_(d.origem,120) || 'Site',
      String(d.pagina || '').slice(0,500),
      String(d.referencia || '').slice(0,500),
      clean_(d.utmSource,160),
      clean_(d.utmMedium,160),
      clean_(d.utmCampaign,220),
      clean_(d.utmTerm,220),
      clean_(d.utmContent,220),
      'Novo'
    ]);
    SpreadsheetApp.flush();
  }finally{
    lock.releaseLock();
  }
  return {ok:true,id:id};
}

function login_(d){
  const usuario = String(d.usuario || '').trim().toLowerCase();
  const senha = String(d.senha || '');
  if(!usuario || !senha) throw new Error('Informe usuário e senha.');

  const sh = planilha_().getSheetByName(CFG.ABA_USUARIOS);
  if(!sh) throw new Error('Execute INSTALAR() no Apps Script primeiro.');

  const u = objetos_(sh).find(x =>
    String(x['Usuário'] || '').trim().toLowerCase() === usuario &&
    String(x['Senha Hash'] || '') === hash_(senha) &&
    String(x['Status'] || '') === 'Ativo'
  );
  if(!u) throw new Error('Usuário ou senha inválidos.');

  const token = Utilities.getUuid() + Utilities.getUuid();
  const validade = new Date(Date.now() + CFG.TOKEN_HORAS * 3600000);
  atualizarLinha_(sh,u._linha,{'Token':token,'Validade token':validade});
  log_('LOGIN','Acesso ao painel',u);
  return {ok:true,token,usuario:publicUser_(u)};
}

function auth_(token){
  if(!token) throw new Error('Sessão expirada.');
  const sh = planilha_().getSheetByName(CFG.ABA_USUARIOS);
  if(!sh) throw new Error('Execute INSTALAR() primeiro.');
  const u = objetos_(sh).find(x => String(x.Token || '') === String(token) && String(x.Status || '') === 'Ativo');
  if(!u || new Date(u['Validade token']).getTime() < Date.now()) throw new Error('Sessão expirada.');
  return u;
}

function publicUser_(u){
  return {id:u.ID,nome:u.Nome,usuario:u['Usuário'],perfil:u.Perfil};
}

function listarProcedimentos_(u){
  const procedures = {};
  CFG.PROCEDIMENTOS.forEach(cfg => procedures[cfg.key] = lerProcedimento_(cfg.key));
  return {ok:true,procedures:procedures,usuario:publicUser_(u)};
}

function listarLeads_(u){
  const ss = planilha_();
  let sh = ss.getSheetByName(CFG.ABA_LEADS);
  if(!sh){
    sh = criarAba_(ss, CFG.ABA_LEADS, ['ID','Data','Nome','Telefone','Procedimento','Origem','Página','Referência','UTM Source','UTM Medium','UTM Campaign','UTM Term','UTM Content','Status']);
  }
  const rows = objetos_(sh).map(x => ({
    id: String(x.ID || ''),
    data: x.Data instanceof Date ? x.Data.toISOString() : String(x.Data || ''),
    nome: String(x.Nome || ''),
    telefone: String(x.Telefone || ''),
    procedimento: String(x.Procedimento || ''),
    origem: String(x.Origem || 'Site'),
    pagina: String(x['Página'] || ''),
    referencia: String(x['Referência'] || ''),
    utmSource: String(x['UTM Source'] || ''),
    utmMedium: String(x['UTM Medium'] || ''),
    utmCampaign: String(x['UTM Campaign'] || ''),
    status: String(x.Status || 'Novo')
  }));
  rows.sort((a,b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
  return {ok:true,leads:rows.slice(0,500),usuario:publicUser_(u)};
}

function atualizarStatusLead_(u,d){
  const id = clean_(d.id,80);
  const status = clean_(d.status,40);
  const permitidos = ['Novo','Contatado','Agendado','Sem resposta'];
  if(!id) throw new Error('Cliente inválido.');
  if(permitidos.indexOf(status) < 0) throw new Error('Status inválido.');
  const sh = planilha_().getSheetByName(CFG.ABA_LEADS);
  if(!sh) throw new Error('Aba Leads não encontrada.');
  const leads = objetos_(sh);
  const lead = leads.find(x => String(x.ID || '') === id);
  if(!lead) throw new Error('Cliente não encontrado.');
  atualizarLinha_(sh, lead._linha, {'Status':status});
  SpreadsheetApp.flush();
  log_('ATUALIZAR_LEAD', id + ' • ' + status, u);
  return {ok:true};
}

function salvarProcedimento_(u,d){
  const cfg = configPorKey_(d.key);
  const sh = planilha_().getSheetByName(cfg.sheet);
  if(!sh) throw new Error('Aba do procedimento não encontrada. Execute INSTALAR().');

  const nome = clean_(d.nome,120) || cfg.nome;
  const original = numeroOuVazio_(d.precoOriginal);
  const promocional = numeroOuVazio_(d.precoPromocional);
  const observacao = clean_(d.observacaoPreco,120);
  const descricao = clean_(d.descricao,900);
  const ativo = d.ativo === true || String(d.ativo || '').toUpperCase() === 'SIM' ? 'SIM' : 'NÃO';

  if(original !== '' && original < 0) throw new Error('Preço original inválido.');
  if(promocional !== '' && promocional < 0) throw new Error('Preço promocional inválido.');

  sh.getRange('B2').setValue(nome);
  sh.getRange('B3').setValue(original);
  sh.getRange('B4').setValue(promocional);
  sh.getRange('B5').setFormula('=IF(OR(B3="",B4="",B3<=B4),"",ROUND((1-B4/B3)*100,0)&"% OFF")');
  sh.getRange('B6').setValue(observacao);
  sh.getRange('B7').setValue(descricao);
  sh.getRange('B8').setValue(ativo);
  SpreadsheetApp.flush();
  limparCachePublico_();

  log_('SALVAR_PROCEDIMENTO', cfg.sheet, u);
  return {ok:true,procedure:lerProcedimento_(cfg.key)};
}

function adicionarImagens_(u,d){
  const cfg = configPorKey_(d.key);
  const fotos = Array.isArray(d.imagens) ? d.imagens : [];
  if(!fotos.length) throw new Error('Selecione pelo menos uma imagem.');
  if(fotos.length > 5) throw new Error('Envie no máximo 5 imagens por vez.');

  const sh = planilha_().getSheetByName(cfg.sheet);
  if(!sh) throw new Error('Aba do procedimento não encontrada.');

  const atual = lerProcedimento_(cfg.key);
  const ocupados = {};
  (atual.imagesDetailed || []).forEach(x => ocupados[x.slot] = true);
  const livres = [];
  for(let slot=1;slot<=CFG.MAX_IMAGENS;slot++) if(!ocupados[slot]) livres.push(slot);
  if(!livres.length) throw new Error('Esse procedimento já possui 10 imagens. Exclua uma antes de adicionar outra.');
  if(fotos.length > livres.length) throw new Error(`Há espaço para apenas ${livres.length} imagem(ns).`);

  const pasta = pastaProcedimento_(cfg);
  const adicionadas = [];

  fotos.forEach((f,index) => {
    const mime = String(f.mime || 'image/jpeg');
    if(!/^image\//i.test(mime)) throw new Error('Um dos arquivos não é uma imagem válida.');
    const b64 = String(f.base64 || '').trim();
    if(!b64) throw new Error('Uma das imagens veio vazia.');

    const bytes = Utilities.base64Decode(b64);
    if(bytes.length > 1800000) throw new Error('Uma das imagens ficou muito grande. Tente novamente com uma foto menor.');

    const ext = mime.includes('png') ? 'png' : 'jpg';
    const nome = cfg.key + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + (index+1) + '.' + ext;
    const file = pasta.createFile(Utilities.newBlob(bytes,mime,nome));
    try{ file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }catch(_){ }

    const slot = livres[index];
    const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
    sh.getRange(8 + slot, 2).setValue(url);
    adicionadas.push({slot:slot,url:url,fileId:file.getId()});
  });

  SpreadsheetApp.flush();
  limparCachePublico_();
  log_('ADICIONAR_IMAGENS', cfg.sheet + ' • ' + adicionadas.length + ' imagem(ns)', u);
  return {ok:true,adicionadas:adicionadas,procedure:lerProcedimento_(cfg.key)};
}

function excluirImagem_(u,d){
  const cfg = configPorKey_(d.key);
  const slot = Number(d.slot);
  if(!Number.isInteger(slot) || slot < 1 || slot > CFG.MAX_IMAGENS) throw new Error('Imagem inválida.');

  const sh = planilha_().getSheetByName(cfg.sheet);
  const cell = sh.getRange(8 + slot, 2);
  const url = String(cell.getValue() || '').trim();
  if(!url) return {ok:true,procedure:lerProcedimento_(cfg.key)};

  const fileId = driveFileId_(url);
  if(fileId){
    try{ DriveApp.getFileById(fileId).setTrashed(true); }catch(_){ }
  }
  cell.clearContent();
  SpreadsheetApp.flush();
  limparCachePublico_();

  log_('EXCLUIR_IMAGEM', cfg.sheet + ' • slot ' + slot, u);
  return {ok:true,procedure:lerProcedimento_(cfg.key)};
}

function alterarMinhaSenha_(u,d){
  const atual = String(d.senhaAtual || '');
  const nova = String(d.novaSenha || '');
  const confirmar = String(d.confirmarSenha || '');
  if(String(u['Senha Hash'] || '') !== hash_(atual)) throw new Error('Senha atual incorreta.');
  if(nova.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
  if(nova !== confirmar) throw new Error('A confirmação da nova senha não confere.');

  const sh = planilha_().getSheetByName(CFG.ABA_USUARIOS);
  atualizarLinha_(sh,u._linha,{'Senha Hash':hash_(nova),'Token':'','Validade token':''});
  log_('ALTERAR_SENHA','Senha alterada',u);
  return {ok:true};
}

function lerProcedimento_(key, ssOpcional){
  const cfg = configPorKey_(key);
  const ss = ssOpcional || planilha_();
  const sh = ss.getSheetByName(cfg.sheet);
  if(!sh) throw new Error('Aba ' + cfg.sheet + ' não encontrada. Execute INSTALAR().');

  const mapa = lerMapaAba_(sh);
  const original = normalizarNumero_(primeiroValor_(mapa,['preço original','preco original']));
  const promocional = normalizarNumero_(primeiroValor_(mapa,['preço promocional','preco promocional','preço','preco']));
  const discount = calcularDesconto_(original,promocional);
  const detailed = [];

  for(let i=1;i<=CFG.MAX_IMAGENS;i++){
    const url = String(primeiroValor_(mapa,[`link imagem ${i}`]) || '').trim();
    if(url) detailed.push({slot:i,url:url});
  }

  return {
    key: cfg.key,
    sheet: cfg.sheet,
    title: String(valorOuPadrao_(mapa,['nome'],cfg.nome)).trim(),
    nome: String(valorOuPadrao_(mapa,['nome'],cfg.nome)).trim(),
    priceOriginal: original,
    priceOriginalText: original === null ? '' : formatarPreco_(original),
    precoOriginal: original,
    price: promocional,
    priceText: promocional === null ? 'Consultar' : formatarPreco_(promocional),
    precoPromocional: promocional,
    discountPercent: discount,
    priceNote: String(valorOuPadrao_(mapa,['observação do preço','observacao do preco'],cfg.observacaoPreco)).trim(),
    observacaoPreco: String(valorOuPadrao_(mapa,['observação do preço','observacao do preco'],cfg.observacaoPreco)).trim(),
    description: String(valorOuPadrao_(mapa,['descrição','descricao'],cfg.descricao)).trim(),
    descricao: String(valorOuPadrao_(mapa,['descrição','descricao'],cfg.descricao)).trim(),
    active: String(valorOuPadrao_(mapa,['ativo'],'SIM')).trim().toUpperCase() !== 'NÃO',
    ativo: String(valorOuPadrao_(mapa,['ativo'],'SIM')).trim().toUpperCase() !== 'NÃO',
    images: detailed.map(x => x.url),
    imagesDetailed: detailed
  };
}

function procedimentoPublico_(p){
  return {
    title:p.title,
    priceOriginal:p.priceOriginal,
    priceOriginalText:p.priceOriginalText,
    price:p.price,
    priceText:p.priceText,
    discountPercent:p.discountPercent,
    priceNote:p.priceNote,
    description:p.description,
    active:p.active,
    images:p.images
  };
}

function configPorKey_(key){
  const k = String(key || '').trim().toLowerCase();
  const cfg = CFG.PROCEDIMENTOS.find(x => x.key === k);
  if(!cfg) throw new Error('Procedimento inválido.');
  return cfg;
}

function lerMapaAba_(sh){
  const out = {};
  const last = Math.min(Math.max(sh.getLastRow(),0),100);
  if(last < 1) return out;
  const rows = sh.getRange(1,1,last,2).getValues();
  rows.forEach(r => {
    const k = normalizarChave_(r[0]);
    if(k && k !== 'campo') out[k] = r[1];
  });
  return out;
}

function primeiroValor_(obj,chaves){
  for(const chave of chaves){
    const k = normalizarChave_(chave);
    if(Object.prototype.hasOwnProperty.call(obj,k) && obj[k] !== '') return obj[k];
  }
  return '';
}

function valorOuPadrao_(obj,chaves,padrao){
  const v = primeiroValor_(obj,chaves);
  return v !== '' ? v : padrao;
}

function normalizarChave_(v){
  return String(v || '').trim().toLowerCase();
}

function normalizarNumero_(value){
  if(typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value == null ? '' : value).trim();
  if(!text) return null;
  let clean = text.replace(/R\$/gi,'').replace(/\s/g,'');
  if(clean.includes(',')) clean = clean.replace(/\./g,'').replace(',','.');
  clean = clean.replace(/[^0-9.-]/g,'');
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function numeroOuVazio_(v){
  const raw = String(v == null ? '' : v).trim();
  if(!raw) return '';
  const n = normalizarNumero_(v);
  if(n === null) throw new Error('Informe um preço válido.');
  return n;
}

function calcularDesconto_(original,promo){
  if(original === null || promo === null || original <= 0 || promo < 0 || promo >= original) return null;
  return Math.round((1 - promo/original) * 100);
}

function formatarPreco_(value){
  const n = typeof value === 'number' ? value : normalizarNumero_(value);
  if(n === null || !Number.isFinite(n)) return 'Consultar';
  return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

function pastaFotosRaiz_(){
  const props = PropertiesService.getScriptProperties();
  const salvo = String(props.getProperty('FOTOS_FOLDER_ID') || '').trim();
  if(salvo){
    try{return DriveApp.getFolderById(salvo);}catch(_){ }
  }
  const it = DriveApp.getFoldersByName(CFG.PASTA_FOTOS);
  const pasta = it.hasNext() ? it.next() : DriveApp.createFolder(CFG.PASTA_FOTOS);
  props.setProperty('FOTOS_FOLDER_ID',pasta.getId());
  return pasta;
}

function pastaProcedimento_(cfg){
  const raiz = pastaFotosRaiz_();
  const it = raiz.getFoldersByName(cfg.sheet);
  return it.hasNext() ? it.next() : raiz.createFolder(cfg.sheet);
}

function driveFileId_(url){
  const s = String(url || '');
  const m = s.match(/\/file\/d\/([^/?]+)/i) || s.match(/[?&]id=([^&]+)/i);
  return m ? m[1] : '';
}

function criarAba_(ss,nome,cabecalho){
  let sh = ss.getSheetByName(nome);
  if(!sh) sh = ss.insertSheet(nome);
  if(sh.getLastRow() < 1){
    sh.getRange(1,1,1,cabecalho.length).setValues([cabecalho]);
  }else{
    const atual = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),cabecalho.length)).getValues()[0];
    cabecalho.forEach((h,i) => { if(atual[i] !== h) sh.getRange(1,i+1).setValue(h); });
  }
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,cabecalho.length).setBackground('#17130F').setFontColor('#FFFFFF').setFontWeight('bold');
  return sh;
}

function objetos_(sh){
  if(!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(x => String(x || '').trim());
  return values.map((row,idx) => {
    const o = {_linha:idx+2};
    headers.forEach((h,i) => { if(h) o[h] = row[i]; });
    return o;
  });
}

function atualizarLinha_(sh,linha,obj){
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(x => String(x || '').trim());
  Object.keys(obj).forEach(k => {
    const idx = headers.indexOf(k);
    if(idx >= 0) sh.getRange(linha,idx+1).setValue(obj[k]);
  });
}

function hash_(s){
  const salt = PropertiesService.getScriptProperties().getProperty('HASH_SALT') || '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + String(s || ''), Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
}

function uid_(prefix){
  return prefix + '-' + Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();
}

function clean_(v,max){
  return String(v == null ? '' : v).trim().replace(/\s+/g,' ').slice(0,max || 500);
}

function log_(acao,detalhe,u){
  try{
    const sh = planilha_().getSheetByName(CFG.ABA_LOG);
    if(sh) sh.appendRow([new Date(),acao,String(detalhe || ''),u ? String(u['Usuário'] || u.Nome || '') : '']);
  }catch(_){ }
}

function msg_(err){
  return err && err.message ? err.message : String(err || 'Erro inesperado.');
}

function respostaGet_(obj,e){
  const callback = String(e && e.parameter && e.parameter.callback || '').trim();
  if(callback && /^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(callback)){
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(obj);
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function TESTAR(){
  const ss = planilha_();
  const r = {ok:true,nome:ss.getName(),url:ss.getUrl(),abas:ss.getSheets().map(x=>x.getName())};
  Logger.log(JSON.stringify(r,null,2));
  return r;
}
