const TIMELINE_CARD = {width:164,height:74,stepX:218,stepY:94,pad:24,top:118};
const BAND_COLORS = ['#bfa7ec','#83c5b6','#d9b17e','#8eafdc','#da9ba9','#aac18f'];
let overview = {};
let lastDiagram = ui.page;

function resetOverview() {
  overview = {projectId:project().id,path:null,zoom:null,left:0,top:0,showLore:true,layout:null};
}

function chapterColumns(nodes,chapter,index) {
  const local = new Set(nodes.map(n=>n.id)), degree = new Map(), depth = new Map();
  const ordered = [...nodes].sort((a,b)=>(b.id===chapter.start)-(a.id===chapter.start) || a.x-b.x || a.y-b.y || a.no-b.no);
  for (const n of ordered) {
    degree.set(n.id,index.incoming.get(n.id).filter(e=>local.has(e.from)&&e.from!==n.id).length);
    depth.set(n.id,0);
  }
  const queue = ordered.filter(n=>degree.get(n.id)===0).map(n=>n.id), done=new Set(), columns=[];
  let head=0, fallback=0;
  while (done.size<ordered.length) {
    if (head===queue.length) {
      // An authored loop still needs an entry column.
      while (done.has(ordered[fallback].id)) fallback++;
      queue.push(ordered[fallback].id);
    }
    const id=queue[head++];
    if (done.has(id)) continue;
    done.add(id);
    const col=depth.get(id);
    (columns[col]??=[]).push(index.nodes.get(id));
    for (const edge of index.outgoing.get(id)) {
      if (!local.has(edge.to)||done.has(edge.to)) continue;
      depth.set(edge.to,Math.max(depth.get(edge.to),col+1));
      degree.set(edge.to,degree.get(edge.to)-1);
      if (!degree.get(edge.to)) queue.push(edge.to);
    }
  }
  for (const column of columns) column.sort((a,b)=>a.y-b.y||a.no-b.no);
  return columns;
}

function layoutTimeline(p,index) {
  const byChapter=new Map(p.chapters.map(c=>[c.id,[]])), lore=new Map(p.lore.map(l=>[l.id,l]));
  for (const n of p.nodes) byChapter.get(n.chapter).push(n);
  const cards=new Map(), usedLore=new Set(), bands=[];
  const s=TIMELINE_CARD;
  let x=0, height=0;
  p.chapters.forEach((chapter,i)=>{
    const nodes=byChapter.get(chapter.id), columns=chapterColumns(nodes,chapter,index);
    const rows=columns.reduce((max,col)=>Math.max(max,col.length),1);
    const width=Math.max(268,(Math.max(1,columns.length)-1)*s.stepX+s.width+s.pad*2);
    const loreIds=new Set(nodes.flatMap(n=>n.lore));
    for (const id of loreIds) usedLore.add(id);
    const band={chapter,i,x,width,nodes,lore:[...loreIds].map(id=>lore.get(id)).filter(Boolean),color:BAND_COLORS[i%BAND_COLORS.length]};
    bands.push(band);
    const graphTop=overview.showLore?s.top:s.top-34;
    columns.forEach((column,col)=>{
      column.forEach((n,row)=>cards.set(n.id,{x:x+s.pad+col*s.stepX,y:graphTop+((rows-column.length)/2+row)*s.stepY}));
    });
    x+=width;
    height=Math.max(height,graphTop+(rows-1)*s.stepY+s.height+34);
  });
  return {index,bands,cards,width:x,height,graphTop:overview.showLore?s.top:s.top-34,unassigned:p.lore.filter(l=>!usedLore.has(l.id))};
}

function timelineWire(a,b,ordinal,portOffset,graphTop) {
  const w=TIMELINE_CARD.width,h=TIMELINE_CARD.height;
  const x=a.x+w,y=a.y+h/2+portOffset,tx=b.x,ty=b.y+h/2+portOffset;
  if (tx>x && tx-x<TIMELINE_CARD.stepX-w+65) {
    const dx=Math.min(110,(tx-x)*.50);
    return `M ${x} ${y} C ${x+dx} ${y}, ${tx-dx} ${ty}, ${tx-2} ${ty}`;
  }
  const bend=11+(ordinal%3)*3, lift=graphTop-bend;
  return `M ${x} ${y} Q ${x+bend} ${y} ${x+bend} ${y-bend} V ${lift+bend} Q ${x+bend} ${lift} ${x} ${lift} H ${tx} Q ${tx-bend} ${lift} ${tx-bend} ${lift+bend} V ${ty-bend} Q ${tx-bend} ${ty} ${tx-2} ${ty}`;
}

function timelineBand(band) {
  const {chapter,i,x,width,color,lore}=band;
  const chip=l=>`<button class="band-chip kind-${l.kind}" data-action="edit-lore" data-id="${idAttr(l.id)}" title="${esc(LORE_KINDS[l.kind].name+' · '+l.title)}">${icon(LORE_KINDS[l.kind].icon,12)}<span>${esc(l.title)}</span></button>`;
  return `<section class="timeline-band" data-band="${idAttr(chapter.id)}" aria-label="${esc(chapterName(chapter.id))}" style="left:${x}px;width:${width}px;--band-color:${color}">
    <header class="band-head"><span class="band-number">Глава ${pad(i+1)}</span><div><h3>${esc(chapter.title)}</h3><button class="band-open" data-action="chapter" data-id="${idAttr(chapter.id)}" aria-label="Открыть карту главы ${i+1}" title="Открыть карту главы">${icon('map',16)}</button></div></header>
    ${overview.showLore && lore.length?`<div class="band-lore" aria-label="Лор главы ${i+1}">${lore.map(chip).join('')}</div>`:''}
    ${band.nodes.length?'':`<button class="empty-band" data-action="timeline-first" data-id="${idAttr(chapter.id)}">${icon('plus',15)}Добавить первую сцену</button>`}
  </section>`;
}

function timelineCard(n,point,index,memory,tip) {
  const incoming=index.incoming.get(n.id), label=incoming.length===1?incoming[0].label:'';
  const onPath=memory?.visited.has(n.id);
  const caption=label?`<small title="${esc(label)}">${icon('branch',10)}${esc(label)}</small>`:'';
  return `<article class="timeline-card${memory?(onPath?' on-path':' off-path'):''}${tip===n.id?' path-tip':''}" data-scene="${idAttr(n.id)}" style="left:${point.x}px;top:${point.y}px;${typedStyle(n)}">
    <button class="timeline-scene" data-action="jump" data-id="${idAttr(n.id)}" title="${esc('Открыть сцену «'+n.title+'» в главе')}">${typeTag(n.type)}<strong>${esc(n.title)}</strong>${caption}</button>
    <button class="scene-eye" data-action="trace-to" data-id="${idAttr(n.id)}" aria-label="${esc('Показать путь к сцене «'+n.title+'»')}" title="Показать путь к этой сцене">${icon(onPath?'check':'eye',14)}</button></article>`;
}

function timelineEdges(p,layout,memory) {
  const pairs=new Map(), offsets=new Map();
  for (const edge of p.edges) {
    if(!pairs.has(edge.from))pairs.set(edge.from,new Map());
    const targets=pairs.get(edge.from);
    if(!targets.has(edge.to))targets.set(edge.to,[]);
    targets.get(edge.to).push(edge.id);
  }
  for (const targets of pairs.values()) for (const group of targets.values()) {
    group.forEach((id,i)=>offsets.set(id,(i-(group.length-1)/2)*Math.min(14,46/group.length)));
  }
  const lines=p.edges.map((edge,i)=>{
    const onPath=memory?.chosen.has(edge.id);
    const name=edge.label || layout.index.nodes.get(edge.to).title;
    const d=timelineWire(layout.cards.get(edge.from),layout.cards.get(edge.to),i,offsets.get(edge.id),layout.graphTop);
    return {onPath,html:`<g class="timeline-edge${memory?(onPath?' on-path':' off-path'):''}" data-wire="${idAttr(edge.id)}"><path class="timeline-line" d="${d}" marker-end="url(#timeline-${onPath?'active':'arrow'})"/><path class="timeline-hit" d="${d}" data-action="trace-edge" data-id="${idAttr(edge.id)}" role="button" tabindex="0" aria-label="${esc('Выделить переход «'+name+'»')}"><title>${esc(name)}</title></path></g>`};
  });
  const marker=(id,color)=>`<marker id="timeline-${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4 0 8 2 4Z" fill="${color}"/></marker>`;
  return `<svg class="timeline-wires" width="${layout.width}" height="${layout.height}" aria-label="Переходы между сценами"><defs>${marker('arrow','#9488a6')}${marker('active','#97e4c5')}</defs>${lines.filter(l=>!l.onPath).map(l=>l.html).join('')}${lines.filter(l=>l.onPath).map(l=>l.html).join('')}</svg>`;
}

function routeStrip(p,index,memory) {
  const path=overview.path;
  if (!path) return '';
  const last=index.nodes.get(path.at(-1).node), outgoing=index.outgoing.get(last.id);
  const options=outgoing.filter(edge=>transitionOpen(edge,memory));
  let status=options.length?'Продолжить ветку':last.type==='ending'?'Финал':outgoing.length?'Нет доступных переходов':'Конец ветки';
  if(path[0].node!==p.chapters.find(c=>c.start)?.start)status+=' · от «'+index.nodes.get(path[0].node).title+'»';
  const back=previousFork(p,index,path);
  return `<div class="route-strip"><div class="route-location" aria-live="polite">${icon('eye',18)}<span><small>${esc(status)}</small><strong>${esc(last.title)}</strong></span></div>
    <div class="route-options">${options.map(edge=>`<button data-action="trace-edge" data-id="${idAttr(edge.id)}">${esc(edge.label||index.nodes.get(edge.to).title)}${icon('arrow',13)}</button>`).join('')}</div>
    ${path.length>1?`<button class="route-back" data-action="trace-back" title="Вернуться к предыдущему выбору">${icon('undo',14)}${back<0?'Шаг назад':'К развилке'}</button>`:''}</div>`;
}

function renderTimeline(index) {
  const p=project();
  const layout=layoutTimeline(p,index);
  overview.layout=layout;
  const memory=overview.memory;
  const unassigned=overview.showLore&&layout.unassigned.length?`<div class="loose-lore"><button data-action="loose-lore">${icon('book',14)}Общий лор <b>${layout.unassigned.length}</b></button><div>${layout.unassigned.map(l=>`<button class="band-chip kind-${l.kind}" data-action="edit-lore" data-id="${idAttr(l.id)}">${icon(LORE_KINDS[l.kind].icon,12)}<span>${esc(l.title)}</span></button>`).join('')}</div></div>`:'';
  byId('workspace').innerHTML=`${routeStrip(p,index,memory)}
    <div class="timeline-scroll" id="timeline-scroll" tabindex="0" role="region" aria-label="Шкала сюжета по главам"><div class="timeline-sheet"><div class="timeline-board" style="width:${layout.width}px;height:${layout.height}px">
      ${layout.bands.map(timelineBand).join('')}
    </div></div></div>${unassigned}
    <div class="timeline-foot"><label class="band-selector">${icon('timeline',16)}<select id="timeline-chapter" aria-label="Перейти к главе на шкале">${layout.bands.map(b=>`<option value="${idAttr(b.chapter.id)}">${esc(chapterName(b.chapter.id))}</option>`).join('')}</select></label>
      <div class="timeline-camera">${iconButton('timeline-out','minus','Уменьшить шкалу')}<button data-action="timeline-actual" id="timeline-percent" title="Масштаб 100%"></button>${iconButton('timeline-in','plus','Увеличить шкалу')}${iconButton('timeline-fit','fit','Уместить всю историю')}</div></div>`;
  const pane=byId('timeline-scroll');
  const board=pane.querySelector('.timeline-board');
  const loreHeight=[...board.querySelectorAll('.band-lore')].reduce((max,row)=>Math.max(max,row.offsetHeight),0);
  const graphTop=loreHeight?Math.max(TIMELINE_CARD.top,72+loreHeight+20):TIMELINE_CARD.top-34;
  const shift=graphTop-layout.graphTop;
  for(const pos of layout.cards.values())pos.y+=shift;
  layout.height+=shift;
  layout.graphTop=graphTop;
  board.style.height=layout.height+'px';
  board.style.setProperty('--graph-top',graphTop+'px');
  board.insertAdjacentHTML('beforeend',timelineEdges(p,layout,memory)+p.nodes.map(n=>timelineCard(n,layout.cards.get(n.id),index,memory,overview.path?.at(-1).node)).join(''));
  if (overview.zoom===null) overview.zoom=Math.max(narrowMap.matches ? .9 : .77,Math.min(1,(pane.clientWidth-20)/layout.width,(pane.clientHeight-12)/layout.height));
  sizeTimeline();
  pane.scrollTo(overview.left,overview.top);
  pane.addEventListener('scroll',rememberTimelineView);
  rememberTimelineView();
  enableTimelinePan(pane);
}

function sizeTimeline() {
  const {layout,zoom}=overview, sheet=byId('timeline-scroll').firstElementChild;
  sheet.style.width=layout.width*zoom+'px';
  sheet.style.height=layout.height*zoom+'px';
  sheet.firstElementChild.style.transform=`scale(${zoom})`;
  byId('timeline-percent').textContent=Math.round(zoom*100)+'%';
}

function rememberTimelineView() {
  const pane=byId('timeline-scroll');
  if (!pane || !overview.layout || overview.projectId!==project().id) return;
  overview.left=pane.scrollLeft; overview.top=pane.scrollTop;
  if(overview.bandAnchor && Math.abs(pane.scrollLeft-overview.bandAnchor.left)<2 && overview.layout.bands.some(b=>b.chapter.id===overview.bandAnchor.id)) {
    byId('timeline-chapter').value=overview.bandAnchor.id;
    return;
  }
  overview.bandAnchor=null;
  const x=(pane.scrollLeft+Math.min(75,pane.clientWidth/3))/overview.zoom;
  const band=overview.layout.bands.find(b=>b.x+b.width>x) || overview.layout.bands.at(-1);
  byId('timeline-chapter').value=band.chapter.id;
}

function scrollToTimelineChapter(id) {
  const pane=byId('timeline-scroll'), band=overview.layout.bands.find(b=>b.chapter.id===id);
  if (!band) return;
  pane.scrollTo(band.x*overview.zoom,0);
  overview.bandAnchor={id,left:pane.scrollLeft};
  rememberTimelineView();
  const section=[...pane.querySelectorAll('[data-band]')].find(el=>el.dataset.band===id);
  const heading=section?.querySelector('.band-head h3');
  if (heading && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    heading.animate([{color:band.color},{color:'#f3edf4'}],{duration:750});
  }
}

function zoomTimeline(scale,fit=false,point=null) {
  const pane=byId('timeline-scroll'), layout=overview.layout;
  const anchor=point||{x:pane.clientWidth/2,y:pane.clientHeight/2}, sheet=pane.firstElementChild;
  const before=sheet.getBoundingClientRect(), rect=pane.getBoundingClientRect();
  const x=(rect.left+anchor.x-before.left)/overview.zoom, y=(rect.top+anchor.y-before.top)/overview.zoom;
  const fitScale=Math.min(1.3,(pane.clientWidth-12)/layout.width,(pane.clientHeight-8)/layout.height);
  overview.zoom=fit?fitScale:Math.max(Math.min(.15,fitScale),Math.min(2.2,scale));
  sizeTimeline();
  if (fit) pane.scrollTo(0,0);
  else {const after=sheet.getBoundingClientRect(); pane.scrollBy(after.left-rect.left+x*overview.zoom-anchor.x,after.top-rect.top+y*overview.zoom-anchor.y);}
  rememberTimelineView();
}

function enableTimelinePan(pane) {
  let drag=null;
  pane.addEventListener('pointerdown',e=>{
    if (e.pointerType!=='mouse'||e.button>1||e.target.closest('button,select,[data-action]')) return;
    drag={x:e.clientX,y:e.clientY,left:pane.scrollLeft,top:pane.scrollTop};
    pane.setPointerCapture(e.pointerId); pane.classList.add('panning'); e.preventDefault();
  });
  pane.addEventListener('pointermove',e=>{if(drag)pane.scrollTo(drag.left+drag.x-e.clientX,drag.top+drag.y-e.clientY);});
  pane.addEventListener('lostpointercapture',()=>{drag=null;pane.classList.remove('panning');});
  pane.addEventListener('wheel',e=>{
    if (e.ctrlKey||e.metaKey) {
      e.preventDefault();
      const box=pane.getBoundingClientRect();
      zoomTimeline(overview.zoom*Math.exp(-Math.max(-180,Math.min(180,e.deltaY))*.0025),false,{x:e.clientX-box.left,y:e.clientY-box.top});
    } else if (!e.shiftKey && !e.deltaX && pane.scrollHeight<=pane.clientHeight+1 && pane.scrollWidth>pane.clientWidth) {
      e.preventDefault(); pane.scrollLeft+=e.deltaY*(e.deltaMode===1?16:1);
    }
  },{passive:false});
}

function showTimelinePath(path,reveal=true) {
  if (overview.projectId!==project().id) resetOverview();
  const action=document.activeElement?.dataset.action, id=document.activeElement?.dataset.id;
  overview.path=path;
  ui.page='timeline';
  renderAll();
  if (path && reveal) {
    const card=Array.from(byId('timeline-scroll').querySelectorAll('[data-scene]')).find(el=>el.dataset.scene===path.at(-1).node);
    card?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  if(action && ['trace-edge','trace-to','trace-back','trace-toggle','read-route'].includes(action)) {
    const buttons=[...document.querySelectorAll('button[data-action]')];
    const focus=buttons.find(b=>b.dataset.action===action && b.dataset.id===id)
      || document.querySelector('.route-options button, .route-back, [data-action="trace-toggle"]');
    focus?.focus({preventScroll:true});
  }
}

function startTimelinePath() {
  if (overview.path) {showTimelinePath(null);return;}
  const p=project(), start=p.chapters.find(c=>c.start)?.start;
  if (start) showTimelinePath(followUnambiguous(p,storyIndex(p),[{node:start,via:null}]));
}

function traceTimeline(id,isEdge) {
  const p=project(), index=ui.page==='timeline'?overview.layout.index:storyIndex(p), edge=isEdge?index.edges.get(id):null;
  const target=edge?edge.from:id;
  let path=null;
  if (overview.path) {
    const at=overview.path.findLastIndex(step=>step.node===target);
    if (at>=0) {
      const prefix=overview.path.slice(0,at+1);
      if (!edge || transitionOpen(edge,readingMemory(p,prefix))) {
        path=prefix;
        if (edge) path.push({node:edge.to,via:edge.id});
      }
    }
  }
  if (!path) {
    const result=findStoryPath(p,index,target,edge);
    if (!result.path) {
      toast(result.limited?'Слишком много сочетаний. Выберите шаги через «Выделить ветку».':'Условия закрывают этот путь. Проверьте переходы в карте главы.');
      return;
    }
    path=result.path;
  }
  showTimelinePath(edge?followUnambiguous(p,index,path):path);
}

function openLooseLore() {
  modal('Общий лор',`<div class="modal-body timeline-lore-list">${overview.layout.unassigned.map(l=>`<button class="quiet-button" data-action="edit-lore" data-id="${idAttr(l.id)}">${loreChip(l)}<span>${esc(l.description)}</span>${icon('chevron-right',14)}</button>`).join('')}</div>`);
}
