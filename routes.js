function storyIndex(p) {
  const nodes = new Map(p.nodes.map(n => [n.id,n]));
  const edges = new Map(p.edges.map(e => [e.id,e]));
  const outgoing = new Map(p.nodes.map(n => [n.id,[]]));
  const incoming = new Map(p.nodes.map(n => [n.id,[]]));
  for (const edge of p.edges) {
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  }
  return {nodes,edges,outgoing,incoming};
}

function visitStep(memory,step) {
  memory.visited.add(step.node);
  if (step.via !== null) memory.chosen.add(step.via);
}

// Replay only the still-valid prefix after an author edits a scene or a condition.
function validStoryPath(p,index,path) {
  if (!path?.length || !index.nodes.has(path[0].node)) return null;
  const memory = readingMemory(p,[path[0]]);
  let i = 1;
  for (; i < path.length; i++) {
    const step = path[i], edge = index.edges.get(step.via);
    if (!edge || edge.from !== path[i-1].node || edge.to !== step.node || !transitionOpen(edge,memory)) break;
    visitStep(memory,step);
  }
  return i === path.length ? path : path.slice(0,i);
}

function followUnambiguous(p,index,path) {
  const memory = readingMemory(p,path), walked = new Set();
  let current = path.at(-1).node;
  while (!walked.has(current)) {
    walked.add(current);
    const options = index.outgoing.get(current).filter(edge => transitionOpen(edge,memory));
    if (options.length !== 1) break;
    const edge = options[0], step = {node:edge.to,via:edge.id};
    path.push(step);
    visitStep(memory,step);
    current = step.node;
  }
  return path;
}

function previousFork(p,index,path) {
  const memory = readingMemory(p,[path[0]]);
  let fork = -1;
  for (let i=0; i<path.length-1; i++) {
    if (index.outgoing.get(path[i].node).filter(e => transitionOpen(e,memory)).length>1) fork=i;
    visitStep(memory,path[i+1]);
  }
  return fork;
}

// A single route needs only the rules on its way to the destination. For
// preview alternatives, keep earlier choices that can affect later scenes too.
function searchStoryRoutes(p,index,target,{finalEdge=null,prefix=null,limit=1}={}) {
  if (!index.nodes.has(target)) return {paths:[]};
  const alternatives=limit>1;
  const ancestors = new Set([target]), pending = [target];
  const flags = {node:new Map(),edge:new Map()};
  let nextFlag = 1n;
  function collectRules(edge) {
    for (const rule of edge.rules || []) {
      const table = flags[rule.kind];
      if (!table.has(rule.ref)) {
        table.set(rule.ref,nextFlag);
        nextFlag <<= 1n;
      }
    }
  }
  if (finalEdge) collectRules(finalEdge);
  while (pending.length) {
    for (const edge of index.incoming.get(pending.pop())) {
      collectRules(edge);
      if (!ancestors.has(edge.from)) {
        ancestors.add(edge.from);
        pending.push(edge.from);
      }
    }
  }
  if (alternatives) {
    const future=new Set([target]), queue=[target];
    for(let i=0;i<queue.length;i++) {
      for(const edge of index.outgoing.get(queue[i])) {
        collectRules(edge);
        if(!future.has(edge.to)){future.add(edge.to);queue.push(edge.to);}
      }
    }
  }
  const first = p.chapters.find(c => c.start)?.start;
  let roots = [first], initialMask=0n;
  if (prefix?.length) {
    const last=prefix.at(-1).node;
    if(!ancestors.has(last))return {paths:[]};
    roots=[last];
    for(const step of prefix)initialMask|=(flags.node.get(step.node)||0n)|(flags.edge.get(step.via)||0n);
  } else if (!ancestors.has(first)) {
    roots = [...ancestors].filter(id=>!index.incoming.get(id).length);
    if (!roots.length) roots = [p.chapters.find(c=>ancestors.has(c.start))?.start || target];
  }
  const states = [], seen = new Map(), paths=[];
  let limited=false;
  function enqueue(node,mask,parent,via,branch) {
    let masks = seen.get(node);
    if (!masks) { masks=new Set(); seen.set(node,masks); }
    const key=alternatives?mask.toString(36)+'/'+branch:mask;
    if (masks.has(key)) return;
    if(states.length>=30000){limited=true;return;}
    masks.add(key);
    states.push({node,mask,parent,via,branch});
  }
  for (const root of roots) enqueue(root,initialMask|(flags.node.get(root)||0n),-1,prefix?.at(-1)?.via||null,alternatives?'root/'+root:'');
  let activeMask = 0n;
  const memory = {
    nodes:index.nodes, edges:index.edges,
    visited:{has:id=>Boolean(activeMask & (flags.node.get(id)||0n))},
    chosen:{has:id=>Boolean(activeMask & (flags.edge.get(id)||0n))}
  };
  for (let i=0; i<states.length; i++) {
    const state = states[i];
    activeMask = state.mask;
    if (state.node===target && (!finalEdge || transitionOpen(finalEdge,memory))) {
      if(paths.length===limit)return {paths,limited:true};
      const path=[];
      for (let cursor=i; cursor!==-1; cursor=states[cursor].parent) {
        const {node,via}=states[cursor];
        path.push({node,via});
      }
      path.reverse();
      if (finalEdge) path.push({node:finalEdge.to,via:finalEdge.id});
      paths.push(prefix?.length ? prefix.slice(0,-1).concat(path) : path);
      if(!alternatives)return {paths,limited:false};
    }
    const outgoing=index.outgoing.get(state.node);
    for (const edge of outgoing) {
      if (!ancestors.has(edge.to) || !transitionOpen(edge,memory)) continue;
      const mask=activeMask | (flags.edge.get(edge.id)||0n) | (flags.node.get(edge.to)||0n);
      enqueue(edge.to,mask,i,edge.id,alternatives&&outgoing.length>1?'edge/'+edge.id:state.branch);
    }
  }
  return {paths,limited};
}

function findStoryPath(p,index,target,finalEdge=null,prefix=null) {
  const result=searchStoryRoutes(p,index,target,{finalEdge,prefix});
  return {path:result.paths[0],limited:result.limited};
}
