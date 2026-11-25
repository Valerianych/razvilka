const NODE_W = 214;
const NODE_H = { scene:105, choice:109, dialogue:105, ending:105 };
const narrowMap = window.matchMedia('(max-width:620px)');
const desktopShape = n => ({w:NODE_W,h:n.art === 'radio' ? 177 : NODE_H[n.type]});
const shape = n => narrowMap.matches ? {w:220,h:n.art==='radio'?104:76} : desktopShape(n);
const narrowPositions = new Map(), topPorts = new Set();
const pointFor = n => narrowMap.matches ? n.mobile || narrowPositions.get(n.id) || n : n;
function prepareNarrowMap(nodes) {
  narrowPositions.clear(); topPorts.clear();
  if(!narrowMap.matches || !nodes.length)return;
  const edges=chapterEdges(), bySource=new Map(), local=new Map(nodes.map(n=>[n.id,n]));
  for(const edge of edges){if(!bySource.has(edge.from))bySource.set(edge.from,[]);bySource.get(edge.from).push(edge.to);}
  const start=chapterById(ui.chapter).start;
  const stack=[...nodes.map(n=>({id:n.id,depth:0,top:true})).reverse(),{id:start,depth:0,top:true}];
  let y=0;
  while(stack.length){
    const {id,depth,top}=stack.pop(), n=local.get(id);
    if(!n||narrowPositions.has(id))continue;
    narrowPositions.set(id,{x:depth*48,y});
    if(top)topPorts.add(id);
    y+=shape(n).h+33;
    const children=bySource.get(id)||[], fork=children.length>1;
    for(let i=children.length-1;i>=0;i--)stack.push({id:children[i],depth:Math.min(2,depth+Number(fork)),top:!fork});
  }
}
const typedStyle = n => `--node-color:${NODE_TYPES[n.type].color}`;
const idAttr = value => escapeHtml(value);
const mapPane = () => document.getElementById('map-pane');
const stage = () => document.getElementById('world');
const boxFor = n => document.getElementById('card-' + n.id);
let dragging = null, mapResize = null, lastPaneSize = null, spaceDown = false;
function iconButton(action, glyph, label, extra = '') {
  return `<button type="button" class="icon-button" data-action="${action}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${extra}>${icon(glyph,17)}</button>`;
}
function typeTag(type) {
  const info = NODE_TYPES[type];
  return `<span class="type-tag" style="--node-color:${info.color}">${icon(info.icon,13)}${info.name}</span>`;
}
function graphBounds(nodes = chapterNodes()) {
  if (!nodes.length) return { x:0, y:0, w:500, h:320 };
  const x = Math.min(...nodes.map(n => pointFor(n).x)), y = Math.min(...nodes.map(n => pointFor(n).y));
  return { x,y,w:Math.max(...nodes.map(n => pointFor(n).x + shape(n).w)) - x,h:Math.max(...nodes.map(n => pointFor(n).y + shape(n).h)) - y };
}
function fitGraph(initial = false) {
  const pane = mapPane(); if (!pane) return;
  const b = graphBounds(), w = pane.clientWidth, h = pane.clientHeight;
  const top = narrowMap.matches ? 60 : 39, bottom = narrowMap.matches ? 43 : 50, side = w > 660 ? 36 : 18;
  camera.scale = Math.max(.2,Math.min(initial ? 1.08 : 1.22,(w-side*2)/b.w,(h-top-bottom)/b.h));
  if(initial && narrowMap.matches)camera.scale=Math.max(.88,camera.scale);
  camera.x = (w - b.w * camera.scale)/2 - b.x*camera.scale;
  camera.y = top + Math.max(0,(h-top-bottom-b.h*camera.scale)/2) - b.y*camera.scale;
  applyCamera();
}
function applyCamera() {
  const world = stage(), pane = mapPane(); if (!world || !pane) return;
  world.style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
  pane.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
  const dotSpace = 22 * camera.scale;
  pane.style.backgroundSize = `${dotSpace}px ${dotSpace}px`;
  const zoom = document.getElementById('zoom-value');
  if (zoom) zoom.textContent = Math.round(camera.scale * 100) + '%';
  drawMinimap();
}
function zoomBy(factor, point) {
  const pane = mapPane(); if (!pane) return;
  const pivot = point || { x:pane.clientWidth/2, y:pane.clientHeight/2 };
  const next = Math.max(.17,Math.min(2.3,camera.scale*factor));
  camera.x = pivot.x - (pivot.x-camera.x)*next/camera.scale;
  camera.y = pivot.y - (pivot.y-camera.y)*next/camera.scale;
  camera.scale = next; applyCamera();
}
function revealNode(n) {
  const pane = mapPane(); if (!pane) return;
  const b = shape(n), pos=pointFor(n), x = pos.x*camera.scale+camera.x, y = pos.y*camera.scale+camera.y;
  if (x < 10 || y < 10 || x+b.w*camera.scale > pane.clientWidth-10 || y+b.h*camera.scale > pane.clientHeight-25) {
    camera.x = pane.clientWidth/2 - (pos.x+b.w/2)*camera.scale;
    camera.y = pane.clientHeight/2 - (pos.y+b.h/2)*camera.scale;
    applyCamera();
  }
}
function cardMarkup(n) {
  const selected = n.id === ui.selected, b = shape(n), pos=pointFor(n);
  const outputs = project().edges.filter(e => e.from === n.id).length;
  const footer = n.type === 'choice' ? icon('branch',13) + countWords(outputs,['вариант','варианта','вариантов'])
    : n.type === 'dialogue' && n.lines.length ? icon('bubbles',13) + lineCount(n.lines.length)
    : n.type === 'ending' ? icon('ending',13) + 'Конец ветки' : '';
  const start = chapterById(ui.chapter)?.start === n.id;
  return `<article id="card-${idAttr(n.id)}" class="node-card node-${n.type}${selected ? ' selected' : ''}${n.art ? ' illustrated' : ''}${topPorts.has(n.id)?' top-port':''}" style="left:${pos.x}px;top:${pos.y}px;width:${b.w}px;height:${b.h}px;${typedStyle(n)}" data-node="${idAttr(n.id)}" role="button" tabindex="0" aria-label="${escapeHtml(NODE_TYPES[n.type].name+' '+n.title)}" aria-pressed="${selected}">
    ${start ? '<div class="start-label">'+icon('play',10)+'Начало</div>' : ''}
    ${n.art === 'radio' ? '<div class="node-art" role="img" aria-label="Старый приёмник в лесной сторожке"></div>' : ''}
    <div class="node-content"><div class="node-meta">${typeTag(n.type)}<span class="node-number">${n.important?'<span class="important-mark" title="Ключевой момент" aria-label="Ключевой момент">'+icon('spark',12)+'</span>':''}#${pad(n.no)}</span></div>
    <h3>${escapeHtml(n.title || 'Без названия')}</h3>
    ${footer ? '<div class="node-detail">'+footer+'</div>' : '<p class="node-summary">'+escapeHtml(n.description)+'</p>'}</div>
    <button class="port in" data-action="port-in" data-id="${idAttr(n.id)}" tabindex="-1" aria-label="Вход узла"></button>
    <button class="port out" data-action="port-out" data-id="${idAttr(n.id)}" tabindex="-1" title="Создать переход" aria-label="Создать переход"></button>
  </article>`;
}
function renderMap() {
  const nodes = chapterNodes();
  prepareNarrowMap(nodes);
  document.getElementById('workspace').innerHTML = `<section class="map-pane" id="map-pane" aria-label="Интерактивная карта сюжета" tabindex="0">
    <div id="world" class="world"><svg id="edges" class="edge-layer" aria-hidden="true"></svg><div id="edge-labels"></div><div id="nodes">${nodes.map(cardMarkup).join('')}</div></div>
    <div class="canvas-tools floating" role="toolbar" aria-label="Инструменты карты">
      ${iconButton('tool','pointer','Выделение (V)','data-tool="pointer"') }
      ${iconButton('tool','hand','Перемещение карты (H)','data-tool="hand"')}
      <span class="tool-divider"></span>${iconButton('tool','link','Связать узлы (C)','data-tool="link"')}
    </div>
    <div id="link-note" class="link-note" hidden></div>
    <button id="show-inspector" class="show-inspector floating icon-button" data-action="show-inspector" title="Открыть детали узла" aria-label="Открыть детали узла">${icon('panel')}</button>
    ${!nodes.length ? '<div class="empty-map"><div class="empty-symbol">'+icon('map',30)+'</div><h3>С чего начнётся история?</h3><p>Добавьте первую сцену этой главы.</p><button class="btn primary" data-action="add-node">'+icon('plus',16)+'Добавить узел</button></div>' : ''}
    <div class="camera-controls floating">${iconButton('zoom-out','minus','Уменьшить масштаб')}<button id="zoom-value" class="zoom-number" data-action="actual-size" title="Масштаб 100%">100%</button>${iconButton('zoom-in','plus','Увеличить масштаб')}<span class="tool-divider"></span>${iconButton('fit','fit','Показать всю карту (F)')}</div>
    ${nodes.length ? '<button id="minimap" class="minimap" data-action="minimap" title="Перейти в эту область карты" aria-label="Мини-карта. Перейти в эту область"><svg id="mini-svg" aria-hidden="true"></svg></button>' : ''}
    </section><aside id="inspector" class="inspector" aria-label="Детали узла"></aside>`;
  drawEdges(); renderInspector(); syncMapTools(); applyCamera();
  const pane = mapPane();
  pane.addEventListener('pointerdown',beginMapDrag);
  pane.addEventListener('pointermove',moveMapDrag);
  pane.addEventListener('pointerup',endMapDrag);
  pane.addEventListener('pointercancel',cancelMapDrag);
  pane.addEventListener('wheel',wheelMap,{passive:false});
  pane.addEventListener('dblclick',e => { if (e.target === pane && ui.tool === 'pointer') { const r=pane.getBoundingClientRect(); openNodeForm(null,{x:(e.clientX-r.left-camera.x)/camera.scale,y:(e.clientY-r.top-camera.y)/camera.scale}); } });
  mapResize?.disconnect();
  lastPaneSize = {pane,w:pane.clientWidth,h:pane.clientHeight};
  mapResize = new ResizeObserver(() => {
    if (!pane.isConnected || !lastPaneSize || !pane.clientWidth) return;
    const w=pane.clientWidth, h=pane.clientHeight;
    camera.x+=(w-lastPaneSize.w)/2; camera.y+=(h-lastPaneSize.h)/2;
    lastPaneSize={pane,w,h}; applyCamera();
  });
  mapResize.observe(pane);
}
function wire(n1,n2) {
  const a=shape(n1), b=shape(n2);
  if(narrowMap.matches) {
    const from=pointFor(n1),to=pointFor(n2),x=from.x+22,y=from.y+a.h;
    if(topPorts.has(n2.id)){
      const tx=to.x+22,ty=to.y,mid=(y+ty)/2;
      return {d:`M ${x} ${y} C ${x} ${mid}, ${tx} ${mid}, ${tx} ${ty}`,labelX:(x+tx)/2+45,labelY:mid};
    }
    const tx=to.x,ty=to.y+b.h/2,turn=ty>=y?8:-8,side=tx>=x?8:-8;
    return {d:`M ${x} ${y} V ${ty-turn} Q ${x} ${ty} ${x+side} ${ty} H ${tx}`,labelX:tx+48,labelY:to.y-12};
  }
  const x1=n1.x+a.w, y1=n1.y+a.h/2, x2=n2.x, y2=n2.y+b.h/2;
  if (x2-x1 < 30) {
    const lift=Math.min(n1.y,n2.y)-32;
    return { d:`M ${x1} ${y1} C ${x1+40} ${y1}, ${x1+40} ${lift}, ${x1} ${lift} H ${x2} C ${x2-40} ${lift}, ${x2-40} ${y2}, ${x2} ${y2}`, labelX:(x1+x2)/2, labelY:lift };
  }
  const dx=x2-x1, bend=dx*.54;
  return { d:`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`, labelX:(x1+x2)/2, labelY:(y1+y2)/2 };
}
function drawEdges() {
  const layer=document.getElementById('edges'), labelLayer=document.getElementById('edge-labels'); if (!layer) return;
  const paths=[], labels=[];
  for (const e of chapterEdges()) {
    const a=nodeById(e.from), b=nodeById(e.to), g=wire(a,b);
    const color=a.type==='choice' ? NODE_TYPES[b.type].color : NODE_TYPES[a.type].color;
    paths.push(`<path d="${g.d}" stroke="${color}" stroke-width="1.6" fill="none" opacity=".76"/>`);
    if (e.label) labels.push(`<button class="edge-label" style="left:${g.labelX}px;top:${g.labelY}px;--node-color:${color}" data-action="edit-edge" data-id="${idAttr(e.id)}" title="Изменить переход">${escapeHtml(e.label)}</button>`);
  }
  layer.innerHTML=paths.join(''); labelLayer.innerHTML=labels.join('');
}
let miniView=null;
function drawMinimap() {
  const svg=document.getElementById('mini-svg'), pane=mapPane(); if (!svg||!pane) return;
  const b=graphBounds(), padX=b.w*.09, padY=b.h*.15;
  const box={x:b.x-padX,y:b.y-padY,w:b.w+2*padX,h:b.h+2*padY};
  const ratio=svg.clientWidth/(svg.clientHeight||1);
  if (box.w/box.h > ratio) { const h=box.w/ratio; box.y-=(h-box.h)/2; box.h=h; }
  else { const w=box.h*ratio; box.x-=(w-box.w)/2; box.w=w; }
  svg.setAttribute('viewBox',[box.x,box.y,box.w,box.h].join(' ')); miniView=box;
  const wires=chapterEdges().map(e=>`<path d="${wire(nodeById(e.from),nodeById(e.to)).d}" stroke="#666170" stroke-width="6" fill="none"/>`);
  const shapes=chapterNodes().map(n=>`<rect x="${pointFor(n).x}" y="${pointFor(n).y}" width="${shape(n).w}" height="${shape(n).h}" rx="10" fill="${NODE_TYPES[n.type].color}" opacity="${n.id===ui.selected ? '.87' : '.47'}"/>`);
  const x=Math.max(box.x+4,-camera.x/camera.scale), y=Math.max(box.y+4,-camera.y/camera.scale);
  const r=Math.min(box.x+box.w-4,(pane.clientWidth-camera.x)/camera.scale), bot=Math.min(box.y+box.h-4,(pane.clientHeight-camera.y)/camera.scale);
  const viewport=r>x&&bot>y ? `<rect x="${x}" y="${y}" width="${r-x}" height="${bot-y}" rx="12" fill="#b7a4e9" fill-opacity=".035" stroke="#81748f" stroke-width="1" vector-effect="non-scaling-stroke"/>` : '';
  svg.innerHTML=wires.join('')+shapes.join('')+viewport;
}
function navigateMinimap(e) {
  const pane=mapPane(), svg=document.getElementById('mini-svg'); if (!pane||!svg||!miniView) return;
  const rect=svg.getBoundingClientRect();
  if (!e.detail || !rect.width) { fitGraph(); return; }
  const x=miniView.x+(e.clientX-rect.left)/rect.width*miniView.w, y=miniView.y+(e.clientY-rect.top)/rect.height*miniView.h;
  camera.x=pane.clientWidth/2-x*camera.scale; camera.y=pane.clientHeight/2-y*camera.scale; applyCamera();
}
function syncMapTools() {
  const pane=mapPane(); if (!pane) return;
  pane.dataset.tool=ui.tool;
  pane.querySelectorAll('[data-tool]').forEach(b => {b.classList.toggle('active',b.dataset.tool===ui.tool); b.setAttribute('aria-pressed',String(b.dataset.tool===ui.tool));});
  const note=document.getElementById('link-note'); note.hidden=ui.tool!=='link';
  note.innerHTML=(ui.source ? 'Выберите узел назначения' : 'Выберите исходный узел')+'<button data-action="cancel-link" aria-label="Отменить">'+icon('x',13)+'</button>';
  pane.querySelectorAll('.node-card').forEach(el=>el.classList.toggle('link-source',el.dataset.node===ui.source));
}
function setMapTool(tool,source=null) { ui.tool=tool; ui.source=source; syncMapTools(); }
function chooseMapNode(id) {
  if (ui.tool==='link') {
    if (!ui.source) { setMapTool('link',id); return; }
    if (ui.source===id) { toast('Выберите другой узел для перехода'); return; }
    const source=ui.source; setMapTool('pointer'); openEdgeForm(source,id); return;
  }
  selectNode(id);
}
function selectNode(id,reveal=false) {
  const n=nodeById(id); if (!n) return;
  const switched=ui.page!=='map'||ui.chapter!==n.chapter;
  ui.page='map'; ui.chapter=n.chapter; ui.selected=id; ui.inspector=true;
  if (switched) { renderAll(true); } else {
    mapPane()?.querySelectorAll('.node-card').forEach(el=>{const active=el.dataset.node===id; el.classList.toggle('selected',active); el.setAttribute('aria-pressed',String(active));});
    renderInspector(); drawMinimap();
  }
  if (reveal) requestAnimationFrame(()=>revealNode(n));
}
function beginMapDrag(e) {
  if (dragging || e.button>1 || e.target.closest('button,.empty-map') || e.isPrimary===false) return;
  const card=e.target.closest('[data-node]'), hand=ui.tool==='hand'||e.button===1||spaceDown;
  if (card && ui.tool==='link' && !hand) { chooseMapNode(card.dataset.node); return; }
  const n=card&&!hand ? nodeById(card.dataset.node) : null;
  const pos=n?pointFor(n):null;
  dragging={id:e.pointerId,sx:e.clientX,sy:e.clientY,cx:camera.x,cy:camera.y,n,nx:pos?.x,ny:pos?.y,oldMobile:n?.mobile,moved:false,snapshot:null};
  e.currentTarget.setPointerCapture(e.pointerId);
  e.preventDefault();
}
function moveMapDrag(e) {
  const d=dragging; if (!d||d.id!==e.pointerId) return;
  const dx=e.clientX-d.sx,dy=e.clientY-d.sy;
  if (!d.moved && Math.hypot(dx,dy)<4) return;
  if (!d.moved && d.n) d.snapshot=JSON.stringify(project());
  d.moved=true; mapPane().classList.add('dragging');
  if (!d.n) {camera.x=d.cx+dx; camera.y=d.cy+dy; applyCamera();return;}
  const pos={x:Math.round(d.nx+dx/camera.scale),y:Math.round(d.ny+dy/camera.scale)};
  if(narrowMap.matches)d.n.mobile=pos;else Object.assign(d.n,pos);
  const card=boxFor(d.n); card.style.left=pos.x+'px'; card.style.top=pos.y+'px'; drawEdges(); drawMinimap();
}
function endMapDrag(e) {
  const d=dragging; if (!d||d.id!==e.pointerId) return;
  dragging=null; mapPane()?.classList.remove('dragging');
  if (d.n && d.moved) { remember(d.snapshot); persist(); }
  if (d.n && !d.moved) chooseMapNode(d.n.id);
}
function cancelMapDrag(e) {
  const d=dragging; if (!d||d.id!==e.pointerId) return;
  if (d.n && d.moved) { if(narrowMap.matches)d.n.mobile=d.oldMobile;else Object.assign(d.n,{x:d.nx,y:d.ny}); const el=boxFor(d.n); el.style.left=d.nx+'px'; el.style.top=d.ny+'px'; drawEdges(); drawMinimap(); }
  dragging=null; mapPane()?.classList.remove('dragging');
}
function wheelMap(e) {
  if (e.target.closest('.floating,.minimap')) return;
  e.preventDefault();
  const r=mapPane().getBoundingClientRect();
  if (e.ctrlKey || e.metaKey || (!e.shiftKey && e.deltaX===0 && (e.deltaMode!==0 || Math.abs(e.deltaY)>=45))) {
    zoomBy(Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.0025),{x:e.clientX-r.left,y:e.clientY-r.top});
  } else {camera.x-=e.shiftKey ? e.deltaY : e.deltaX; camera.y-=e.shiftKey ? 0 : e.deltaY; applyCamera();}
}
function freeSpot(source,point) {
  const nodes=chapterNodes(), base=point || (source ? {x:source.x+NODE_W+115, y:source.y} : {x:0,y:0});
  let y=base.y;
  while (nodes.some(n=>base.x<n.x+desktopShape(n).w+24&&base.x+NODE_W+24>n.x&&y<n.y+desktopShape(n).h+26&&y+130>n.y)) y+=142;
  return { x:Math.round(base.x),y:Math.round(y) };
}
