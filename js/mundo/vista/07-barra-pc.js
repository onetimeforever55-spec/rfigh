  // ── GÉNESIS · LA VISTA · La barra de abajo en el PC, con la forma de la de WorldBox ──

  // En el PC los botones de siempre se ven en una barra abajo en el centro, con pestañas encima y botones cuadrados
  // con su icono. No hay nada nuevo: cada botón de la barra pulsa el botón de siempre (que sigue en la página, oculto
  // en el PC) y copia de él si se ve, si está desactivado y si está pulsado. En el móvil no se usa.
  const BARRA_PC = [
    { id: 'mundo', titulo: 'Mundo', icono: 'todo', botones: [
      { de: 'zoom-mas', icono: 'acercar', nombre: 'Acercar' },
      { de: 'zoom-menos', icono: 'alejar', nombre: 'Alejar' },
      { de: 'ver-todo', icono: 'todo', nombre: 'Ver todo el mundo' },
      { de: 'ir-mio', icono: 'casa', nombre: 'Ir a tu pueblo' },
      { de: 'ir-batalla', icono: 'batalla', nombre: 'Ir a la batalla' },
      { de: 'limpio', icono: 'ojo', nombre: 'Ocultar la interfaz' },
    ] },
    { id: 'pueblo', titulo: 'Tu pueblo', icono: 'corte', botones: [
      { hace: 'ordenes', icono: 'ordenes', nombre: 'Órdenes', pista: 'Abrir o cerrar la ventana de órdenes' },
      { de: 'corte-btn', icono: 'corte', nombre: 'La corte' },
      { de: 'tropas-btn', icono: 'tropas', nombre: 'Modo tropas' },
      { de: 'fundar-btn', icono: 'fundar', nombre: 'Fundar pueblo' },
      { de: 'arquitecto-btn', icono: 'arquitecto', nombre: 'Modo arquitecto' },
    ] },
    { id: 'info', titulo: 'Información', icono: 'cronica', botones: [
      { hoja: 'pueblos', icono: 'pueblos', nombre: 'Pueblos', pista: 'Los pueblos del mundo y la ficha del elegido' },
      { hoja: 'cronica', icono: 'cronica', nombre: 'Crónica', pista: 'Lo que va pasando en el mundo' },
      { hoja: 'retos', icono: 'retos', nombre: 'Retos', pista: 'Tus metas y tu puntuación' },
    ] },
    { id: 'ajustes', titulo: 'Ajustes', icono: 'modo', botones: [
      { de: 'sonido', icono: 'sonido', nombre: 'Sonido' },
      { de: 'graficos', icono: 'graficos', nombre: 'Gráficos' },
      { de: 'cambiar-modo', icono: 'modo', nombre: 'Cambiar de modo' },
      { de: 'ayuda-abrir', icono: 'ayuda', nombre: 'Cómo se juega' },
      { de: 'nuevo', icono: 'nuevo', nombre: 'Nuevo mundo' },
    ] },
  ];
  let barraPestana = 'mundo';
  const icoBarra = n => M.arte && M.arte.iconoBarraURL ? '<img class="wb-ico" alt="" src="' + M.arte.iconoBarraURL(n) + '">' : '';
  // La hoja del panel que está abierta (o null si el panel está cerrado).
  const hojaAbierta = () => document.body.classList.contains('sin-panel') ? null : ((document.querySelector('.panel-hoja:not([hidden])') || {}).dataset || {}).hoja || null;
  function atarBarra() {
    if ($('wb')) return;
    const wb = document.createElement('div');
    wb.id = 'wb'; wb.className = 'wb';
    wb.innerHTML = '<div class="wb-pista" id="wb-pista" hidden></div>' +
      '<div class="wb-pestanas" role="tablist">' + BARRA_PC.map(p => '<button type="button" class="wb-pestana" role="tab" data-p="' + p.id + '" aria-label="' + p.titulo + '">' + icoBarra(p.icono) + '</button>').join('') + '</div>' +
      '<div class="wb-barra" role="toolbar">' + BARRA_PC.map(p => '<div class="wb-grupo" data-p="' + p.id + '">' + p.botones.map((b, i) => '<button type="button" class="wb-boton" data-p="' + p.id + '" data-i="' + i + '" aria-label="' + b.nombre + '">' + icoBarra(b.icono) + '</button>').join('') + '</div>').join('') + '</div>';
    document.querySelector('.g').appendChild(wb);
    const de = el => BARRA_PC.find(p => p.id === el.dataset.p).botones[+el.dataset.i];
    for (const t of wb.querySelectorAll('.wb-pestana')) t.addEventListener('click', () => { barraPestana = t.dataset.p; pintarBarra(); });
    for (const el of wb.querySelectorAll('.wb-boton')) {
      el.addEventListener('click', () => {
        const b = de(el);
        if (b.de) { const o = $(b.de); if (o && !o.disabled) o.click(); }
        else if (b.hoja) { if (hojaAbierta() === b.hoja) $('cerrar-panel').click(); else abrirHoja(b.hoja); }
        else if (b.hace === 'ordenes') { if (document.body.classList.contains('sin-ordenes')) { $('abrir-ordenes').click(); } else $('cerrar-ordenes').click(); }
        pintarBarra(); mostrarPista(el);
      });
      el.addEventListener('mouseenter', () => mostrarPista(el));
      el.addEventListener('mouseleave', () => { $('wb-pista').hidden = true; });
    }
    for (const t of wb.querySelectorAll('.wb-pestana')) {
      t.addEventListener('mouseenter', () => { const p = BARRA_PC.find(x => x.id === t.dataset.p); pista(t, p.id === 'pueblo' && !tuPueblo() ? 'Tu voluntad' : p.titulo, ''); });
      t.addEventListener('mouseleave', () => { $('wb-pista').hidden = true; });
    }
    pintarBarra();
    setInterval(pintarBarra, 500);
  }
  // El cartel que sale encima del botón: su nombre y lo que hace (lo mismo que dice el botón de siempre).
  function pista(el, titulo, texto) {
    const p = $('wb-pista'), caja = el.getBoundingClientRect(), wb = $('wb').getBoundingClientRect();
    p.innerHTML = '<b>' + esc(titulo) + '</b>' + (texto ? '<span>' + esc(texto) + '</span>' : '');
    p.hidden = false;
    p.style.left = Math.max(0, Math.min(wb.width - p.offsetWidth, caja.left - wb.left + caja.width / 2 - p.offsetWidth / 2)) + 'px';
  }
  function mostrarPista(el) {
    const b = BARRA_PC.find(p => p.id === el.dataset.p).botones[+el.dataset.i], o = b.de && $(b.de);
    const texto = o ? (o.title || o.getAttribute('aria-label') || '') : b.pista || '';
    const titulo = o && /Sonido|Gráficos|Seguro|Nuevo mundo|Cambiar/.test(o.textContent) ? o.textContent.replace(/^[^\wÁÉÍÓÚáéíóú¿?]+/, '').trim() : b.nombre;
    pista(el, titulo, texto && texto !== titulo ? texto : '');
  }
  function pintarBarra() {
    const wb = $('wb'); if (!wb) return;
    const visible = b => { if (b.de) { const o = $(b.de); return !!o && !o.hidden; } if (b.hace === 'ordenes') return !!$('voluntad'); return true; };
    // Una pestaña sin ningún botón a la vista (el pueblo, en el modo dios sin órdenes) no se enseña.
    for (const p of BARRA_PC) { const t = wb.querySelector('.wb-pestana[data-p="' + p.id + '"]'); t.hidden = !p.botones.some(visible); }
    if (wb.querySelector('.wb-pestana[data-p="' + barraPestana + '"]').hidden) barraPestana = 'mundo';
    for (const t of wb.querySelectorAll('.wb-pestana')) { const on = t.dataset.p === barraPestana; t.classList.toggle('activa', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); }
    for (const g of wb.querySelectorAll('.wb-grupo')) g.hidden = g.dataset.p !== barraPestana;
    const hoja = hojaAbierta();
    for (const el of wb.querySelectorAll('.wb-boton')) {
      const b = BARRA_PC.find(p => p.id === el.dataset.p).botones[+el.dataset.i], o = b.de && $(b.de);
      el.hidden = !visible(b);
      el.disabled = !!(o && o.disabled);
      const pulsado = o ? o.getAttribute('aria-pressed') === 'true' || o.getAttribute('aria-expanded') === 'true' : b.hoja ? hoja === b.hoja : b.hace === 'ordenes' ? !document.body.classList.contains('sin-ordenes') : false;
      el.classList.toggle('activo', pulsado);
    }
  }
