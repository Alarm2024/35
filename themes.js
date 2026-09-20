(function(){
  var KEY='house-theme';
  var THEMES={
    midnight:{bg:'#0b1214',ink:'#e8fbf6',dim:'#9ab3ad',accent:'#2ee6c7',card:'#121a19',line:'rgba(46,230,199,.22)',dot:'#2ee6c7'},
    dawn:{bg:'#f4f1ea',ink:'#1a1814',dim:'#5c574e',accent:'#0f766e',card:'#fffaf3',line:'rgba(15,118,110,.22)',dot:'#e8efe8'},
    nord:{bg:'#2e3440',ink:'#eceff4',dim:'#88c0d0',accent:'#88c0d0',card:'#3b4252',line:'rgba(136,192,208,.28)',dot:'#88c0d0'},
    solarized:{bg:'#002b36',ink:'#eee8d5',dim:'#93a1a1',accent:'#b58900',card:'#073642',line:'rgba(181,137,0,.28)',dot:'#b58900'},
    dracula:{bg:'#282a36',ink:'#f8f8f2',dim:'#bd93f9',accent:'#50fa7b',card:'#21222c',line:'rgba(80,250,123,.28)',dot:'#bd93f9'},
    ocean:{bg:'#0b1c24',ink:'#d8f3ff',dim:'#7fadb8',accent:'#2ec4b6',card:'#12262e',line:'rgba(46,196,182,.28)',dot:'#2ec4b6'}
  };
  var LABELS={midnight:'Midnight',dawn:'Dawn',nord:'Nord',solarized:'Solarized',dracula:'Dracula',ocean:'Ocean'};
  var ORDER=['midnight','dawn','nord','solarized','dracula','ocean'];
  function apply(name){
    if(!(name in THEMES)) name='midnight';
    var t=THEMES[name];
    var r=document.documentElement;
    r.setAttribute('data-theme', name);
    r.style.setProperty('--bg',t.bg);
    r.style.setProperty('--ink',t.ink);
    r.style.setProperty('--dim',t.dim);
    r.style.setProperty('--p',t.accent);
    r.style.setProperty('--g',t.accent);
    r.style.setProperty('--c',t.accent);
    r.style.setProperty('--l',t.line);
    r.style.setProperty('--card',t.card);
    r.style.setProperty('--purple',t.accent);
    r.style.setProperty('--green',t.accent);
    r.style.setProperty('--cyan',t.accent);
    r.style.setProperty('--accent',t.accent);
    r.style.setProperty('--line',t.line);
    r.style.setProperty('--surface',t.card);
    if(document.body){document.body.style.background=t.bg;document.body.style.color=t.ink;}
    try{localStorage.setItem(KEY,name);}catch(e){}
    document.querySelectorAll('[data-theme-item]').forEach(function(el){
      el.classList.toggle('on', el.getAttribute('data-theme-item')===name);
    });
    var cur=document.getElementById('themeCur');
    if(cur) cur.textContent=LABELS[name];
  }
  function mount(){
    if(document.getElementById('themeMenu')) return;
    if(!document.getElementById('theme-css')){
      var css=document.createElement('style'); css.id='theme-css';
      css.textContent=[
        '.theme-wrap{position:relative;flex:0 0 auto}',
        '.theme-btn{display:flex;align-items:center;gap:6px;background:var(--card,#121a19);color:var(--ink);border:1px solid var(--line,var(--l));border-radius:999px;padding:6px 10px;font:600 11px ui-sans-serif,system-ui;cursor:pointer}',
        '.theme-dot{width:10px;height:10px;border-radius:50%;background:#2ee6c7;flex:0 0 auto}',
        '.theme-panel{display:none;position:absolute;right:0;top:calc(100% + 8px);min-width:200px;background:#16181d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:10px;z-index:80;box-shadow:0 18px 40px rgba(0,0,0,.45)}',
        '.theme-wrap.open .theme-panel{display:block}',
        '.theme-panel p{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8b93a0;margin:0 8px 8px}',
        '.theme-item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:#e8eef2;padding:10px 10px;border-radius:12px;font:600 14px ui-sans-serif,system-ui;cursor:pointer;text-align:left}',
        '.theme-item.on{background:#14302c;color:#2ee6c7}',
        '.theme-item i{width:14px;height:14px;border-radius:50%;flex:0 0 auto;display:block}',
        '.theme-item .ck{margin-left:auto;opacity:0}',
        '.theme-item.on .ck{opacity:1}'
      ].join('');
      document.head.appendChild(css);
    }
    var wrap=document.createElement('div');
    wrap.className='theme-wrap';
    wrap.id='themeMenu';
    wrap.innerHTML='<button type="button" class="theme-btn" id="themeOpen"><i class="theme-dot"></i><span id="themeCur">Midnight</span></button>';
    var panel=document.createElement('div');
    panel.className='theme-panel';
    panel.innerHTML='<p>Choose theme</p>';
    ORDER.forEach(function(k){
      var b=document.createElement('button');
      b.type='button';
      b.className='theme-item';
      b.setAttribute('data-theme-item',k);
      b.innerHTML='<i style="background:'+THEMES[k].dot+'"></i><span>'+LABELS[k]+'</span><span class="ck">\u2713</span>';
      b.onclick=function(){apply(k);wrap.classList.remove('open');};
      panel.appendChild(b);
    });
    wrap.appendChild(panel);
    var host=document.querySelector('.header-right')||document.querySelector('.lang')||document.querySelector('.langs')||document.querySelector('header')||document.querySelector('.top')||document.body;
    host.appendChild(wrap);
    document.getElementById('themeOpen').onclick=function(e){
      e.stopPropagation();
      wrap.classList.toggle('open');
    };
    document.addEventListener('click',function(){wrap.classList.remove('open');});
  }
  var start='midnight';
  try{start=localStorage.getItem(KEY)||'midnight';}catch(e){}
  if(!(start in THEMES)) start='midnight';
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){mount();apply(start);});
  }else{mount();apply(start);}
})();
