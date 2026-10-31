// ============================================================
//  UI — Utilidades de DOM y componentes compartidos.
//  Cada pestaña vive en js/views/*.js
// ============================================================
const UI = (() => {
  const $ = (s, r=document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; };
  const esc = s => (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v,d=1) => v==null||!isFinite(v) ? '—' : Number(v).toLocaleString('es-CL',{maximumFractionDigits:d});
  const fmtDate = iso => { if(!iso) return '—'; const t=Logic.todayISO(), n=Logic.daysBetween(iso,t);
    if(n===0) return 'Hoy'; if(n===1) return 'Ayer'; if(n===-1) return 'Mañana';
    return new Date(iso+'T12:00:00').toLocaleDateString('es-CL',{weekday:'short',day:'numeric',month:'short'}); };
  const longDate = iso => new Date(iso+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});

  let toastT;
  function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.add('hidden'),2600); }
  function setMain(node){ const m=$('#main'), y=window.scrollY; m.innerHTML=''; m.appendChild(node); return y; }

  // ---------- Hoja inferior: formularios y detalles, siempre al alcance del pulgar ----------
  function sheet(title, content, { onClose } = {}){
    const ov = el('div','sheet-ov'), box = el('div','sheet');
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label', title);
    box.innerHTML = `<div class="sheet-grip"></div><div class="sheet-hd"><h3>${esc(title)}</h3><button class="icon-btn" aria-label="Cerrar">✕</button></div><div class="sheet-bd"></div>`;
    const body = box.querySelector('.sheet-bd');
    if (typeof content === 'string') body.innerHTML = content; else if (content) body.appendChild(content);
    ov.appendChild(box); document.body.appendChild(ov); document.body.classList.add('no-scroll');
    const close = () => { ov.remove(); if(!$('.sheet-ov')) document.body.classList.remove('no-scroll'); onClose && onClose(); };
    box.querySelector('.sheet-hd button').onclick = close;
    ov.onclick = e => { if(e.target===ov) close(); };
    return { close, body, box };
  }
  const sheetOpen = () => !!$('.sheet-ov, .chat-ov, .scan-ov');

  // Campo con etiqueta siempre visible
  const field = (label, html) => `<label class="field"><span>${esc(label)}</span>${html}</label>`;
  const segmented = (opts, cur, onPick) => {
    const w = el('div','seg');
    opts.forEach(([v,l]) => { const b=el('button',v===cur?'on':'',l); b.type='button'; b.onclick=()=>onPick(v); w.appendChild(b); });
    return w;
  };
  // Elección rápida en una hoja, sin diálogos del navegador
  function ask(title, text, confirmLabel, onYes, danger = true){
    const n = el('div',null,`<p class="muted">${esc(text)}</p><div class="stack"><button class="btn ${danger?'btn-danger':'btn-primary'} wide">${esc(confirmLabel)}</button></div>`);
    const s = sheet(title, n);
    n.querySelector('button').onclick = () => { s.close(); onYes(); };
  }

  // Anillo de progreso
  function ring(pct, center, size = 76, cls = ''){
    const r = (size-9)/2, c = 2*Math.PI*r, p = Math.max(0, Math.min(100, pct||0));
    return `<svg class="ring ${cls}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" class="ring-bg"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-p/100)}" transform="rotate(-90 ${size/2} ${size/2})"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle">${center}</text></svg>`;
  }
  function bar(label, val, target, unit = 'g', { limit = false } = {}){
    const pct = target ? Math.min(100, Math.round(val/target*100)) : 0;
    const over = target && val > target*(limit ? 1 : 1.1);
    return `<div class="macro"><div class="macro-hd"><span>${esc(label)}</span><b>${num(val,0)}${target?` / ${num(target,0)}`:''} ${unit}</b></div>
      <div class="bar ${over?'over':''}"><i style="width:${pct}%"></i></div></div>`;
  }
  const tile = (value, label, sub = '') => `<div class="tile"><b>${value}</b><span>${esc(label)}</span>${sub?`<small>${esc(sub)}</small>`:''}</div>`;

  // ---------- Gráficos ----------
  const charts = new Map();
  function chartColors(){ const s=getComputedStyle(document.documentElement); const g=k=>s.getPropertyValue(k).trim();
    return { line:g('--primary'), text:g('--muted'), grid:g('--line'), accent:g('--accent') }; }
  function baseOpts(c, extra = {}){ return { responsive:true, maintainAspectRatio:false, animation:false,
    plugins:{ legend:{display:false}, ...extra.plugins },
    scales:{ x:{ ticks:{color:c.text,maxTicksLimit:6,maxRotation:0}, grid:{display:false} }, y:{ ticks:{color:c.text,maxTicksLimit:5}, grid:{color:c.grid} } } }; }
  function chart(canvas, cfg){
    if(!canvas || !window.Chart) return;
    charts.get(canvas.id)?.destroy();
    charts.set(canvas.id, new Chart(canvas, cfg));
  }
  const shortDate = iso => iso.slice(8)+'/'+iso.slice(5,7);

  // ---------- Descanso (usa la hora de término: no se atrasa si el teléfono suspende la página) ----------
  let restInt;
  function stopRest(){ clearInterval(restInt); $('.rest-ov')?.remove(); }
  function startRest(seconds){
    stopRest();
    let end = Date.now()+seconds*1000, total = seconds;
    const ov = el('div','rest-ov');
    ov.innerHTML = `<span class="t"></span><div class="bar2"><i></i></div><button data-a="-15">−15</button><button data-a="15">+15</button><button data-a="x">Saltar</button>`;
    document.body.appendChild(ov);
    const tEl = ov.querySelector('.t'), b = ov.querySelector('i');
    const upd = () => { const left = Math.ceil((end-Date.now())/1000);
      if(left<=0){ stopRest(); alarm(); return; }
      tEl.textContent = `${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`; b.style.width = Math.min(100,left/total*100)+'%'; };
    ov.querySelectorAll('button').forEach(x => x.onclick = () => { const a=x.dataset.a; if(a==='x') return stopRest(); end+=Number(a)*1000; total=Math.max(total,(end-Date.now())/1000); upd(); });
    restInt = setInterval(upd, 500); upd();
  }
  function beep(freq=880){ try { const a=new (window.AudioContext||window.webkitAudioContext)(); const o=a.createOscillator(),g=a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value=freq; o.start(); g.gain.setValueAtTime(.2,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.45); o.stop(a.currentTime+.45); } catch {} }
  function alarm(){ if(navigator.vibrate) navigator.vibrate([200,80,200]); beep(); }

  // Reproductor guiado de movilidad
  let mobInt;
  function startMobility(routine){
    clearInterval(mobInt); stopRest();
    let idx=0, end=Date.now()+routine.items[0].s*1000;
    const ov=el('div','rest-ov mob');
    ov.innerHTML=`<div id="mb-name"></div><span class="t"></span><div class="bar2"><i></i></div><button data-a="n">Siguiente</button><button data-a="x">✕</button>`;
    document.body.appendChild(ov);
    const stop=()=>{ clearInterval(mobInt); ov.remove(); };
    const next=()=>{ idx++; if(idx>=routine.items.length){ stop(); alarm(); toast('Movilidad completada 🧘'); return; } end=Date.now()+routine.items[idx].s*1000; beep(); };
    const draw=()=>{ const it=routine.items[idx], left=Math.ceil((end-Date.now())/1000);
      if(left<=0) return next();
      ov.querySelector('.t').textContent=left+'s'; ov.querySelector('i').style.width=left/it.s*100+'%';
      ov.querySelector('#mb-name').textContent=`${idx+1}/${routine.items.length} · ${it.n}`; };
    ov.querySelector('[data-a=n]').onclick=()=>{ next(); if(document.body.contains(ov)) draw(); };
    ov.querySelector('[data-a=x]').onclick=stop;
    mobInt=setInterval(draw,500); draw();
  }

  // Chat con el coach IA
  function startCoachChat(askFn){
    const msgs = [];
    const ov = el('div','chat-ov');
    ov.innerHTML = `<div class="chat-hd"><span>🤖 Coach Kratos</span><button class="icon-btn" id="ch-x" aria-label="Cerrar">✕</button></div>
      <div class="chat-msgs" id="ch-msgs"></div>
      <div class="chips chat-sug">${['¿Cómo voy esta semana?','¿Qué entreno hoy?','¿Qué ceno con lo que me queda?'].map(q=>`<button class="chip">${q}</button>`).join('')}</div>
      <div class="chat-in"><input id="ch-in" placeholder="Pregúntale a Kratos…" autocomplete="off"><button class="btn btn-primary" id="ch-send" aria-label="Enviar">➤</button></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('#ch-msgs'), input = ov.querySelector('#ch-in');
    const add = (role, content) => { const m=el('div','cmsg '+(role==='user'?'user':'bot')); m.textContent=content; box.appendChild(m); box.scrollTop=box.scrollHeight; return m; };
    add('bot', 'Tengo a la vista tu entrenamiento, nutrición, peso, sueño y pasos. Tu historia clínica no se comparte con la IA.');
    ov.querySelector('#ch-x').onclick = () => ov.remove();
    const send = async text => {
      text = (text||input.value).trim(); if(!text) return;
      input.value=''; ov.querySelector('.chat-sug')?.remove(); add('user', text); msgs.push({ role:'user', content:text });
      const pending = add('bot', 'Pensando…');
      try { const reply = await askFn(msgs); pending.textContent = reply || '(sin respuesta)'; msgs.push({ role:'assistant', content:reply }); }
      catch(e){ pending.textContent = '⚠️ ' + (e.message || 'Error'); }
      box.scrollTop = box.scrollHeight;
    };
    ov.querySelectorAll('.chip').forEach(c => c.onclick = () => send(c.textContent));
    ov.querySelector('#ch-send').onclick = () => send();
    input.addEventListener('keydown', e => { if(e.key==='Enter') send(); });
  }

  // Escáner de código de barras (BarcodeDetector; si no existe, entrada manual)
  async function startScanner(onCode){
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia){
      const n = el('div',null,`<p class="muted">Este dispositivo no permite escanear. Escribe el código de barras.</p>
        <input id="bc" inputmode="numeric" placeholder="7801234567890"><button class="btn btn-primary wide">Buscar</button>`);
      const s = sheet('Código de barras', n);
      n.querySelector('button').onclick = () => { const c=n.querySelector('#bc').value.trim(); if(c){ s.close(); onCode(c); } };
      return;
    }
    let stream, raf, stopped = false;
    const ov = el('div','scan-ov');
    ov.innerHTML = `<div class="scan-hint">Apunta al código de barras</div><video playsinline muted></video><div class="scan-frame"></div>
      <div class="scan-bar"><span class="muted">Buscando…</span><button class="btn btn-ghost" id="sc-x">Cancelar</button></div>`;
    document.body.appendChild(ov);
    const video = ov.querySelector('video');
    const cleanup = () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t=>t.stop()); ov.remove(); };
    ov.querySelector('#sc-x').onclick = cleanup;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream; await video.play();
      const det = new window.BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] });
      const scan = async () => {
        if (stopped) return;
        try { const codes = await det.detect(video); if (codes.length){ const c = codes[0].rawValue; cleanup(); onCode(c); return; } } catch {}
        raf = requestAnimationFrame(scan);
      };
      raf = requestAnimationFrame(scan);
    } catch { cleanup(); toast('No se pudo abrir la cámara'); }
  }

  return { $, el, esc, num, fmtDate, longDate, shortDate, toast, setMain, sheet, sheetOpen, field, segmented, ask, ring, bar, tile,
           chart, chartColors, baseOpts, startRest, stopRest, startMobility, startCoachChat, startScanner };
})();
const Views = {};
