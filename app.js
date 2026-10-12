(() => {
  'use strict';

  const PF1_STORAGE_KEY = 'dtEssayHelper.pf1.v1';
  const PF2_STORAGE_KEY = 'dtEssayHelper.pf2.v1';
  const PF3_STORAGE_KEY = 'dtEssayHelper.pf3.v1';
  const PF1_MAX = 4800;
  const PF2_MAX = 7200;
  const PF3_MAX = 12000;
  const PF1_DEFAULT_BUDGETS = { problem: 720, method: 960, analysis: 3120 };
  const PF2_DEFAULT_BUDGETS = { problem: 900, method: 1300, theory: 800, analysis: 3500, future: 700 };
  const PF3_DEFAULT_BUDGETS = { problem: 1400, method: 1800, theory: 1400, analysis: 6000, conclusion: 1400 };
  const VERSION_LIMIT = 40;
  const AUTO_VERSION_MS = 10 * 60 * 1000;

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  function pf1DefaultState() {
    return {
      sections: { problem: '', method: '', analysis: '', references: '' },
      budgets: { ...PF1_DEFAULT_BUDGETS },
      sources: [],
      feedback: { raw: '', points: '', where: '', change: '', why: '', status: 'ikke-set', fileName: '' },
      versions: [], activity: [], lastSavedAt: null, lastAutoVersionHash: ''
    };
  }

  function pf2DefaultState() {
    return {
      sections: { problem: '', method: '', theory: '', analysis: '', future: '', references: '' },
      budgets: { ...PF2_DEFAULT_BUDGETS },
      sources: [], comments: [], versions: [], activity: [], lastSavedAt: null, lastAutoVersionHash: ''
    };
  }

  function pf3DefaultState() {
    return {
      sections: { problem: '', method: '', theory: '', analysis: '', conclusion: '', references: '' },
      budgets: { ...PF3_DEFAULT_BUDGETS },
      sources: [], comments: [], versions: [], activity: [], lastSavedAt: null, lastAutoVersionHash: ''
    };
  }

  function load(key, defaults) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      const base = defaults();
      return {
        ...base,
        ...parsed,
        sections: { ...base.sections, ...(parsed.sections || {}) },
        budgets: { ...base.budgets, ...(parsed.budgets || {}) },
        feedback: base.feedback ? { ...base.feedback, ...(parsed.feedback || {}) } : undefined,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        versions: Array.isArray(parsed.versions) ? parsed.versions : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : []
      };
    } catch (error) {
      console.error('Kunne ikke læse lokalt gemt data:', error);
      return defaults();
    }
  }

  let pf1 = load(PF1_STORAGE_KEY, pf1DefaultState);
  let pf2 = load(PF2_STORAGE_KEY, pf2DefaultState);
  let pf3 = load(PF3_STORAGE_KEY, pf3DefaultState);
  let view = 'home';
  let saveTimer = null;
  let toastTimer = null;
  let pf2Selection = null;
  let pf3Selection = null;

  function persist(key, state, show = true) {
    state.lastSavedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(state));
    if (show) flashSaveStatus();
  }

  function schedulePersist(key, state) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(key, state, true), 350);
  }

  function flashSaveStatus() {
    const node = $('saveStatus');
    if (!node) return;
    node.textContent = 'Gemt lokalt';
    node.classList.add('saved-now');
    setTimeout(() => node.classList.remove('saved-now'), 800);
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function currentConfig() {
    if (view === 'pf1') return { key: PF1_STORAGE_KEY, state: pf1 };
    if (view === 'pf2') return { key: PF2_STORAGE_KEY, state: pf2 };
    if (view === 'pf3') return { key: PF3_STORAGE_KEY, state: pf3 };
    return null;
  }

  function showTopActions(mode) {
    const inWork = mode !== 'home';
    $('homeBtn').classList.toggle('hidden', !inWork);
    $('saveVersionTop').classList.toggle('hidden', !inWork);
    $('exportBtn').classList.toggle('hidden', !inWork);
    const hasFileBackup = mode === 'pf2' || mode === 'pf3';
    $('backupBtn').classList.toggle('hidden', !hasFileBackup);
    $('restoreBackupLabel').classList.toggle('hidden', !hasFileBackup);
  }

  function openView(which) {
    view = which;
    ['homeView','pf1View','pf2View','pf3View'].forEach(id => $(id)?.classList.add('hidden'));
    if (which === 'pf1') { $('pf1View').classList.remove('hidden'); renderPF1(); }
    if (which === 'pf2') { $('pf2View').classList.remove('hidden'); renderPF2(); }
    if (which === 'pf3') { $('pf3View').classList.remove('hidden'); renderPF3(); }
    showTopActions(which);
  }

  function goHome() {
    const cfg = currentConfig();
    if (cfg) persist(cfg.key, cfg.state, false);
    view = 'home';
    ['pf1View','pf2View','pf3View'].forEach(id => $(id)?.classList.add('hidden'));
    $('homeView').classList.remove('hidden');
    showTopActions('home');
  }

  function countChars(text) { return String(text || '').length; }
  function wordCount(text) { return (String(text || '').match(/\b[\p{L}\p{N}’'-]+\b/gu) || []).length; }
  function splitSentences(text) { return String(text).replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean); }
  function countMatches(text, regex) { const m = String(text).match(regex); return m ? m.length : 0; }
  function findMatch(text, regex) { const match = regex.exec(text); regex.lastIndex = 0; return match ? match[0] : null; }
  function excerpt(text, max = 150) { const s = String(text).replace(/\s+/g, ' ').trim(); return s.length <= max ? s : `${s.slice(0, max).trim()}…`; }
  function excerptAround(text, needle, radius = 75) {
    const source = String(text).replace(/\s+/g, ' ');
    const index = source.toLowerCase().indexOf(String(needle).toLowerCase());
    if (index < 0) return excerpt(source);
    const start = Math.max(0, index - radius), end = Math.min(source.length, index + needle.length + radius);
    return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`;
  }
  function escapeAttr(value = '') { return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------------- PF1 ----------------
  function hydratePF1() {
    $('text-problem').value = pf1.sections.problem;
    $('text-method').value = pf1.sections.method;
    $('text-analysis').value = pf1.sections.analysis;
    $('text-references').value = pf1.sections.references;
    $('feedbackRaw').value = pf1.feedback.raw;
    $('feedbackPoints').value = pf1.feedback.points;
    $('feedbackWhere').value = pf1.feedback.where;
    $('feedbackChange').value = pf1.feedback.change;
    $('feedbackWhy').value = pf1.feedback.why;
    $('feedbackStatus').value = pf1.feedback.status;
    $('feedbackFileStatus').textContent = pf1.feedback.fileName ? `Senest indlæst: ${pf1.feedback.fileName}` : '';
    Object.keys(PF1_DEFAULT_BUDGETS).forEach(k => $(`budgetInput-${k}`).value = pf1.budgets[k]);
  }

  function renderPF1() { hydratePF1(); renderPF1Sources(); renderPF1Counts(); renderPF1Versions(); }

  function renderPF1Counts() {
    let total = 0;
    ['problem','method','analysis'].forEach(key => {
      const used = countChars(pf1.sections[key]), budget = Number(pf1.budgets[key] || PF1_DEFAULT_BUDGETS[key]);
      total += used;
      $(`count-${key}`).textContent = used.toLocaleString('da-DK');
      $(`budget-${key}`).textContent = budget.toLocaleString('da-DK');
      const note = $(`budgetNote-${key}`);
      if (used > budget) { note.textContent = `Du bruger ${(used-budget).toLocaleString('da-DK')} tegn mere end den foreløbige fordeling.`; note.classList.add('over'); }
      else { note.textContent = `${(budget-used).toLocaleString('da-DK')} tegn tilbage i den foreløbige ramme.`; note.classList.remove('over'); }
    });
    $('totalCount').textContent = total.toLocaleString('da-DK');
    const rem = PF1_MAX-total;
    $('totalRemaining').textContent = rem >= 0 ? `${rem.toLocaleString('da-DK')} tilbage` : `${Math.abs(rem).toLocaleString('da-DK')} over arbejdsrammen`;
  }

  function makeSource() { return { id: uid(), citation:'', concept:'', documents:'', use:'', page:'', note:'', interpretation:'' }; }
  function makeMiniSource() { return { id: uid(), citation:'', page:'', use:'' }; }
  function sourceInput(label, field, value, prefix='') { return `<div class="source-field"><label>${label}</label><input class="source-input" data-${prefix}source-field="${field}" value="${escapeAttr(value)}"></div>`; }
  function sourceTextarea(label, field, value, prefix='') { return `<div class="source-field"><label>${label}</label><textarea class="source-input" data-${prefix}source-field="${field}">${escapeAttr(value)}</textarea></div>`; }

  function renderPF1Sources() {
    const c = $('sourceList'); c.innerHTML='';
    if (!pf1.sources.length) { c.innerHTML='<div class="empty-state">Ingen kilder registreret endnu.</div>'; return; }
    pf1.sources.forEach((s,i) => {
      const card=document.createElement('div'); card.className='source-card'; card.dataset.id=s.id;
      card.innerHTML=`<div class="source-card-head"><strong>Kilde ${i+1}</strong><button class="remove-source" data-remove-source="${s.id}" type="button">Fjern</button></div>${sourceInput('Kilde / reference','citation',s.citation)}${sourceInput('Centralt begreb','concept',s.concept)}${sourceTextarea('Hvad dokumenterer kilden?','documents',s.documents)}${sourceTextarea('Hvad bruger jeg den til i PF1?','use',s.use)}${sourceInput('Sidehenvisning','page',s.page)}${sourceTextarea('Huskenote','note',s.note)}<div class="source-divider">Hold fortolkningen adskilt</div>${sourceTextarea('Min fortolkning','interpretation',s.interpretation)}`;
      c.appendChild(card);
    });
  }

  function pf1Snapshot(){ return { sections:clone(pf1.sections), sources:clone(pf1.sources), feedback:clone(pf1.feedback), budgets:clone(pf1.budgets) }; }
  function pf1Hash(){ return JSON.stringify({sections:pf1.sections,sources:pf1.sources,feedback:pf1.feedback}); }
  function savePF1Version(label='Manuel version', silent=false){
    const v={id:uid(),timestamp:new Date().toISOString(),label,snapshot:pf1Snapshot()};
    pf1.versions.unshift(v); pf1.versions=pf1.versions.slice(0,VERSION_LIMIT); pf1.lastAutoVersionHash=pf1Hash();
    persist(PF1_STORAGE_KEY,pf1,false); renderPF1Versions(); if(!silent) showToast(`Version gemt: ${label}`);
  }
  function renderPF1Versions(){ renderVersionsInto($('versionList'),pf1.versions,'pf1'); }

  function applyPF1Budgets(){
    const next={problem:Number($('budgetInput-problem').value),method:Number($('budgetInput-method').value),analysis:Number($('budgetInput-analysis').value)};
    const total=Object.values(next).reduce((a,b)=>a+b,0), note=$('budgetSettingsNote');
    if(!Object.values(next).every(v=>Number.isFinite(v)&&v>=100)){note.textContent='Alle tre felter skal have en positiv tegnramme.';return;}
    if(total!==PF1_MAX){note.textContent=`Fordelingen er ${total.toLocaleString('da-DK')} tegn. Den skal samlet være 4.800.`;return;}
    pf1.budgets=next; renderPF1Counts(); persist(PF1_STORAGE_KEY,pf1); note.textContent='Fordelingen er opdateret.';
  }

  function runPF1LanguageCheck(){
    const results=[];
    [['Problemformulering/indledning',pf1.sections.problem],['Metode',pf1.sections.method],['Analyse',pf1.sections.analysis]].forEach(([name,text])=>{
      if(!text.trim()) return;
      splitSentences(text).forEach(sentence=>{ if(wordCount(sentence)>35) results.push({type:'Præcision',message:`${name}: Denne sætning er lang. Tjek om hovedpåstanden stadig er tydelig.`,excerpt:excerpt(sentence)}); });
      const spoken=findMatch(text,/\b(jeg synes|jeg føler|altså|ligesom|helt klart|selvfølgelig|jo|bare)\b/gi); if(spoken) results.push({type:'Akademisk tone',message:`${name}: Tjek om “${spoken}” er bevidst talesprog, eller om relationen kan gøres mere fagligt præcis.`,excerpt:excerptAround(text,spoken)});
      const vague=findMatch(text,/\b(dette|det her|disse ting|sådan noget)\b/gi); if(vague) results.push({type:'Sammenhæng',message:`${name}: Tjek om det er tydeligt, hvad “${vague}” henviser til.`,excerpt:excerptAround(text,vague)});
    });
    const analysis=pf1.sections.analysis||'';
    if(analysis.trim()){
      const narrative=countMatches(analysis,/\b(først|så|derefter|bagefter|herefter|dernæst)\b/gi), analytic=countMatches(analysis,/\b(fordi|derfor|peger på|kan forstås|kan fortolkes|i lyset af|med begrebet|indikerer|synliggør)\b/gi);
      if(narrative>=4&&analytic<2) results.push({type:'Analyse frem for fortælling',message:'Analysen har flere forløbsmarkører end analytiske koblinger. Tjek et sted, hvor du kan gå fra “hvad skete?” til “hvad betyder det set gennem teorien?”.',excerpt:''});
      const claim=findMatch(analysis,/\b(viser|betyder|skyldes|beviser|demonstrerer|derfor)\b/gi); if(claim) results.push({type:'Påstand og belæg',message:`Du bruger “${claim}” i analysen. Tjek om læseren kan se, hvilket empirisk materiale eller hvilken teori påstanden bygger på.`,excerpt:excerptAround(analysis,claim)});
    }
    renderCheckResults($('languageResults'),results,false);
  }

  // ---------------- PF2 ----------------
  function hydratePF2(){
    Object.keys(pf2.sections).forEach(key=>{const el=$(`pf2-text-${key}`); if(el) el.value=pf2.sections[key]||'';});
    Object.keys(PF2_DEFAULT_BUDGETS).forEach(key=>{const el=$(`pf2BudgetInput-${key}`); if(el) el.value=pf2.budgets[key];});
  }
  function renderPF2(){ hydratePF2(); renderPF2Counts(); renderPF2Sources(); renderComments(pf2,'pf2CommentList','pf2'); renderPF2Versions(); }

  function renderPF2Counts(){ renderCounts('pf2',pf2,PF2_DEFAULT_BUDGETS,PF2_MAX,['problem','method','theory','analysis','future']); }

  function applyPF2Budgets(){
    const next={}; Object.keys(PF2_DEFAULT_BUDGETS).forEach(k=>next[k]=Number($(`pf2BudgetInput-${k}`).value));
    const total=Object.values(next).reduce((a,b)=>a+b,0), note=$('pf2BudgetSettingsNote');
    if(!Object.values(next).every(v=>Number.isFinite(v)&&v>=100)){note.textContent='Alle felter skal have en positiv tegnramme.';return;}
    if(total!==PF2_MAX){note.textContent=`Fordelingen er ${total.toLocaleString('da-DK')} tegn. Den skal samlet være 7.200.`;return;}
    pf2.budgets=next; renderPF2Counts(); persist(PF2_STORAGE_KEY,pf2); note.textContent='Fordelingen er opdateret.';
  }

  function renderPF2Sources(){
    const c=$('pf2SourceList'); c.innerHTML='';
    if(!pf2.sources.length){c.innerHTML='<div class="empty-state">Ingen kilder registreret endnu.</div>';return;}
    pf2.sources.forEach((s,i)=>{
      const card=document.createElement('div'); card.className='source-card'; card.dataset.id=s.id;
      card.innerHTML=`<div class="source-card-head"><strong>Kilde ${i+1}</strong><button class="remove-source" data-pf2-remove-source="${s.id}" type="button">Fjern</button></div>${sourceInput('Kilde / reference','citation',s.citation,'pf2-')}${sourceInput('Centralt begreb','concept',s.concept,'pf2-')}${sourceTextarea('Hvad siger/dokumenterer kilden?','documents',s.documents,'pf2-')}${sourceTextarea('Hvorfor er begrebet relevant for PF2?','use',s.use,'pf2-')}${sourceInput('Sidehenvisning','page',s.page,'pf2-')}${sourceTextarea('Huskenote','note',s.note,'pf2-')}<div class="source-divider">Hold fortolkningen adskilt</div>${sourceTextarea('Min fortolkning','interpretation',s.interpretation,'pf2-')}`;
      c.appendChild(card);
    });
  }

  function captureSelection(textarea, kind){
    const start=textarea.selectionStart,end=textarea.selectionEnd;
    const preview=$(kind==='pf2'?'pf2SelectionPreview':'pf3SelectionPreview');
    if(start===end){ if(kind==='pf2')pf2Selection=null; else pf3Selection=null; preview.textContent='Ingen markering endnu.'; return; }
    const quote=textarea.value.slice(start,end).trim();
    if(!quote){ if(kind==='pf2')pf2Selection=null; else pf3Selection=null; preview.textContent='Ingen markering endnu.'; return; }
    const selection={section:textarea.dataset[kind+'Key'],quote,start,end};
    if(kind==='pf2')pf2Selection=selection; else pf3Selection=selection;
    preview.textContent=`“${excerpt(quote,220)}”`;
  }

  function addComment(kind){
    const is2=kind==='pf2', state=is2?pf2:pf3, selection=is2?pf2Selection:pf3Selection;
    const input=$(is2?'pf2CommentInput':'pf3CommentInput');
    const preview=$(is2?'pf2SelectionPreview':'pf3SelectionPreview');
    const comment=input.value.trim();
    if(!selection){showToast(`Markér først et tekststykke i ${kind.toUpperCase()}.`);return;}
    if(!comment){showToast('Skriv kommentaren først.');return;}
    state.comments.unshift({id:uid(),section:selection.section,quote:selection.quote,comment,createdAt:new Date().toISOString()});
    input.value=''; if(is2)pf2Selection=null; else pf3Selection=null; preview.textContent='Ingen markering endnu.';
    renderComments(state,is2?'pf2CommentList':'pf3CommentList',kind);
    persist(is2?PF2_STORAGE_KEY:PF3_STORAGE_KEY,state); showToast('Kommentar gemt sammen med markeringen.');
  }

  function renderComments(state,containerId,kind){
    const c=$(containerId); c.innerHTML='';
    if(!state.comments.length){c.innerHTML='<div class="empty-state">Ingen kommentarer gemt endnu.</div>';return;}
    state.comments.forEach(item=>{
      const card=document.createElement('div'); card.className='comment-card';
      card.innerHTML=`<div class="comment-section">${escapeAttr(sectionLabel(kind,item.section))}</div><blockquote>${escapeAttr(item.quote)}</blockquote><p>${escapeAttr(item.comment)}</p><button type="button" data-${kind}-remove-comment="${item.id}">Fjern kommentar</button>`;
      c.appendChild(card);
    });
  }

  function sectionLabel(kind,key){
    const pf2Labels={problem:'Titel, indledning og problemformulering',method:'Metode og empirisk materiale',theory:'Analysebegreber / teori',analysis:'Analyse',future:'Fremtidigt arbejde',references:'Litteraturliste'};
    const pf3Labels={problem:'Titel, indledning og problemformulering',method:'Metode og empirisk materiale',theory:'Begreber og teori',analysis:'Analyse',conclusion:'Læringspotentiale og afrunding',references:'Litteraturliste'};
    return (kind==='pf2'?pf2Labels:pf3Labels)[key]||key;
  }

  function pf2Snapshot(){return{sections:clone(pf2.sections),sources:clone(pf2.sources),comments:clone(pf2.comments),budgets:clone(pf2.budgets)};}
  function pf2Hash(){return JSON.stringify({sections:pf2.sections,sources:pf2.sources,comments:pf2.comments});}
  function savePF2Version(label='Manuel version',silent=false){
    const v={id:uid(),timestamp:new Date().toISOString(),label,snapshot:pf2Snapshot()}; pf2.versions.unshift(v); pf2.versions=pf2.versions.slice(0,VERSION_LIMIT); pf2.lastAutoVersionHash=pf2Hash();
    persist(PF2_STORAGE_KEY,pf2,false); renderPF2Versions(); if(!silent)showToast(`Version gemt: ${label}`);
  }
  function renderPF2Versions(){renderVersionsInto($('pf2VersionList'),pf2.versions,'pf2');}

  // ---------------- PF3 ----------------
  function hydratePF3(){
    Object.keys(pf3.sections).forEach(key=>{const el=$(`pf3-text-${key}`); if(el) el.value=pf3.sections[key]||'';});
    Object.keys(PF3_DEFAULT_BUDGETS).forEach(key=>{const el=$(`pf3BudgetInput-${key}`); if(el) el.value=pf3.budgets[key];});
  }

  function renderPF3(){ hydratePF3(); renderPF3Counts(); renderPF3Sources(); renderComments(pf3,'pf3CommentList','pf3'); renderPF3Versions(); }
  function renderPF3Counts(){ renderCounts('pf3',pf3,PF3_DEFAULT_BUDGETS,PF3_MAX,['problem','method','theory','analysis','conclusion']); }

  function renderCounts(prefix,state,defaults,max,keys){
    let totalChars=0,totalWords=0;
    keys.forEach(key=>{
      const text=state.sections[key]||'', chars=countChars(text), words=wordCount(text), budget=Number(state.budgets[key]||defaults[key]);
      totalChars+=chars; totalWords+=words;
      $(`${prefix}Count-${key}`).textContent=chars.toLocaleString('da-DK');
      $(`${prefix}CountWords-${key}`).textContent=`${words.toLocaleString('da-DK')} ord`;
      $(`${prefix}Budget-${key}`).textContent=budget.toLocaleString('da-DK');
      const note=$(`${prefix}BudgetNote-${key}`);
      if(chars>budget){note.textContent=`Du bruger ${(chars-budget).toLocaleString('da-DK')} tegn mere end den foreløbige fordeling.`;note.classList.add('over');}
      else{note.textContent=`${(budget-chars).toLocaleString('da-DK')} tegn tilbage i den foreløbige ramme.`;note.classList.remove('over');}
    });
    $(`${prefix}TotalWords`).textContent=`${totalWords.toLocaleString('da-DK')} ord`;
    $(`${prefix}TotalChars`).textContent=`${totalChars.toLocaleString('da-DK')} / ${max.toLocaleString('da-DK')} tegn`;
    const rem=max-totalChars; $(`${prefix}Remaining`).textContent=rem>=0?`${rem.toLocaleString('da-DK')} tilbage`:`${Math.abs(rem).toLocaleString('da-DK')} over arbejdsrammen`;
  }

  function applyPF3Budgets(){
    const next={}; Object.keys(PF3_DEFAULT_BUDGETS).forEach(k=>next[k]=Number($(`pf3BudgetInput-${k}`).value));
    const total=Object.values(next).reduce((a,b)=>a+b,0), note=$('pf3BudgetSettingsNote');
    if(!Object.values(next).every(v=>Number.isFinite(v)&&v>=100)){note.textContent='Alle felter skal have en positiv tegnramme.';return;}
    if(total!==PF3_MAX){note.textContent=`Fordelingen er ${total.toLocaleString('da-DK')} tegn. Den skal samlet være 12.000.`;return;}
    pf3.budgets=next; renderPF3Counts(); persist(PF3_STORAGE_KEY,pf3); note.textContent='Fordelingen er opdateret.';
  }

  function renderPF3Sources(){
    const c=$('pf3SourceList'); c.innerHTML='';
    if(!pf3.sources.length){c.innerHTML='<div class="empty-state">Ingen kildenoter. Tilføj kun en, hvis den hjælper dit skrivearbejde.</div>';return;}
    pf3.sources.forEach((s,i)=>{
      const card=document.createElement('div'); card.className='source-card'; card.dataset.id=s.id;
      card.innerHTML=`<div class="source-card-head"><strong>Kildenote ${i+1}</strong><button class="remove-source" data-pf3-remove-source="${s.id}" type="button">Fjern</button></div>${sourceInput('Kilde','citation',s.citation,'pf3-')}${sourceInput('Side','page',s.page,'pf3-')}${sourceTextarea('Hvad bruger jeg den til?','use',s.use,'pf3-')}`;
      c.appendChild(card);
    });
  }

  function pf3Snapshot(){return{sections:clone(pf3.sections),sources:clone(pf3.sources),comments:clone(pf3.comments),budgets:clone(pf3.budgets)};}
  function pf3Hash(){return JSON.stringify({sections:pf3.sections,sources:pf3.sources,comments:pf3.comments});}
  function savePF3Version(label='Manuel version',silent=false){
    const v={id:uid(),timestamp:new Date().toISOString(),label,snapshot:pf3Snapshot()}; pf3.versions.unshift(v); pf3.versions=pf3.versions.slice(0,VERSION_LIMIT); pf3.lastAutoVersionHash=pf3Hash();
    persist(PF3_STORAGE_KEY,pf3,false); renderPF3Versions(); if(!silent)showToast(`Version gemt: ${label}`);
  }
  function renderPF3Versions(){renderVersionsInto($('pf3VersionList'),pf3.versions,'pf3');}

  function runPF3AcademicCheck(){
    const r=[];
    const p=pf3.sections.problem.trim(), m=pf3.sections.method.trim(), t=pf3.sections.theory.trim(), a=pf3.sections.analysis.trim(), c=pf3.sections.conclusion.trim();

    if(!p) r.push(diagnostic('Problemformulering','Der mangler tekst i titel/indledning/problemformulering.'));
    if(p){
      if(/\b(beviser|viser at|fører til|medfører|skyldes|gør at|forbedrer|forringer)\b/i.test(p)) r.push(diagnostic('Problemformulering','Formuleringen ser ud til allerede at pege mod en bestemt forklaring eller virkning. Se på om spørgsmålet stadig er åbent nok til, at materialet kan overraske dig.',p));
      if(wordCount(p)>290) r.push(diagnostic('Afgrænsning','Indledning/problemformulering fylder meget. Tjek om noget af teksten hører hjemme senere i opgaven.',p));
    }

    if(m){
      if(!/\b(observation|observer|interview|samtale|noter|materiale|empiri|screenshot|skærmbillede|log|handling|situation|dokument)\b/i.test(m)) r.push(diagnostic('Empirisk materiale','Det konkrete materiale eller den konkrete situation er svær at få øje på i metodeafsnittet.',m));
      if(!/\b(fordi|for at undersøge|valgte|relevant|egnet|passer|begrund)\b/i.test(m)) r.push(diagnostic('Metodebegrundelse','Metoden beskrives, men begrundelsen for hvorfor den passer til problemstillingen er ikke tydelig.',m));
      if(!/\b(kan ikke|begræns|afgræns|ikke adgang|fravalg|udelod|usikker)\b/i.test(m)) r.push(diagnostic('Metodisk afgrænsning','Det er ikke tydeligt, hvad materialet ikke giver adgang til at sige noget sikkert om.',m));
    } else r.push(diagnostic('Metode','Der mangler et metode-/empiriafsnit.'));

    if(t){
      const citations=countMatches(t,/\b(\d{4}|et al\.|ifølge|skriver|definerer|beskriver)\b/gi);
      const analyticUse=countMatches(t,/\b(bruger|anvender|hjælper|retter blikket|undersøge|relevant|begreb)\b/gi);
      if(citations>=3&&analyticUse===0) r.push(diagnostic('Begrebsbrug','Teoriafsnittet ligner et referat af kilder. Det er ikke tydeligt, hvad begreberne skal hjælpe dig med at undersøge.',t));
    } else r.push(diagnostic('Begreber','Det er endnu ikke tydeligt, hvilke begreber analysen arbejder med.'));

    if(a){
      const narrative=countMatches(a,/\b(først|så|derefter|bagefter|herefter|dernæst|jeg gjorde|vi gjorde)\b/gi);
      const analytic=countMatches(a,/\b(peger på|kan forstås|kan fortolkes|synliggør|indikerer|gennem begrebet|i lyset af|karakteriseres|viser sig)\b/gi);
      if(narrative>=5&&analytic<3) r.push(diagnostic('Analysegrad','Analyseafsnittet har mange beskrivelser af forløb, men få tydelige analytiske koblinger.',a));
      if(!/\b(observation|interview|citat|eksempel|materiale|empiri|situation|handling|udsagn|skærmbillede|screenshot)\b/i.test(a)) r.push(diagnostic('Empirinærhed','Det konkrete empiriske materiale er svært at få øje på inde i analysen.',a));
      if(!/\b(teknologi|værktøj|system|platform|AI|KI|funktion|grænseflade|computer|app)\b/i.test(a)) r.push(diagnostic('Teknologiens rolle','Teknologiens rolle er vanskelig at få øje på i analyseafsnittet.',a));
      const overclaim=findMatch(a,/\b(beviser|bevis|altid|aldrig|alle|ingen|fører til|medfører|skyldes|viser at)\b/gi); if(overclaim) r.push({type:'Påstand og belæg',message:`Formuleringen “${overclaim}” kan være stærkere end materialet kan bære.`,excerpt:excerptAround(a,overclaim)});
      if(/\b(teknologien|AI|KI|systemet|værktøjet)\b/i.test(a) && /\b(gør|skaber|fører|bestemmer|får)\b/i.test(a)) r.push(diagnostic('Teknologi som forklaring','Et sted i analysen får teknologien muligvis en stærk forklarende rolle. Se på om mennesker, organisering eller situation også er en del af forklaringen.',a));
      const interpretation=countMatches(a,/\b(jeg tolker|jeg forstår|kan fortolkes|peger på|kan ses som|i min analyse)\b/gi);
      const evidence=countMatches(a,/\b(citat|observation|interview|eksempel|materiale|empiri|viser sig|udsagn|handling)\b/gi);
      if(interpretation>=3&&evidence===0) r.push(diagnostic('Fortolkning og belæg','Der er flere fortolkende formuleringer, men det konkrete belæg er svært at få øje på.',a));
    } else r.push(diagnostic('Analyse','Analyseafsnittet er tomt.'));

    if(c){
      if(!/\b(læring|læringspotentiale|mulighed|kan|potentiale|betingelse)\b/i.test(c)) r.push(diagnostic('Læringspotentiale','Læringspotentialet er svært at få øje på i afrundingen.',c));
      const overclaim=findMatch(c,/\b(beviser|altid|aldrig|alle|ingen|fører til|medfører|viser at)\b/gi); if(overclaim) r.push({type:'Konklusion og belæg',message:`Formuleringen “${overclaim}” kan gå længere end en kort caseanalyse kan bære.`,excerpt:excerptAround(c,overclaim)});
    } else r.push(diagnostic('Afrunding','Der mangler tekst i læringspotentiale/afrunding.'));

    [['Problemformulering/indledning',p],['Metode',m],['Begreber/teori',t],['Analyse',a],['Læringspotentiale/afrunding',c]].forEach(([name,text])=>{
      splitSentences(text).forEach(sentence=>{if(wordCount(sentence)>40)r.push(diagnostic('Præcision',`${name}: Denne sætning er lang. Tjek om hovedpåstanden stadig er tydelig.`,sentence));});
      const vague=findMatch(text,/\b(dette|det her|disse ting|sådan noget|noget|forskellige ting)\b/gi); if(vague)r.push({type:'Præcision',message:`${name}: Henvisningen “${vague}” er upræcis.`,excerpt:excerptAround(text,vague)});
    });

    renderCheckResults($('pf3AcademicResults'),r,true);
  }

  // ---------------- Shared versions / diagnosis ----------------
  function renderVersionsInto(container,versions,kind){
    container.innerHTML='';
    if(!versions.length){container.innerHTML='<div class="empty-state">Ingen versioner endnu. Brug “Gem version”, når du vil fastholde et vigtigt stadie.</div>';return;}
    versions.forEach(v=>{const row=document.createElement('div');row.className='version-item';const dt=new Date(v.timestamp);row.innerHTML=`<div class="version-info"><strong>${escapeAttr(v.label)}</strong><span>${dt.toLocaleString('da-DK',{dateStyle:'short',timeStyle:'short'})}</span></div><div class="version-actions"><button type="button" data-restore-${kind}-version="${v.id}">Åbn</button></div>`;container.appendChild(row);});
  }

  function restoreVersion(kind,id){
    const state=kind==='pf1'?pf1:kind==='pf2'?pf2:pf3;
    const v=state.versions.find(x=>x.id===id); if(!v)return;
    if(!window.confirm(`Åbn versionen “${v.label}”? Den aktuelle tekst gemmes først som en version.`))return;
    if(kind==='pf1'){
      savePF1Version('Før gendannelse',true); pf1.sections=clone(v.snapshot.sections||pf1.sections); pf1.sources=clone(v.snapshot.sources||[]); pf1.feedback=clone(v.snapshot.feedback||pf1DefaultState().feedback); pf1.budgets=clone(v.snapshot.budgets||PF1_DEFAULT_BUDGETS); persist(PF1_STORAGE_KEY,pf1,false); renderPF1();
    } else if(kind==='pf2') {
      savePF2Version('Før gendannelse',true); pf2.sections=clone(v.snapshot.sections||pf2.sections); pf2.sources=clone(v.snapshot.sources||[]); pf2.comments=clone(v.snapshot.comments||[]); pf2.budgets=clone(v.snapshot.budgets||PF2_DEFAULT_BUDGETS); persist(PF2_STORAGE_KEY,pf2,false); renderPF2();
    } else {
      savePF3Version('Før gendannelse',true); pf3.sections=clone(v.snapshot.sections||pf3.sections); pf3.sources=clone(v.snapshot.sources||[]); pf3.comments=clone(v.snapshot.comments||[]); pf3.budgets=clone(v.snapshot.budgets||PF3_DEFAULT_BUDGETS); persist(PF3_STORAGE_KEY,pf3,false); renderPF3();
    }
    showToast('Version åbnet.');
  }

  function diagnostic(type,message,text=''){ return {type,message,excerpt:text?excerpt(text):''}; }

  function runPF2AcademicCheck(){
    const r=[];
    const p=pf2.sections.problem.trim(), m=pf2.sections.method.trim(), t=pf2.sections.theory.trim(), a=pf2.sections.analysis.trim(), f=pf2.sections.future.trim();

    if(!p) r.push(diagnostic('Problemformulering','Der mangler tekst i problemformulering/indledning.'));
    if(p){
      const theoryTerms=/\b(Baym|Dalsgaard|Ryberg|Garrison|community|affordance|teori|begreb)\b/i;
      if(theoryTerms.test(p)) r.push(diagnostic('Problemformulering','Problemformuleringen/indledningen ser ud til allerede at trække teori ind. Det kan gøre spørgsmålet teoristyret før undersøgelsen er afgrænset.',p));
      if(/\b(påvirker|ændrer|effekt|fører til|medfører)\b/i.test(p)) r.push(diagnostic('Undersøgelsesdesign','Problemformuleringen indeholder et kausalt eller før/efter-præget ord. Tjek om din empiri faktisk kan bære den type påstand.',p));
      if(wordCount(p)>190) r.push(diagnostic('Afgrænsning','Indledning/problemformulering fylder meget i forhold til en tre-siders opgave. Tjek om noget af teksten hører hjemme senere.',p));
    }

    if(m){
      if(!/\b(valgte|fravalg|afgræns|inkluder|udelod|udvalgte|materiale|empiri)\b/i.test(m)) r.push(diagnostic('Metodisk afgrænsning','Det er ikke tydeligt i metodeafsnittet, hvilke valg og fravalg der afgrænser materialet.',m));
      if(!/\b(fordi|da formålet|for at undersøge|relevant|egnet|passer)\b/i.test(m)) r.push(diagnostic('Metodebegrundelse','Metoden beskrives, men begrundelsen for hvorfor den passer til problemstillingen er ikke tydelig.',m));
      if(!/\b(screenshot|skærmbillede|besked|kommentar|interview|observation|opslag|chat|video|lyd|noter|materiale)\b/i.test(m)) r.push(diagnostic('Empirisk materiale','Det konkrete empiriske materiale er svært at få øje på i metodeafsnittet.',m));
    } else r.push(diagnostic('Metode','Der mangler et metode-/empiriafsnit.'));

    if(t){
      const citations=countMatches(t,/\b(\d{4}|et al\.|ifølge|skriver|definerer|beskriver)\b/gi);
      const relevance=countMatches(t,/\b(relevant|bruges|anvendes|hjælper|retter blikket|undersøge)\b/gi);
      if(citations>=3&&relevance===0) r.push(diagnostic('Begrebsbrug','Teoriafsnittet ligner et referat af kilder, men det er ikke tydeligt, hvorfor begreberne er valgt til netop denne analyse.',t));
    } else r.push(diagnostic('Begreber','Der er endnu ikke gjort synligt, hvilke begreber analysen arbejder med.'));

    if(a){
      const narrative=countMatches(a,/\b(først|så|derefter|bagefter|herefter|dernæst|jeg gjorde|vi gjorde)\b/gi);
      const analytic=countMatches(a,/\b(peger på|kan forstås|kan fortolkes|synliggør|indikerer|gennem begrebet|i lyset af|karakteriseres|viser sig)\b/gi);
      if(narrative>=4&&analytic<3) r.push(diagnostic('Analysegrad','Analyseafsnittet har mange beskrivelser af forløb, men få tydelige analytiske koblinger.',a));
      if(!/\b(besked|kommentar|screenshot|skærmbillede|citat|observation|opslag|interaktion|materiale|empiri|eksempel)\b/i.test(a)) r.push(diagnostic('Empirinærhed','Det er svært at se det konkrete empiriske materiale inde i analysen.',a));
      if(!/\b(medie|platform|funktion|grænseflade|teknologi|kanal|kommunikation)\b/i.test(a)) r.push(diagnostic('Mediets rolle','Mediets rolle i de sociale interaktioner er ikke tydeligt synlig i analysen.',a));
      if(!/\b(fællesskab|community|netværk|relation|forbindelse)\b/i.test(a)) r.push(diagnostic('Fællesskab/netværk','Analysen gør ikke tydeligt brug af et fællesskabs- eller netværksperspektiv.',a));
      const overclaim=findMatch(a,/\b(beviser|bevis|altid|aldrig|alle|ingen|fører til|medfører|skyldes|viser at)\b/gi); if(overclaim) r.push({type:'Påstand og belæg',message:`Formuleringen “${overclaim}” kan være stærkere end materialet kan bære.`,excerpt:excerptAround(a,overclaim)});
      const concepts=pf2.sources.map(s=>(s.concept||'').trim()).filter(Boolean);
      if(concepts.length&&!concepts.some(c=>a.toLowerCase().includes(c.toLowerCase()))) r.push(diagnostic('Teori–empiri-kobling','Ingen af de registrerede centrale begreber kan genfindes ordret i analysen. Koblingen mellem begreb og empiri kan derfor være vanskelig for læseren at se.'));
    } else r.push(diagnostic('Analyse','Analyseafsnittet er tomt.'));

    [['Problemformulering/indledning',p],['Metode',m],['Begreber/teori',t],['Analyse',a],['Fremtidigt arbejde',f]].forEach(([name,text])=>{
      splitSentences(text).forEach(sentence=>{if(wordCount(sentence)>40)r.push(diagnostic('Præcision',`${name}: En meget lang sætning gør det vanskeligt at se hovedpåstanden.`,sentence));});
      const vague=findMatch(text,/\b(dette|det her|disse ting|sådan noget|noget|forskellige ting)\b/gi); if(vague)r.push({type:'Præcision',message:`${name}: Henvisningen “${vague}” er upræcis.`,excerpt:excerptAround(text,vague)});
    });

    if(f&&wordCount(f)>120) r.push(diagnostic('Fremtidigt arbejde','Afsnittet om fremtidigt arbejde fylder relativt meget. Tjek om det er begyndt at blive en ny analyse.',f));
    renderCheckResults($('pf2AcademicResults'),r,true);
  }

  function renderCheckResults(container,results,strong){
    container.classList.remove('empty-state');
    if(!results.length){container.innerHTML=`<div class="language-ok">Tjekket fandt ingen tydelige signaler i de valgte kategorier. Det er ikke det samme som, at teksten er færdig eller fagligt korrekt${strong?' — kun at de indbyggede indikatorer ikke slog ud.':'.'}</div>`;return;}
    container.innerHTML=''; results.slice(0,18).forEach(item=>{const el=document.createElement('div');el.className='language-item';el.innerHTML=`<strong>${escapeAttr(item.type)}</strong><p>${escapeAttr(item.message)}</p>${item.excerpt?`<div class="excerpt">“…${escapeAttr(item.excerpt)}…”</div>`:''}`;container.appendChild(el);});
  }

  // ---------------- Backup / Word ----------------
  function exportBackup(){
    if(view!=='pf2'&&view!=='pf3')return;
    const state=view==='pf2'?pf2:pf3;
    if(view==='pf2') savePF2Version('Før backup',true); else savePF3Version('Før backup',true);
    const payload={format:view==='pf2'?'DT-PF2-backup':'DT-PF3-backup',version:1,exportedAt:new Date().toISOString(),data:state};
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`${view.toUpperCase()}-backup-${new Date().toISOString().slice(0,10)}.json`);
    showToast(`${view.toUpperCase()}-backup gemt som fil.`);
  }

  async function importBackup(file){
    if(!file|| (view!=='pf2'&&view!=='pf3'))return;
    try{
      const parsed=JSON.parse(await file.text());
      const expected=view==='pf2'?'DT-PF2-backup':'DT-PF3-backup';
      if(parsed.format!==expected||!parsed.data) throw new Error(`Filen er ikke en ${view.toUpperCase()}-backup.`);
      if(!window.confirm(`Indlæs denne ${view.toUpperCase()}-backup? Den aktuelle version gemmes først.`))return;
      if(view==='pf2'){
        savePF2Version('Før indlæsning af backup',true); const base=pf2DefaultState(),data=parsed.data;
        pf2={...base,...data,sections:{...base.sections,...(data.sections||{})},budgets:{...base.budgets,...(data.budgets||{})},sources:Array.isArray(data.sources)?data.sources:[],comments:Array.isArray(data.comments)?data.comments:[],versions:Array.isArray(data.versions)?data.versions:[]};
        persist(PF2_STORAGE_KEY,pf2,false); renderPF2();
      }else{
        savePF3Version('Før indlæsning af backup',true); const base=pf3DefaultState(),data=parsed.data;
        pf3={...base,...data,sections:{...base.sections,...(data.sections||{})},budgets:{...base.budgets,...(data.budgets||{})},sources:Array.isArray(data.sources)?data.sources:[],comments:Array.isArray(data.comments)?data.comments:[],versions:Array.isArray(data.versions)?data.versions:[]};
        persist(PF3_STORAGE_KEY,pf3,false); renderPF3();
      }
      showToast(`${view.toUpperCase()}-backup indlæst.`);
    }catch(e){showToast(`Backup kunne ikke indlæses: ${e.message}`);}
    $('restoreBackupFile').value='';
  }

  async function exportWord(){
    if(!window.docx){showToast('Word-biblioteket kunne ikke indlæses.');return;}
    const {Document,Packer,Paragraph,TextRun,HeadingLevel}=window.docx, children=[];
    if(view==='pf1'){
      children.push(new Paragraph({text:'PF1 – Teknologi og teknologibrug',heading:HeadingLevel.TITLE}));
      addWordSection(children,'Problemformulering og kort indledning',pf1.sections.problem,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Metode',pf1.sections.method,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Analyse',pf1.sections.analysis,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Litteraturliste',pf1.sections.references,Paragraph,TextRun,HeadingLevel);
    }else if(view==='pf2'){
      children.push(new Paragraph({text:'PF2 – Fællesskaber og netværk',heading:HeadingLevel.TITLE}));
      addWordSection(children,'Titel, indledning og problemformulering',pf2.sections.problem,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Metode og empirisk materiale',pf2.sections.method,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Analysebegreber / teori',pf2.sections.theory,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Analyse',pf2.sections.analysis,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Fremtidigt arbejde',pf2.sections.future,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Litteraturliste',pf2.sections.references,Paragraph,TextRun,HeadingLevel);
    }else if(view==='pf3'){
      children.push(new Paragraph({text:'PF3 – Teknologi som kognitiv partner',heading:HeadingLevel.TITLE}));
      addWordSection(children,'Titel, indledning og problemformulering',pf3.sections.problem,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Metode og empirisk materiale',pf3.sections.method,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Begreber og teori',pf3.sections.theory,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Analyse',pf3.sections.analysis,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Læringspotentiale og afrunding',pf3.sections.conclusion,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Litteraturliste',pf3.sections.references,Paragraph,TextRun,HeadingLevel);
    }
    const doc=new Document({sections:[{properties:{},children}]}); const blob=await Packer.toBlob(doc);
    const name=view==='pf1'?'PF1-teknologi-og-teknologibrug.docx':view==='pf2'?'PF2-faellesskaber-og-netvaerk.docx':'PF3-teknologi-som-kognitiv-partner.docx';
    downloadBlob(blob,name); showToast('Word-dokument eksporteret.');
  }

  function addWordSection(children,heading,text,Paragraph,TextRun,HeadingLevel){children.push(new Paragraph({text:heading,heading:HeadingLevel.HEADING_1}));const ps=String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);if(!ps.length)ps.push('');ps.forEach(p=>children.push(new Paragraph({children:[new TextRun(p)]})));}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}

  async function importFeedbackFile(file){
    if(!file)return; const status=$('feedbackFileStatus'); status.textContent=`Læser ${file.name} …`;
    try{
      savePF1Version('Før feedback',true); let text='',lower=file.name.toLowerCase();
      if(lower.endsWith('.txt'))text=await file.text();
      else if(lower.endsWith('.docx')){if(!window.mammoth)throw new Error('Word-læseren kunne ikke indlæses.');const ab=await file.arrayBuffer();const result=await window.mammoth.extractRawText({arrayBuffer:ab});text=result.value||'';}
      else if(lower.endsWith('.pdf'))text=await extractPdfText(file); else throw new Error('Filtypen understøttes ikke i piloten.');
      pf1.feedback.raw=text.trim();pf1.feedback.fileName=file.name;$('feedbackRaw').value=pf1.feedback.raw;status.textContent=`Indlæst: ${file.name}`;persist(PF1_STORAGE_KEY,pf1,false);showToast('Feedback indlæst. Versionen før feedback er gemt.');
    }catch(e){status.textContent=`Kunne ikke læse filen: ${e.message}. Du kan stadig indsætte feedbacken som tekst.`;}
  }
  async function extractPdfText(file){const pdfjsLib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';const data=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjsLib.getDocument({data}).promise,pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();pages.push(content.items.map(item=>item.str).join(' '));}return pages.join('\n\n');}

  function maybeAutoVersion(){
    if(view==='pf1'){const hash=pf1Hash();if(hash!==pf1.lastAutoVersionHash&&(pf1.sections.problem||pf1.sections.method||pf1.sections.analysis))savePF1Version('Automatisk version',true);}
    if(view==='pf2'){const hash=pf2Hash();if(hash!==pf2.lastAutoVersionHash&&Object.values(pf2.sections).some(Boolean))savePF2Version('Automatisk version',true);}
    if(view==='pf3'){const hash=pf3Hash();if(hash!==pf3.lastAutoVersionHash&&Object.values(pf3.sections).some(Boolean))savePF3Version('Automatisk version',true);}
  }

  // ---------------- Events ----------------
  function bindEvents(){
    $$('.open-pf').forEach(btn=>btn.addEventListener('click',()=>openView(btn.dataset.open)));
    $('homeBtn').addEventListener('click',goHome);
    $('exportBtn').addEventListener('click',exportWord);
    $('saveVersionTop').addEventListener('click',()=>view==='pf1'?savePF1Version('Manuel version'):view==='pf2'?savePF2Version('Manuel version'):savePF3Version('Manuel version'));
    $('backupBtn').addEventListener('click',exportBackup);
    $('restoreBackupFile').addEventListener('change',e=>importBackup(e.target.files?.[0]));

    $('saveVersion').addEventListener('click',()=>savePF1Version('Manuel version'));
    $('saveAfterFeedback').addEventListener('click',()=>savePF1Version('Efter feedback'));
    $('runLanguageCheck').addEventListener('click',runPF1LanguageCheck);
    $('applyBudgets').addEventListener('click',applyPF1Budgets);
    $('addSource').addEventListener('click',()=>{pf1.sources.push(makeSource());renderPF1Sources();persist(PF1_STORAGE_KEY,pf1);});
    $('feedbackFile').addEventListener('change',e=>importFeedbackFile(e.target.files?.[0]));

    const pf1Map={'text-problem':'problem','text-method':'method','text-analysis':'analysis','text-references':'references'};
    Object.entries(pf1Map).forEach(([id,key])=>$(id).addEventListener('input',e=>{pf1.sections[key]=e.target.value;renderPF1Counts();schedulePersist(PF1_STORAGE_KEY,pf1);}));
    const feedbackMap={feedbackRaw:'raw',feedbackPoints:'points',feedbackWhere:'where',feedbackChange:'change',feedbackWhy:'why'};
    Object.entries(feedbackMap).forEach(([id,key])=>$(id).addEventListener('input',e=>{pf1.feedback[key]=e.target.value;schedulePersist(PF1_STORAGE_KEY,pf1);}));
    $('feedbackStatus').addEventListener('change',e=>{pf1.feedback.status=e.target.value;schedulePersist(PF1_STORAGE_KEY,pf1);});
    $('sourceList').addEventListener('input',e=>{const field=e.target.dataset.sourceField;if(!field)return;const card=e.target.closest('.source-card'),s=pf1.sources.find(x=>x.id===card?.dataset.id);if(s){s[field]=e.target.value;schedulePersist(PF1_STORAGE_KEY,pf1);}});
    $('sourceList').addEventListener('click',e=>{const id=e.target.dataset.removeSource;if(id){pf1.sources=pf1.sources.filter(x=>x.id!==id);renderPF1Sources();persist(PF1_STORAGE_KEY,pf1);}});
    $('versionList').addEventListener('click',e=>{const id=e.target.dataset.restorePf1Version;if(id)restoreVersion('pf1',id);});

    $$('.pf2-writing').forEach(el=>{el.addEventListener('input',e=>{pf2.sections[e.target.dataset.pf2Key]=e.target.value;renderPF2Counts();schedulePersist(PF2_STORAGE_KEY,pf2);});['mouseup','keyup','select'].forEach(eventName=>el.addEventListener(eventName,()=>captureSelection(el,'pf2')));});
    $('pf2ApplyBudgets').addEventListener('click',applyPF2Budgets);
    $('pf2RunAcademicCheck').addEventListener('click',runPF2AcademicCheck);
    $('pf2SaveVersion').addEventListener('click',()=>savePF2Version('Manuel version'));
    $('pf2AddComment').addEventListener('click',()=>addComment('pf2'));
    $('pf2CommentList').addEventListener('click',e=>{const id=e.target.dataset.pf2RemoveComment;if(id){pf2.comments=pf2.comments.filter(x=>x.id!==id);renderComments(pf2,'pf2CommentList','pf2');persist(PF2_STORAGE_KEY,pf2);}});
    $('pf2AddSource').addEventListener('click',()=>{pf2.sources.push(makeSource());renderPF2Sources();persist(PF2_STORAGE_KEY,pf2);});
    $('pf2SourceList').addEventListener('input',e=>{const field=e.target.dataset.pf2SourceField;if(!field)return;const card=e.target.closest('.source-card'),s=pf2.sources.find(x=>x.id===card?.dataset.id);if(s){s[field]=e.target.value;schedulePersist(PF2_STORAGE_KEY,pf2);}});
    $('pf2SourceList').addEventListener('click',e=>{const id=e.target.dataset.pf2RemoveSource;if(id){pf2.sources=pf2.sources.filter(x=>x.id!==id);renderPF2Sources();persist(PF2_STORAGE_KEY,pf2);}});
    $('pf2VersionList').addEventListener('click',e=>{const id=e.target.dataset.restorePf2Version;if(id)restoreVersion('pf2',id);});

    $$('.pf3-writing').forEach(el=>{el.addEventListener('input',e=>{pf3.sections[e.target.dataset.pf3Key]=e.target.value;renderPF3Counts();schedulePersist(PF3_STORAGE_KEY,pf3);});['mouseup','keyup','select'].forEach(eventName=>el.addEventListener(eventName,()=>captureSelection(el,'pf3')));});
    $('pf3ApplyBudgets').addEventListener('click',applyPF3Budgets);
    $('pf3RunAcademicCheck').addEventListener('click',runPF3AcademicCheck);
    $('pf3SaveVersion').addEventListener('click',()=>savePF3Version('Manuel version'));
    $('pf3AddComment').addEventListener('click',()=>addComment('pf3'));
    $('pf3CommentList').addEventListener('click',e=>{const id=e.target.dataset.pf3RemoveComment;if(id){pf3.comments=pf3.comments.filter(x=>x.id!==id);renderComments(pf3,'pf3CommentList','pf3');persist(PF3_STORAGE_KEY,pf3);}});
    $('pf3AddSource').addEventListener('click',()=>{pf3.sources.push(makeMiniSource());renderPF3Sources();persist(PF3_STORAGE_KEY,pf3);});
    $('pf3SourceList').addEventListener('input',e=>{const field=e.target.dataset.pf3SourceField;if(!field)return;const card=e.target.closest('.source-card'),s=pf3.sources.find(x=>x.id===card?.dataset.id);if(s){s[field]=e.target.value;schedulePersist(PF3_STORAGE_KEY,pf3);}});
    $('pf3SourceList').addEventListener('click',e=>{const id=e.target.dataset.pf3RemoveSource;if(id){pf3.sources=pf3.sources.filter(x=>x.id!==id);renderPF3Sources();persist(PF3_STORAGE_KEY,pf3);}});
    $('pf3VersionList').addEventListener('click',e=>{const id=e.target.dataset.restorePf3Version;if(id)restoreVersion('pf3',id);});

    $$('[data-panel]').forEach(button=>button.addEventListener('click',()=>{const panel=$(button.dataset.panel);if(panel)panel.classList.toggle('collapsed');}));
    window.addEventListener('beforeunload',()=>{const cfg=currentConfig();if(cfg)persist(cfg.key,cfg.state,false);});
  }

  bindEvents();
  if(!pf1.sources.length){pf1.sources.push(makeSource());persist(PF1_STORAGE_KEY,pf1,false);}
  if(!pf2.sources.length){pf2.sources.push(makeSource());persist(PF2_STORAGE_KEY,pf2,false);}
  renderPF1(); renderPF2(); renderPF3(); showTopActions('home'); setInterval(maybeAutoVersion,AUTO_VERSION_MS);
})();
