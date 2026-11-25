function chapterName(id) {
  const index=project().chapters.findIndex(c=>c.id===id);
  return index<0?'':`Глава ${index+1} · ${project().chapters[index].title}`;
}
function ruleCaption(rule) {
  if(rule.kind==='node') {
    const n=nodeById(rule.ref);
    return n?`Узел «${n.title}» ${rule.seen?'посещён':'пропущен'}`:'Узел условия удалён';
  }
  const edge=project().edges.find(e=>e.id===rule.ref);
  if(!edge)return 'Переход условия удалён';
  const label=edge.label||nodeById(edge.to).title;
  return `В узле «${nodeById(edge.from).title}» ${rule.seen?'выбран':'пропущен'} переход «${label}»`;
}
function ruleOptions(kind,selected,editingEdge) {
  const p=project(), byChapter=new Map(p.chapters.map(c=>[c.id,[]])), nodes=new Map(p.nodes.map(n=>[n.id,n]));
  if(kind==='node'){
    for(const n of p.nodes)byChapter.get(n.chapter).push([n.id,n.title]);
  }else{
    for(const edge of p.edges){
      if(edge.id===editingEdge)continue;
      const source=nodes.get(edge.from),dest=nodes.get(edge.to);
      byChapter.get(source.chapter).push([edge.id,`${source.title} → ${edge.label||dest.title}`]);
    }
  }
  const groups=p.chapters.map(c=>{
    const items=byChapter.get(c.id);
    if(!items.length)return '';
    return `<optgroup label="${esc(chapterName(c.id))}">${items.map(([id,title])=>`<option value="${idAttr(id)}" ${selected===id?'selected':''}>${esc(title)}</option>`).join('')}</optgroup>`;
  }).join('');
  return '<option value="">Выберите событие</option>'+groups;
}
function ruleRow(rule={kind:'edge',seen:true,ref:''},editingEdge) {
  const tests=[['edge-yes','Выбран переход'],['edge-no','Пропущен переход'],['node-yes','Посещён узел'],['node-no','Пропущен узел']];
  const test=rule.kind+'-'+(rule.seen?'yes':'no');
  return `<div class="rule-row"><div class="rule-row-top"><select class="rule-test" aria-label="Что проверить">${tests.map(([id,label])=>`<option value="${id}" ${test===id?'selected':''}>${label}</option>`).join('')}</select>${iconButton('remove-rule','x','Убрать условие')}</div><select class="rule-ref" required aria-label="Событие для условия">${ruleOptions(rule.kind,rule.ref,editingEdge)}</select></div>`;
}
function rulesEditor(edge) {
  const rules=edge?.rules||[];
  return `<section class="rules-editor"><div class="section-line"><h3>${icon('branch',15)}Условия перехода</h3><button type="button" class="text-action" data-action="add-rule">${icon('plus',14)}Условие</button></div>
    <p class="rule-empty" ${rules.length?'hidden':''}>Переход доступен при любом прохождении.</p><label class="rule-mode" ${rules.length<2?'hidden':''}>Учитывать<select name="ruleMode" aria-label="Сочетание условий"><option value="all">Все условия</option><option value="any" ${edge?.ruleMode==='any'?'selected':''}>Любое из условий</option></select></label>
    <div class="rule-rows">${rules.map(r=>ruleRow(r,edge.id)).join('')}</div></section>`;
}
function refreshRuleControls(form) {
  const count=form.querySelectorAll('.rule-row').length;
  form.querySelector('.rule-empty').hidden=count>0;
  form.querySelector('.rule-mode').hidden=count<2;
}
function readRules(form) {
  return [...form.querySelectorAll('.rule-row')].map(row=>{
    const [kind,state]=row.querySelector('.rule-test').value.split('-');
    return {kind,ref:row.querySelector('.rule-ref').value,seen:state==='yes'};
  });
}
function startReading() {
  const start=project().chapters.find(c=>c.start)?.start;
  if (!start) { toast('Добавьте первый узел, чтобы пройти историю'); return; }
  playSession={start,path:[{node:start,via:null}]}; renderReading();
}
function followEdge(id) {
  if(!playSession)return;
  const edge=project().edges.find(e=>e.id===id);
  if(!edge||edge.from!==playSession.path.at(-1).node||!transitionOpen(edge,readingMemory(project(),playSession.path)))return;
  playSession.path.push({node:edge.to,via:edge.id});
  renderReading();
}
function renderReading() {
  const n=nodeById(playSession.path.at(-1).node), outgoing=project().edges.filter(e=>e.from===n.id);
  const memory=readingMemory(project(),playSession.path), eligible=outgoing.filter(e=>transitionOpen(e,memory));
  const conditional=outgoing.filter(e=>e.rules?.length);
  const explanation=conditional.length?`<details class="route-check"><summary>Проверить условия</summary>${conditional.map(e=>`<div><b>${esc(e.label||nodeById(e.to).title)}</b><small>${e.ruleMode==='any'?'Достаточно одного условия':'Нужны все условия'}</small>${e.rules.map(rule=>`<p class="${ruleMet(rule,memory)?'met':'unmet'}">${icon(ruleMet(rule,memory)?'check':'x',13)}${esc(ruleCaption(rule))}</p>`).join('')}</div>`).join('')}</details>`:'';
  const end=outgoing.length?'На этом маршруте нет доступного перехода':'Конец ветки';
  const choices=eligible.map(e=>{
    const dest=nodeById(e.to);
    return `<button data-action="read-next" data-id="${idAttr(e.id)}"><span>${esc(e.label||dest.title)}${n.chapter!==dest.chapter?'<small>'+esc(chapterName(dest.chapter))+'</small>':''}</span>${icon('arrow',16)}</button>`;
  }).join('');
  const body=`<div class="reader-image ${n.art==='radio'?'receiver':project().artwork?'forest':'abstract'}"><span>${typeTag(n.type)}</span></div>
    <div class="reader-body"><div class="reader-location">${esc(chapterName(n.chapter))} <span> / </span> #${pad(n.no)}</div><h3>${esc(n.title)}</h3>${n.description?'<p class="reader-description">'+esc(n.description)+'</p>':''}
    ${n.lines.length?'<div class="reader-lines">'+n.lines.map(l=>`<div><b>${esc(l.speaker||'Рассказчик')}</b><p>${esc(l.text)}</p></div>`).join('')+'</div>':''}
    <div class="reader-choices">${choices||'<div class="reader-end">'+icon('ending',16)+end+'</div>'}</div>${explanation}</div>
    <div class="reader-controls"><button class="quiet-button" data-action="read-back" ${playSession.path.length<2?'disabled':''}>${icon('arrow-left',15)}Назад</button><button class="quiet-button" data-action="read-restart">${icon('reset',14)}Сначала</button><button class="quiet-button" data-action="jump" data-id="${idAttr(n.id)}">${icon('map',14)}К узлу</button></div>`;
  modal('Прохождение истории',body,'reader-modal');
}
