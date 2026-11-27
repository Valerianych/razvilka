const foldText = text => String(text || '').toLocaleLowerCase('ru').replace(/ё/g,'е');
let refreshAfterWriting=false;

function writingIndex(p) {
  const chapters=new Map(p.chapters.map((c,i)=>[c.id,{number:i+1,name:`Глава ${i+1} · ${c.title}`}]));
  const labels=new Map();
  for(const e of p.edges) {
    if(!e.label)continue;
    if(!labels.has(e.from))labels.set(e.from,[]);
    labels.get(e.from).push(e.label);
  }
  const item=(kind,record,meta,glyph,body,chapter=null)=>({
    kind,id:record.id,title:record.title,meta,glyph,chapter,name:foldText(record.title),
    words:foldText([record.title,meta,...body].join(' '))
  });
  return [
    ...p.nodes.map(n=>item('node',n,chapters.get(n.chapter).name+' · '+NODE_TYPES[n.type].name+' #'+pad(n.no),
      NODE_TYPES[n.type].icon,[n.description,...(labels.get(n.id)||[]),...n.lines.map(l=>l.speaker+' '+l.text)],chapters.get(n.chapter).number)),
    ...p.lore.map(l=>item('lore',l,'База лора · '+LORE_KINDS[l.kind].name,LORE_KINDS[l.kind].icon,[l.description]))
  ];
}

function writerSearch(purpose) {
  const global=purpose==='project', label=global?'Название, реплика или текст варианта':'Найти сцену в любой главе';
  return `<div class="writer-search" data-purpose="${purpose}"><label class="search-box">${icon('search',17)}<input type="search" placeholder="${label}" aria-label="${label}" autocomplete="off" ${global?'data-first':''}></label><div class="writer-results" aria-label="Результаты поиска"></div></div>`;
}

function drawWriterResults(host) {
  const input=foldText(host.querySelector('input').value.trim());
  const scope=input.match(/(?:^|\s)(?:глава|гл\.?)\s*(\d+)(?=\s|$)/u);
  const query=scope?input.replace(scope[0],' ').trim():input;
  const words=query.split(/\s+/).filter(Boolean);
  const target=host.dataset.purpose==='target';
  const hits=modalContext.entries.filter(item=>(!target||item.kind==='node') && (!scope||item.chapter===Number(scope[1])) && words.every(w=>item.words.includes(w)));
  if(query)hits.sort((a,b)=>Number(b.name.startsWith(query))-Number(a.name.startsWith(query)) || Number(b.name.includes(query))-Number(a.name.includes(query)));
  const limit=Number(host.dataset.limit)||30;
  const rows=hits.slice(0,limit).map(item=>{
    const action=target?'choose-destination':item.kind==='node'?'jump':'edit-lore';
    return `<button type="button" class="writer-result" data-action="${action}" data-id="${idAttr(item.id)}">${icon(item.glyph,16)}<span><strong>${esc(item.title)}</strong><small>${esc(item.meta)}</small></span>${icon('chevron-right',14)}</button>`;
  }).join('');
  host.querySelector('.writer-results').innerHTML=(rows||'<p class="no-matches" role="status">Совпадений нет</p>')+
    (hits.length>limit?'<button type="button" class="text-action" data-action="more-matches">Показать ещё</button>':'');
}

function openProjectSearch() {
  modal('Найти в проекте','<div class="modal-body">'+writerSearch('project')+'</div>','finder-modal');
  modalContext={entries:writingIndex(project())};
  drawWriterResults(dialog.querySelector('.writer-search'));
}

const outcomeNames={scene:'Новая сцена',ending:'Новый финал',dialogue:'Новый диалог',choice:'Новый выбор',existing:'Готовая сцена'};

function choiceRow(edge,index) {
  const dest=edge?nodeById(edge.to):null, mode=dest?'existing':'scene';
  const description=dest?chapterName(dest.chapter)+' → '+dest.title:outcomeNames.scene;
  const locked=edge?.rules?.length?`<span class="choice-rule-count" title="Условия перехода">${icon('sliders',12)}${edge.rules.length}</span>`:'';
  return `<section class="choice-row" data-edge="${idAttr(edge?.id||'')}" data-destination="${idAttr(dest?.id||'')}" data-original-target="${idAttr(dest?.id||'')}">
    <div class="choice-row-top"><label><span class="choice-number">Вариант ${index+1}</span><input class="choice-label" maxlength="140" aria-label="Текст варианта ${index+1}" value="${esc(edge?.label)}" placeholder="${esc(dest?.title||(index===0?'Например, передать письмо':index===1?'Например, сжечь письмо':'Что выберет читатель?'))}"></label>
    <button type="button" class="icon-button remove-option" data-action="remove-option" aria-label="Убрать вариант ${index+1}" title="Убрать вариант">${icon('x',14)}</button></div>
    <details class="choice-target"><summary>${icon('arrow',13)}<span class="target-summary">${esc(description)}</span>${locked}${icon('chevron-down',12)}</summary>
    <div class="choice-target-fields"><label class="field"><span>Куда ведёт вариант</span><select class="outcome-mode">${Object.entries(outcomeNames).map(([key,label])=>`<option value="${key}" ${key===mode?'selected':''}>${label}</option>`).join('')}</select></label>
    <label class="field outcome-title" ${dest?'hidden':''}><span>Название новой карточки</span><input maxlength="240" placeholder="Как в тексте варианта"></label>
    <div class="outcome-picker" ${dest?'':'hidden'}></div></div></details>
    <div class="removed-option" hidden><span></span><button type="button" class="text-action" data-action="restore-option">Вернуть</button></div></section>`;
}

function openChoiceWriter({id=null,source=null,chapter=ui.chapter,side=null,spot=null}={}) {
  const n=id?nodeById(id):null, parent=source?nodeById(source):null;
  const edges=n?project().edges.filter(e=>e.from===id):[];
  const rows=edges.map(choiceRow);
  while(rows.length<2)rows.push(choiceRow(null,rows.length));
  const context=parent?'После сцены «'+parent.title+'»':chapterName(n?.chapter||chapter);
  const body=`<form id="choice-form"><div class="modal-body choice-body"><div class="writer-location">${icon(parent?'branch':'layers',14)}${esc(context)}</div>
    <label class="field writer-question"><span>Момент выбора</span><input data-first name="question" required maxlength="240" value="${esc(n?.title)}" placeholder="Что сделать с письмом?"></label>
    <h3>Варианты для читателя</h3><div class="choice-rows">${rows.join('')}</div>
    <button type="button" class="add-option" data-action="add-option">${icon('plus',15)}Ещё вариант</button>
    <p class="writer-error" role="alert" hidden></p></div>${formFooter(n?'Сохранить':'Создать выбор')}</form>`;
  modal(n?'Варианты выбора':'Новый выбор',body,'writer-modal');
  modalContext={id,source,chapter:n?.chapter||chapter,side,spot,entries:writingIndex(project()),projectId:project().id};
  // Each picker only renders its search results when the author opens it.
  dialog.querySelectorAll('.choice-target').forEach(bindChoiceTarget);
  if(n)dialog.querySelector('.choice-label')?.focus({preventScroll:true});
}

function refreshChoiceTarget(row) {
  const mode=row.querySelector('.outcome-mode').value, existing=mode==='existing';
  row.querySelector('.outcome-title').hidden=existing;
  const picker=row.querySelector('.outcome-picker');
  picker.hidden=!existing;
  if(existing&&!picker.firstElementChild&&row.querySelector('details').open){
    picker.innerHTML=writerSearch('target');
    drawWriterResults(picker.firstElementChild);
  }
  const dest=existing?nodeById(row.dataset.destination):null;
  const newName=row.querySelector('.outcome-title input').value.trim();
  row.querySelector('.target-summary').textContent=existing?(dest?chapterName(dest.chapter)+' → '+dest.title:'Выбрать готовую сцену'):outcomeNames[mode]+(newName?' · '+newName:'');
}

function bindChoiceTarget(details) {
  details.addEventListener('toggle',()=>{if(details.open&&dialog.open&&details.isConnected&&modalContext.entries)refreshChoiceTarget(details.closest('.choice-row'));});
}

function numberChoiceRows() {
  const rows=dialog.querySelectorAll('.choice-row:not(.is-removed)');
  rows.forEach((row,i)=>{
    row.querySelector('.choice-number').textContent='Вариант '+(i+1);
    row.querySelector('.choice-label').setAttribute('aria-label','Текст варианта '+(i+1));
    row.querySelector('.remove-option').setAttribute('aria-label','Убрать вариант '+(i+1));
  });
}

function addChoiceRow() {
  const list=dialog.querySelector('.choice-rows');
  list.insertAdjacentHTML('beforeend',choiceRow(null,list.children.length));
  const row=list.lastElementChild;
  bindChoiceTarget(row.querySelector('details'));
  numberChoiceRows();row.querySelector('.choice-label').focus();
}

function toggleChoiceRow(row,remove) {
  if(remove&&!row.dataset.edge){row.remove();numberChoiceRows();dialog.querySelector('.add-option').focus();return;}
  row.classList.toggle('is-removed',remove);
  const note=row.querySelector('.removed-option');
  note.hidden=!remove;
  if(remove){
    const used=project().edges.filter(e=>e.rules?.some(r=>r.kind==='edge'&&r.ref===row.dataset.edge)).length;
    note.querySelector('span').textContent='Вариант будет убран'+(used?' · от него зависит '+countWords(used,['переход','перехода','переходов']):'');
    note.querySelector('button').focus();
  }else row.querySelector('.choice-label').focus();
  numberChoiceRows();
}

function saveWrittenChoice(form,ctx) {
  const error=form.querySelector('.writer-error');
  function fail(message){error.textContent=message;error.hidden=false;}
  const p=project(), parent=nodeById(ctx.source);
  let choice=nodeById(ctx.id);
  if(p.id!==ctx.projectId || !chapterById(ctx.chapter) || (ctx.id&&choice?.type!=='choice') || (ctx.source&&!parent)){
    fail('Исходная сцена изменилась. Откройте её на карте.');return;
  }
  const question=form.elements.question, typedTitle=question.value.trim();
  const title=choice&&typedTitle===question.defaultValue.trim()?choice.title:typedTitle;
  const edits=[], removed=new Set();
  for(const row of form.querySelectorAll('.choice-row')){
    const edge=row.dataset.edge?p.edges.find(e=>e.id===row.dataset.edge&&e.from===ctx.id):null;
    if(row.classList.contains('is-removed')){if(edge)removed.add(edge.id);continue;}
    const field=row.querySelector('.choice-label'), typedLabel=field.value.trim();
    const kind=row.querySelector('.outcome-mode').value, sameTarget=kind==='existing'&&row.dataset.destination===row.dataset.originalTarget;
    const sameLabel=typedLabel===field.defaultValue.trim();
    if(row.dataset.edge&&sameTarget&&sameLabel)continue;
    if(row.dataset.edge&&!edge){fail('Этот вариант удалён в другой вкладке. Скопируйте его текст в новый вариант.');return;}
    const label=edge&&sameLabel?edge.label:typedLabel;
    const name=row.querySelector('.outcome-title input').value.trim();
    const dest=kind==='existing'?nodeById(edge&&sameTarget?edge.to:row.dataset.destination):null;
    if(kind==='existing'&&!dest){
      row.querySelector('details').open=true;refreshChoiceTarget(row);
      fail('Выберите сцену для этого варианта.');row.querySelector('.writer-search input')?.focus();return;
    }
    if(!edge&&!label&&!name&&!dest)continue;
    if(!edge || edge.label!==label || edge.to!==dest?.id)edits.push({edge,kind,label,name,dest});
  }
  if(choice&&choice.title===title&&!edits.length&&!removed.size){closeModal();return;}
  const created=!choice, localNodes=[];
  if(narrowMap.matches)prepareNarrowMap(p.nodes.filter(n=>n.chapter===ctx.chapter));
  changeProject(()=>{
    if(!choice){
      choice=appendPlacedNode(p,ctx.chapter,'choice',title,parent,ctx.side,ctx.spot);
      if(parent){const incoming=makeEdge(parent.id,choice.id);if(ctx.side)setEndpoints(incoming,ctx.side,opposite[ctx.side]);p.edges.push(incoming);}
    }else choice.title=title;
    if(removed.size)p.edges=p.edges.filter(e=>!removed.has(e.id));
    for(const edit of edits){
      const dest=edit.dest||appendPlacedNode(p,ctx.chapter,edit.kind,edit.name||edit.label||freshTitles[edit.kind],choice);
      if(!edit.dest)localNodes.push(dest);
      if(edit.edge){
        if(edit.edge.to!==dest.id)delete edit.edge.ports;
        edit.edge.to=dest.id;edit.edge.label=edit.label;
      }else p.edges.push(makeEdge(choice.id,dest.id,edit.label));
    }
  });
  refreshAfterWriting=false;closeModal();
  if(ui.page==='timeline'&&!created){renderAll();}
  else {
    ui.page='map';ui.selected=choice.id;ui.chapter=ctx.chapter;ui.source=null;ui.tool='pointer';
    renderAll();
    if(created)fitGraph(true,[...(parent?[parent]:[]),choice,...localNodes]);
    revealNode(choice);
  }
  toast(created?'Выбор добавлен на карту':'Варианты сохранены');
}
