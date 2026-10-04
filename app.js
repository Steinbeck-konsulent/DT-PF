(() => {
  'use strict';

  const PF1_STORAGE_KEY = 'dtEssayHelper.pf1.v1';
  const PF2_STORAGE_KEY = 'dtEssayHelper.pf2.v1';
  const PF1_MAX = 4800;
  const PF2_MAX = 7200;
  const PF1_DEFAULT_BUDGETS = { problem: 720, method: 960, analysis: 3120 };
  const PF2_DEFAULT_BUDGETS = { problem: 900, method: 1300, theory: 800, analysis: 3500, future: 700 };
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
  let view = 'home';
  let saveTimer = null;
  let toastTimer = null;
  let pf2Selection = null;

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
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function showTopActions(mode) {
    const inWork = mode !== 'home';
    $('homeBtn').classList.toggle('hidden', !inWork);
    $('saveVersionTop').classList.toggle('hidden', !inWork);
    $('exportBtn').classList.toggle('hidden', !inWork);
    const isPF2 = mode === 'pf2';
    $('backupBtn').classList.toggle('hidden', !isPF2);
    $('restoreBackupLabel').classList.toggle('hidden', !isPF2);
  }

  function openView(which) {
    view = which;
    $('homeView').classList.add('hidden');
    $('pf1View').classList.add('hidden');
    $('pf2View').classList.add('hidden');
    if (which === 'pf1') {
      $('pf1View').classList.remove('hidden');
      renderPF1();
    } else if (which === 'pf2') {
      $('pf2View').classList.remove('hidden');
      renderPF2();
    }
    showTopActions(which);
  }

  function goHome() {
    if (view === 'pf1') persist(PF1_STORAGE_KEY, pf1, false);
    if (view === 'pf2') persist(PF2_STORAGE_KEY, pf2, false);
    view = 'home';
    $('pf1View').classList.add('hidden');
    $('pf2View').classList.add('hidden');
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

  // ---------------- PF1: original pilot behaviour ----------------
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
      if (used > budget) { note.textContent = `Du bruger ${used-budget} tegn mere end den foreløbige fordeling. Det reducerer pladsen til de øvrige afsnit.`; note.classList.add('over'); }
      else { note.textContent = `${(budget-used).toLocaleString('da-DK')} tegn tilbage i den foreløbige ramme.`; note.classList.remove('over'); }
    });
    $('totalCount').textContent = total.toLocaleString('da-DK');
    const rem = PF1_MAX-total;
    $('totalRemaining').textContent = rem >= 0 ? `${rem.toLocaleString('da-DK')} tilbage` : `${Math.abs(rem).toLocaleString('da-DK')} over arbejdsrammen`;
  }

  function makeSource() { return { id: uid(), citation:'', concept:'', documents:'', use:'', page:'', note:'', interpretation:'' }; }
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

  // ---------------- PF2: adjusted version ----------------
  function hydratePF2(){
    Object.keys(pf2.sections).forEach(key=>{const el=$(`pf2-text-${key}`); if(el) el.value=pf2.sections[key]||'';});
    Object.keys(PF2_DEFAULT_BUDGETS).forEach(key=>{const el=$(`pf2BudgetInput-${key}`); if(el) el.value=pf2.budgets[key];});
  }
  function renderPF2(){ hydratePF2(); renderPF2Counts(); renderPF2Sources(); renderPF2Comments(); renderPF2Versions(); }

  function renderPF2Counts(){
    let totalChars=0,totalWords=0;
    ['problem','method','theory','analysis','future'].forEach(key=>{
      const text=pf2.sections[key]||'', chars=countChars(text), words=wordCount(text), budget=Number(pf2.budgets[key]||PF2_DEFAULT_BUDGETS[key]);
      totalChars+=chars; totalWords+=words;
      $(`pf2Count-${key}`).textContent=chars.toLocaleString('da-DK');
      $(`pf2CountWords-${key}`).textContent=`${words.toLocaleString('da-DK')} ord`;
      $(`pf2Budget-${key}`).textContent=budget.toLocaleString('da-DK');
      const note=$(`pf2BudgetNote-${key}`);
      if(chars>budget){note.textContent=`Du bruger ${(chars-budget).toLocaleString('da-DK')} tegn mere end den foreløbige fordeling. Det reducerer pladsen til de øvrige afsnit.`;note.classList.add('over');}
      else{note.textContent=`${(budget-chars).toLocaleString('da-DK')} tegn tilbage i den foreløbige ramme.`;note.classList.remove('over');}
    });
    $('pf2TotalWords').textContent=`${totalWords.toLocaleString('da-DK')} ord`;
    $('pf2TotalChars').textContent=`${totalChars.toLocaleString('da-DK')} / 7.200 tegn`;
    const rem=PF2_MAX-totalChars; $('pf2Remaining').textContent=rem>=0?`${rem.toLocaleString('da-DK')} tilbage`:`${Math.abs(rem).toLocaleString('da-DK')} over arbejdsrammen`;
  }

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

  function renderPF2Comments(){
    const c=$('pf2CommentList'); c.innerHTML='';
    if(!pf2.comments.length){c.innerHTML='<div class="empty-state">Ingen kommentarer gemt endnu.</div>';return;}
    pf2.comments.forEach(item=>{
      const card=document.createElement('div'); card.className='comment-card';
      card.innerHTML=`<div class="comment-section">${escapeAttr(sectionLabel(item.section))}</div><blockquote>${escapeAttr(item.quote)}</blockquote><p>${escapeAttr(item.comment)}</p><button type="button" data-remove-comment="${item.id}">Fjern kommentar</button>`;
      c.appendChild(card);
    });
  }
  function sectionLabel(key){return ({problem:'Titel, indledning og problemformulering',method:'Metode og empirisk materiale',theory:'Analysebegreber / teori',analysis:'Analyse',future:'Fremtidigt arbejde',references:'Litteraturliste'})[key]||key;}

  function capturePF2Selection(textarea){
    const start=textarea.selectionStart,end=textarea.selectionEnd;
    if(start===end){pf2Selection=null;$('pf2SelectionPreview').textContent='Ingen markering endnu.';return;}
    const quote=textarea.value.slice(start,end).trim();
    if(!quote){pf2Selection=null;$('pf2SelectionPreview').textContent='Ingen markering endnu.';return;}
    pf2Selection={section:textarea.dataset.pf2Key,quote,start,end};
    $('pf2SelectionPreview').textContent=`“${excerpt(quote,220)}”`;
  }

  function addPF2Comment(){
    const comment=$('pf2CommentInput').value.trim();
    if(!pf2Selection){showToast('Markér først et tekststykke i PF2.');return;}
    if(!comment){showToast('Skriv kommentaren først.');return;}
    pf2.comments.unshift({id:uid(),section:pf2Selection.section,quote:pf2Selection.quote,comment,createdAt:new Date().toISOString()});
    $('pf2CommentInput').value=''; pf2Selection=null; $('pf2SelectionPreview').textContent='Ingen markering endnu.';
    renderPF2Comments(); persist(PF2_STORAGE_KEY,pf2); showToast('Kommentar gemt sammen med markeringen.');
  }

  function pf2Snapshot(){return{sections:clone(pf2.sections),sources:clone(pf2.sources),comments:clone(pf2.comments),budgets:clone(pf2.budgets)};}
  function pf2Hash(){return JSON.stringify({sections:pf2.sections,sources:pf2.sources,comments:pf2.comments});}
  function savePF2Version(label='Manuel version',silent=false){
    const v={id:uid(),timestamp:new Date().toISOString(),label,snapshot:pf2Snapshot()}; pf2.versions.unshift(v); pf2.versions=pf2.versions.slice(0,VERSION_LIMIT); pf2.lastAutoVersionHash=pf2Hash();
    persist(PF2_STORAGE_KEY,pf2,false); renderPF2Versions(); if(!silent)showToast(`Version gemt: ${label}`);
  }
  function renderPF2Versions(){renderVersionsInto($('pf2VersionList'),pf2.versions,'pf2');}

  function renderVersionsInto(container,versions,kind){
    container.innerHTML='';
    if(!versions.length){container.innerHTML='<div class="empty-state">Ingen versioner endnu. Brug “Gem version”, når du vil fastholde et vigtigt stadie.</div>';return;}
    versions.forEach(v=>{const row=document.createElement('div');row.className='version-item';const dt=new Date(v.timestamp);row.innerHTML=`<div class="version-info"><strong>${escapeAttr(v.label)}</strong><span>${dt.toLocaleString('da-DK',{dateStyle:'short',timeStyle:'short'})}</span></div><div class="version-actions"><button type="button" data-restore-${kind}-version="${v.id}">Åbn</button></div>`;container.appendChild(row);});
  }

  function restoreVersion(kind,id){
    const state=kind==='pf1'?pf1:pf2, versions=state.versions, v=versions.find(x=>x.id===id); if(!v)return;
    if(!window.confirm(`Åbn versionen “${v.label}”? Den aktuelle tekst gemmes først som en version.`))return;
    if(kind==='pf1'){
      savePF1Version('Før gendannelse',true); pf1.sections=clone(v.snapshot.sections||pf1.sections); pf1.sources=clone(v.snapshot.sources||[]); pf1.feedback=clone(v.snapshot.feedback||pf1DefaultState().feedback); pf1.budgets=clone(v.snapshot.budgets||PF1_DEFAULT_BUDGETS); persist(PF1_STORAGE_KEY,pf1,false); renderPF1();
    }else{
      savePF2Version('Før gendannelse',true); pf2.sections=clone(v.snapshot.sections||pf2.sections); pf2.sources=clone(v.snapshot.sources||[]); pf2.comments=clone(v.snapshot.comments||[]); pf2.budgets=clone(v.snapshot.budgets||PF2_DEFAULT_BUDGETS); persist(PF2_STORAGE_KEY,pf2,false); renderPF2();
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

  function exportBackup(){
    savePF2Version('Før backup',true);
    const payload={format:'DT-PF2-backup',version:1,exportedAt:new Date().toISOString(),data:pf2};
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`DT-PF2-backup-${new Date().toISOString().slice(0,10)}.json`);
    showToast('PF2-backup gemt som fil.');
  }

  async function importBackup(file){
    if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(parsed.format!=='DT-PF2-backup'||!parsed.data) throw new Error('Filen er ikke en PF2-backup.');
      if(!window.confirm('Indlæs denne PF2-backup? Den aktuelle PF2-version gemmes først.'))return;
      savePF2Version('Før indlæsning af backup',true);
      const base=pf2DefaultState(), data=parsed.data;
      pf2={...base,...data,sections:{...base.sections,...(data.sections||{})},budgets:{...base.budgets,...(data.budgets||{})},sources:Array.isArray(data.sources)?data.sources:[],comments:Array.isArray(data.comments)?data.comments:[],versions:Array.isArray(data.versions)?data.versions:[]};
      persist(PF2_STORAGE_KEY,pf2,false); renderPF2(); showToast('PF2-backup indlæst.');
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
    }else{
      children.push(new Paragraph({text:'PF2 – Fællesskaber og netværk',heading:HeadingLevel.TITLE}));
      addWordSection(children,'Titel, indledning og problemformulering',pf2.sections.problem,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Metode og empirisk materiale',pf2.sections.method,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Analysebegreber / teori',pf2.sections.theory,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Analyse',pf2.sections.analysis,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Fremtidigt arbejde',pf2.sections.future,Paragraph,TextRun,HeadingLevel);
      addWordSection(children,'Litteraturliste',pf2.sections.references,Paragraph,TextRun,HeadingLevel);
    }
    const doc=new Document({sections:[{properties:{},children}]}); const blob=await Packer.toBlob(doc);
    downloadBlob(blob,view==='pf1'?'PF1-teknologi-og-teknologibrug.docx':'PF2-faellesskaber-og-netvaerk.docx'); showToast('Word-dokument eksporteret.');
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
  }

  function bindEvents(){
    $$('.open-pf').forEach(btn=>btn.addEventListener('click',()=>openView(btn.dataset.open)));
    $('homeBtn').addEventListener('click',goHome);
    $('exportBtn').addEventListener('click',exportWord);
    $('saveVersionTop').addEventListener('click',()=>view==='pf1'?savePF1Version('Manuel version'):savePF2Version('Manuel version'));
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

    $$('.pf2-writing').forEach(el=>{
      el.addEventListener('input',e=>{pf2.sections[e.target.dataset.pf2Key]=e.target.value;renderPF2Counts();schedulePersist(PF2_STORAGE_KEY,pf2);});
      ['mouseup','keyup','select'].forEach(eventName=>el.addEventListener(eventName,()=>capturePF2Selection(el)));
    });
    $('pf2ApplyBudgets').addEventListener('click',applyPF2Budgets);
    $('pf2RunAcademicCheck').addEventListener('click',runPF2AcademicCheck);
    $('pf2SaveVersion').addEventListener('click',()=>savePF2Version('Manuel version'));
    $('pf2AddComment').addEventListener('click',addPF2Comment);
    $('pf2CommentList').addEventListener('click',e=>{const id=e.target.dataset.removeComment;if(id){pf2.comments=pf2.comments.filter(x=>x.id!==id);renderPF2Comments();persist(PF2_STORAGE_KEY,pf2);}});
    $('pf2AddSource').addEventListener('click',()=>{pf2.sources.push(makeSource());renderPF2Sources();persist(PF2_STORAGE_KEY,pf2);});
    $('pf2SourceList').addEventListener('input',e=>{const field=e.target.dataset.pf2SourceField;if(!field)return;const card=e.target.closest('.source-card'),s=pf2.sources.find(x=>x.id===card?.dataset.id);if(s){s[field]=e.target.value;schedulePersist(PF2_STORAGE_KEY,pf2);}});
    $('pf2SourceList').addEventListener('click',e=>{const id=e.target.dataset.pf2RemoveSource;if(id){pf2.sources=pf2.sources.filter(x=>x.id!==id);renderPF2Sources();persist(PF2_STORAGE_KEY,pf2);}});
    $('pf2VersionList').addEventListener('click',e=>{const id=e.target.dataset.restorePf2Version;if(id)restoreVersion('pf2',id);});

    $$('[data-panel]').forEach(button=>button.addEventListener('click',()=>{const panel=$(button.dataset.panel);if(panel)panel.classList.toggle('collapsed');}));
    window.addEventListener('beforeunload',()=>{if(view==='pf1')persist(PF1_STORAGE_KEY,pf1,false);if(view==='pf2')persist(PF2_STORAGE_KEY,pf2,false);});
  }

  bindEvents();
  if(!pf1.sources.length){pf1.sources.push(makeSource());persist(PF1_STORAGE_KEY,pf1,false);}
  if(!pf2.sources.length){pf2.sources.push(makeSource());persist(PF2_STORAGE_KEY,pf2,false);}
  renderPF1(); renderPF2(); showTopActions('home'); setInterval(maybeAutoVersion,AUTO_VERSION_MS);
})();
