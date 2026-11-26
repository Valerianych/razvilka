const iconPaths = {
  eye:'<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  timeline:'<path d="M3 11h18M7 4v3m10 10v3"/><rect x="3" y="7" width="8" height="8" rx="2"/><rect x="14" y="8" width="7" height="7" rx="2"/>',
  map: '<rect x="3" y="3" width="6" height="5" rx="1.4"/><rect x="15" y="12" width="6" height="5" rx="1.4"/><rect x="3" y="16" width="6" height="5" rx="1.4"/><path d="M6 8v8m0-5c0 2 1 3.5 4 3.5h5"/>',
  book: '<path d="M12 6c-2-2-5-2.5-9-1.8v14c4-.7 7-.2 9 1.8 2-2 5-2.5 9-1.8v-14c-4-.7-7-.2-9 1.8Zm0 0v14"/>',
  bubbles: '<path d="M14 12a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2z"/><path d="M17 8h2a2 2 0 0 1 2 2v11l-4-3h-4a2 2 0 0 1-2-2"/>',
  cloud: '<path d="M7 17H6a4.4 4.4 0 1 1 0-8.8A6.1 6.1 0 0 1 17.8 7a5 5 0 0 1 1.6 9.3"/><path d="m9 14 2.3 2.3 4.7-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>', 'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'chevron-right':'<path d="m9 5 7 7-7 7"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>',play:'<path d="m7 4 13 8-13 8z"/>',
  scene:'<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3.5 9h17m-12-4.2-2.4 4m7.4-4-2.4 4m7.4-4-2.4 4"/>',
  choice:'<path d="m12 2.5 9.5 9.5-9.5 9.5L2.5 12z"/><path d="M12 15v-3m0 0 3-3m-3 3-3-3"/>',
  dialogue:'<path d="M21 13a3 3 0 0 1-3 3H9l-6 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/><path d="M7.5 8h9m-9 4h5"/>',
  ending:'<path d="M5 21V4c5-3 9 3 14 0v10c-5 3-9-3-14 0"/>',file:'<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5M8.5 12h7m-7 4h5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>', undo:'<path d="m9 5-6 5 6 5m-6-5h10a7 7 0 0 1 7 7v1"/>',redo:'<path d="m15 5 6 5-6 5m6-5H11a7 7 0 0 0-7 7v1"/>',
  pointer:'<path d="m5 3 14 10-7 1.3L9 21z"/>',hand:'<path d="M7.5 13V6a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-7a1.5 1.5 0 0 1 3 0v7-4.5a1.5 1.5 0 0 1 3 0v6.8a8 8 0 0 1-8 7.7c-2.7 0-4.4-1.4-6-4l-3-5a1.6 1.6 0 0 1 2.7-1.8l2.3 2.8z"/>',
  link:'<path d="m10 14 4-4m-.5 5.5-3.2 3.2a4.3 4.3 0 0 1-6.1-6.1l3.2-3.2m3.2-.9 3.2-3.2a4.3 4.3 0 0 1 6.1 6.1l-3.2 3.2"/>',
  fit:'<path d="M3.5 9V4h5m7 0h5v5m0 6v5h-5m-7 0h-5v-5"/><rect x="8" y="8" width="8" height="8" rx="1.3"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>', sliders:'<path d="M4 6h7m5 0h4M4 12h2m5 0h9M4 18h10m5 0h1"/><circle cx="13.5" cy="6" r="2.2"/><circle cx="8.5" cy="12" r="2.2"/><circle cx="16.5" cy="18" r="2.2"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  layers:'<path d="m12 3 9.5 5-9.5 5-9.5-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  user:'<circle cx="12" cy="8" r="3.3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2.3"/>',
  box:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',spark:'<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
  branch:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 7v10m0-3c7 0 12-1.8 12-6"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>','arrow-left':'<path d="M20 12H5m6-6-6 6 6 6"/>',edit:'<path d="m14.5 5.5 4 4M4 20l4.5-1L20 7.5a2.8 2.8 0 0 0-4-4L4.5 15z"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m2 0h1m2 0h1m2 0h1m2 0h1M5 12h1m2 0h1m2 0h1m2 0h1m2 0h1M8 15h8"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tag:'<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>', reset:'<path d="M3 10a9 9 0 1 1 1.8 8M3 4v6h6"/>', home:'<path d="m3 11 9-8 9 8M6 9v12h12V9"/>',
  alert:'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v14h5"/>',dot:'<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'
};
function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
}
