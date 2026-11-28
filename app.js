const byId = id => document.getElementById(id);
const esc = escapeHtml;
const views = {map:['Карта сюжета','map'], lore:['База лора','book'], dialogues:['Диалоги','bubbles']};
let timer, confirmCallback, playSession=null, modalContext={}, fieldSnapshot=null;
const dialog=byId('dialog'), menu=byId('menu');
function toast(message) {
  clearTimeout(timer); byId('toast').textContent=message; byId('toast').classList.add('visible');
  timer=setTimeout(()=>byId('toast').classList.remove('visible'),2900);
}
function dismissMenu() { menu.hidden=true; menu.innerHTML=''; menu.classList.remove('quick-palette'); }
function showMenu(anchor, markup) {
  if (!menu.hidden && menu.dataset.for===anchor.dataset.action) { dismissMenu(); return; }
  menu.innerHTML=markup; menu.hidden=false; menu.dataset.for=anchor.dataset.action;
  const rect=anchor.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-menu.offsetWidth-8))+'px';
  menu.style.top=(rect.bottom+menu.offsetHeight+8<innerHeight ? rect.bottom+6 : Math.max(8,rect.top-menu.offsetHeight-6))+'px';
  menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
function menuItem(action, glyph, label, data='', extra='') {
  return `<button class="menu-item" data-action="${action}" ${data}>${icon(glyph,16)}<span>${esc(label)}</span>${extra}</button>`;
}
function modal(title, body, cls='') {
  dismissMenu(); dialog.className='modal '+cls;
  dialog.innerHTML=`<div class="modal-shell"><div class="modal-head"><h2 id="dialog-title">${esc(title)}</h2>${iconButton('close','x','Закрыть')}</div>${body}</div>`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('[data-first]')?.focus({preventScroll:true});
}
function closeModal() { if (dialog.open) dialog.close(); modalContext={}; }
function formFooter(label, left='') {
  return `<div class="form-footer">${left}<div class="footer-spacer"></div><button type="button" class="btn subtle" data-action="close">Отмена</button><button class="btn primary" type="submit">${esc(label)}</button></div>`;
}
function confirmChange(title, text, callback, label='Удалить') {
  confirmCallback=callback;
  modal(title,`<div class="modal-body"><p class="question-text">${esc(text)}</p></div><div class="form-footer"><button class="btn subtle" data-action="close">Отмена</button><button class="btn danger" data-action="confirm">${esc(label)}</button></div>`);
}
function renderAll(fit=false) {
  rememberTimelineView();
  cancelConnector(); dismissMenu();
  const p=project();
  if(overview.projectId!==p.id)resetOverview();
  const allChapters=ui.page==='timeline', diagram=allChapters||ui.page==='map';
  const story=allChapters||overview.path?storyIndex(p):null;
  if(overview.path)overview.path=validStoryPath(p,story,overview.path);
  overview.occurrences=loreOccurrences(p);
  if(!overview.occurrences.byLore.has(overview.loreId)){overview.loreId=null;overview.loreScene=null;}
  overview.loreMatches=new Set((overview.occurrences.byLore.get(overview.loreId)||[]).map(n=>n.id));
  overview.memory=overview.path&&!overview.loreId?readingMemory(p,overview.path):null;
  if(diagram)lastDiagram=ui.page;
  if (!chapterById(ui.chapter)) ui.chapter=p.chapters[0].id;
  if (!nodeById(ui.selected) || nodeById(ui.selected).chapter!==ui.chapter) ui.selected=chapterById(ui.chapter).start || chapterNodes()[0]?.id || null;
  const navPage=diagram?'map':ui.page;
  document.title=(allChapters?'Все главы':views[navPage][0])+' · '+p.title+' — Развилка';
  byId('main-nav').innerHTML=Object.entries(views).map(([key,[title,glyph]])=>`<button data-action="page" data-page="${key}" class="nav-item ${key===navPage?'active':''}" ${key===navPage?'aria-current="page"':''}>${icon(glyph,17)}<span>${title}</span></button>`).join('');
  byId('project-title').textContent=p.title;
  byId('start-own').hidden=!(p.id==='quiet-air'&&studio.projects.length===1);
  byId('project-cover').classList.toggle('plain',!p.artwork);
  byId('project-meta').innerHTML=`<span>${icon('book',15)}Визуальная новелла</span>${p.genre?'<i></i><span>'+esc(p.genre)+'</span>':''}`;
  byId('file-menu').innerHTML=icon('folder',16)+'<span>Файл</span>'+icon('chevron-down',13);
  byId('workspace').className='workspace '+(allChapters?'timeline-workspace':diagram?'map-workspace':'collection-workspace');
  const chapter=chapterById(ui.chapter), mainAction={map:['add-node','Добавить узел'],lore:['add-lore','Добавить запись'],dialogues:['add-line','Добавить реплику']}[navPage];
  const chapterNum=p.chapters.findIndex(c=>c.id===chapter.id)+1;
  const scope=diagram?`<div class="map-scope" role="group" aria-label="Вид карты"><button data-action="all-chapters" class="${allChapters?'current':''}" aria-pressed="${allChapters}">${icon('timeline',15)}Все главы</button><button data-action="chapters" class="chapter-switch ${allChapters?'':'current'}" aria-haspopup="true">${icon('layers',15)}<span>${allChapters?'По главам':'Глава '+chapterNum+'<span class="chapter-name"> · '+esc(chapter.title)+'</span>'}</span>${icon('chevron-down',12)}</button></div>`:'';
  const focusLabel=overview.memory?'Снять выделение':overview.path?'К выделенной ветке':'Выделить ветку';
  const compactFocus=overview.memory?'Снять':overview.path?'К ветке':'Ветка';
  const actions=allChapters?`<button class="timeline-lore-toggle" data-action="timeline-lore" aria-pressed="${overview.showLore}" aria-label="Показывать лор глав" title="Показывать лор глав">${icon('book',16)}<span>Лор</span></button><button data-action="trace-toggle" class="btn route-toggle ${overview.memory?'enabled':''}" aria-label="${focusLabel}" title="${focusLabel}" aria-pressed="${!!overview.memory}" ${p.nodes.length?'':'disabled'}>${icon('eye',17)}<span class="route-label">${focusLabel}</span><span class="route-label-compact">${compactFocus}</span></button>`:`<div class="history-actions">${iconButton('undo','undo','Отменить (Ctrl+Z)')}${iconButton('redo','redo','Повторить (Ctrl+Shift+Z)')}</div><span class="tool-divider"></span><button class="btn primary add-button" data-action="${mainAction[0]}">${icon('plus',17)}${mainAction[1]}</button>`;
  byId('workbar').classList.toggle('diagram-bar',diagram);
  byId('workbar').innerHTML=`<div class="view-context"><h2>${views[navPage][0]}</h2>${scope}</div><div class="work-actions">${actions}</div>`;
  if (allChapters) { mapResize?.disconnect(); renderTimeline(story); }
  else if (ui.page==='map') { renderMap(); if (fit) fitGraph(true); }
  else { mapResize?.disconnect(); renderCollection(); }
  renderStatus(); refreshHistoryButtons();
}
function renderStatus() {
  const all=ui.page==='timeline', diagram=all||ui.page==='map';
  const here=new Set((all?project().nodes:chapterNodes()).map(n=>n.id));
  const count=diagram ? nodeCount(here.size)+'<span class="status-dot">·</span>'+edgeCount(all?project().edges.length:project().edges.filter(e=>here.has(e.from)).length)
    : ui.page==='lore' ? countWords(project().lore.length,['запись','записи','записей']) : lineCount(project().nodes.reduce((n,v)=>n+v.lines.length,0));
  const legend=diagram ? Object.entries(NODE_TYPES).map(([key,t])=>`<span class="legend-item"><i class="legend-swatch swatch-${key}" style="--node-color:${t.color}"></i>${t.name}</span>`).join('') : '';
  const pending=diagram?unfinishedScenes(project()).length:0;
  const openEnds=diagram?`<button class="unfinished-button" data-action="unfinished" title="Сцены без исходящих переходов во всех главах">${icon('edit',13)}Без продолжения <b>${pending}</b></button>`:'';
  byId('statusbar').innerHTML=`<div class="status-count">${icon(diagram?'map':views[ui.page][1],14)}${count}</div>${openEnds}<div class="legend">${legend}</div><button class="shortcut-button" data-action="shortcuts">${icon('keyboard',16)}<span>Горячие клавиши</span></button>`;
}
function openUnfinishedScenes() {
  const p=project(), pending=unfinishedScenes(p), groups=new Map();
  for(const n of pending){if(!groups.has(n.chapter))groups.set(n.chapter,[]);groups.get(n.chapter).push(n);}
  const list=p.chapters.filter(c=>groups.has(c.id)).map(c=>`<section><h3>${esc(chapterName(c.id))}</h3>${groups.get(c.id).map(n=>`<button data-action="jump" data-id="${idAttr(n.id)}">${typeTag(n.type)}<strong>${esc(n.title)}</strong>${icon('chevron-right',15)}</button>`).join('')}</section>`).join('');
  const msg=p.nodes.length?'У каждой сцены есть продолжение или отметка «Финал».':'Здесь появятся сцены, которым нужно продолжение.';
  modal('Без продолжения',`<div class="modal-body unfinished-list">${list||'<p>'+msg+'</p>'}</div>`);
}
function loreChip(item) { return `<span class="lore-chip kind-${item.kind}">${icon(LORE_KINDS[item.kind].icon,12)}${esc(item.title)}</span>`; }
function renderInspector() {
  const panel=byId('inspector'), n=nodeById(ui.selected); if (!panel) return;
  const show=ui.inspector && !!n;
  panel.hidden=!show; byId('show-inspector').hidden=show||!n;
  if (!show) return;
  const outgoing=project().edges.filter(e=>e.from===n.id);
  const arrivals=project().edges.filter(e=>e.to===n.id&&nodeById(e.from).chapter!==n.chapter);
  const related=n.lore.map(id=>project().lore.find(l=>l.id===id)).filter(Boolean);
  const links=outgoing.map(e=>{
    const target=nodeById(e.to);
    return `<div class="transition-row"><button class="jump-node" data-action="jump" data-id="${idAttr(target.id)}"><i style="background:${NODE_TYPES[target.type].color}"></i><span>${esc(e.label || target.title)}${target.chapter!==n.chapter?'<small>'+esc(chapterName(target.chapter))+'</small>':''}${e.rules?.length?'<small>'+esc(countWords(e.rules.length,['условие','условия','условий']))+'</small>':''}</span>${icon('chevron-right',12)}</button>${iconButton('edit-edge','edit','Изменить переход',`data-id="${idAttr(e.id)}"`)}</div>`;
  }).join('');
  panel.innerHTML=`<div class="inspector-head"><span>${icon('panel',16)}Детали узла</span>${iconButton('hide-inspector','x','Закрыть детали узла')}</div>
    <div class="inspector-scroll"><div class="inspector-id"><button class="type-edit" data-action="node-type" title="Изменить тип узла">${typeTag(n.type)}${icon('chevron-down',12)}</button><span class="inspector-ident"><span class="inspector-no">УЗЕЛ #${pad(n.no)}</span>${iconButton('toggle-important','spark',n.important?'Снять отметку «Ключевой момент»':'Отметить ключевой момент',`aria-pressed="${!!n.important}"`)}</span></div>
    <label class="field"><span>Название</span><input data-edit="title" data-id="${idAttr(n.id)}" value="${esc(n.title)}" maxlength="240" placeholder="Название узла"></label>
    <button class="inspect-preview" data-action="preview-scene" data-id="${idAttr(n.id)}">${icon('play',14)}Проверить отсюда</button>
    ${n.type!=='ending'?`<button class="writer-from-scene" data-action="${n.type==='choice'?'edit-choice':'new-choice'}" data-id="${idAttr(n.id)}">${icon('branch',15)}${n.type==='choice'?'Редактировать варианты':'Добавить выбор после сцены'}</button>`:''}
    <label class="field"><span>Описание</span><textarea data-edit="description" data-id="${idAttr(n.id)}" rows="4" placeholder="Что происходит в этой точке истории?">${esc(n.description)}</textarea></label>
    <section class="inspector-section"><div class="section-line"><h3>${icon('book',15)}Связанный лор</h3>${iconButton('attach-lore','plus','Привязать запись лора')}</div>
    <div class="chips">${related.length?related.map(l=>`<button class="plain-chip" data-action="edit-lore" data-id="${idAttr(l.id)}">${loreChip(l)}</button>`).join(''):'<button class="text-action" data-action="attach-lore">Привязать запись</button>'}</div></section>
    <section class="inspector-section"><div class="section-line"><h3>${icon('branch',15)}Переходы <small>${outgoing.length}</small></h3>${iconButton('add-edge','plus','Добавить переход')}</div>
      ${links||'<button data-action="add-edge" class="text-action">Добавить переход</button>'}
      ${arrivals.length?'<div class="incoming-chapters"><span>Сюда ведут</span>'+arrivals.map(e=>{const origin=nodeById(e.from);return `<button class="text-action" data-action="jump" data-id="${idAttr(origin.id)}">${icon('arrow-left',13)}${esc(chapterName(origin.chapter)+' · '+origin.title)}</button>`;}).join('')+'</div>':''}</section>
    <section class="inspector-section"><div class="section-line"><h3>${icon('bubbles',15)}Реплики <small>${n.lines.length}</small></h3>${iconButton('node-line','plus','Добавить реплику к узлу')}</div>
    ${n.lines.map(line=>`<button class="inspector-line" data-action="edit-line" data-node-id="${idAttr(n.id)}" data-id="${idAttr(line.id)}"><b>${esc(line.speaker||'Рассказчик')}</b><span>${esc(line.text)}</span></button>`).join('')||'<button class="text-action" data-action="node-line">Добавить реплику</button>'}</section>
    <button class="secondary-link" data-action="trace-to" data-id="${idAttr(n.id)}">${icon('eye',16)}Показать путь к узлу</button>
    <button class="secondary-link" data-action="node-options">${icon('more',16)}Действия с узлом</button></div>`;
}
function renderCollection() {
  const workspace=byId('workspace');
  const isLore=ui.page==='lore';
  workspace.innerHTML=`<section class="collection"><div class="collection-toolbar"><label class="search-box">${icon('search',17)}<input id="search" value="${esc(ui.search)}" placeholder="${isLore?'Найти запись':'Найти реплику или персонажа'}" aria-label="Поиск"></label>${isLore?'<div class="filters">'+[['all','Все'],...Object.entries(LORE_KINDS).map(([k,v])=>[k,v.plural])].map(([key,v])=>`<button data-action="filter" data-kind="${key}" class="filter ${ui.kind===key?'active':''}">${v}</button>`).join('')+'</div>':''}</div><div id="collection-content"></div></section>`;
  drawCollectionContent();
}
function drawCollectionContent() {
  const host=byId('collection-content'); if (!host) return;
  const q=ui.search.trim().toLocaleLowerCase('ru');
  const match=(...s)=>s.join(' ').toLocaleLowerCase('ru').includes(q);
  if (ui.page==='lore') {
    const items=project().lore.filter(l=>(ui.kind==='all'||l.kind===ui.kind)&&match(l.title,l.description));
    host.className='lore-grid'; host.innerHTML=items.map(l=>{
      const used=overview.occurrences.byLore.get(l.id).length;
      return `<button class="lore-card kind-${l.kind}" data-action="edit-lore" data-id="${idAttr(l.id)}"><div class="lore-card-top"><span class="lore-icon">${icon(LORE_KINDS[l.kind].icon,21)}</span><span>${LORE_KINDS[l.kind].name}</span>${icon('edit',14)}</div><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p><div class="card-foot">${icon('link',13)}${nodeCount(used)}</div></button>`;
    }).join('');
    if (!items.length) host.innerHTML=emptyCollection(q||ui.kind!=='all'?'Записи не найдены':'Здесь будет лор истории',q||ui.kind!=='all'?'Измените условия поиска.':'Добавьте персонажа, место, предмет или событие.','book');
  } else {
    const groups=project().nodes.map(n=>({n,lines:n.lines.filter(l=>match(l.text,l.speaker,n.title))})).filter(g=>g.lines.length);
    host.className='dialogue-list';
    host.innerHTML=groups.map(({n,lines})=>`<article class="dialogue-group"><div class="dialogue-group-top"><div>${typeTag(n.type)}<h3>${esc(n.title)}</h3></div><button class="quiet-button" data-action="jump" data-id="${idAttr(n.id)}">${icon('map',14)}На карте</button></div>${lines.map(l=>`<button class="dialogue-line" data-action="edit-line" data-node-id="${idAttr(n.id)}" data-id="${idAttr(l.id)}"><span class="speaker-mark">${esc((l.speaker||'Р')[0].toUpperCase())}</span><span class="line-copy"><b>${esc(l.speaker||'Рассказчик')}</b><span>${esc(l.text)}</span></span>${icon('edit',14)}</button>`).join('')}<button class="text-action" data-action="add-line" data-node-id="${idAttr(n.id)}">${icon('plus',14)}Добавить реплику</button></article>`).join('');
    if (!groups.length) host.innerHTML=emptyCollection(q?'Реплики не найдены':'Диалоги начинаются с реплики',q?'Попробуйте другое имя или слово.':'Добавьте реплику и укажите сцену, в которой она звучит.','bubbles');
  }
}
function emptyCollection(title,subtitle,glyph) { return `<div class="empty-collection"><div class="empty-symbol">${icon(glyph,27)}</div><h3>${title}</h3><p>${subtitle}</p></div>`; }
function goPage(page) { ui.page=page==='map'?lastDiagram:page; ui.search=''; ui.kind='all'; setMapTool('pointer'); renderAll(); }
function placeKey(){return 'razvilka.place.'+project().id+(narrowMap.matches?'.narrow':'.wide');}
function rememberPlace() {
  const pane=mapPane(), w=pane?.clientWidth||lastPaneSize?.w, h=pane?.clientHeight||lastPaneSize?.h;
  const map=w&&h?{x:(w/2-camera.x)/camera.scale,y:(h/2-camera.y)/camera.scale,scale:camera.scale}:null;
  const place={diagram:lastDiagram,chapter:ui.chapter,selected:ui.selected,map,inspector:ui.inspector,
    left:overview.left,top:overview.top,zoom:overview.zoom,lore:overview.showLore,path:overview.path,loreId:overview.loreId,loreScene:overview.loreScene};
  try {sessionStorage.setItem(placeKey(),JSON.stringify(place));} catch { /* The editor also works without tab storage. */ }
}
function resumePlace() {
  let place;
  try {place=JSON.parse(sessionStorage.getItem(placeKey()));} catch { /* An unavailable view starts at the chapter entrance. */ }
  if(!place||!chapterById(place.chapter)){renderAll(true);return;}
  ui.chapter=place.chapter;
  ui.selected=nodeById(place.selected)?.chapter===ui.chapter?place.selected:chapterById(ui.chapter).start;
  ui.page=place.diagram==='timeline'?'timeline':'map';
  if(typeof place.inspector==='boolean')ui.inspector=place.inspector;
  if(overview.projectId!==project().id)resetOverview();
  if(Number.isFinite(place.zoom)&&place.zoom>0)overview.zoom=place.zoom;
  if(Number.isFinite(place.left))overview.left=place.left;
  if(Number.isFinite(place.top))overview.top=place.top;
  if(typeof place.lore==='boolean')overview.showLore=place.lore;
  if(project().lore.some(l=>l.id===place.loreId)){overview.loreId=place.loreId;overview.loreScene=place.loreScene;}
  if(Array.isArray(place.path)&&place.path.every(s=>typeof s?.node==='string'&&(s.via===null||typeof s.via==='string')))overview.path=place.path;
  const m=place.map, restore=ui.page==='map'&&m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&m.scale>=.17&&m.scale<=2.3;
  renderAll(!restore);
  if(restore){const pane=mapPane();camera.scale=m.scale;camera.x=pane.clientWidth/2-m.x*m.scale;camera.y=pane.clientHeight/2-m.y*m.scale;applyCamera();}
}
function activateProject(id) {
  rememberPlace();
  studio.active=id; past=[]; future=[]; ui.page=project().chapters.length>1?'timeline':'map'; ui.chapter=project().chapters[0].id; ui.selected=project().chapters[0].start;
  resetOverview();
  ui.inspector=innerWidth>=1000; ui.tool='pointer'; ui.source=null; ui.search='';ui.kind='all'; persist(); closeModal(); resumePlace();
}
function openExampleRoutes() {
  const fresh=seedProject(),template=JSON.stringify(fresh);
  const example=studio.projects.find(p=>p.artwork&&JSON.stringify({...p,id:fresh.id,title:fresh.title})===template);
  if(example){activateProject(example.id);return;}
  fresh.id=uid();fresh.title='Тихий эфир · пример';studio.projects.push(fresh);activateProject(fresh.id);
}
function showProjects() {
  modal('Мои проекты',`<div class="modal-body project-list">${studio.projects.map(p=>`<button class="project-option" data-action="activate-project" data-id="${idAttr(p.id)}"><span class="project-thumb ${p.artwork?'has-art':''}">${p.artwork?'':icon('book',22)}</span><span><strong>${esc(p.title)}</strong><small>${countWords(p.chapters.length,['глава','главы','глав'])} · ${nodeCount(p.nodes.length)}</small></span>${p.id===studio.active?icon('check',18):icon('chevron-right',15)}</button>`).join('')}<button class="text-action" data-action="example-routes">${icon('branch',15)}Пример с последствиями</button></div><div class="form-footer"><button class="btn subtle" data-action="import">${icon('upload',15)}Из файла</button><button class="btn primary" data-action="new-project">${icon('plus',16)}Новый проект</button></div>`);
}
function openProjectForm(isNew) {
  const p=isNew?{title:'',genre:''}:project();
  modal(isNew?'Новый проект':'Параметры проекта',`<form id="project-form"><div class="modal-body"><label class="field"><span>Название новеллы</span><input data-first name="title" required maxlength="160" placeholder="Название вашей истории" value="${esc(p.title)}"></label><label class="field"><span>Жанр</span><input name="genre" maxlength="100" placeholder="Например, городское фэнтези" value="${esc(p.genre)}"></label></div>${formFooter(isNew?'Создать проект':'Сохранить')}</form>`);
  modalContext={isNew};
}
function nodeOptions(selected='',includeNone=false) {
  return (includeNone?'<option value="">Самостоятельный узел</option>':'')+project().chapters.map((c,i)=>{
    const nodes=project().nodes.filter(n=>n.chapter===c.id);
    return !nodes.length?'':`<optgroup label="Глава ${i+1} · ${esc(c.title)}">${nodes.map(n=>`<option value="${idAttr(n.id)}" ${n.id===selected?'selected':''}>#${pad(n.no)} · ${esc(n.title)}</option>`).join('')}</optgroup>`;
  }).join('');
}
function openNodeForm(source=ui.selected,point=null,initialType='scene') {
  const types=Object.entries(NODE_TYPES).map(([key,t])=>`<label class="type-option" style="--node-color:${t.color}"><input type="radio" name="type" value="${key}" ${key===initialType?'checked':''}><span>${icon(t.icon,19)}${t.name}</span></label>`).join('');
  modal('Новый узел',`<form id="node-form"><div class="modal-body"><fieldset class="type-field"><legend>Тип узла</legend><div class="type-options">${types}</div></fieldset><label class="field"><span>Название</span><input data-first name="title" required maxlength="240" placeholder="Что здесь происходит?"></label><label class="field"><span>Описание</span><textarea name="description" rows="3" placeholder="Коротко о событии или выборе"></textarea></label><label class="moment-check"><input type="checkbox" name="important">${icon('spark',14)}Ключевой момент</label>${project().nodes.length?`<label class="field"><span>Переход из узла</span><select name="source">${nodeOptions(source,true)}</select></label><label id="new-branch-label" class="field" ${source?'':'hidden'}><span>Подпись перехода</span><input name="label" maxlength="140" placeholder="Например, ответить на звонок"></label>`:''}</div>${formFooter('Добавить узел')}</form>`);
  modalContext={point};
}
function openChapterForm(isNew,source='') {
  const entry=isNew&&project().nodes.length?`<label class="field"><span>Продолжить после узла</span><select name="source"><option value="">Начать отдельную главу</option>${nodeOptions(source)}</select></label><label class="field" id="chapter-entry" ${source?'':'hidden'}><span>Первая сцена новой главы</span><input name="entryTitle" maxlength="240" placeholder="По названию главы"></label>`:'';
  modal(isNew?'Новая глава':'Название главы',`<form id="chapter-form"><div class="modal-body"><label class="field"><span>Название</span><input name="title" data-first required maxlength="160" value="${isNew?'':esc(chapterById(ui.chapter).title)}" placeholder="Название главы"></label>${entry}</div>${formFooter(isNew?'Создать главу':'Сохранить')}</form>`);
  modalContext={isNew};
}
function openEdgeForm(source=ui.selected,target='',edge=null) {
  if (!project().nodes.length) {openNodeForm(null);return;}
  const options=project().chapters.map((c,i)=>{
    const nodes=project().nodes.filter(n=>n.chapter===c.id&&n.id!==source);
    return nodes.length?`<optgroup label="Глава ${i+1} · ${esc(c.title)}">${nodes.map(n=>`<option value="${idAttr(n.id)}" ${n.id===target?'selected':''}>#${pad(n.no)} · ${esc(n.title)}</option>`).join('')}</optgroup>`:'';
  }).join('');
  modal(edge?'Редактировать переход':'Новый переход',`<form id="edge-form"><div class="modal-body"><div class="from-node">${icon('branch',18)}<span>Из узла <b>${esc(nodeById(source).title)}</b></span></div>
    <label class="field"><span>Куда ведёт переход</span><select name="target" required><option value="">Выберите узел</option>${options}</select></label><label class="field"><span>Подпись перехода</span><input name="label" maxlength="140" value="${esc(edge?.label)}" placeholder="Например, открыть дверь"></label>
    ${rulesEditor(edge)}${!edge?'<button type="button" data-action="new-connected" data-id="'+idAttr(source)+'" class="text-action">'+icon('plus',14)+'Создать узел для этой ветки</button>':'<button type="button" class="text-action" data-action="split-edge">'+icon('plus',14)+'Вставить сцену в этот переход</button>'}</div>${formFooter(edge?'Сохранить':'Связать узлы',edge?iconButton('delete-edge','trash','Удалить переход',`data-id="${idAttr(edge.id)}"`):'')}</form>`);
  modalContext={source,edge:edge?.id};
}
function openLoreForm(id=null,attachTo=null) {
  const item=project().lore.find(l=>l.id===id)||{title:'',description:'',kind:'person'};
  const used=overview.occurrences.byLore.get(id)||[];
  const appearances=id?`<button class="lore-show-map kind-${item.kind}" type="submit" name="next" value="appearances">${icon('map',16)}Где появляется <span>${sceneCount(used.length)}</span></button>`:'';
  modal(id?'Запись лора':'Новая запись лора',`<form id="lore-form"><button type="submit" hidden></button><div class="modal-body"><label class="field"><span>Категория</span><select name="kind">${Object.entries(LORE_KINDS).map(([k,v])=>`<option value="${k}" ${item.kind===k?'selected':''}>${v.name}</option>`).join('')}</select></label><label class="field"><span>Название</span><input data-first required maxlength="200" name="title" value="${esc(item.title)}" placeholder="Имя или название"></label>${appearances}<label class="field"><span>Описание</span><textarea rows="5" name="description" placeholder="Какие детали важны для истории?">${esc(item.description)}</textarea></label>
    ${used.length?'<details class="lore-scenes"><summary>Сцены по главам</summary><div class="chips">'+used.map(n=>`<button type="button" class="quiet-button" data-action="jump" data-id="${idAttr(n.id)}">${esc(chapterName(n.chapter)+' · '+n.title)}</button>`).join('')+'</div></details>':''}${id?'<button type="submit" class="text-action" name="next" value="scene">'+icon('plus',14)+'Создать сцену с этой записью</button>':''}</div>${formFooter(id?'Сохранить':'Добавить запись',id?iconButton('delete-lore','trash','Удалить запись',`data-id="${idAttr(id)}"`):'')}</form>`);
  modalContext={id,attachTo};
}
function openLorePicker() {
  const n=nodeById(ui.selected); if (!n) return;
  modal('Связанный лор',`<form id="attach-form"><div class="modal-body"><p class="context-copy">Записи для узла «${esc(n.title)}»</p><div class="check-list">${project().lore.map(l=>`<label><input type="checkbox" name="lore" value="${idAttr(l.id)}" ${n.lore.includes(l.id)?'checked':''}><span>${loreChip(l)}</span><small>${LORE_KINDS[l.kind].name}</small></label>`).join('')}</div><button type="button" class="text-action" data-action="new-attached-lore">${icon('plus',14)}Новая запись лора</button></div>${formFooter('Сохранить')}</form>`);
}
function openLineForm(nodeId='',lineId=null) {
  if (!project().nodes.length) { openNodeForm(null,null,'dialogue'); modalContext.thenLine=true; return; }
  const n=nodeById(nodeId)||nodeById(ui.selected)||project().nodes[0], line=n.lines.find(l=>l.id===lineId);
  const speakers=[...new Set([...project().lore.filter(l=>l.kind==='person').map(l=>l.title),...project().nodes.flatMap(v=>v.lines.map(l=>l.speaker))].filter(Boolean))];
  modal(line?'Редактировать реплику':'Новая реплика',`<form id="line-form"><div class="modal-body"><label class="field"><span>Узел на карте</span><select name="node">${nodeOptions(n.id)}</select></label><label class="field"><span>Кто говорит</span><input name="speaker" list="speakers" maxlength="140" value="${esc(line?.speaker)}" placeholder="Имя персонажа"><datalist id="speakers">${speakers.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist></label><label class="field"><span>Реплика</span><textarea data-first name="text" required rows="4" placeholder="Слова персонажа">${esc(line?.text)}</textarea></label></div>${formFooter(line?'Сохранить':'Добавить реплику',line?iconButton('delete-line','trash','Удалить реплику',`data-node-id="${idAttr(n.id)}" data-id="${idAttr(line.id)}"`):'')}</form>`);
  modalContext={node:n.id,line:line?.id};
}
function downloadProject() {
  const p=project(), blob=new Blob([JSON.stringify({format:'razvilka-project',version:2,project:p},null,2)],{type:'application/json'});
  const a=document.createElement('a'), url=URL.createObjectURL(blob);
  a.href=url; a.download=(p.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim()||'Новелла')+'.razvilka.json';
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
  toast('Файл проекта подготовлен');
}
async function importProject(file) {
  if (!file) return;
  try {
    const pkg=JSON.parse(await file.text());
    if (pkg.format!=='razvilka-project'||![1,2].includes(pkg.version)) throw new Error('Выберите файл проекта в формате .razvilka.json.');
    const p=validateProject(pkg.project); p.id=uid();
    if (studio.projects.some(v=>v.title===p.title)) p.title+=' (копия)';
    studio.projects.push(p); activateProject(p.id); toast('Проект открыт');
  } catch (error) { toast(error instanceof SyntaxError?'Не удалось прочитать JSON проекта':error.message); }
  finally { byId('import-file').value=''; }
}
function travelHistory(direction) {
  const take=direction==='undo'?past:future, give=direction==='undo'?future:past;
  if (!take.length) return;
  give.push(JSON.stringify(project()));
  studio.projects[studio.projects.findIndex(p=>p.id===studio.active)]=JSON.parse(take.pop());
  fieldSnapshot=null; persist(); renderAll(); toast(direction==='undo'?'Действие отменено':'Действие повторено');
}
function deleteNode(id) {
  const n=nodeById(id); if (!n) return;
  confirmChange('Удалить узел?',`«${n.title}» и его переходы будут удалены. Действие можно отменить.`,()=>{
    changeProject(p=>{
      p.nodes=p.nodes.filter(v=>v.id!==id); p.edges=p.edges.filter(e=>e.from!==id&&e.to!==id);
      const c=chapterById(n.chapter); if (c.start===id) c.start=p.nodes.find(v=>v.chapter===c.id)?.id||null;
    });
    if (ui.selected===id) ui.selected=chapterById(ui.chapter).start;
    renderAll(); toast('Узел удалён');
  });
}
function showShortcuts() {
  const keys=[['Найти в проекте','Ctrl / ⌘ + K'],['Добавить узел','N'],['Выделение','V'],['Перемещение карты','H'],['Временно перемещать карту','Пробел'],['Связать узлы','C'],['Показать всю карту','F'],['Удалить выбранный узел','Delete'],['Отменить действие','Ctrl / ⌘ + Z'],['Повторить действие','Ctrl / ⌘ + Shift + Z'],['Закрыть окно или выйти из связи','Esc']];
  modal('Горячие клавиши','<div class="modal-body key-list">'+keys.map(([l,k])=>`<div><span>${l}</span><kbd>${k}</kbd></div>`).join('')+'</div>');
}
function setChapter(id) {
  ui.page='map';ui.chapter=id;ui.selected=chapterById(id).start||chapterNodes()[0]?.id||null;ui.source=null;ui.tool='pointer';renderAll(true);
}
function handleAction(action,button,e) {
  const id=button.dataset.id, n=nodeById(ui.selected);
  switch(action) {
    case 'page': goPage(button.dataset.page); break;
    case 'all-chapters': goPage('timeline');break;
    case 'timeline-lore': overview.showLore=!overview.showLore;renderAll();break;
    case 'loose-lore': openLooseLore();break;
    case 'clear-lore-focus': clearLoreFocus();break;
    case 'unfinished': openUnfinishedScenes();break;
    case 'timeline-first': case 'first-scene':
      if(action==='timeline-first')setChapter(id);
      pendingInsert={chapter:ui.chapter,side:'right'};addFromPalette('scene');break;
    case 'next-scene': pendingInsert={chapter:ui.chapter,source:id,side:narrowMap.matches?'bottom':'right'};addFromPalette('scene');break;
    case 'find-project': openProjectSearch();break;
    case 'new-choice': openChoiceWriter({source:id});break;
    case 'edit-choice': openChoiceWriter({id});break;
    case 'add-option': addChoiceRow();break;
    case 'remove-option': case 'restore-option': toggleChoiceRow(button.closest('.choice-row'),action==='remove-option');break;
    case 'more-matches': {
      const host=button.closest('.writer-search');
      const prev=Number(host.dataset.limit)||30;
      host.dataset.limit=prev+30;drawWriterResults(host);
      host.querySelectorAll('.writer-result')[prev]?.focus();break;
    }
    case 'choose-destination': {
      const row=button.closest('.choice-row'), details=row.querySelector('details');
      row.dataset.destination=id;refreshChoiceTarget(row);details.open=false;details.querySelector('summary').focus();break;
    }
    case 'trace-toggle': startTimelinePath();break;
    case 'clear-chapter-route': overview.path=null;renderAll();break;
    case 'trace-to': case 'trace-edge': traceTimeline(id,action==='trace-edge');break;
    case 'trace-back': {
      const path=overview.path, fork=previousFork(project(),overview.layout.index,path);
      showTimelinePath(path.slice(0,fork<0?-1:fork+1));break;
    }
    case 'read-route': {const path=playSession?.path.slice();if(path){closeModal();showTimelinePath(path);}break;}
    case 'timeline-in': zoomTimeline(overview.zoom*1.2);break;
    case 'timeline-out': zoomTimeline(overview.zoom/1.2);break;
    case 'timeline-actual': zoomTimeline(1);break;
    case 'timeline-fit': zoomTimeline(1,true);break;
    case 'file-menu': showMenu(button,menuItem('projects','grid','Мои проекты')+menuItem('project-settings','sliders','Параметры проекта')+'<hr>'+menuItem('undo','undo','Отменить действие',past.length?'':'disabled')+menuItem('redo','redo','Повторить действие',future.length?'':'disabled')+'<hr>'+menuItem('export','download','Скачать проект')+menuItem('import','upload','Открыть из файла')+'<hr>'+menuItem('shortcuts','keyboard','Горячие клавиши'));break;
    case 'projects': showProjects();break;
    case 'new-project': openProjectForm(true);break;
    case 'project-settings': openProjectForm(false);break;
    case 'activate-project': activateProject(id);break;
    case 'export': downloadProject();break;
    case 'import': byId('import-file').click();break;
    case 'play': startReading();break;
    case 'preview-scene': previewScene(id);break;
    case 'preview-isolated': if(nodeById(id))beginReading([{node:id,via:null}],{id,source:'isolated'});break;
    case 'preview-path': choosePreviewHistory(Number(button.dataset.index));break;
    case 'preview-map': {
      const path=playSession?.entry;
      closeModal();if(path)showTimelinePath(path);else goPage('timeline');break;
    }
    case 'read-next': followEdge(id);break;
    case 'read-back': if(playSession&&playSession.path.length>playSession.entry.length){playSession.path.pop();renderReading();}break;
    case 'read-restart': if(playSession){playSession.path=playSession.entry.slice();renderReading();}break;
    case 'chapters': showMenu(button,project().chapters.map((c,i)=>menuItem('chapter','layers',`Глава ${i+1} · ${c.title}`,`data-id="${idAttr(c.id)}"`,ui.page==='map'&&ui.chapter===c.id?icon('check',14):'')).join('')+'<hr>'+menuItem('add-chapter','plus','Добавить главу')+(ui.page==='map'?menuItem('rename-chapter','edit','Переименовать главу'):''));break;
    case 'chapter': setChapter(id);break;
    case 'add-chapter': openChapterForm(true);break;
    case 'continue-chapter': openChapterForm(true,id);break;
    case 'rename-chapter': openChapterForm(false);break;
    case 'add-node': openAddPalette(button);break;
    case 'detailed-node': openNodeForm(null,pendingInsert?.spot);break;
    case 'new-connected': openNodeForm(id);break;
    case 'undo': case 'redo': travelHistory(action);break;
    case 'tool': setMapTool(button.dataset.tool);break;
    case 'cancel-link': setMapTool('pointer');break;
    case 'open-palette': if(e.detail===0)paletteAtHandle(button);break;
    case 'quick-type': addFromPalette(button.dataset.type);break;
    case 'pick-target': openEdgeForm(id);break;
    case 'split-edge': {const form=byId('edge-form');if(form.reportValidity()){modalContext.split=true;form.requestSubmit();}break;}
    case 'other-chapters': showChapterExits(button,id);break;
    case 'example-routes': openExampleRoutes();break;
    case 'add-rule': {const form=byId('edge-form');form.querySelector('.rule-rows').insertAdjacentHTML('beforeend',ruleRow(undefined,modalContext.edge));refreshRuleControls(form);form.querySelector('.rule-row:last-child .rule-ref').focus();break;}
    case 'remove-rule': {const form=byId('edge-form');button.closest('.rule-row').remove();refreshRuleControls(form);break;}
    case 'port-in': if(ui.tool==='link')chooseMapNode(id);else selectNode(id);break;
    case 'fit': fitGraph();break;
    case 'zoom-in': zoomBy(1.18);break;
    case 'zoom-out': zoomBy(1/1.18);break;
    case 'actual-size': zoomBy(1/camera.scale);break;
    case 'minimap': navigateMinimap(e);break;
    case 'show-inspector': case 'hide-inspector': ui.inspector=action==='show-inspector';renderInspector();break;
    case 'jump': closeModal();selectNode(id,true);break;
    case 'node-type': showMenu(button,Object.entries(NODE_TYPES).map(([k,t])=>menuItem('set-type',t.icon,t.name,`data-type="${k}"`,n.type===k?icon('check',14):'')).join(''));break;
    case 'toggle-important': changeProject(()=>{n.important=!n.important;});renderAll();toast(n.important?'Ключевой момент отмечен':'Отметка снята');break;
    case 'set-type': changeProject(()=>{n.type=button.dataset.type;});renderAll();break;
    case 'node-options': showMenu(button,menuItem('set-start','play','Начать главу с этого узла')+menuItem('new-connected','plus','Добавить связанную сцену',`data-id="${idAttr(n.id)}"`)+'<hr>'+menuItem('delete-node','trash','Удалить узел',`data-id="${idAttr(n.id)}"`));break;
    case 'set-start': changeProject(()=>{chapterById(n.chapter).start=n.id;});renderAll();toast('Начало главы изменено');break;
    case 'delete-node': deleteNode(id);break;
    case 'add-edge': openEdgeForm();break;
    case 'edit-edge': {const edge=project().edges.find(v=>v.id===id);if(edge)openEdgeForm(edge.from,edge.to,edge);break;}
    case 'delete-edge': changeProject(p=>{p.edges=p.edges.filter(v=>v.id!==id);});closeModal();renderAll();toast('Переход удалён');break;
    case 'filter': ui.kind=button.dataset.kind; renderCollection();break;
    case 'add-lore': openLoreForm();break;
    case 'edit-lore': openLoreForm(id);modalContext.chapterForScene=button.closest('[data-band]')?.dataset.band;break;
    case 'attach-lore': openLorePicker();break;
    case 'new-attached-lore': {
      const pending=[...new FormData(byId('attach-form')).getAll('lore')];
      openLoreForm(null,n.id);modalContext.pending=pending;break;
    }
    case 'delete-lore': {
      const item=project().lore.find(l=>l.id===id);
      confirmChange('Удалить запись лора?',`«${item.title}» будет удалена из базы и всех связанных узлов.`,()=>{
        changeProject(p=>{p.lore=p.lore.filter(l=>l.id!==id);p.nodes.forEach(v=>{v.lore=v.lore.filter(key=>key!==id);});});renderAll();toast('Запись удалена');
      });break;
    }
    case 'add-line': openLineForm(button.dataset.nodeId||'');break;
    case 'node-line': openLineForm(n.id);break;
    case 'edit-line': openLineForm(button.dataset.nodeId,id);break;
    case 'delete-line': {
      const owner=nodeById(button.dataset.nodeId);changeProject(()=>{owner.lines=owner.lines.filter(l=>l.id!==id);});closeModal();renderAll();toast('Реплика удалена');break;
    }
    case 'shortcuts': showShortcuts();break;
    case 'confirm': {const cb=confirmCallback;confirmCallback=null;closeModal();cb?.();break;}
    case 'close': closeModal();break;
  }
}
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]'); if(!button||button.disabled)return;
  const action=button.dataset.action;
  if (!['file-menu','chapters','node-type','node-options','other-chapters','open-palette'].includes(action)) dismissMenu();
  handleAction(action,button,e);
});
document.addEventListener('pointerdown',e=>{
  if(!menu.hidden&&!menu.contains(e.target)&&!e.target.closest('[aria-haspopup],.type-edit,[data-action="node-options"]'))dismissMenu();
});
dialog.addEventListener('click',e=>{if(e.target===dialog)closeModal();});
dialog.addEventListener('close',()=>{if(dialog.open)return;playSession=null;if(refreshAfterWriting){refreshAfterWriting=false;renderAll();}});
byId('import-file').addEventListener('change',e=>importProject(e.target.files[0]));
document.addEventListener('change',e=>{
  if(e.target.matches('.outcome-mode')){
    const row=e.target.closest('.choice-row');refreshChoiceTarget(row);
    if(e.target.value==='existing')row.querySelector('.writer-search input')?.focus();
  }
  if(e.target.id==='timeline-chapter')scrollToTimelineChapter(e.target.value);
  if(e.target.id==='appearance-scene')selectAppearance(e.target.value);
  if(e.target.matches('.rule-test')) {
    const kind=e.target.value.split('-')[0], ref=e.target.closest('.rule-row').querySelector('.rule-ref');
    const previous=ref.value;
    ref.innerHTML=ruleOptions(kind,previous,modalContext.edge);
  }
  if(e.target.matches('#chapter-form [name="source"]'))byId('chapter-entry').hidden=!e.target.value;
  if (e.target.matches('#node-form [name="source"]')) byId('new-branch-label').hidden=!e.target.value;
});
document.addEventListener('focusin',e=>{ if(e.target.matches('[data-edit]'))fieldSnapshot={el:e.target,saved:false}; });
document.addEventListener('focusout',e=>{
  const el=e.target;if(!el.matches('[data-edit="title"]'))return;
  const n=nodeById(el.dataset.id);if(n&&!n.title.trim()){n.title='Без названия';el.value=n.title;const card=boxFor(n);if(card)card.querySelector('h3').textContent=n.title;persist();}
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.matches('.writer-search input')){const host=el.closest('.writer-search');delete host.dataset.limit;drawWriterResults(host);return;}
  if(el.matches('.outcome-title input')){refreshChoiceTarget(el.closest('.choice-row'));return;}
  if(el.id==='search'){ui.search=el.value;drawCollectionContent();return;}
  if(!el.dataset.edit)return;
  const n=nodeById(el.dataset.id);if(!n)return;
  if(!fieldSnapshot||fieldSnapshot.el!==el||!fieldSnapshot.saved){remember();fieldSnapshot={el,saved:true};}
  n[el.dataset.edit]=el.value;persist();
  const card=boxFor(n);
  if(card){card.querySelector('h3').textContent=n.title||'Без названия';card.setAttribute('aria-label',NODE_TYPES[n.type].name+' '+n.title);const summary=card.querySelector('.node-summary');if(summary)summary.textContent=n.description;}
});
dialog.addEventListener('submit',e=>{
  e.preventDefault();const form=e.target, data=new FormData(form);
  const value=k=>String(data.get(k)||'').trim(), ctx=modalContext;
  for (const field of form.querySelectorAll('input[required], textarea[required]')) {
    if (!field.value.trim()) { field.setCustomValidity('Заполните это поле');field.reportValidity(); field.addEventListener('input',()=>field.setCustomValidity(''),{once:true});return; }
  }
  switch(form.id) {
    case 'choice-form': saveWrittenChoice(form,ctx);break;
    case 'project-form': {
      if(ctx.isNew){const p=blankProject(value('title'),value('genre'));studio.projects.push(p);activateProject(p.id);toast('Новый проект создан');}
      else{changeProject(p=>{p.title=value('title');p.genre=value('genre');});closeModal();renderAll();}break;
    }
    case 'chapter-form': {
      const c=ctx.isNew?{id:uid(),title:value('title'),start:null}:chapterById(ui.chapter);
      changeProject(p=>{
        if(!ctx.isNew){c.title=value('title');return;}
        p.chapters.push(c);
        const source=value('source');
        if(source){
          const entry=makeNode(p,c.id,'scene',value('entryTitle')||c.title,{x:0,y:0});
          p.nodes.push(entry); c.start=entry.id; p.edges.push(makeEdge(source,entry.id));
        }
      });closeModal();setChapter(c.id);break;
    }
    case 'node-form': {
      const p=project(),source=nodeById(value('source')), at=freeSpot(source?.chapter===ui.chapter?source:null,ctx.point);
      const n={...makeNode(p,ui.chapter,value('type'),value('title'),at),description:value('description'),important:data.has('important'),lore:ctx.loreId?[ctx.loreId]:[]};
      changeProject(()=>{p.nodes.push(n);if(!chapterById(ui.chapter).start)chapterById(ui.chapter).start=n.id;if(source)p.edges.push(makeEdge(source.id,n.id,value('label')));});
      const thenLine=ctx.thenLine;closeModal();ui.page='map';ui.selected=n.id;ui.inspector=innerWidth>=1000;renderAll(chapterNodes().length===1);revealNode(n);toast('Узел добавлен');if(thenLine)openLineForm(n.id);break;
    }
    case 'edge-form': {
      const split=ctx.split===true;ctx.split=false;let inserted=null;
      const target=value('target'),label=value('label'),rules=readRules(form),ruleMode=value('ruleMode')==='any'?'any':'all';
      if(project().edges.some(v=>v.id!==ctx.edge&&v.from===ctx.source&&v.to===target&&v.label===label&&(v.ruleMode||'all')===ruleMode&&JSON.stringify(v.rules||[])===JSON.stringify(rules))){toast('Такой переход уже есть');return;}
      changeProject(p=>{
        const edge=ctx.edge?p.edges.find(v=>v.id===ctx.edge):makeEdge(ctx.source,target);
        if(edge.to!==target)delete edge.ports;
        Object.assign(edge,{to:target,label,rules,ruleMode});
        if(!ctx.edge)p.edges.push(edge);
        if(split)inserted=splitTransition(p,edge);
      });
      closeModal();if(inserted)ui.selected=inserted.id;renderAll();
      if(inserted){revealNode(inserted);renameOnCard(inserted);}else toast('Переход сохранён');break;
    }
    case 'lore-form': {
      const previous=project().lore.find(l=>l.id===ctx.id);
      const text=k=>previous&&form.elements[k].value===form.elements[k].defaultValue?previous[k]:value(k);
      const item={id:ctx.id||uid(),kind:value('kind'),title:text('title'),description:text('description')};
      if(!previous||ctx.attachTo||['kind','title','description'].some(k=>previous[k]!==item[k])){
        changeProject(p=>{if(previous)Object.assign(previous,item);else p.lore.push(item);if(ctx.attachTo){const owner=nodeById(ctx.attachTo);owner.lore=[...new Set([...(ctx.pending||owner.lore),item.id])];}});
      }
      closeModal();
      if(e.submitter?.value==='appearances'){showLoreOnMap(item.id);break;}
      renderAll();
      if(e.submitter?.value==='scene'){if(ctx.chapterForScene)ui.chapter=ctx.chapterForScene;openNodeForm(null);modalContext.loreId=item.id;}else toast('Запись сохранена');break;
    }
    case 'attach-form': changeProject(()=>{nodeById(ui.selected).lore=data.getAll('lore');});closeModal();renderAll();break;
    case 'line-form': {
      const owner=nodeById(value('node')),line={id:ctx.line||uid(),speaker:value('speaker'),text:value('text')};
      changeProject(()=>{if(ctx.line&&ctx.node===owner.id)Object.assign(owner.lines.find(l=>l.id===ctx.line),line);else{if(ctx.line){const old=nodeById(ctx.node);old.lines=old.lines.filter(l=>l.id!==ctx.line);}owner.lines.push(line);}});
      closeModal();renderAll();toast('Реплика сохранена');break;
    }
  }
});
document.addEventListener('keydown',e=>{
  const editing=e.target.matches('input,textarea,select,[contenteditable="true"]');
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyK'&&!dialog.open){e.preventDefault();openProjectSearch();return;}
  const search=e.target.closest('.writer-search');
  if(search&&!e.isComposing&&['ArrowDown','ArrowUp','Enter'].includes(e.key)){
    const items=[...search.querySelectorAll('.writer-result')], ix=items.indexOf(e.target);
    if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();items[0]?.click();return;}
    if(e.key!=='Enter'){e.preventDefault();if(e.key==='ArrowUp'&&ix<=0)search.querySelector('input').focus();else items[Math.max(0,Math.min(items.length-1,ix+(e.key==='ArrowDown'?1:-1)))]?.focus();return;}
  }
  if(e.key==='Enter'&&!e.isComposing&&e.target.closest('#choice-form')){
    const form=byId('choice-form');
    if(e.ctrlKey||e.metaKey){e.preventDefault();form.requestSubmit();return;}
    if(e.target.matches('[name="question"],.choice-label')){
      const labels=[...form.querySelectorAll('.choice-row:not(.is-removed) .choice-label')], next=labels[labels.indexOf(e.target)+1];
      if(next){e.preventDefault();next.focus();return;}
    }
  }
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.timeline-hit')){e.preventDefault();traceTimeline(e.target.dataset.id,true);return;}
  if(e.key==='Escape'){if(connectorDrag){cancelConnector();return;}if(!menu.hidden){dismissMenu();return;}if(!dialog.open)setMapTool('pointer');return;}
  if(dialog.open||editing)return;
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();travelHistory(e.shiftKey?'redo':'undo');return;}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();travelHistory('redo');return;}
  if(e.ctrlKey||e.metaKey||e.altKey||ui.page!=='map'||!menu.hidden)return;
  const card=e.target.closest('.node-card');
  if((e.key==='Enter'||e.key===' ')&&card&&e.target===card){e.preventDefault();chooseMapNode(card.dataset.node);return;}
  if(e.key===' '&&e.target.closest('button'))return;
  switch(e.code){
    case 'Space': e.preventDefault();spaceDown=true;mapPane()?.classList.add('space-pan');break;
    case 'KeyV': setMapTool('pointer');break;
    case 'KeyH': setMapTool('hand');break;
    case 'KeyC': setMapTool('link');break;
    case 'KeyN': e.preventDefault();openAddPalette(document.querySelector('.add-button'));break;
    case 'KeyF': fitGraph();break;
    case 'Delete': if(ui.selected)deleteNode(ui.selected);break;
    case 'Equal': zoomBy(1.18);break;
    case 'Minus': zoomBy(1/1.18);break;
  }
});
function releaseSpace(){spaceDown=false;mapPane()?.classList.remove('space-pan');}
window.addEventListener('keyup',e=>{if(e.code==='Space')releaseSpace();});
window.addEventListener('blur',releaseSpace);
window.addEventListener('storage',e=>{
  if(e.key!==STORAGE_KEY||!e.newValue)return;
  const writing=dialog.open&&!!byId('choice-form');
  if((dialog.open&&!writing)||document.activeElement?.matches('[data-edit]')) {toast('Проект изменён в другой вкладке');return;}
  const previous=studio.active;studio=readStudio();
  if(studio.projects.some(p=>p.id===previous))studio.active=previous;
  past=[];future=[];
  if(writing){
    refreshAfterWriting=true;modalContext.entries=writingIndex(project());
    dialog.querySelectorAll('.writer-search').forEach(drawWriterResults);
    return;
  }
  renderAll();
});
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon,el.dataset.icon==='chevron-right'?12:15);});
narrowMap.addEventListener('change',()=>{ui.inspector=!narrowMap.matches&&innerWidth>=1000;if(ui.page==='map')renderAll(true);});
window.addEventListener('pagehide',rememberPlace);
persist();resumePlace();
