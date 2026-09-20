(function(){
  var KEY='house-theme';
  var THEMES={
    midnight:{bg:'#0b1214',ink:'#e8fbf6',dim:'#9ab3ad',accent:'#2ee6c7',card:'#121a19',line:'rgba(46,230,199,.22)'},
    dawn:{bg:'#f4f1ea',ink:'#1a1814',dim:'#5c574e',accent:'#0f766e',card:'#fffaf3',line:'rgba(15,118,110,.22)'},
    nord:{bg:'#2e3440',ink:'#eceff4',dim:'#88c0d0',accent:'#88c0d0',card:'#3b4252',line:'rgba(136,192,208,.28)'},
    solarized:{bg:'#002b36',ink:'#eee8d5',dim:'#93a1a1',accent:'#b58900',card:'#073642',line:'rgba(181,137,0,.28)'},
    dracula:{bg:'#282a36',ink:'#f8f8f2',dim:'#bd93f9',accent:'#50fa7b',card:'#21222c',line:'rgba(80,250,123,.28)'},
    ocean:{bg:'#0b1c24',ink:'#d8f3ff',dim:'#7fadb8',accent:'#2ec4b6',card:'#12262e',line:'rgba(46,196,182,.28)'}
  };
  var LABELS={midnight:'Midnight',dawn:'Dawn',nord:'Nord',solarized:'Solarized',dracula:'Dracula',ocean:'Ocean'};
  function apply(name){
    var t=THEMES[name]||THEMES.midnight;
    var r=document.documentElement;
    r.setAttribute('data-theme', name in THEMES?name:'midnight');
    ['bg','ink','dim'].forEach(function(){});
    r.style.setProperty('--bg',t.bg);
    r.style.setProperty('--ink',t.ink);
    r.style.setProperty('--dim',t.dim);
    r.style.setProperty('--p',t.accent);
    r.style.setProperty('--g',t.accent);
    r.style.setProperty('--c',t.accent);
    r.style.setProperty('--l',t.line);
    r.style.setProperty('--card',t.card);
    r.style.setProperty('--green',t.accent);
    r.style.setProperty('--cyan',t.accent);
    r.style.setProperty('--purple',t.accent);
    r.style.setProperty('--accent',t.accent);
    r.style.setProperty('--line',t.line);
    r.style.setProperty('--surface',t.card);
    if(document.body){document.body.style.background=t.bg;document.body.style.color=t.ink;}
    try{localStorage.setItem(KEY,name);}catch(e){}
    var sel=document.getElementById('themeSel');
    if(sel) sel.value=name in THEMES?name:'midnight';
  }
  function mount(){
    if(document.getElementById('themeSel')) return;
    var wrap=document.createElement('label');
    wrap.className='theme-wrap';
    wrap.style.cssText='display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)';
    wrap.innerHTML='Theme <select id="themeSel" style="background:var(--card);color:var(--ink);border:1px solid var(--l,var(--line));border-radius:10px;padding:6px 10px;font:600 12px ui-sans-serif,system-ui,sans-serif"></select>';
    var host=document.querySelector('.langs, .lang, .lang-switch, header .header-right, header')||document.body;
    host.appendChild(wrap);
    var sel=document.getElementById('themeSel');
    Object.keys(THEMES).forEach(function(k){
      var o=document.createElement('option'); o.value=k; o.textContent=LABELS[k]; sel.appendChild(o);
    });
    sel.onchange=function(){apply(sel.value);};
  }
  var start='midnight';
  try{start=localStorage.getItem(KEY)||'midnight';}catch(e){}
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){mount();apply(start);});
  }else{mount();apply(start);}
})();
