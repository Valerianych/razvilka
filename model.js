const NODE_TYPES = {
  scene: { name: 'Сцена', color: '#b6a2f3', icon: 'scene' },
  choice: { name: 'Выбор', color: '#dfb37b', icon: 'choice' },
  dialogue: { name: 'Диалог', color: '#80caba', icon: 'dialogue' },
  ending: { name: 'Финал', color: '#e49ba8', icon: 'ending' }
};
const LORE_KINDS = {
  person: { name: 'Персонаж', plural: 'Персонажи', icon: 'user' },
  location: { name: 'Локация', plural: 'Локации', icon: 'pin' },
  object: { name: 'Предмет', plural: 'Предметы', icon: 'box' },
  event: { name: 'Событие', plural: 'События', icon: 'spark' }
};
const STORAGE_KEY = 'razvilka.studio.v1';
const uid = () => globalThis.crypto?.randomUUID?.() || 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
const pad = n => String(n).padStart(2, '0');
function countWords(n, forms) {
  const lastTwo = n % 100, last = n % 10;
  const i = lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2;
  return n + ' ' + forms[i];
}
const nodeCount = n => countWords(n, ['узел','узла','узлов']);
const edgeCount = n => countWords(n, ['связь','связи','связей']);
const lineCount = n => countWords(n, ['реплика','реплики','реплик']);
function blankProject(title, genre = '') {
  return { id: uid(), title, genre, artwork: false, chapters: [{ id: uid(), title: 'Начало', start: null }], nodes: [], edges: [], lore: [] };
}
function seedProject() {
  const chapter = 'prologue';
  const base = { chapter, art: '', lore: [], lines: [] };
  return validateProject({
    id: 'quiet-air', title: 'Тихий эфир', genre: 'Мистический триллер', artwork: true,
    chapters: [{ id: chapter, title: 'Первый контакт', start: 'signal' }],
    nodes: [
      { ...base, id:'signal', no:1, type:'scene', title:'Ночной сигнал', x:0, y:112, art:'radio', lore:['mira','receiver'], description:'Мира настраивает старый приёмник в лесной сторожке. Сквозь помехи незнакомый голос произносит её имя.' },
      { ...base, id:'response', no:2, type:'choice', important:true, title:'Откликнуться на зов?', x:296, y:145, description:'Мира держит руку над переключателем. Ещё можно выйти на улицу или просто выключить радио.' },
      { ...base, id:'voice', no:3, type:'dialogue', title:'Голос в эфире', x:638, y:0, lore:['mira','receiver'], description:'Собеседник знает слишком много.', lines:[{id:'first-line',speaker:'Голос',text:'Мира, ты всё ещё видишь свет на вышке?'},{id:'second-line',speaker:'Мира',text:'Кто вы? Откуда вы знаете моё имя?'}] },
      { ...base, id:'tower', no:4, type:'scene', title:'Тропа к вышке', x:638, y:151, description:'Между соснами мерцает огонёк. Мира идёт к старой радиовышке.', lore:['tower-lore','mira'] },
      { ...base, id:'dawn', no:5, type:'ending', title:'До рассвета', x:638, y:302, description:'Приёмник умолкает. До самого утра в сторожке слышен только ветер.', lore:['receiver'] }
    ],
    edges:[{id:'e-signal',from:'signal',to:'response',label:''},{id:'e-voice',from:'response',to:'voice',label:'Ответить'},{id:'e-tower',from:'response',to:'tower',label:'Пойти к вышке'},{id:'e-dawn',from:'response',to:'dawn',label:'Выключить'}],
    lore:[
      {id:'mira',kind:'person',title:'Мира',description:'Звукорежиссёр. Приехала разобрать вещи деда и узнала в ночном эфире интонации давно забытого голоса.'},
      {id:'receiver',kind:'object',title:'Приёмник',description:'Старый коротковолновый приёмник в деревянном корпусе. На шкале частот карандашом отмечено одно деление.'},
      {id:'tower-lore',kind:'location',title:'Радиовышка',description:'Ретранслятор за лесной просекой. Электричество отключили много лет назад, но по ночам на вершине вспыхивает свет.'}
    ]
  });
}
function validateProject(input) {
  if (!input || typeof input.title !== 'string' || !Array.isArray(input.chapters) || !input.chapters.length
      || !Array.isArray(input.nodes) || !Array.isArray(input.edges) || !Array.isArray(input.lore)) throw new Error('Нужен файл проекта Развилки.');
  const unique = list => {
    if (list.some(item => !item || typeof item.id !== 'string' || !item.id) || new Set(list.map(item => item.id)).size !== list.length) throw new Error('В файле повреждены идентификаторы записей.');
  };
  [input.chapters, input.nodes, input.edges, input.lore].forEach(unique);
  const string = value => typeof value === 'string' ? value : '';
  const safe = {
    id: string(input.id) || uid(), title: input.title.trim() || 'Без названия', genre: string(input.genre), artwork: input.artwork === true,
    chapters: input.chapters.map(c => ({ id:c.id, title:string(c.title) || 'Глава', start:string(c.start) || null })),
    lore: input.lore.map(l => ({ id:l.id, kind:Object.hasOwn(LORE_KINDS,l.kind) ? l.kind : 'event', title:string(l.title) || 'Запись', description:string(l.description) }))
  };
  const chapterIds = new Set(safe.chapters.map(c => c.id)), loreIds = new Set(safe.lore.map(l => l.id));
  safe.nodes = input.nodes.map((n,i) => {
    if (!chapterIds.has(n.chapter) || !Object.hasOwn(NODE_TYPES,n.type) || !Number.isFinite(n.x) || !Number.isFinite(n.y)) throw new Error('В файле есть повреждённый узел.');
    const lines = Array.isArray(n.lines) ? n.lines : [];
    unique(lines);
    return { id:n.id, no:Number.isSafeInteger(n.no) && n.no > 0 ? n.no : i+1, chapter:n.chapter, type:n.type,
      title:string(n.title) || 'Без названия', description:string(n.description), x:n.x, y:n.y, art:n.art === 'radio' ? 'radio' : '',
      important:n.important === true,
      mobile:Number.isFinite(n.mobile?.x) && Number.isFinite(n.mobile?.y) ? {x:n.mobile.x,y:n.mobile.y} : null,
      lore:Array.isArray(n.lore) ? [...new Set(n.lore.filter(id => loreIds.has(id)))] : [],
      lines:lines.map(l => ({ id:l.id, speaker:string(l.speaker), text:string(l.text) })) };
  });
  const nodeIds = new Set(safe.nodes.map(n => n.id));
  safe.edges = input.edges.map(e => {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) throw new Error('В файле есть связь с отсутствующим узлом.');
    return { id:e.id, from:e.from, to:e.to, label:string(e.label) };
  });
  safe.chapters.forEach(c => { if (!safe.nodes.some(n => n.id === c.start && n.chapter === c.id)) c.start = safe.nodes.find(n => n.chapter === c.id)?.id || null; });
  return safe;
}
function readStudio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const projects = data.projects.map(validateProject);
      if (projects.length) return { version:1, projects, active:projects.some(p => p.id === data.active) ? data.active : projects[0].id };
    }
  } catch { /* A locally disabled storage area still permits in-memory editing and export. */ }
  return { version:1, projects:[seedProject()], active:'quiet-air' };
}
let studio = readStudio();
const project = () => studio.projects.find(p => p.id === studio.active);
const nodeById = id => project().nodes.find(n => n.id === id);
const chapterById = id => project().chapters.find(c => c.id === id);
const ui = {
  page:'map', chapter:project().chapters[0].id, selected:project().chapters[0].start,
  inspector:window.innerWidth >= 1000, tool:'pointer', source:null, search:'', kind:'all'
};
const camera = { x:0, y:0, scale:1 };
let past = [], future = [], storageOK = true;
function persist() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(studio)); storageOK = true; }
  catch { storageOK = false; }
  const flag = document.getElementById('save-state');
  if (flag) {
    flag.innerHTML = (storageOK ? icon('check-circle',15) : icon('alert',15)) + '<span>' + (storageOK ? 'Сохранено' : 'Только в памяти') + '</span>';
    flag.classList.toggle('failed',!storageOK);
    flag.title = storageOK ? 'Изменения сохранены в этом браузере' : 'Хранилище недоступно. Скачайте проект в меню «Файл».';
  }
}
function remember(snapshot = JSON.stringify(project())) {
  past.push(snapshot);
  if (past.length > 60) past.shift();
  future = [];
  refreshHistoryButtons();
}
function changeProject(edit) {
  remember();
  edit(project());
  persist();
}
function refreshHistoryButtons() {
  document.querySelectorAll('[data-action="undo"]').forEach(b => { b.disabled = !past.length; });
  document.querySelectorAll('[data-action="redo"]').forEach(b => { b.disabled = !future.length; });
}
const chapterNodes = () => project().nodes.filter(n => n.chapter === ui.chapter);
const chapterEdges = () => {
  const ids = new Set(chapterNodes().map(n => n.id));
  return project().edges.filter(e => ids.has(e.from) && ids.has(e.to));
};
