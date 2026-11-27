const directions={right:[1,0],bottom:[0,1],left:[-1,0],top:[0,-1]};
const opposite={right:'left',left:'right',bottom:'top',top:'bottom'};
const sideNames={right:'справа',bottom:'снизу',left:'слева',top:'сверху'};
const freshTitles={scene:'Новая сцена',choice:'Новый выбор',dialogue:'Новый диалог',ending:'Новый финал'};
let pendingInsert=null, connectorDrag=null;
function handleMarkup(n) {
  return SIDES.map(side=>{
    const title=`Добавить узел ${sideNames[side]} или потянуть связь`;
    return `<button type="button" class="node-handle handle-${side}" data-action="open-palette" data-side="${side}" data-id="${idAttr(n.id)}" aria-label="${title}" title="${title}">${icon('arrow',15)}</button>`;
  }).join('');
}
function anchorPoint(n,side) {
  const pos=pointFor(n),size=shape(n),[dx,dy]=directions[side];
  return {x:pos.x+size.w*(1+dx)/2,y:pos.y+size.h*(1+dy)/2};
}
function bezierWire(start,end,outSide,inSide) {
  const bend=Math.max(32,Math.min(145,Math.hypot(end.x-start.x,end.y-start.y)*.44));
  const u=directions[outSide],v=directions[inSide];
  const a={x:start.x+bend*u[0],y:start.y+bend*u[1]}, b={x:end.x+bend*v[0],y:end.y+bend*v[1]};
  return {d:`M ${start.x} ${start.y} C ${a.x} ${a.y}, ${b.x} ${b.y}, ${end.x} ${end.y}`,
    labelX:(start.x+3*a.x+3*b.x+end.x)/8,labelY:(start.y+3*a.y+3*b.y+end.y)/8};
}
function worldPoint(clientX,clientY) {
  const rect=mapPane().getBoundingClientRect();
  return {x:(clientX-rect.left-camera.x)/camera.scale,y:(clientY-rect.top-camera.y)/camera.scale};
}
function nearestSide(n,point,fallback) {
  const pos=pointFor(n),size=shape(n),dx=(point.x-pos.x)/size.w-.5,dy=(point.y-pos.y)/size.h-.5;
  if(Math.max(Math.abs(dx),Math.abs(dy))<.18)return fallback;
  return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'bottom':'top');
}
function setEndpoints(edge,fromSide,toSide) {
  edge.ports={ [narrowMap.matches?'narrow':'wide']:[fromSide,toSide] };
}
function connectNow(from,to,fromSide,toSide) {
  if(!from||!to||from.id===to.id)return;
  if(project().edges.some(e=>e.from===from.id&&e.to===to.id)){toast('Между этими узлами уже есть переход');return;}
  const edge=makeEdge(from.id,to.id);
  if(fromSide)setEndpoints(edge,fromSide,toSide);
  changeProject(p=>p.edges.push(edge));
  ui.selected=from.id;ui.source=null;ui.tool='pointer';
  renderAll();toast('Переход создан. Нажмите на линию, чтобы его изменить.');
}
function openPalette(source,side,spot,clientX,clientY) {
  dismissMenu();pendingInsert={source,side,spot,chapter:ui.chapter};
  const items=Object.entries(NODE_TYPES).map(([key,t])=>`<button type="button" data-action="quick-type" data-type="${key}" style="--node-color:${t.color}">${icon(t.icon,19)}<span>${t.name}</span></button>`).join('');
  menu.classList.add('quick-palette');menu.dataset.for='quick-add';
  menu.innerHTML=`<div class="palette-heading">${source?'Добавить продолжение':'Добавить узел'}</div><div class="palette-types">${items}</div>${source?
    '<hr>'+menuItem('pick-target','link','Связать с узлом…',`data-id="${idAttr(source)}"`)+menuItem('continue-chapter','layers','Продолжить в новой главе…',`data-id="${idAttr(source)}"`):'<hr>'+menuItem('detailed-node','edit','Заполнить карточку…')}`;
  menu.hidden=false;
  menu.style.left=Math.max(8,Math.min(clientX+8,innerWidth-menu.offsetWidth-8))+'px';
  menu.style.top=Math.max(8,Math.min(clientY+7,innerHeight-menu.offsetHeight-8))+'px';
  menu.querySelector('button').focus({preventScroll:true});
}
function paletteAtHandle(button) {
  const rect=button.getBoundingClientRect();
  openPalette(button.dataset.id,button.dataset.side,null,rect.left+rect.width/2,rect.top+rect.height/2);
}
function openAddPalette(button) {
  const pane=mapPane(),rect=button.getBoundingClientRect(),canvas=pane.getBoundingClientRect();
  openPalette(null,'right',worldPoint(canvas.left+canvas.width/2,canvas.top+canvas.height/2),rect.left,rect.bottom);
}
function insertPosition(n,source,side,drop,compact) {
  const size=compact?shape:desktopShape, position=compact?pointFor:node=>node;
  const box=size(n), origin=source?position(source):{x:0,y:0}, parent=source?size(source):{w:0,h:0};
  const stacked=compact&&!side&&source, [dx,dy]=directions[side||'right'], gap=compact?55:92;
  const base=drop?{x:drop.x-box.w/2,y:drop.y-box.h/2}:{
    x:stacked?origin.x+(source.type==='choice'?30:0):origin.x+(parent.w-box.w)/2+dx*((parent.w+box.w)/2+gap),
    y:stacked?origin.y+parent.h+gap:origin.y+(parent.h-box.h)/2+dy*((parent.h+box.h)/2+gap)
  };
  const occupied=project().nodes.filter(item=>item.chapter===n.chapter).map(item=>({...position(item),...size(item)}));
  for(let i=0;;i++){
    const step=stacked?i:Math.ceil(i/2)*(i%2?1:-1);
    const x=Math.round(base.x+(dy?step*(box.w+34):0)),y=Math.round(base.y+(dx?step*(box.h+36):0));
    if(!occupied.some(b=>x<b.x+b.w+12&&x+box.w+12>b.x&&y<b.y+b.h+12&&y+box.h+12>b.y))return {x,y};
  }
}
function appendPlacedNode(p,chapter,type,title,source,side,spot) {
  const n=makeNode(p,chapter,type,title,{x:0,y:0});
  Object.assign(n,insertPosition(n,source,side||'right',narrowMap.matches?null:spot,false));
  if(narrowMap.matches){
    n.mobile=insertPosition(n,source,side,spot,true);
    for(const current of p.nodes){
      if(current.chapter!==chapter||current.mobile)continue;
      const {x,y}=pointFor(current);
      current.mobile={x,y};
    }
  }
  p.nodes.push(n);
  const c=chapterById(chapter);
  if(!c.start)c.start=n.id;
  return n;
}
function addFromPalette(type) {
  const pending=pendingInsert; pendingInsert=null;
  if(!pending||pending.chapter!==ui.chapter||!Object.hasOwn(NODE_TYPES,type))return;
  if(type==='choice'){openChoiceWriter({source:pending.source,chapter:pending.chapter,side:pending.side,spot:pending.spot});return;}
  const source=nodeById(pending.source), side=pending.side||'right';
  let n;
  changeProject(p=>{
    n=appendPlacedNode(p,ui.chapter,type,freshTitles[type],source,side,pending.spot);
    if(source){const edge=makeEdge(source.id,n.id);setEndpoints(edge,side,opposite[side]);p.edges.push(edge);}
  });
  ui.selected=n.id;ui.source=null;ui.tool='pointer';
  renderAll();revealNode(n);renameOnCard(n);
}
function splitTransition(p,edge) {
  const source=nodeById(edge.from),target=nodeById(edge.to);
  const n=makeNode(p,source.chapter,'scene',freshTitles.scene,{x:0,y:0});
  const middle=(position,size)=>{
    if(source.chapter!==target.chapter)return null;
    const a=position(source),b=position(target),sa=size(source),sb=size(target);
    return {x:(a.x+b.x+(sa.w+sb.w)/2)/2,y:(a.y+b.y+(sa.h+sb.h)/2)/2};
  };
  Object.assign(n,insertPosition(n,source,'right',middle(v=>v,desktopShape),false));
  if(narrowMap.matches)n.mobile=insertPosition(n,source,'bottom',middle(pointFor,shape),true);
  if(source.type==='choice'&&!edge.label)edge.label=target.title;
  edge.to=n.id;delete edge.ports;
  p.nodes.push(n);p.edges.push(makeEdge(n.id,target.id));
  return n;
}
function renameOnCard(n) {
  const heading=boxFor(n)?.querySelector('h3');
  if(!heading||heading.querySelector('input'))return;
  const input=document.createElement('input');
  input.className='inline-title'; input.maxLength=240;input.setAttribute('aria-label','Название узла на карте');input.value=n.title;
  heading.replaceChildren(input);const original=n.title;
  let cancelled=false,recorded=false;
  function saveTitle(value) {
    if(nodeById(n.id)!==n||n.title===value)return;
    if(!recorded){remember();recorded=true;}
    n.title=value;persist();
    const field=document.querySelector('#inspector [data-edit="title"]');
    if(field?.dataset.id===n.id)field.value=value;
  }
  input.addEventListener('input',()=>{if(input.value.trim())saveTitle(input.value);});
  input.addEventListener('blur',()=>{
    saveTitle(cancelled?original:input.value.trim()||original);
    heading.textContent=n.title;
    boxFor(n)?.setAttribute('aria-label',NODE_TYPES[n.type].name+' '+n.title);
  },{once:true});
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelled=e.key==='Escape';input.blur();boxFor(n)?.focus({preventScroll:true});}
  });
  input.focus({preventScroll:true});input.select();
}
function beginConnector(e,button) {
  if(e.button!==0||e.isPrimary===false||connectorDrag)return;
  e.preventDefault();dismissMenu();
  const pane=mapPane();
  connectorDrag={pointer:e.pointerId,source:nodeById(button.dataset.id),side:button.dataset.side,startX:e.clientX,startY:e.clientY,moved:false,pane,button};
  pane.setPointerCapture(e.pointerId);
}
function connectorHit(e,d) {
  const el=document.elementFromPoint(e.clientX,e.clientY);
  if(!el||!d.pane.contains(el)||el.closest('.floating,.minimap,.link-note,.empty-map'))return null;
  const card=el.closest('.node-card');
  return {target:card?nodeById(card.dataset.node):null,point:worldPoint(e.clientX,e.clientY)};
}
function moveConnector(e) {
  const d=connectorDrag;if(!d||d.pointer!==e.pointerId)return;
  if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<5)return;
  d.moved=true;d.pane.classList.add('connecting');
  const hit=connectorHit(e,d),target=hit?.target!==d.source?hit?.target:null;
  d.pane.querySelector('.connect-target')?.classList.remove('connect-target');
  const point=hit?.point||worldPoint(e.clientX,e.clientY),endSide=target?nearestSide(target,point,opposite[d.side]):opposite[d.side];
  if(target)boxFor(target).classList.add('connect-target');
  const curve=bezierWire(anchorPoint(d.source,d.side),target?anchorPoint(target,endSide):point,d.side,endSide);
  byId('connector-preview').setAttribute('d',curve.d);
}
function cancelConnector() {
  const d=connectorDrag;if(!d)return;
  connectorDrag=null;
  d.pane.classList.remove('connecting');d.pane.querySelector('.connect-target')?.classList.remove('connect-target');
  byId('connector-preview')?.removeAttribute('d');
  if(d.pane.hasPointerCapture(d.pointer))d.pane.releasePointerCapture(d.pointer);
}
function finishConnector(e) {
  const d=connectorDrag;if(!d||d.pointer!==e.pointerId)return;
  const hit=connectorHit(e,d);cancelConnector();
  if(!d.moved){paletteAtHandle(d.button);return;}
  if(!hit||hit.target===d.source)return;
  if(hit.target)connectNow(d.source,hit.target,d.side,nearestSide(hit.target,hit.point,opposite[d.side]));
  else openPalette(d.source.id,d.side,hit.point,e.clientX,e.clientY);
}
function showChapterExits(button,id) {
  const from=nodeById(id),exits=project().edges.filter(e=>e.from===id&&nodeById(e.to).chapter!==from.chapter);
  if(exits.length===1){selectNode(exits[0].to,true);return;}
  showMenu(button,exits.map(e=>{const n=nodeById(e.to);return menuItem('jump','layers',chapterName(n.chapter)+' · '+n.title,`data-id="${idAttr(n.id)}"`);}).join(''));
}
