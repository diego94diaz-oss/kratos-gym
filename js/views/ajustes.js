// ============================================================
//  VISTA Ajustes — perfil, instalación, recordatorios y datos
// ============================================================
Views.ajustes = () => {
  const { el, esc, field, num } = UI;
  const c = App.cache, x = App.ctx(), p = c.profile || {}, sp = c.salud?.perfil || {}, w = el('div');
  const back = el('header','page-hd','<button class="btn-link" id="bk">‹ Volver</button><h1>Ajustes</h1>');
  back.querySelector('#bk').onclick = () => App.go('hoy'); w.appendChild(back);

  // --- Instalar ---
  const inst = el('section','card');
  if (App.isInstalled()) inst.innerHTML = '<h3>📲 App instalada</h3><p class="help">Ya estás usando la versión instalada.</p>';
  else if (App.canInstall()) { inst.innerHTML = '<h3>📲 Instalar en el celular</h3><p class="help">Queda en tu pantalla de inicio, a pantalla completa y funciona sin señal.</p><button class="btn btn-primary wide">Instalar</button>'; inst.querySelector('button').onclick = App.install; }
  else inst.innerHTML = `<h3>📲 Instalar en el celular</h3><p class="help">${/iphone|ipad/i.test(navigator.userAgent)?'En Safari: Compartir → «Agregar a inicio».':'En Chrome: menú ⋮ → «Instalar app» o «Agregar a la pantalla principal».'}</p>`;
  w.appendChild(inst);

  // --- Perfil ---
  const pc = el('section','card');
  const fromSalud = sp.estatura_cm || sp.nacimiento;
  pc.innerHTML = `<h3>Perfil</h3>${fromSalud?`<p class="help">Edad, estatura y sexo vienen de Mi Salud: ${x.profile.edad??'—'} años · ${num(x.profile.estatura_cm)} cm.</p>`:`
    <div class="grid3">${field('Edad',`<input id="p-edad" type="number" inputmode="numeric" value="${p.edad??''}">`)}${field('Estatura',`<input id="p-est" type="number" inputmode="decimal" value="${p.estatura_cm??''}">`)}${field('Sexo',`<select id="p-sexo"><option value="h" ${p.sexo!=='m'?'selected':''}>Hombre</option><option value="m" ${p.sexo==='m'?'selected':''}>Mujer</option></select>`)}</div>`}
    ${field('Nombre',`<input id="p-nom" value="${esc(p.nombre||'')}">`)}
    ${field('Actividad diaria',`<select id="p-act">${Logic.ACTIVITY.map(([v,l])=>`<option value="${v}" ${Number(p.actividad||1.45)===v?'selected':''}>${l}</option>`).join('')}</select>`)}
    ${field('Objetivo',`<select id="p-obj">${[['recomposicion','Recomposición'],['perder','Perder grasa'],['ganar','Ganar músculo'],['mantener','Mantener'],['fuerza','Fuerza']].map(([v,t])=>`<option value="${v}" ${p.objetivo===v?'selected':''}>${t}</option>`).join('')}</select>`)}
    ${field('% de grasa medido (DEXA o similar, opcional)',`<input id="p-bf" type="number" inputmode="decimal" step="0.1" value="${p.grasa_pct??''}">`)}
    <button class="btn btn-primary wide" id="p-save">Guardar perfil</button>`;
  pc.querySelector('#p-save').onclick = () => { const v = q => pc.querySelector(q)?.value, data = {
      nombre:v('#p-nom')||null, actividad:Number(v('#p-act'))||1.45, objetivo:v('#p-obj'), grasa_pct:Number(v('#p-bf'))||null };
    if (!fromSalud) Object.assign(data, { edad:Number(v('#p-edad'))||null, estatura_cm:Number(v('#p-est'))||null, sexo:v('#p-sexo') });
    App.saveProfile(data); };
  w.appendChild(pc);

  // --- Notificaciones ---
  const rem = p.reminders || {}, nf = el('section','card');
  const row = (id,label,on,hora) => `<div class="rem"><label class="check"><input type="checkbox" id="rm-${id}" ${on?'checked':''}><span>${label}</span></label>${hora!==undefined?`<input type="time" id="rh-${id}" value="${hora}" aria-label="Hora">`:''}</div>`;
  nf.innerHTML = `<h3>🔔 Recordatorios</h3><p class="help" id="nz-st">Comprobando…</p><div class="row-btns"><button class="btn btn-primary" id="nz-on">Activar</button><button class="btn btn-ghost" id="nz-t">Probar</button></div>
    ${row('ent','🏋️ Entrenar',rem.entrenar?.on,rem.entrenar?.hora||'18:00')}${row('pes','⚖️ Pesarme',rem.pesarse?.on,rem.pesarse?.hora||'08:00')}${row('com','🍽️ Anotar comidas',rem.comidas?.on,rem.comidas?.hora||'21:00')}${row('agu','💧 Agua',rem.agua?.on,rem.agua?.hora||'16:00')}
    <p class="help">Solo te avisa si hace falta: no recuerda entrenar si ya entrenaste hoy.</p><button class="btn btn-ghost wide" id="nz-s">Guardar recordatorios</button><button class="btn-link" id="nz-off">Desactivar en este dispositivo</button>`;
  const st = nf.querySelector('#nz-st');
  (async () => { try { if (!Push.supported()) return st.textContent='Este dispositivo no permite notificaciones.'; st.textContent = await Push.isSubscribed() ? '✅ Activadas en este dispositivo.' : 'Desactivadas en este dispositivo.'; } catch { st.textContent=''; } })();
  nf.querySelector('#nz-on').onclick = App.pushEnable; nf.querySelector('#nz-t').onclick = App.pushTest; nf.querySelector('#nz-off').onclick = App.pushDisable;
  nf.querySelector('#nz-s').onclick = () => { const g = (id,k) => ({ on:nf.querySelector('#rm-'+id).checked, hora:nf.querySelector('#rh-'+id).value });
    App.saveReminders({ entrenar:g('ent'), pesarse:g('pes'), comidas:g('com'), agua:g('agu') }); };
  w.appendChild(nf);

  // --- Datos ---
  const dt = el('section','card');
  dt.innerHTML = `<h3>Tus datos</h3><div class="row-btns"><button class="btn btn-ghost" id="e1">⬇️ Entrenamientos</button><button class="btn btn-ghost" id="e2">⬇️ Peso</button></div>
    <label class="field"><span>Importar entrenamientos.csv</span><input type="file" id="imp" accept=".csv"></label>`;
  dt.querySelector('#e1').onclick = () => App.exportCSV('entrenamientos'); dt.querySelector('#e2').onclick = () => App.exportCSV('peso');
  dt.querySelector('#imp').onchange = e => e.target.files[0] && App.importCSV(e.target.files[0]);
  w.appendChild(dt);

  const ac = el('section','card',`<h3>Cuenta</h3><p class="muted">${esc(DB.currentUserEmail||'')}</p><button class="btn btn-ghost wide">Cerrar sesión</button>`);
  ac.querySelector('button').onclick = App.signOut; w.appendChild(ac);
  return w;
};
