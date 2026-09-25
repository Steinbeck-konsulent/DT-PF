(() => {
  'use strict';

  const STORAGE_KEY = 'dtEssayHelper.pf1.v1';
  const MAX_CHARS = 4800;
  const DEFAULT_BUDGETS = { problem: 720, method: 960, analysis: 3120 };
  const VERSION_LIMIT = 40;
  const AUTO_VERSION_MS = 10 * 60 * 1000;

  const defaultState = () => ({
    sections: { problem: '', method: '', analysis: '', references: '' },
    budgets: { ...DEFAULT_BUDGETS },
    sources: [],
    feedback: {
      raw: '', points: '', where: '', change: '', why: '', status: 'ikke-set', fileName: ''
    },
    versions: [],
    activity: [],
    lastSavedAt: null,
    lastAutoVersionHash: ''
  });

  let state = loadState();
  let saveTimer = null;
  let toastTimer = null;
  let view = 'home';

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        sections: { ...defaultState().sections, ...(parsed.sections || {}) },
        budgets: { ...DEFAULT_BUDGETS, ...(parsed.budgets || {}) },
        feedback: { ...defaultState().feedback, ...(parsed.feedback || {}) },
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        versions: Array.isArray(parsed.versions) ? parsed.versions : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : []
      };
    } catch (error) {
      console.error('Kunne ikke læse lokalt gemt data:', error);
      return defaultState();
    }
  }

  function persistState(showIndicator = true) {
    state.lastSavedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (showIndicator) flashSaveStatus();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistState(true), 350);
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
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function openPF1() {
    view = 'pf1';
    $('homeView').classList.add('hidden');
    $('pf1View').classList.remove('hidden');
    $('homeBtn').classList.remove('hidden');
    $('saveVersionTop').classList.remove('hidden');
    $('exportBtn').classList.remove('hidden');
    renderAll();
  }

  function goHome() {
    persistState(false);
    view = 'home';
    $('pf1View').classList.add('hidden');
    $('homeView').classList.remove('hidden');
    $('homeBtn').classList.add('hidden');
    $('saveVersionTop').classList.add('hidden');
    $('exportBtn').classList.add('hidden');
  }

  function hydrateFields() {
    $('text-problem').value = state.sections.problem;
    $('text-method').value = state.sections.method;
    $('text-analysis').value = state.sections.analysis;
    $('text-references').value = state.sections.references;

    $('feedbackRaw').value = state.feedback.raw;
    $('feedbackPoints').value = state.feedback.points;
    $('feedbackWhere').value = state.feedback.where;
    $('feedbackChange').value = state.feedback.change;
    $('feedbackWhy').value = state.feedback.why;
    $('feedbackStatus').value = state.feedback.status;
    $('feedbackFileStatus').textContent = state.feedback.fileName ? `Senest indlæst: ${state.feedback.fileName}` : '';
    $('budgetInput-problem').value = state.budgets.problem;
    $('budgetInput-method').value = state.budgets.method;
    $('budgetInput-analysis').value = state.budgets.analysis;
  }

  function renderAll() {
    hydrateFields();
    renderSources();
    renderCounts();
    renderVersions();
  }

  function countChars(text) {
    return (text || '').length;
  }

  function renderCounts() {
    const keys = ['problem', 'method', 'analysis'];
    let total = 0;
    keys.forEach((key) => {
      const used = countChars(state.sections[key]);
      const budget = Number(state.budgets[key] || DEFAULT_BUDGETS[key]);
      total += used;
      $(`count-${key}`).textContent = used.toLocaleString('da-DK');
      $(`budget-${key}`).textContent = budget.toLocaleString('da-DK');
      const note = $(`budgetNote-${key}`);
      if (used > budget) {
        note.textContent = `Du bruger ${used - budget} tegn mere end den foreløbige fordeling. Det reducerer pladsen til de øvrige afsnit.`;
        note.classList.add('over');
      } else {
        const remaining = budget - used;
        note.textContent = `${remaining.toLocaleString('da-DK')} tegn tilbage i den foreløbige ramme.`;
        note.classList.remove('over');
      }
    });
    $('totalCount').textContent = total.toLocaleString('da-DK');
    const remaining = MAX_CHARS - total;
    $('totalRemaining').textContent = remaining >= 0
      ? `${remaining.toLocaleString('da-DK')} tilbage`
      : `${Math.abs(remaining).toLocaleString('da-DK')} over arbejdsrammen`;
    $('totalRemaining').style.color = remaining < 0 ? '#8A5B16' : '';
  }

  function makeSource() {
    return {
      id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      citation: '', concept: '', documents: '', use: '', page: '', note: '', interpretation: ''
    };
  }

  function renderSources() {
    const container = $('sourceList');
    container.innerHTML = '';
    if (!state.sources.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Ingen kilder registreret endnu.';
      container.appendChild(empty);
      return;
    }

    state.sources.forEach((source, index) => {
      const card = document.createElement('div');
      card.className = 'source-card';
      card.dataset.id = source.id;
      card.innerHTML = `
        <div class="source-card-head">
          <strong>Kilde ${index + 1}</strong>
          <button class="remove-source" type="button" data-remove-source="${source.id}">Fjern</button>
        </div>
        ${sourceInput('Kilde / reference', 'citation', source.citation)}
        ${sourceInput('Centralt begreb', 'concept', source.concept)}
        ${sourceTextarea('Hvad dokumenterer kilden?', 'documents', source.documents)}
        ${sourceTextarea('Hvad bruger jeg den til i PF1?', 'use', source.use)}
        ${sourceInput('Sidehenvisning', 'page', source.page)}
        ${sourceTextarea('Huskenote', 'note', source.note)}
        <div class="source-divider">Hold fortolkningen adskilt</div>
        ${sourceTextarea('Min fortolkning', 'interpretation', source.interpretation)}
      `;
      container.appendChild(card);
    });
  }

  function escapeAttr(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sourceInput(label, field, value) {
    return `<div class="source-field"><label>${label}</label><input class="source-input" data-source-field="${field}" value="${escapeAttr(value)}"></div>`;
  }

  function sourceTextarea(label, field, value) {
    return `<div class="source-field"><label>${label}</label><textarea class="source-input" data-source-field="${field}">${escapeAttr(value)}</textarea></div>`;
  }

  function addSource() {
    state.sources.push(makeSource());
    renderSources();
    persistState();
  }

  function removeSource(id) {
    state.sources = state.sources.filter((source) => source.id !== id);
    renderSources();
    persistState();
  }

  function updateSourceFromEvent(event) {
    const field = event.target.dataset.sourceField;
    if (!field) return;
    const card = event.target.closest('.source-card');
    if (!card) return;
    const source = state.sources.find((item) => item.id === card.dataset.id);
    if (!source) return;
    source[field] = event.target.value;
    scheduleSave();
  }

  function snapshotPayload() {
    return {
      sections: structuredClone(state.sections),
      sources: structuredClone(state.sources),
      feedback: structuredClone(state.feedback),
      budgets: structuredClone(state.budgets)
    };
  }

  function currentHash() {
    return JSON.stringify({ sections: state.sections, sources: state.sources, feedback: state.feedback });
  }

  function saveVersion(label = 'Manuel version', silent = false) {
    const version = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      label,
      snapshot: snapshotPayload()
    };
    state.versions.unshift(version);
    state.versions = state.versions.slice(0, VERSION_LIMIT);
    state.activity.unshift({ timestamp: version.timestamp, type: 'version', label });
    state.lastAutoVersionHash = currentHash();
    persistState(false);
    renderVersions();
    if (!silent) showToast(`Version gemt: ${label}`);
  }

  function maybeAutoVersion() {
    if (view !== 'pf1') return;
    const hash = currentHash();
    if (hash === state.lastAutoVersionHash) return;
    if (!state.sections.problem && !state.sections.method && !state.sections.analysis) return;
    saveVersion('Automatisk version', true);
  }

  function renderVersions() {
    const container = $('versionList');
    container.innerHTML = '';
    if (!state.versions.length) {
      container.innerHTML = '<div class="empty-state">Ingen versioner endnu. Brug “Gem version”, når du vil fastholde et vigtigt stadie.</div>';
      return;
    }
    state.versions.forEach((version) => {
      const row = document.createElement('div');
      row.className = 'version-item';
      const dt = new Date(version.timestamp);
      row.innerHTML = `
        <div class="version-info">
          <strong>${escapeAttr(version.label)}</strong>
          <span>${dt.toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
        <div class="version-actions">
          <button type="button" data-restore-version="${version.id}">Åbn</button>
        </div>`;
      container.appendChild(row);
    });
  }

  function restoreVersion(id) {
    const version = state.versions.find((item) => item.id === id);
    if (!version) return;
    if (!window.confirm(`Åbn versionen “${version.label}”? Den aktuelle tekst gemmes først som en version.`)) return;
    saveVersion('Før gendannelse', true);
    state.sections = structuredClone(version.snapshot.sections || state.sections);
    state.sources = structuredClone(version.snapshot.sources || []);
    state.feedback = structuredClone(version.snapshot.feedback || defaultState().feedback);
    state.budgets = structuredClone(version.snapshot.budgets || DEFAULT_BUDGETS);
    persistState(false);
    renderAll();
    showToast('Version åbnet.');
  }

  async function exportWord() {
    if (!window.docx) {
      showToast('Word-biblioteket kunne ikke indlæses. Prøv at genindlæse siden.');
      return;
    }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
    const children = [];
    children.push(new Paragraph({
      text: 'PF1 – Teknologi og teknologibrug',
      heading: HeadingLevel.TITLE
    }));
    addWordSection(children, 'Problemformulering og kort indledning', state.sections.problem, Paragraph, TextRun, HeadingLevel);
    addWordSection(children, 'Metode', state.sections.method, Paragraph, TextRun, HeadingLevel);
    addWordSection(children, 'Analyse', state.sections.analysis, Paragraph, TextRun, HeadingLevel);
    addWordSection(children, 'Litteraturliste', state.sections.references, Paragraph, TextRun, HeadingLevel);

    const docxDocument = new Document({ sections: [{ properties: {}, children }] });
    const blob = await Packer.toBlob(docxDocument);
    const url = URL.createObjectURL(blob);
    const link = documentCreate('a', { href: url, download: 'PF1-teknologi-og-teknologibrug.docx' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    state.activity.unshift({ timestamp: new Date().toISOString(), type: 'export', label: 'Word-eksport' });
    persistState(false);
    showToast('Word-dokument eksporteret.');
  }

  function addWordSection(children, heading, text, Paragraph, TextRun, HeadingLevel) {
    children.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_1 }));
    const paragraphs = String(text || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
    if (!paragraphs.length) paragraphs.push('');
    paragraphs.forEach((paragraph) => {
      children.push(new Paragraph({ children: [new TextRun(paragraph)] }));
    });
  }

  function documentCreate(tag, attrs = {}) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function runLanguageCheck() {
    const results = [];
    const sections = [
      ['Problemformulering/indledning', state.sections.problem],
      ['Metode', state.sections.method],
      ['Analyse', state.sections.analysis]
    ];

    sections.forEach(([name, text]) => {
      if (!text.trim()) return;
      const sentences = splitSentences(text);
      sentences.forEach((sentence) => {
        const words = wordCount(sentence);
        if (words > 35) {
          results.push({ type: 'Præcision', message: `${name}: Denne sætning er lang. Tjek om hovedpåstanden stadig er tydelig.`, excerpt: excerpt(sentence) });
        }
      });

      const spoken = findMatch(text, /\b(jeg synes|jeg føler|altså|ligesom|helt klart|selvfølgelig|jo|bare)\b/gi);
      if (spoken) {
        results.push({ type: 'Akademisk tone', message: `${name}: Tjek om “${spoken}” er bevidst talesprog, eller om relationen kan gøres mere fagligt præcis.`, excerpt: excerptAround(text, spoken) });
      }

      const vague = findMatch(text, /\b(dette|det her|disse ting|sådan noget)\b/gi);
      if (vague) {
        results.push({ type: 'Sammenhæng', message: `${name}: Tjek om det er tydeligt, hvad “${vague}” henviser til.`, excerpt: excerptAround(text, vague) });
      }
    });

    const analysis = state.sections.analysis || '';
    if (analysis.trim()) {
      const narrativeCount = countMatches(analysis, /\b(først|så|derefter|bagefter|herefter|dernæst)\b/gi);
      const analyticCount = countMatches(analysis, /\b(fordi|derfor|peger på|kan forstås|kan fortolkes|i lyset af|med begrebet|indikerer|synliggør)\b/gi);
      if (narrativeCount >= 4 && analyticCount < 2) {
        results.push({ type: 'Analyse frem for fortælling', message: 'Analysen har flere forløbsmarkører end analytiske koblinger. Tjek et sted, hvor du kan gå fra “hvad skete?” til “hvad betyder det set gennem teorien?”.', excerpt: '' });
      }

      const claim = findMatch(analysis, /\b(viser|betyder|skyldes|beviser|demonstrerer|derfor)\b/gi);
      if (claim) {
        results.push({ type: 'Påstand og belæg', message: `Du bruger “${claim}” i analysen. Tjek om læseren kan se, hvilket empirisk materiale eller hvilken teori påstanden bygger på.`, excerpt: excerptAround(analysis, claim) });
      }

      const concepts = state.sources.map((s) => (s.concept || '').trim()).filter(Boolean);
      if (concepts.length && !concepts.some((concept) => analysis.toLowerCase().includes(concept.toLowerCase()))) {
        results.push({ type: 'Begrebsbrug', message: 'Ingen af dine registrerede centrale begreber kan genfindes ordret i analysen. Det kan være helt i orden; tjek blot om koblingen mellem teori og empiri er tydelig.', excerpt: '' });
      }
    }

    const container = $('languageResults');
    container.classList.remove('empty-state');
    if (!results.length) {
      container.innerHTML = '<div class="language-ok">Tjekket fandt ingen tydelige sproglige signaler i de valgte kategorier. Det er ikke en vurdering af, at teksten er “færdig” – kun at de enkle indikatorer ikke slog ud.</div>';
      return;
    }

    container.innerHTML = '';
    results.slice(0, 12).forEach((result) => {
      const item = document.createElement('div');
      item.className = 'language-item';
      item.innerHTML = `<strong>${escapeAttr(result.type)}</strong><p>${escapeAttr(result.message)}</p>${result.excerpt ? `<div class="excerpt">“…${escapeAttr(result.excerpt)}…”</div>` : ''}`;
      container.appendChild(item);
    });
  }

  function splitSentences(text) {
    return String(text).replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  }

  function wordCount(text) {
    return (String(text).match(/\b[\p{L}\p{N}’'-]+\b/gu) || []).length;
  }

  function findMatch(text, regex) {
    const match = regex.exec(text);
    regex.lastIndex = 0;
    return match ? match[0] : null;
  }

  function countMatches(text, regex) {
    const matches = String(text).match(regex);
    return matches ? matches.length : 0;
  }

  function excerpt(text, max = 120) {
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max).trim()}…`;
  }

  function excerptAround(text, needle, radius = 70) {
    const source = String(text).replace(/\s+/g, ' ');
    const index = source.toLowerCase().indexOf(String(needle).toLowerCase());
    if (index < 0) return excerpt(source);
    const start = Math.max(0, index - radius);
    const end = Math.min(source.length, index + needle.length + radius);
    return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`;
  }

  async function importFeedbackFile(file) {
    if (!file) return;
    const status = $('feedbackFileStatus');
    status.textContent = `Læser ${file.name} …`;

    try {
      saveVersion('Før feedback', true);
      let text = '';
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.txt')) {
        text = await file.text();
      } else if (lower.endsWith('.docx')) {
        if (!window.mammoth) throw new Error('Word-læseren kunne ikke indlæses.');
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        text = result.value || '';
      } else if (lower.endsWith('.pdf')) {
        text = await extractPdfText(file);
      } else {
        throw new Error('Filtypen understøttes ikke i piloten.');
      }

      state.feedback.raw = text.trim();
      state.feedback.fileName = file.name;
      $('feedbackRaw').value = state.feedback.raw;
      status.textContent = `Indlæst: ${file.name}`;
      state.activity.unshift({ timestamp: new Date().toISOString(), type: 'feedback', label: `Feedback indlæst: ${file.name}` });
      persistState(false);
      showToast('Feedback indlæst. Versionen før feedback er gemt.');
    } catch (error) {
      console.error(error);
      status.textContent = `Kunne ikke læse filen: ${error.message}. Du kan stadig indsætte feedbacken som tekst.`;
    }
  }

  async function extractPdfText(file) {
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages.join('\n\n');
  }


  function applyBudgets() {
    const next = {
      problem: Number($('budgetInput-problem').value),
      method: Number($('budgetInput-method').value),
      analysis: Number($('budgetInput-analysis').value)
    };
    const total = next.problem + next.method + next.analysis;
    const note = $('budgetSettingsNote');
    if (!Object.values(next).every((value) => Number.isFinite(value) && value >= 100)) {
      note.textContent = 'Alle tre felter skal have en positiv tegnramme.';
      return;
    }
    if (total !== MAX_CHARS) {
      note.textContent = `Fordelingen er ${total.toLocaleString('da-DK')} tegn. Den skal samlet være 4.800.`;
      return;
    }
    state.budgets = next;
    renderCounts();
    persistState();
    note.textContent = 'Fordelingen er opdateret.';
  }

  function bindEvents() {
    $$('.open-pf').forEach((button) => button.addEventListener('click', openPF1));
    $('homeBtn').addEventListener('click', goHome);
    $('exportBtn').addEventListener('click', exportWord);
    $('saveVersion').addEventListener('click', () => saveVersion('Manuel version'));
    $('saveVersionTop').addEventListener('click', () => saveVersion('Manuel version'));
    $('saveAfterFeedback').addEventListener('click', () => saveVersion('Efter feedback'));
    $('runLanguageCheck').addEventListener('click', runLanguageCheck);
    $('applyBudgets').addEventListener('click', applyBudgets);
    $('addSource').addEventListener('click', addSource);
    $('feedbackFile').addEventListener('change', (event) => importFeedbackFile(event.target.files?.[0]));

    const sectionMap = {
      'text-problem': 'problem',
      'text-method': 'method',
      'text-analysis': 'analysis',
      'text-references': 'references'
    };
    Object.entries(sectionMap).forEach(([id, key]) => {
      $(id).addEventListener('input', (event) => {
        state.sections[key] = event.target.value;
        renderCounts();
        scheduleSave();
      });
    });

    const feedbackMap = {
      feedbackRaw: 'raw', feedbackPoints: 'points', feedbackWhere: 'where', feedbackChange: 'change', feedbackWhy: 'why'
    };
    Object.entries(feedbackMap).forEach(([id, key]) => {
      $(id).addEventListener('input', (event) => {
        state.feedback[key] = event.target.value;
        scheduleSave();
      });
    });
    $('feedbackStatus').addEventListener('change', (event) => {
      state.feedback.status = event.target.value;
      scheduleSave();
    });

    $('sourceList').addEventListener('input', updateSourceFromEvent);
    $('sourceList').addEventListener('click', (event) => {
      const id = event.target.dataset.removeSource;
      if (id) removeSource(id);
    });

    $('versionList').addEventListener('click', (event) => {
      const id = event.target.dataset.restoreVersion;
      if (id) restoreVersion(id);
    });

    $$('[data-panel]').forEach((button) => {
      button.addEventListener('click', () => {
        const panel = $(button.dataset.panel);
        if (panel) panel.classList.toggle('collapsed');
      });
    });

    window.addEventListener('beforeunload', () => persistState(false));
  }

  bindEvents();
  if (!state.sources.length) {
    state.sources.push(makeSource());
    persistState(false);
  }
  renderAll();
  setInterval(maybeAutoVersion, AUTO_VERSION_MS);
})();
