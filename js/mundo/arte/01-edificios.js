  // ── GÉNESIS · EL ARTE · Edificios: casas por época y la casa del saber ──

  // ---------- Edificios ----------
  const PARED = '#e8d8b4', MADERA = '#7a5232', PIEDRA = '#a8a49a', CRISTAL = '#4a6a9a', LUZ = '#ffe08a';
  // Un tejado a dos aguas: tejas en filas, la mitad izquierda iluminada.
  function tejado(H, x0, x1, top, base, col) {
    for (let y = top; y <= base; y++) {
      const inset = Math.round((base - y) * ((x1 - x0) / 2) / (base - top + 1) * 0.5);
      for (let x = x0 + inset; x <= x1 - inset; x++) {
        const izq = x < (x0 + x1) / 2;
        let c = izq ? claro(col, 0.08) : oscuro(col, 0.14);
        if ((y - top) % 2 === 1) c = oscuro(c, 0.12);
        H.p(x, y, c);
      }
    }
    for (let x = x0 + Math.round((x1 - x0) / 4); x <= x1 - Math.round((x1 - x0) / 4); x++) H.p(x, top, claro(col, 0.3));
  }
  function ventana(H, x, y, luz) { H.r(x, y, 2, 2, luz ? LUZ : CRISTAL); H.p(x, y, luz ? '#fff4c0' : '#7a9aca'); }
  function casa(estilo, col, v) {
    return guardado('h' + estilo + col + v, () => {
      const H = hoja(T, T);
      if (estilo === 'choza') {
        // Choza redonda de barro con techo de paja cónico (la paja, del color del pueblo).
        for (let y = 9; y < 15; y++) for (let x = 3; x < 13; x++) { const dx = (x + 0.5 - 8) / 5; if (dx * dx < 1) H.p(x, y, x < 7 ? '#c8a070' : x > 10 ? '#9a7448' : '#b08a5a'); }
        H.r(7, 11, 2, 4, '#4a3020');
        const paja = mezcla(col, '#d8b060', 0.45);
        for (let y = 2; y < 11; y++) { const half = Math.round((y - 1) * 0.72); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 === 0 ? oscuro(paja, 0.2) : x < 8 ? claro(paja, 0.1) : oscuro(paja, 0.08)); }
        H.p(7, 1, oscuro(paja, 0.3)); H.p(8, 1, oscuro(paja, 0.3));
      } else if (estilo === 'casa') {
        // Casa de madera y piedra con tejado de tejas, chimenea, puerta y ventana.
        H.r(2, 8, 12, 7, PARED); H.r(2, 8, 1, 7, MADERA); H.r(13, 8, 1, 7, MADERA); H.r(2, 14, 12, 1, oscuro(PARED, 0.2));
        H.r(7, 10, 2, 5, '#6a4024'); H.p(8, 12, '#d8b060');
        ventana(H, 4, 10, v % 2 === 0); ventana(H, 10, 10, v % 3 === 0);
        H.r(11, 2, 2, 4, '#8a8690'); H.r(11, 2, 2, 1, '#5a5860');
        tejado(H, 1, 14, 3, 8, col);
      } else if (estilo === 'entramado') {
        // Dos plantas de entramado de madera, ventanas en las dos, tejado alto.
        H.r(2, 6, 12, 9, '#f0e6d0');
        for (const x of [2, 7, 8, 13]) H.r(x, 6, 1, 9, '#5a3a22');
        H.r(2, 10, 12, 1, '#5a3a22'); H.r(2, 6, 12, 1, '#5a3a22');
        for (let k = 0; k < 4; k++) { H.p(3 + k, 7 + k * 0.75, '#5a3a22'); H.p(12 - k, 7 + k * 0.75, '#5a3a22'); }
        ventana(H, 4, 11, v % 2 === 0); ventana(H, 10, 11, false); ventana(H, 10, 7, v % 3 === 0);
        H.r(7, 12, 2, 3, '#6a4024');
        tejado(H, 1, 14, 0, 6, col);
      } else {
        // Bloque de pisos: hormigón, rejilla de ventanas (algunas encendidas) y una franja del color del pueblo.
        H.r(2, 2, 12, 13, '#b8bcc4'); H.r(2, 2, 1, 13, '#d4d8de'); H.r(13, 2, 1, 13, '#8a8e96');
        H.r(2, 1, 12, 2, col); H.r(2, 1, 12, 1, claro(col, 0.25));
        const r = azar(v + 3);
        for (let y = 4; y < 12; y += 3) for (let x = 4; x < 12; x += 3) ventana(H, x, y, r() < 0.3);
        H.r(7, 12, 2, 3, '#4a4e58');
      }
      H.contorno();
      return H.lienzo();
    });
  }
  function edificio(nombre, col, fase) {
    fase = fase || 0;
    return guardado('e' + nombre + col + fase, () => {
      const H = hoja(T, T);
      if (nombre === 'torre' && fase !== 1) return torreDeFase(H, fase, col);
      if (nombre === 'cuartel') return cuartel(H, fase, col);
      if (nombre === 'arqueria') return arqueria(H, fase, col);
      if (nombre === 'castillo') return castillo(H, fase, col);
      if (nombre === 'saber') return casaSaber(H, fase, col);
      if (nombre === 'pozo') return pozo(H, fase, col);
      if (nombre === 'granero') return granero(H, fase, col);
      if (nombre === 'fuente') return fuente(H, fase, col);
      if (nombre === 'parque') return parque(H, fase, col);
      if (nombre === 'palacio') return palacio(H, fase, col);
      if (nombre === 'central') return central(H, fase, col);
      if (nombre === 'banco') return banco(H, fase, col);
      if (nombre === 'campamento') return campamento(H, fase, col);
      if (nombre === 'fabrica') return fabrica(H, fase, col);
      if (nombre === 'estacion') return estacion(H, fase, col);
      if (nombre === 'hospital') return hospital(H, fase, col);
      if (nombre === 'aerodromo') return aerodromo(H, fase, col);
      if (nombre === 'aduana') return aduana(H, fase, col);
      if (nombre === 'petroleo') return pozoPetroleo(H, fase, col);
      if (nombre === 'mina') return mina(H, fase, col);
      if (nombre === 'minapriv') return minaPrivada(H, fase, col);
      if (nombre === 'fab_textil') return fabTextil(H, fase, col);
      if (nombre === 'fab_aserradero') return fabAserradero(H, fase, col);
      if (nombre === 'fab_fundicion') return fabFundicion(H, fase, col);
      if (nombre === 'fab_conservera') return fabConservera(H, fase, col);
      if (nombre === 'fab_ferrocarril') return estacionPrivada(H, fase, col);
      if (nombre === 'inmopriv') return inmobiliaria(H, fase, col);
      if (nombre === 'gremio') return gremio(H, fase, col);
      if (nombre === 'bancopriv') return bancoPrivado(H, fase, col);
      if (nombre === 'muelle') return muelle(H, fase, col);
      if (nombre === 'casona') return casona(H, fase, col);
      if (nombre === 'templo' && fase === 4) return iglesia(H, col);
      if (nombre === 'templo' && fase !== 1) return temploDeFase(H, fase, col);
      if (nombre === 'molino' && fase !== 1) return molinoDeFase(H, fase, col);
      if (nombre === 'puerto' && fase !== 1) return puertoDeFase(H, fase, col);
      if (nombre === 'ayuntamiento' && fase !== 1) return ayuntamientoDeFase(H, fase, col);
      if (nombre === 'ayuntamiento') {
        H.r(1, 8, 14, 7, '#e0d0a8'); H.r(1, 14, 14, 1, '#a89a7a');
        for (const x of [2, 5, 10, 13]) H.r(x, 9, 1, 5, '#f4ecd8');
        H.r(7, 10, 2, 5, '#5a3a22'); ventana(H, 3, 10, true); ventana(H, 11, 10, true);
        tejado(H, 0, 15, 4, 8, col);
        H.r(7, 0, 2, 4, '#c8b890'); H.p(7, 1, '#e0b040'); H.p(8, 1, '#e0b040');
      } else if (nombre === 'torre') {
        // Torre de piedra almenada con aspillera y puerta.
        H.r(4, 3, 8, 12, PIEDRA); H.r(4, 3, 2, 12, claro(PIEDRA, 0.18)); H.r(10, 3, 2, 12, oscuro(PIEDRA, 0.2));
        for (let y = 5; y < 15; y += 3) for (let x = 4; x < 12; x += 4) H.r(x + (y % 2) * 2, y, 2, 1, oscuro(PIEDRA, 0.12));
        for (const x of [3, 6, 9, 12]) H.r(x, 1, 2, 2, PIEDRA);
        H.r(3, 3, 10, 1, oscuro(PIEDRA, 0.25));
        H.r(7, 6, 1, 3, '#2a2a30'); H.r(7, 12, 2, 3, '#4a3020');
        H.r(4, 14, 2, 1, '#5a8a3a');
      } else if (nombre === 'templo') {
        // Templo de columnas blancas con frontón del color del pueblo.
        H.r(1, 13, 14, 2, '#d8d0bc'); H.r(2, 12, 12, 1, '#e8e0cc');
        for (const x of [3, 6, 9, 12]) { H.r(x, 7, 2, 5, '#f4f0e4'); H.p(x + 1, 7, '#c8c0ac'); }
        H.r(2, 6, 12, 1, '#e8e0cc');
        for (let y = 2; y < 6; y++) { const half = Math.round((y - 1) * 1.8); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.1) : oscuro(col, 0.1)); }
        H.p(7, 4, '#ffe08a'); H.p(8, 4, '#ffe08a');
      } else if (nombre === 'molino') {
        // El cuerpo del molino (las aspas giran aparte).
        for (let y = 5; y < 15; y++) { const half = 2 + Math.round((y - 5) * 0.3); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 7 ? '#f4ecd8' : x > 9 ? '#c8b898' : '#e8dcc0'); }
        H.r(7, 11, 2, 4, '#5a3a22'); ventana(H, 7, 7, false);
        for (let y = 1; y < 6; y++) { const half = Math.round(y * 0.8) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.1) : oscuro(col, 0.15)); }
      } else if (nombre === 'puerto') {
        // Muelle de tablas sobre pilotes, con un barril y un rollo de cuerda.
        H.r(0, 5, 16, 6, '#9a6a3a');
        for (let x = 1; x < 16; x += 3) H.r(x, 5, 1, 6, '#7a5028');
        H.r(0, 5, 16, 1, '#b88a52');
        for (const x of [1, 7, 13]) H.r(x, 11, 2, 3, '#5a3a22');
        H.r(10, 2, 3, 4, '#8a5a2a'); H.r(10, 3, 3, 1, '#4a4a52'); H.r(3, 3, 3, 2, '#c8b07a'); H.p(4, 3, '#8a7040');
      } else if (nombre === 'ruina') {
        H.r(2, 8, 3, 6, PIEDRA); H.r(2, 6, 2, 2, PIEDRA); H.r(10, 9, 4, 5, PIEDRA); H.r(12, 7, 2, 2, PIEDRA);
        for (const [x, y] of [[6, 13], [7, 12], [8, 13], [5, 14], [9, 14]]) H.p(x, y, oscuro(PIEDRA, 0.15));
        H.r(3, 13, 2, 1, '#5a8a3a'); H.p(11, 8, '#5a8a3a'); H.p(12, 13, '#6a9a4a');
      }
      H.contorno();
      return H.lienzo();
    });
  }
  // Torres según la fase: empalizada de troncos (tribal), piedra (medieval), torre artillada (pólvora), búnker con ametralladora.
  // ---------- La casa del saber de cada época (donde estudian los eruditos) ----------
  function casaSaber(H, tipo, col) {
    if (tipo === 'chaman' || tipo === 0) {
      // Tienda de pieles del chamán, un tótem pintado y una hoguera con humo.
      for (let y = 4; y < 15; y++) { const half = Math.round((y - 3) * 0.55); for (let x = 6 - half; x <= 6 + half; x++) H.p(x, y, x < 6 ? '#c8a070' : '#a07a4a'); }
      for (let y = 4; y < 15; y += 3) H.p(6, y, '#6a4a2a'); H.r(5, 11, 2, 4, '#3a2416'); H.p(6, 3, '#6a4a2a'); H.p(5, 2, '#6a4a2a'); H.p(7, 2, '#6a4a2a');
      H.r(12, 3, 2, 12, '#8a5a32'); H.r(12, 3, 2, 2, col); H.r(11, 5, 4, 1, '#c83a2a'); H.r(12, 7, 2, 2, '#f0c040'); H.p(12, 7, '#1a1a1a'); H.p(13, 10, '#3a8ad0');
      H.r(9, 13, 3, 1, '#5a3a22'); H.p(10, 12, '#ff8a1e'); H.p(9, 12, '#ffd84a'); H.p(10, 11, '#ffd84a');
      H.contorno(); return H.lienzo();
    }
    if (tipo === 'filosofo') {
      // Academia: pórtico de columnas, escalones, un banco de piedra y rollos.
      H.r(1, 13, 14, 2, '#d8d0bc'); H.r(2, 12, 12, 1, '#e8e0cc');
      for (const x of [2, 5, 8, 11]) { H.r(x, 6, 2, 6, '#f4f0e4'); H.p(x, 6, '#c8c0ac'); }
      H.r(1, 4, 14, 2, '#e8e0cc'); H.r(1, 4, 14, 1, col); H.r(3, 2, 10, 2, '#e8e0cc');
      H.r(6, 9, 4, 1, '#efe2b8'); H.p(13, 11, '#efe2b8');
      H.contorno(); return H.lienzo();
    }
    if (tipo === 'monje') {
      // Monasterio: muros de piedra, tejado, campanario con su campana y una ventana de arco.
      H.r(1, 7, 10, 8, PIEDRA); H.r(1, 7, 1, 8, claro(PIEDRA, 0.15)); tejado(H, 0, 11, 3, 7, oscuro(col, 0.1));
      H.r(11, 2, 4, 13, oscuro(PIEDRA, 0.05)); H.r(11, 2, 4, 1, oscuro(col, 0.2)); H.r(12, 4, 2, 2, '#2a2a30'); H.p(12, 5, '#e0b040'); H.p(13, 5, '#e0b040');
      H.r(12, 0, 2, 2, oscuro(col, 0.2)); H.p(12, -1 + 1, '#e0c060');
      H.r(4, 10, 2, 3, '#2a2a30'); H.p(4, 9, '#2a2a30'); H.p(5, 9, '#2a2a30'); H.r(8, 11, 2, 4, '#4a3020');
      H.contorno(); return H.lienzo();
    }
    if (tipo === 'erudito') {
      // Universidad: fachada clara con cúpula, reloj y ventanales.
      H.r(1, 8, 14, 7, '#e8dcc4'); H.r(1, 14, 14, 1, '#b8a888');
      for (const x of [2, 5, 10, 13]) ventana(H, x, 10, true);
      H.r(7, 11, 2, 4, '#5a3a22');
      for (let y = 2; y < 8; y++) { const half = Math.round(Math.sqrt(Math.max(0, 9 - (y - 7) * (y - 7) * 0.25)) * 1.4); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.15) : oscuro(col, 0.12)); }
      H.r(7, 0, 2, 2, '#e0b040'); H.r(7, 5, 2, 2, '#f4f4f4'); H.p(8, 6, '#2a2a2a');
      H.contorno(); return H.lienzo();
    }
    // Laboratorio y observatorio: ladrillo, chimenea humeante y cúpula con telescopio.
    H.r(1, 7, 10, 8, '#a0503a'); for (let y = 8; y < 15; y += 2) for (let x = 1 + (y % 4 ? 0 : 1); x < 11; x += 3) H.p(x, y, '#8a3e2a');
    H.r(2, 9, 2, 2, LUZ); H.r(6, 9, 2, 2, LUZ); H.r(4, 12, 2, 3, '#3a2a2a'); H.r(2, 4, 2, 3, '#6a3a2a');
    H.r(10, 9, 5, 6, '#c8ccd4'); for (let y = 4; y < 9; y++) { const half = Math.round(Math.sqrt(Math.max(0, 6.25 - (y - 9) * (y - 9) * 0.25))); for (let x = 12 - half; x <= 12 + half; x++) H.p(x, y, '#e4e8ee'); }
    H.r(12, 2, 1, 4, '#3a3a44'); H.p(13, 2, '#3a3a44'); H.p(12, 6, col);
    H.contorno(); return H.lienzo();
  }
  /*
   * El adoquín de las plazas: piedras en anillos alrededor del centro de la plaza (dx, dy en píxeles de arte
   * desde el centro), con juntas oscuras y piedras de tres tonos. Lo usan la fuente y las parcelas de su
   * explanada, así el dibujo sigue sin cortes de una parcela a otra.
   */
  const LOSAS = [['#b8a888', '#a8987a', '#c4b494', '#8a7a5e'], ['#b4aea2', '#a29c90', '#c4beb2', '#7e786e'], ['#c8bca8', '#b8ac98', '#d6ccb8', '#8e8474'], ['#c4c4c0', '#b0b0ac', '#d4d4d0', '#8c8c88']];
  function piedraPlaza(dx, dy, fase) {
    const L = LOSAS[Math.max(0, Math.min(3, fase))], d = Math.sqrt(dx * dx + dy * dy);
    const anillo = Math.floor(d / 2.6), fr = d / 2.6 - anillo;
    if (anillo === 0) return L[2];
    const n = Math.max(6, anillo * 7), ang = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * n + (anillo % 2) * 0.5, seg = Math.floor(ang), fs = ang - seg;
    if (fr < 0.26 || fs < 0.13) return L[3];
    const h = ((anillo * 73856093) ^ (seg * 19349663)) >>> 0;
    return L[h % 3];
  }
