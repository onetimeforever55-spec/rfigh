  // ── GÉNESIS · EL ARTE · Aldeanos, tiradores, vehículos, barcos e iconos ──

  // ---------- Aldeanos (12×14, los pies abajo en el centro) ----------
  // o: oficio; edad: 'nino' | 'adulto' | 'viejo'; paso: 0/1 (piernas); alto: -1/0/1 (herramienta arriba o abajo);
  // carga: lleva troncos o piedras; arma, tirador, armadura: los guerreros. pelo: 0..3.
  const PIEL = ['#f0c8a0', '#d8a878', '#b07a50', '#8a5a3a'], PELO = ['#3a2418', '#1e1a1a', '#c89a4a', '#7a3a1e'];
  const MAT = ['#a3a9b5', '#8a5a32', '#c89a3a', '#8a909c', '#cfd6e2', '#b8c0cc', '#6a7a5a'];
  /*
   * EL TIRADOR EN COMBATE: posturas de tiro, mirando a la derecha (el pintor lo voltea si el blanco está a la
   * izquierda). 'apunta': de pie con el arma al hombro (honda, pólvora temprana); 'rodilla': rodilla en tierra
   * (arcabuz, espingarda); 'tierra': cuerpo a tierra (fusil moderno); 'arco': tensando el arco (tenso = cuerda
   * atrás, con la flecha). Devuelve el dibujo y dónde está la boca del arma, para el fogonazo.
   */
  const BOCA = { apunta: [15, 7], rodilla: [15, 9], tierra: [15, 10], arco: [13, 7] };
  function tiradorEnPose(o) {
    const clave = 'tp' + [o.col, o.pose, o.tenso ? 1 : 0, o.arma, o.armadura, o.piel, o.pelo].join(':');
    return guardado(clave, () => {
      const H = hoja(16, 14), piel = PIEL[o.piel || 0], pelo = PELO[o.pelo || 0], arm = o.armadura ? MAT[o.armadura] : null;
      const unif = (o.arma || 0) >= 6 ? ((o.arma || 0) >= 7 ? mezcla(o.col, '#4a4a3a', 0.4) : o.col) : null;
      const ropa = unif || arm || o.col, pierna = unif ? oscuro(unif, 0.3) : '#4a3a2e', fuego = (o.arma || 0) >= 5, culata = '#7a4a22', canon = '#3a3a44';
      const casco = (x, y) => {
        if (unif) { const c_ = o.arma >= 7 ? oscuro(unif, 0.25) : oscuro(unif, 0.55); H.r(x - 1, y - 1, 5, 2, c_); H.r(x - 2, y, 7, 1, oscuro(c_, 0.2)); }
        else if (fuego) { H.r(x - 1, y - 1, 5, 2, o.arma >= 7 ? '#5a6a4a' : '#2a2a3a'); H.r(x - 2, y, 7, 1, o.arma >= 7 ? '#4a5a3a' : '#1a1a2a'); }
        else if ((o.arma || 0) >= 1) { H.r(x - 1, y - 1, 5, 2, '#4a7a3a'); H.p(x - 1, y + 1, '#4a7a3a'); }
        else { H.r(x, y - 1, 3, 1, pelo); H.p(x - 1, y, pelo); }
      };
      const cabeza = (x, y) => { H.r(x, y, 3, 4, piel); H.r(x + 2, y, 1, 4, oscuro(piel, 0.12)); H.p(x + 2, y + 2, '#2a1e1a'); H.r(x, y - 1, 3, 1, pelo); casco(x, y); };
      const torso = (x, y, w, h) => { H.r(x, y, w, h, ropa); H.r(x, y, w, 1, claro(ropa, 0.15)); if (arm && !unif) H.r(x + Math.floor(w / 2), y, 1, h, o.col); H.r(x, y + h - 1, w, 1, oscuro(ropa, 0.3)); };
      if (o.pose === 'tierra') {
        // Tumbado boca abajo: piernas atrás, el cuerpo pegado al suelo, la cabeza alzada y el fusil al frente.
        H.r(0, 12, 4, 1, pierna); H.p(0, 11, '#2a1e14'); H.p(1, 13, '#2a1e14');
        torso(3, 11, 6, 2);
        H.p(9, 12, ropa); H.p(10, 12, piel);
        cabeza(9, 8);
        H.r(8, 10, 3, 1, culata); H.r(11, 10, 5, 1, canon); H.p(10, 11, culata);
      } else if (o.pose === 'rodilla') {
        // Rodilla en tierra: una pierna doblada con la rodilla en el suelo, la otra delante; el arma al hombro.
        H.r(3, 12, 3, 1, pierna); H.p(2, 12, '#2a1e14');
        H.r(6, 11, 2, 1, pierna); H.r(7, 12, 1, 1, pierna); H.p(7, 13, '#2a1e14');
        torso(4, 8, 5, 4);
        cabeza(5, 4);
        H.p(9, 9, ropa); H.p(10, 9, piel); H.p(8, 10, piel);
        H.r(7, 9, 3, 1, culata); H.r(10, 9, 6, 1, canon); if (o.arma === 6) H.p(15, 8, '#dfe4ec');
      } else if (o.pose === 'arco') {
        // Tensando el arco: brazo delantero estirado con el arco, el de atrás tira de la cuerda (y suelta).
        H.r(5, 11, 1, 2, pierna); H.r(7, 11, 1, 2, pierna); H.p(5, 12, '#2a1e14'); H.p(7, 12, '#2a1e14');
        torso(4, 7, 5, 4);
        cabeza(5, 3);
        H.r(9, 7, 2, 1, ropa); H.p(11, 7, piel);
        for (const [x, y] of [[11, 3], [12, 4], [12, 5], [12, 6], [12, 7], [12, 8], [12, 9], [12, 10], [11, 11]]) H.p(x, y, '#8a5a2b');
        const cuerda = o.tenso ? 8 : 11;
        H.p(11, 4, '#e8e0c8'); H.p(11, 10, '#e8e0c8'); for (let y = 5; y <= 9; y++) H.p(y === 7 ? cuerda : Math.round(11 + (cuerda - 11) * (1 - Math.abs(y - 7) / 3)), y, '#e8e0c8');
        if (o.tenso) { H.r(8, 7, 6, 1, '#c8a050'); H.p(14, 7, '#cfd6e2'); H.p(8, 7, piel); }
      } else {
        // De pie apuntando: el arma al hombro y los dos brazos al frente.
        H.r(5, 11, 1, 2, pierna); H.r(7, 11, 1, 2, pierna); H.p(5, 12, '#2a1e14'); H.p(7, 12, '#2a1e14');
        torso(4, 7, 5, 4);
        cabeza(5, 3);
        H.p(9, 8, ropa); H.p(10, 8, piel); H.p(8, 9, piel);
        if (fuego) { H.r(7, 7, 3, 1, culata); H.r(10, 7, 6, 1, canon); }
        else { H.r(9, 6, 1, 3, '#7a5232'); H.p(10, 5, '#c8b07a'); H.p(10, 7, '#a3a1aa'); }
      }
      H.contorno(0.6);
      return H.lienzo();
    });
  }
  function aldeano(o) {
    const clave = 'v' + [o.col, o.oficio, o.edad, o.paso, o.corre ? 1 : 0, o.alto, o.carga, o.arma, o.tirador ? 1 : 0, o.armadura, o.piel, o.pelo, o.sabio || '', o.traje || 0].join(':');
    return guardado(clave, () => {
      const H = hoja(12, 14), piel = PIEL[o.piel || 0], pelo = o.edad === 'viejo' ? '#e8e8ec' : PELO[o.pelo || 0];
      if (o.edad === 'nino') {
        // Niño: más bajito y cabezón.
        const pn = o.paso || 0; H.p(pn === 1 ? 4 : 5, 12, '#3a2a1e'); H.p(pn === 3 ? 8 : pn === 1 ? 7 : 6 + (pn === 0 ? 1 : 0), 12, '#3a2a1e');
        H.r(5, 9, 3, 3, o.col); H.p(7, 10, oscuro(o.col, 0.2));
        H.r(5, 6, 3, 3, piel); H.p(7, 7, '#2a1e1a'); H.r(5, 5, 3, 1, pelo); H.p(4, 6, pelo);
        H.contorno(0.6);
        return H.lienzo();
      }
      const guerrero = o.oficio === 'guerrero', arm = guerrero && o.armadura ? MAT[o.armadura] : null;
      // Desde la Revolución Industrial el soldado viste uniforme del color de su reino: vistoso con la espingarda,
      // apagado (de campaña) en la era moderna y la Segunda Guerra Mundial.
      const unif = guerrero && (o.arma || 0) >= 6 ? ((o.arma || 0) >= 7 ? mezcla(o.col, '#4a4a3a', 0.4) : o.col) : null;
      // Piernas (al andar, una adelantada) y zapatos.
      // Piernas: quieto, o un ciclo de cuatro tiempos al andar (zancada, cruce, zancada con la otra, cruce);
      // al correr, la zancada es más larga y la rodilla sube. La pierna de delante va un poco más oscura.
      // El traje de mercaderes y empresarios: 1 = casaca y sombrero de ala (hasta la Revolución Industrial),
      // 2 = traje oscuro, camisa blanca, corbata del color del reino y chistera.
      const traje = !guerrero && o.traje ? o.traje : 0, tela = traje === 2 ? '#24242c' : traje === 1 ? '#5a2a2a' : null;
      const pierna = unif ? oscuro(unif, 0.3) : tela ? oscuro(tela, 0.1) : '#4a3a2e', lejana = unif ? oscuro(unif, 0.45) : tela ? oscuro(tela, 0.3) : '#3a2e24', zapato = '#2a1e14', pn = o.paso || 0, larga = o.corre ? 1 : 0;
      const pie = (x, y, col) => { H.p(x, y - 1, col); H.p(x, y, zapato); };
      if (pn === 0) { H.r(5, 11, 1, 2, pierna); H.r(7, 11, 1, 2, pierna); H.p(5, 12, zapato); H.p(7, 12, zapato); }
      else if (pn === 1 || pn === 3) {
        // Zancada: una pierna atrás y la otra delante (se alternan cuál va cerca).
        const atras = pn === 1 ? lejana : pierna, delante = pn === 1 ? pierna : lejana;
        H.p(5, 11, atras); H.p(7, 11, delante); pie(4 - larga, 12, atras); pie(8 + larga, 12, delante);
      } else {
        // Cruce: las piernas pasan una junto a otra; la que va en el aire, con la rodilla doblada.
        const apoyo = pn === 2 ? pierna : lejana, aire = pn === 2 ? lejana : pierna;
        H.r(6, 11, 1, 2, apoyo); H.p(6, 12, zapato); H.p(7, 11, aire); H.p(7 + larga, 12 - larga, aire);
      }
      // Cuerpo con la ropa del color del pueblo (o la armadura con un tabardo del color del pueblo), cinturón.
      const ropa = unif || arm || tela || o.col;
      H.r(4, 7, 5, 4, ropa); H.r(4, 7, 1, 4, claro(ropa, 0.15)); H.r(8, 7, 1, 4, oscuro(ropa, 0.2));
      if (arm && !unif) H.r(6, 7, 1, 4, o.col);
      if (traje === 2) { H.p(6, 7, '#f2efe8'); H.p(5, 7, '#f2efe8'); H.p(6, 8, o.col); H.p(6, 9, oscuro(o.col, 0.2)); H.p(8, 8, '#c8a050'); }
      else if (traje === 1) { H.r(6, 7, 1, 3, '#e8d8b0'); H.r(4, 10, 5, 1, '#c8a050'); }
      H.r(4, 10, 5, 1, oscuro(ropa, 0.35));
      // Correajes: bandolera blanca y botones dorados con la espingarda; cinturón y tirantes de cuero en la era moderna.
      if (unif && (o.arma || 0) === 6) { H.p(4, 7, '#f0ece0'); H.p(5, 8, '#f0ece0'); H.p(6, 9, '#f0ece0'); H.r(4, 10, 5, 1, '#f0ece0'); H.p(7, 7, '#c8a050'); H.p(7, 8, '#c8a050'); }
      else if (unif) { H.r(4, 10, 5, 1, '#3a2a1a'); H.p(5, 7, '#3a2a1a'); H.p(5, 8, '#3a2a1a'); H.p(6, 10, '#c8a050'); }
      // Brazos: balancean al andar (el de atrás siempre; el de delante solo si no lleva nada en la mano).
      const mano = !!(o.carga || ['lenador', 'minero', 'granjero', 'constructor'].includes(o.oficio) || guerrero);
      const vaivenAtras = pn === 1 ? -1 : pn === 3 ? 1 : 0, vaivenDelante = mano ? 0 : -vaivenAtras;
      H.p(3, 8, ropa); H.p(3 + (vaivenAtras > 0 ? 0 : vaivenAtras), 9 + (vaivenAtras > 0 ? 1 : 0), piel);
      H.p(9, 8, ropa); H.p(9 + (vaivenDelante < 0 ? 1 : 0), 9 + (vaivenDelante > 0 ? 1 : 0), piel);
      // Cabeza, ojo y pelo.
      H.r(5, 3, 3, 4, piel); H.r(7, 3, 1, 4, oscuro(piel, 0.12)); H.p(7, 5, '#2a1e1a');
      H.r(5, 2, 3, 1, pelo); H.p(4, 3, pelo); H.p(5, 3, pelo);
      // Sombreros y cascos según el oficio.
      if (o.oficio === 'granjero') { H.r(3, 2, 7, 1, '#e2c25a'); H.r(5, 1, 3, 1, '#d0b048'); }
      else if (o.oficio === 'minero') { H.r(4, 1, 5, 2, '#c8a03a'); H.p(7, 2, '#fff4a0'); }
      else if (traje === 2) { H.r(4, 0, 5, 3, '#16161c'); H.r(4, 2, 5, 1, oscuro(o.col, 0.3)); H.r(3, 3, 7, 1, '#101014'); H.p(5, 0, '#3a3a44'); H.p(5, 1, '#2a2a32'); }
      else if (traje === 1) { H.r(4, 0, 5, 2, '#3a2a1e'); H.r(2, 2, 9, 1, '#2a1e14'); H.p(8, 0, '#e8e0c8'); H.p(9, 0, '#d8d0b8'); }
      else if (o.oficio === 'comerciante') { H.r(4, 1, 5, 2, '#7a3a1a'); H.r(3, 2, 7, 1, '#5a2a12'); }
      else if (o.oficio === 'constructor') { H.r(4, 1, 5, 2, '#e8a030'); }
      else if (unif) { const casco = (o.arma || 0) >= 7 ? oscuro(unif, 0.25) : oscuro(unif, 0.55); if ((o.arma || 0) >= 7) { H.r(4, 1, 5, 2, casco); H.r(3, 2, 7, 1, oscuro(casco, 0.2)); H.p(5, 1, claro(casco, 0.15)); } else { H.r(5, 0, 3, 3, casco); H.r(4, 2, 5, 1, oscuro(casco, 0.3)); H.p(6, 0, '#e8d8a0'); } }
      else if (guerrero && o.arma >= 2 && !(o.tirador && o.arma >= 5)) { H.r(4, 1, 5, 2, o.arma >= 4 ? '#cfd6e2' : '#8a909c'); H.p(6, 3, o.arma >= 4 ? '#cfd6e2' : '#8a909c'); H.p(6, 0, o.col); }
      else if (guerrero && o.tirador && o.arma >= 1 && o.arma < 5) { H.r(4, 1, 5, 2, '#4a7a3a'); H.p(4, 3, '#4a7a3a'); }
      else if (guerrero && o.arma >= 5) { H.r(4, 1, 5, 2, o.arma >= 7 ? '#5a6a4a' : '#2a2a3a'); H.r(3, 2, 7, 1, o.arma >= 7 ? '#4a5a3a' : '#1a1a2a'); }
      // Lo que lleva en la mano (a la derecha), que sube y baja al trabajar.
      const a = o.alto || 0;
      if (o.carga === 3) { H.r(9, 4, 3, 7, '#e0b840'); H.r(9, 4, 3, 2, '#f8e080'); H.r(9, 8, 3, 1, '#8a6a2a'); H.p(10, 3, '#f8e080'); H.p(9, 11, '#c8a030'); H.p(11, 11, '#c8a030'); }
      else if (o.carga) { const c = o.carga === 2 ? '#9a98a2' : '#8a5a2b'; H.r(4, 0, 5, 2, c); H.r(4, 0, 5, 1, claro(c, 0.2)); }
      else if (o.oficio === 'lenador') { H.r(10, 5 + a, 1, 6, '#7a5232'); H.r(10, 5 + a, 2, 2, '#c8ccd6'); }
      else if (o.oficio === 'minero') { H.r(10, 6 + a, 1, 5, '#7a5232'); H.r(9, 5 + a, 3, 1, '#a3a1aa'); }
      else if (o.oficio === 'granjero') { H.r(10, 4 + a, 1, 8, '#7a5232'); H.r(10, 11 + a, 2, 1, '#9aa0aa'); }
      else if (o.oficio === 'constructor') { H.r(10, 6 + a, 1, 4, '#7a5232'); H.r(9, 5 + a, 3, 2, '#5e5e68'); }
      else if (guerrero) {
        const arma = o.arma || 0;
        // La espingarda (Revolución Industrial): el rifle largo de culata de madera, cañón muy largo y bayoneta.
        if (o.tirador && arma === 6) { for (let k = 0; k < 9; k++) H.p(4 + k, 10 - Math.floor(k * 0.75), k < 3 ? '#7a4a22' : '#3a3a44'); H.p(13, 3, '#dfe4ec'); H.p(14, 2, '#dfe4ec'); }
        else if (o.tirador && arma >= 5) { for (let k = 0; k < 6; k++) H.p(6 + k, 9 - Math.floor(k * 0.8), k < 2 ? '#5a3a1e' : '#3a3a44'); }
        else if (o.tirador && arma >= 1) { for (let y = 4; y <= 11; y++) H.p(10 + (y > 5 && y < 10 ? 1 : 0), y, '#8a5a2b'); H.r(10, 5, 1, 6, '#e8e0c8'); H.r(2, 7, 1, 4, '#7a5232'); H.p(2, 6, '#e8e0c8'); }
        else if (arma === 0) { H.r(10, 5 + a, 1, 6, '#6b4a2b'); H.r(10, 4 + a, 2, 2, '#5a3a20'); }
        else if (arma === 1) { H.r(10, 0 + a, 1, 12, '#7a5232'); H.r(10, -1 + a, 1, 2, '#d8b060'); }
        else if (arma === 6) { H.r(10, 7, 1, 5, '#7a4a22'); H.r(10, 2, 1, 5, '#3a3a44'); H.p(11, 10, '#7a4a22'); H.r(10, 0, 1, 2, '#dfe4ec'); H.p(9, 6, '#5a5a62'); }
        else if (arma >= 5) { H.r(10, 1, 1, 11, '#5a3a1e'); H.p(10, 0, '#cfd6e2'); }
        else {
          H.r(10, 3 + a, 1, 6, arma >= 4 ? '#eef1f6' : '#c8ccd6'); H.p(10, 2 + a, '#ffffff'); H.r(9, 8 + a, 3, 1, '#c8a050'); H.p(10, 9 + a, '#6a4a2a');
          if (arma >= 3) { H.r(1, 7, 3, 4, o.col); H.p(2, 8, claro(o.col, 0.4)); H.r(1, 7, 3, 1, '#c8a050'); }
        }
      }
      // El erudito de cada época, con su ropa larga, su tocado y lo que lleva en la mano.
      if (o.oficio === 'erudito') {
        const tipo = o.sabio || 'chaman', a2 = o.alto || 0;
        const tunica = { chaman: '#8a5a32', filosofo: '#eeeae0', monje: '#6a4a30', erudito: '#3a2a4a', cientifico: '#f2f2f4' }[tipo];
        // Ropa larga hasta los pies (tapa las piernas), con el color del pueblo en un detalle.
        H.r(4, 7, 5, 5, tunica); H.r(4, 7, 1, 5, claro(tunica, 0.12)); H.r(8, 7, 1, 5, oscuro(tunica, 0.18)); H.r(3, 11, 7, 1, oscuro(tunica, 0.1));
        H.p(5, 12, '#2a1e14'); H.p(7, 12, '#2a1e14');
        H.p(3, 8, tunica); H.p(9, 8, tunica);
        if (tipo === 'chaman') {
          // Flecos de cuero, pinturas en la cara, un tocado de plumas y un bastón con un hueso.
          for (let x = 4; x <= 8; x += 2) H.p(x, 11, '#5a3a1e');
          H.p(6, 6, '#c83a2a'); H.r(4, 2, 5, 1, o.col);
          H.p(4, 1, '#e04030'); H.p(5, 0, '#f0c040'); H.p(6, 0, '#3a8ad0'); H.p(7, 0, '#f0c040'); H.p(8, 1, '#e04030');
          H.r(10, 2 + a2, 1, 10, '#6b4a2b'); H.p(10, 1 + a2, '#e8e0c8'); H.p(11, 1 + a2, '#e8e0c8'); H.p(11, 3 + a2, '#e04030');
        } else if (tipo === 'filosofo') {
          // Toga blanca con banda del color del pueblo, barba gris y un rollo de pergamino.
          for (let k = 0; k < 4; k++) H.p(4 + k, 7 + k, o.col);
          H.r(5, 6, 3, 2, '#c8c8d0'); H.p(5, 2, piel); H.p(6, 2, piel);
          H.r(9, 7 + a2, 3, 3, '#efe2b8'); H.p(9, 7 + a2, '#c8b080'); H.p(11, 9 + a2, '#c8b080');
        } else if (tipo === 'monje') {
          // Hábito pardo con capucha, cordón y un libro.
          H.r(4, 2, 5, 1, '#5a3a22'); H.p(4, 3, '#5a3a22'); H.p(4, 4, '#5a3a22'); H.p(4, 5, '#5a3a22'); H.p(8, 3, '#5a3a22'); H.p(8, 4, '#5a3a22');
          H.r(4, 9, 5, 1, '#d8c890'); H.p(6, 10, '#d8c890');
          H.r(9, 8 + a2, 3, 3, '#7a2a1a'); H.r(9, 8 + a2, 3, 1, '#f0e8d0'); H.p(10, 9 + a2, '#e0c060');
        } else if (tipo === 'erudito') {
          // Toga oscura, birrete negro, cuello blanco y una pluma.
          H.r(4, 1, 5, 2, '#1a1a22'); H.p(8, 1, '#2a2a3a');
          H.r(5, 7, 3, 1, '#f0f0f0'); H.p(6, 8, o.col);
          H.r(9, 8 + a2, 3, 3, '#3a5a8a'); H.p(10, 6 + a2, '#f4f4f4'); H.p(11, 5 + a2, '#f4f4f4');
        } else {
          // Bata blanca abierta (camisa del color del pueblo), gafas y un matraz con algo verde.
          H.r(6, 7, 1, 4, o.col); H.p(6, 5, '#2a2a2a'); H.p(5, 5, '#2a2a2a');
          H.p(10, 7 + a2, '#cfe8f0'); H.r(9, 8 + a2, 3, 3, '#cfe8f0'); H.r(9, 9 + a2, 3, 2, '#5ac05a'); H.p(10, 9 + a2, '#9af09a');
        }
      }
      H.contorno(0.68);
      return H.lienzo();
    });
  }
  // El mismo dibujo teñido (para el destello rojo o blanco al recibir un golpe).
  function tenido(img, color) {
    return guardado('tinte' + color + img.__id, () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }
  let sigId = 0;
  const conId = img => { if (img.__id == null) img.__id = ++sigId; return img; };

  // ---------- Vehículos de guerra (mirando a la derecha; el pintor los voltea) ----------
  function vehiculo(tipo, col, paso) {
    return guardado('veh' + tipo + col + paso, () => {
      if (tipo === 'tanque') {
        const H = hoja(16, 11), cuerpo = mezcla(col, '#5a6040', 0.55);
        H.r(1, 7, 14, 3, '#2a2a26'); for (let x = 2; x < 15; x += 2) H.p(x + (paso ? 1 : 0), 8, '#55554c'); // orugas
        for (let x = 2; x < 15; x += 3) H.disco(x + 0.5, 8.5, 1, '#3a3a34');
        H.r(1, 5, 14, 2, cuerpo); H.r(2, 4, 12, 1, claro(cuerpo, 0.15));
        H.r(4, 2, 7, 2, cuerpo); H.r(5, 1, 5, 1, claro(cuerpo, 0.2)); // torreta
        H.r(11, 2, 5, 1, '#3a3a34'); // cañón
        H.p(6, 3, col); H.p(7, 3, col);
        H.contorno();
        return H.lienzo();
      }
      // Cañón de campaña o artillería: tubo largo sobre dos ruedas y un afuste.
      const H = hoja(16, 10), pesado = tipo === 'artilleria';
      H.r(1, 6, 7, 1, '#6b4a2b'); // afuste
      H.disco(8.5, 6.5, 2.4, '#5a3a22', true); H.p(8, 6, '#c8a060');
      H.r(6, 3, pesado ? 10 : 8, 2, pesado ? '#4a4e44' : '#3a3a3a'); H.r(6, 3, pesado ? 10 : 8, 1, pesado ? '#6a7060' : '#5a5a5a');
      if (pesado) H.r(3, 2, 4, 3, mezcla(col, '#5a6040', 0.6)); // escudo
      H.p(2, 5, col);
      H.contorno();
      return H.lienzo();
    });
  }
  // El avión de cada época: biplano (Era Moderna) o bombardero de dos motores (II Guerra Mundial).
  function avion(col, bombardero) {
    return guardado('avion' + col + (bombardero ? 'b' : ''), () => {
      const H = hoja(16, 9), cuerpo = mezcla(col, '#7a8070', 0.5);
      H.r(2, 4, 12, 2, cuerpo); H.r(13, 4, 2, 2, claro(cuerpo, 0.15)); H.p(15, 4, '#2a2a2a'); H.p(15, 5, '#2a2a2a'); // fuselaje y hélice
      if (bombardero) {
        H.r(5, 0, 4, 9, oscuro(cuerpo, 0.12)); H.r(5, 0, 4, 1, claro(cuerpo, 0.1)); // alas largas
        H.r(9, 1, 2, 1, '#3a3a34'); H.r(9, 7, 2, 1, '#3a3a34'); // dos motores
        H.p(6, 5, '#2a2a26'); H.p(7, 5, '#2a2a26'); // bombas bajo el vientre
      } else {
        H.r(6, 1, 3, 7, oscuro(cuerpo, 0.12)); H.r(6, 1, 3, 1, claro(cuerpo, 0.1)); // alas
        H.p(6, 3, '#4a3a2a'); H.p(8, 6, '#4a3a2a'); // los montantes del biplano
      }
      H.r(1, 2, 2, 2, oscuro(cuerpo, 0.12)); H.r(1, 6, 2, 1, oscuro(cuerpo, 0.12)); // cola
      H.p(11, 4, '#a8d8f0'); H.p(7, 3, col); H.p(7, 6, col);
      H.contorno();
      return H.lienzo();
    });
  }

  // ---------- Barcos de cada época (de pesca y mercantes), mirando a la derecha ----------
  function barco(tipo, fase, col) {
    return guardado('barco' + tipo + fase + col, () => {
      const H = hoja(20, 16);
      if (tipo === 'guerra' && fase === 'galera') { // galera de guerra: casco oscuro, espolón, escudos, remos y vela del reino
        H.r(1, 10, 17, 3, '#4a3020'); H.r(1, 10, 17, 1, '#6a4a2a'); H.r(2, 13, 15, 1, '#2a1a10'); H.r(18, 11, 2, 1, '#8a7a5a'); H.p(0, 9, '#4a3020');
        for (let x = 3; x < 17; x += 3) { H.r(x, 9, 2, 2, col); H.p(x, 9, '#e8d8a0'); H.p(x, 13, '#8a6a42'); H.p(x - 1, 14, '#8a6a42'); }
        H.r(9, 1, 1, 8, '#2a1a10'); H.r(5, 2, 9, 6, col); H.r(5, 2, 9, 1, '#1a1a1a'); H.r(5, 7, 9, 1, '#1a1a1a'); H.r(8, 4, 3, 2, '#e8d8a0');
      } else if (tipo === 'guerra' && fase === 'galeon') { // galeón de guerra: tres palos, troneras con cañones y banderas del reino
        H.r(1, 10, 18, 4, '#3a2416'); H.r(1, 10, 18, 1, '#6a4422'); H.r(14, 6, 5, 4, '#3a2416'); H.r(1, 7, 4, 3, '#3a2416'); H.r(1, 12, 18, 1, col);
        for (let x = 3; x < 17; x += 3) { H.p(x, 11, '#0a0a0a'); H.p(x + 1, 11, '#5a5a62'); }
        for (const [x, h] of [[5, 7], [9, 9], [13, 7]]) { H.r(x, 10 - h, 1, h, '#2a1a10'); H.r(x - 2, 11 - h, 5, h - 4, '#e8e0cc'); H.r(x - 2, 11 - h, 5, 1, '#1a1a1a'); }
        H.r(9, 0, 3, 1, col); H.r(13, 2, 2, 1, col); H.r(5, 2, 2, 1, col);
      } else if (tipo === 'guerra') { // acorazado: casco gris de hierro, dos torretas con cañones, puente y chimenea
        H.r(0, 10, 20, 4, '#5a626e'); H.r(0, 10, 20, 1, '#7a828e'); H.r(1, 14, 18, 1, '#3a4048'); H.r(0, 12, 20, 1, col);
        H.r(7, 6, 6, 4, '#6a727e'); H.r(8, 4, 3, 2, '#7a828e'); H.p(9, 5, CRISTAL); H.r(11, 3, 2, 3, '#3a3a40');
        for (const x of [2, 15]) { H.r(x, 8, 3, 2, '#4a525e'); } H.r(0, 8, 2, 1, '#2a2e34'); H.r(18, 8, 2, 1, '#2a2e34');
        H.p(9, 2, col);
      } else if (tipo === 'pesca') {
        if (fase === 0) { // canoa con un pescador y su remo
          H.r(3, 11, 13, 2, '#7a4a22'); H.r(4, 13, 11, 1, '#5a3418'); H.r(3, 11, 13, 1, '#9a6a3a'); H.p(2, 10, '#7a4a22'); H.p(16, 10, '#7a4a22');
          H.r(9, 8, 2, 3, col); H.r(9, 6, 2, 2, '#e8b890'); H.r(12, 7, 1, 6, '#6b4a2b'); H.r(12, 12, 2, 2, '#6b4a2b');
        } else if (fase <= 1) { // barca de vela latina
          H.r(3, 11, 13, 2, '#6b4a2b'); H.r(4, 13, 11, 1, '#5a3a22'); H.r(3, 11, 13, 1, '#8a6a42');
          H.r(9, 2, 1, 9, '#3a2a1e'); for (let y = 2; y < 10; y++) H.r(10, y, Math.round((y - 1) * 0.7), 1, '#e8e0c8'); H.p(11, 5, col); H.r(5, 9, 2, 2, '#e8b890');
        } else if (fase === 2) { // pesquero de dos velas
          H.r(2, 11, 16, 3, '#5a3a22'); H.r(2, 11, 16, 1, '#8a6a42'); H.r(3, 14, 14, 1, '#3a2a1e');
          for (const [x, h] of [[6, 8], [12, 9]]) { H.r(x, 11 - h, 1, h, '#3a2a1e'); H.r(x + 1, 12 - h, 3, h - 2, '#f0e8d4'); H.r(x + 1, 13 - h, 3, 1, col); }
        } else { // arrastrero de motor con chimenea
          H.r(1, 10, 18, 4, '#3a4a6a'); H.r(1, 10, 18, 1, '#5a6a8a'); H.r(2, 14, 16, 1, '#2a3248'); H.r(1, 12, 18, 1, col);
          H.r(5, 6, 6, 4, '#e8e8e4'); H.r(6, 7, 1, 1, CRISTAL); H.r(8, 7, 1, 1, CRISTAL); H.r(12, 4, 2, 6, '#2a2a2a'); H.r(12, 4, 2, 1, col); H.r(15, 3, 1, 7, '#5a5a62');
        }
      } else {
        if (fase === 0) { // balsa de troncos con una vela de piel y fardos
          H.r(2, 11, 15, 2, '#8a5a2b'); for (let x = 2; x < 17; x += 3) H.p(x, 12, '#6a4220'); H.r(3, 13, 13, 1, '#5a3418');
          H.r(9, 3, 1, 8, '#5a3a22'); H.r(6, 4, 6, 5, '#c8a070'); H.r(6, 6, 6, 1, col); H.r(4, 9, 3, 2, '#c8b07a'); H.r(13, 9, 2, 2, '#a07a4a');
        } else if (fase <= 1) { // galera: remos y vela cuadrada
          H.r(1, 10, 18, 3, '#6b4a2b'); H.r(1, 10, 18, 1, '#9a6a3a'); H.r(2, 13, 16, 1, '#4a3020'); H.p(0, 9, '#6b4a2b'); H.p(19, 8, '#6b4a2b');
          for (let x = 3; x < 17; x += 3) { H.p(x, 13, '#8a6a42'); H.p(x - 1, 14, '#8a6a42'); }
          H.r(9, 1, 1, 9, '#3a2a1e'); H.r(5, 2, 9, 6, '#e8dcc0'); H.r(5, 4, 9, 1, col); H.r(5, 6, 9, 1, col);
        } else if (fase === 2) { // galeón de tres palos
          H.r(1, 10, 18, 4, '#5a3a22'); H.r(1, 10, 18, 1, '#8a5a2a'); H.r(14, 7, 5, 3, '#5a3a22'); H.r(1, 8, 4, 2, '#5a3a22');
          for (let x = 3; x < 17; x += 3) H.p(x, 12, '#2a1a10');
          for (const [x, h] of [[5, 7], [9, 9], [13, 7]]) { H.r(x, 10 - h, 1, h, '#3a2a1e'); H.r(x - 2, 11 - h, 5, h - 4, '#f4ecd8'); H.r(x - 2, 12 - h, 5, 1, col); }
          H.r(9, 0, 2, 1, col);
        } else { // vapor: casco de hierro, chimeneas y humo
          H.r(0, 9, 20, 5, '#2a2e38'); H.r(0, 9, 20, 1, '#4a4e58'); H.r(0, 12, 20, 1, '#a03a2a');
          H.r(4, 5, 11, 4, '#e8e8e4'); for (let x = 5; x < 14; x += 2) H.p(x, 6, CRISTAL);
          for (const x of [7, 11]) { H.r(x, 1, 2, 4, col); H.r(x, 1, 2, 1, '#1a1a1a'); }
        }
      }
      H.contorno();
      return H.lienzo();
    });
  }

  // ---------- Iconos de la interfaz (12×12 píxeles, con contorno): recursos, estaciones y secciones ----------
  const ICONOS = {
    pescado: H => { H.r(2, 5, 7, 3, '#7aa8c8'); H.r(3, 4, 5, 1, '#9ac4e0'); H.r(3, 8, 5, 1, '#5a88a8'); H.r(9, 4, 2, 1, '#5a88a8'); H.r(9, 8, 2, 1, '#5a88a8'); H.p(10, 5, '#5a88a8'); H.p(10, 7, '#5a88a8'); H.p(3, 5, '#1a1a1a'); H.r(5, 6, 3, 1, '#c8e0f0'); },
    carne: H => { H.r(3, 3, 6, 6, '#c84a3a'); H.r(4, 2, 4, 1, '#c84a3a'); H.r(4, 9, 3, 1, '#a83a2a'); H.r(4, 4, 3, 2, '#e87a6a'); H.r(8, 8, 2, 1, '#f0e8dc'); H.r(9, 9, 2, 2, '#f0e8dc'); H.p(11, 10, '#f0e8dc'); },
    leche: H => { H.r(4, 3, 4, 1, '#c8c8d0'); H.r(3, 4, 6, 7, '#f4f4f8'); H.r(3, 4, 1, 7, '#d8d8e0'); H.r(4, 6, 4, 2, '#7aa8e0'); H.r(5, 1, 2, 2, '#d8d8e0'); },
    frutos: H => { H.r(3, 5, 4, 4, '#d83a3a'); H.p(4, 6, '#f08a7a'); H.r(7, 4, 3, 3, '#8a3ac8'); H.r(6, 8, 3, 3, '#e8a83a'); H.p(5, 4, '#4a8a3a'); H.p(6, 3, '#4a8a3a'); },
    granadas: H => { H.r(3, 4, 6, 7, '#3e4a2a'); H.r(4, 3, 4, 9, '#3e4a2a'); H.r(4, 5, 4, 1, '#56643a'); H.r(4, 8, 4, 1, '#56643a'); H.r(5, 1, 2, 2, '#8a8a90'); H.r(7, 1, 3, 1, '#8a8a90'); H.p(9, 2, '#c8c8d0'); H.p(4, 4, '#6a7a48'); },
    semillas: H => { H.r(3, 3, 6, 7, '#c8a86a'); H.r(3, 3, 6, 1, '#e0c890'); H.r(4, 2, 4, 1, '#a8885a'); H.p(5, 1, '#6a4a2a'); for (const [x, y] of [[4, 6], [6, 5], [7, 7], [5, 8]]) H.p(x, y, '#7a5a2a'); H.p(8, 1, '#4a9a3a'); H.p(9, 0, '#5ab04a'); H.p(7, 0, '#5ab04a'); },
    muebles: H => { H.r(2, 2, 2, 9, '#8a5a2a'); H.r(2, 6, 7, 2, '#a8743a'); H.r(7, 8, 2, 3, '#8a5a2a'); H.r(2, 6, 7, 1, '#c89a5a'); H.r(2, 2, 2, 1, '#c89a5a'); },
    vehiculos: H => { H.r(1, 6, 10, 3, '#5a6a4a'); H.r(3, 4, 5, 2, '#6a7a5a'); H.r(8, 4, 4, 1, '#3a3a40'); H.r(1, 9, 10, 2, '#2a2a2e'); for (const x of [2, 5, 8]) H.p(x, 10, '#8a8a90'); },
    carbon: H => { H.disco(4.5, 7.5, 3.2, '#2a2a30', true); H.disco(8, 6, 3.4, '#1e1e24', true); H.disco(7, 9, 2.6, '#34343c', true); H.p(7, 4, '#6a6a76'); H.p(4, 6, '#5a5a66'); H.p(9, 8, '#5a5a66'); },
    petroleo: H => { H.r(3, 2, 7, 9, '#2a3a5a'); H.r(3, 2, 7, 1, '#4a5a7a'); H.r(3, 10, 7, 1, '#1a2a4a'); H.r(3, 5, 7, 1, '#c8402a'); H.r(5, 1, 3, 1, '#5a6a8a'); H.p(4, 3, '#7a8aaa'); },
    oro: H => { H.disco(6, 6, 5, '#f0c040', true); H.disco(6, 6, 3.4, '#e0a820'); H.r(5, 3, 2, 6, '#fff0a0'); H.r(5, 3, 1, 6, '#b07818'); },
    comida: H => { for (const [x0, x1] of [[3, 5], [6, 6], [9, 7]]) for (let y = 2; y < 11; y++) H.p(Math.round(x0 + (x1 - x0) * (y - 2) / 8), y, '#c89a30'); for (const [x, y] of [[3, 2], [2, 3], [4, 3], [6, 1], [5, 2], [7, 2], [9, 2], [8, 3], [10, 3], [3, 4], [6, 3], [9, 4]]) H.p(x, y, '#f0d070'); H.r(4, 8, 5, 1, '#8a5a2a'); },
    madera: H => { H.r(1, 4, 9, 5, '#8a5a2a'); H.r(1, 4, 9, 1, '#a8743a'); H.r(2, 6, 6, 1, '#6a4220'); H.disco(9.5, 6.5, 2.7, '#d8a868'); H.p(9, 6, '#b08048'); H.p(10, 7, '#b08048'); },
    piedra: H => { H.disco(7, 7, 4.2, '#a8a49a', true); H.disco(3.6, 8.4, 2.6, '#8a867c', true); H.p(6, 5, '#d0ccc2'); },
    metal: H => { for (let y = 5; y < 10; y++) H.r(2 + (9 - y) * 0 + (y === 5 ? 2 : y === 6 ? 1 : 0), y, 8 - (y === 5 ? 4 : y === 6 ? 2 : 0) + (y > 6 ? 1 : 0), 1, y === 5 ? '#e0e8f0' : y < 8 ? '#a8b2be' : '#7a8490'); H.r(3, 4, 4, 1, '#c8d0d8'); },
    armas: H => { for (let k = 0; k < 7; k++) { H.p(3 + k, 8 - k, '#e0e4ec'); H.p(4 + k, 8 - k, '#9aa0aa'); } H.p(10, 1, '#ffffff'); H.r(1, 8, 4, 1, '#c8a040'); H.p(3, 7, '#c8a040'); H.p(3, 9, '#c8a040'); H.r(1, 10, 2, 1, '#6a4220'); H.p(2, 9, '#6a4220'); },
    gente: H => { H.disco(6, 3.5, 2.2, '#f0c8a0'); H.r(4, 2, 4, 1, '#5a3a20'); H.r(3, 6, 6, 4, '#4a8ad0'); H.r(3, 6, 6, 1, '#6aa8e8'); H.r(4, 10, 1, 2, '#3a3a48'); H.r(7, 10, 1, 2, '#3a3a48'); },
    nivel: H => { H.r(2, 6, 8, 5, '#e8d8b4'); for (let y = 1; y < 6; y++) H.r(6 - y, y + 1, y * 2, 1, '#c84a3a'); H.r(5, 8, 2, 3, '#6a4220'); H.p(3, 7, '#4a6a9a'); H.p(8, 7, '#4a6a9a'); },
    tec: H => { H.r(5, 1, 2, 4, '#c8d8e8'); for (let y = 5; y < 11; y++) { const w = Math.min(4, y - 4); H.r(6 - w, y, w * 2, 1, y > 7 ? '#5ac8a0' : '#c8d8e8'); } H.p(4, 9, '#9af0d0'); H.r(4, 0, 4, 1, '#8a6a4a'); },
    subir: H => { for (let y = 1; y < 7; y++) H.r(6 - (y - 1), y, (y - 1) * 2 + 1, 1, '#f0c040'); H.r(4, 7, 3, 4, '#f0c040'); H.p(5, 2, '#fff0a0'); },
    primavera: H => { for (const [x, y] of [[6, 2], [3, 5], [9, 5], [4, 8], [8, 8]]) H.disco(x, y, 1.9, '#ff8ab0'); H.disco(6, 5.6, 1.6, '#ffd84a'); H.r(6, 9, 1, 3, '#4a9a3a'); },
    verano: H => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; H.p(Math.round(6 + Math.cos(a) * 5), Math.round(6 + Math.sin(a) * 5), '#ffb030'); } H.disco(6, 6, 3.3, '#ffd84a', true); },
    otono: H => { for (let y = 1; y < 10; y++) { const w = Math.round(Math.sin((y / 9) * Math.PI) * 4); H.r(6 - w, y, w * 2 + 1, 1, y < 5 ? '#f08a30' : '#d0601e'); } H.r(6, 2, 1, 9, '#8a3a1a'); H.p(6, 11, '#6a4220'); },
    invierno: H => { for (let k = -4; k <= 4; k++) { H.p(6 + k, 6, '#e8f4ff'); H.p(6, 6 + k, '#e8f4ff'); if (Math.abs(k) < 4) { H.p(6 + k, 6 + k, '#bcd8f0'); H.p(6 + k, 6 - k, '#bcd8f0'); } } H.p(6, 6, '#ffffff'); },
    noche: H => { H.disco(6, 6, 4.5, '#f0e0a0', true); H.disco(8, 4.5, 3.6, null); for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const dx = x + 0.5 - 8.2, dy = y + 0.5 - 4.4; if (dx * dx + dy * dy < 12) H.d[y * 12 + x] = null; } },
    mapa: H => { H.r(1, 2, 10, 8, '#5aa040'); H.r(1, 2, 3, 8, '#4a8ad0'); H.r(7, 2, 1, 8, '#3a7a30'); H.r(4, 2, 1, 8, '#2a6aa8'); H.p(9, 5, '#c84a3a'); H.p(8, 6, '#c84a3a'); H.p(10, 6, '#c84a3a'); H.p(9, 7, '#c84a3a'); },
    ordenes: H => { H.r(2, 9, 8, 2, '#e8dcc0'); for (let k = 0; k < 7; k++) { H.p(3 + k, 8 - k, '#f4f0e4'); H.p(4 + k, 8 - k, '#c8c0ac'); } H.p(10, 1, '#ffffff'); H.p(3, 8, '#2a2a3a'); H.p(2, 9, '#2a2a3a'); },
    pueblos: H => { H.r(1, 6, 5, 5, '#e8d8b4'); for (let y = 2; y < 6; y++) H.r(3.5 - (y - 2), y, (y - 2) * 2 + 1, 1, '#c84a3a'); H.r(6, 5, 5, 6, '#d8c8a4'); for (let y = 1; y < 5; y++) H.r(8.5 - (y - 1), y, (y - 1) * 2 + 1, 1, '#4a8ad0'); H.p(3, 9, '#6a4220'); H.p(8, 9, '#6a4220'); },
    cronica: H => { H.r(2, 2, 8, 8, '#efe2b8'); H.r(1, 1, 10, 2, '#d8c890'); H.r(1, 9, 10, 2, '#d8c890'); for (const y of [4, 6, 8]) H.r(3, y, 6, 1, '#9a8a6a'); },
    retos: H => { H.r(3, 1, 6, 5, '#f0c040'); H.r(3, 1, 2, 5, '#ffe080'); H.p(2, 2, '#f0c040'); H.p(9, 2, '#f0c040'); H.p(1, 3, '#f0c040'); H.p(10, 3, '#f0c040'); H.r(5, 6, 2, 2, '#c89020'); H.r(3, 8, 6, 2, '#8a5a2a'); },
    mas: H => { for (const x of [2, 5, 8]) H.r(x, 5, 2, 2, '#e8e0cc'); },
    arqui: H => { H.r(2, 9, 8, 2, '#a8a49a'); H.r(4, 6, 4, 3, '#c8a878'); H.r(3, 2, 1, 7, '#7a5530'); H.r(8, 2, 1, 7, '#7a5530'); H.r(3, 4, 6, 1, '#7a5530'); H.r(9, 1, 1, 4, '#f0c040'); H.r(9, 1, 3, 1, '#f0c040'); }
  };
  function icono(nombre) {
    return guardado('ico' + nombre, () => { const H = hoja(12, 12); (ICONOS[nombre] || ICONOS.mas)(H); H.contorno(0.75); return H.lienzo(); });
  }
  const iconoURL = nombre => guardado('icourl' + nombre, () => icono(nombre).toDataURL());
  // Los iconos de la barra de abajo en el PC (16×16, como los botones de WorldBox): uno por cada botón que ya existe.
  const linea = (H, x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let k = 0; k <= n; k++) H.p(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, c); };
  const BARRA = {
    pausa: H => { H.r(4, 3, 3, 10, '#e8e4dc'); H.r(9, 3, 3, 10, '#e8e4dc'); H.r(4, 3, 1, 10, '#ffffff'); H.r(9, 3, 1, 10, '#ffffff'); },
    seguir: H => { for (let y = 0; y < 11; y++) { const w = 6 - Math.abs(y - 5); H.r(5, 3 + y, w + 1, 1, '#8ee070'); } H.r(5, 3, 1, 11, '#c8f8a8'); },
    velocidad: H => { H.disco(8, 8, 6.4, '#e8e4dc', true); H.disco(8, 8, 4.8, '#3a4a6a'); linea(H, 8, 8, 8, 4, '#ffd24a'); linea(H, 8, 8, 11, 9, '#ffd24a'); H.p(8, 8, '#ffffff'); H.r(7, 0, 3, 2, '#c8c4bc'); },
    acercar: H => { H.disco(6.5, 6.5, 5, '#cfe4f4', true); H.disco(6.5, 6.5, 3.4, '#4a7ab0'); H.r(4, 6, 6, 1, '#ffffff'); H.r(6, 4, 1, 6, '#ffffff'); linea(H, 10, 10, 14, 14, '#8a6a3a'); linea(H, 11, 10, 14, 13, '#6a4a2a'); },
    alejar: H => { H.disco(6.5, 6.5, 5, '#cfe4f4', true); H.disco(6.5, 6.5, 3.4, '#4a7ab0'); H.r(4, 6, 6, 1, '#ffffff'); linea(H, 10, 10, 14, 14, '#8a6a3a'); linea(H, 11, 10, 14, 13, '#6a4a2a'); },
    todo: H => { H.r(2, 3, 12, 10, '#5aa040'); H.r(2, 3, 4, 10, '#4a8ad0'); H.r(9, 3, 1, 10, '#3a7a30'); H.p(11, 6, '#c84a3a'); H.p(12, 7, '#c84a3a'); for (const [x, y, dx, dy] of [[1, 1, 1, 1], [14, 1, -1, 1], [1, 14, 1, -1], [14, 14, -1, -1]]) { H.p(x, y, '#ffd24a'); H.p(x + dx, y, '#ffd24a'); H.p(x, y + dy, '#ffd24a'); } },
    casa: H => { for (let y = 0; y < 6; y++) H.r(8 - y - 1, 2 + y, y * 2 + 2, 1, y < 2 ? '#e05a4a' : '#c84a3a'); H.r(3, 8, 10, 6, '#e8d8b4'); H.r(3, 8, 10, 1, '#f8ecd0'); H.r(7, 10, 2, 4, '#7a4a22'); H.r(4, 9, 2, 2, '#8ac0e8'); H.r(10, 9, 2, 2, '#8ac0e8'); },
    batalla: H => { linea(H, 2, 2, 12, 12, '#e8ecf4'); linea(H, 3, 2, 13, 12, '#9aa0aa'); linea(H, 13, 2, 3, 12, '#e8ecf4'); linea(H, 12, 2, 2, 12, '#9aa0aa'); H.r(1, 12, 4, 1, '#c8a040'); H.r(11, 12, 4, 1, '#c8a040'); H.r(2, 13, 2, 2, '#7a4a22'); H.r(12, 13, 2, 2, '#7a4a22'); },
    ojo: H => { for (let x = 1; x < 15; x++) { const h = Math.round(Math.sin((x - 1) / 13 * Math.PI) * 4); H.r(x, 8 - h, 1, h * 2 + 1, '#f4f0e8'); } H.disco(8, 8, 3, '#4a8ad0'); H.disco(8, 8, 1.6, '#1a2030'); H.p(7, 7, '#ffffff'); },
    corte: H => { H.r(2, 13, 12, 2, '#c8c0ac'); H.r(1, 3, 14, 2, '#e8dcc0'); for (let y = 0; y < 2; y++) H.r(5 - y * 2, 1 - y + 1, 6 + y * 4, 1, '#f0c040'); for (const x of [3, 7, 11]) { H.r(x, 5, 2, 8, '#f4eee0'); H.p(x, 5, '#ffffff'); } },
    tropas: H => { H.disco(8, 8, 6, '#9aa4b4', true); H.r(2, 9, 12, 2, '#7a8494'); H.r(7, 1, 2, 4, '#c84a3a'); H.r(6, 11, 4, 3, '#f0c8a0'); H.r(3, 7, 10, 1, '#c8d0dc'); },
    fundar: H => { H.r(3, 2, 1, 13, '#7a4a22'); for (let y = 0; y < 6; y++) H.r(4, 2 + y, 9 - Math.abs(y - 3) * 2, 1, y < 2 ? '#ff7a5a' : '#e0503a'); H.r(1, 14, 12, 1, '#5aa040'); },
    arquitecto: H => { H.r(2, 13, 12, 2, '#a8a49a'); H.r(5, 8, 6, 5, '#c8a878'); H.r(5, 8, 6, 1, '#e0c898'); H.r(3, 2, 1, 11, '#7a5530'); H.r(12, 2, 1, 11, '#7a5530'); H.r(3, 5, 10, 1, '#7a5530'); H.r(13, 1, 1, 5, '#f0c040'); H.r(13, 1, 3, 1, '#f0c040'); },
    ordenes: H => { H.r(2, 2, 10, 12, '#efe2b8'); H.r(2, 2, 10, 1, '#fff4d0'); for (const y of [5, 7, 9]) H.r(4, y, 6, 1, '#9a8a6a'); for (let k = 0; k < 8; k++) { H.p(7 + k * 0.9, 13 - k, '#f4f0e4'); H.p(8 + k * 0.9, 13 - k, '#c84a3a'); } },
    pueblos: H => { for (let y = 0; y < 4; y++) H.r(4 - y, 4 + y, y * 2 + 1, 1, '#c84a3a'); H.r(1, 8, 7, 6, '#e8d8b4'); for (let y = 0; y < 5; y++) H.r(11 - y, 2 + y, y * 2 + 1, 1, '#4a8ad0'); H.r(7, 7, 8, 7, '#d8c8a4'); H.r(3, 10, 2, 4, '#7a4a22'); H.r(10, 10, 2, 4, '#7a4a22'); },
    cronica: H => { H.r(3, 2, 10, 12, '#efe2b8'); H.r(1, 1, 14, 3, '#d8c890'); H.r(1, 12, 14, 3, '#d8c890'); H.r(1, 1, 14, 1, '#f0e0b0'); for (const y of [5, 7, 9]) H.r(4, y, 8, 1, '#9a8a6a'); },
    retos: H => { H.r(4, 1, 8, 7, '#f0c040'); H.r(4, 1, 3, 7, '#ffe080'); H.r(2, 2, 2, 3, '#f0c040'); H.r(12, 2, 2, 3, '#f0c040'); H.r(7, 8, 2, 3, '#c89020'); H.r(4, 11, 8, 3, '#8a5a2a'); H.r(4, 11, 8, 1, '#a8743a'); },
    sonido: H => { H.r(2, 6, 3, 4, '#e8e4dc'); for (let k = 0; k < 4; k++) H.r(5 + k, 6 - k, 1, 4 + k * 2, '#e8e4dc'); for (let y = 0; y < 7; y++) H.p(11 + Math.round(Math.sin(y / 6 * Math.PI) * 1.5), 5 + y, '#8ac0e8'); for (let y = 0; y < 11; y++) H.p(13 + Math.round(Math.sin(y / 10 * Math.PI) * 1.5), 3 + y, '#8ac0e8'); },
    graficos: H => { H.r(1, 2, 14, 10, '#3a4a6a'); H.r(2, 3, 12, 8, '#5aa040'); H.r(2, 3, 5, 8, '#4a8ad0'); H.p(9, 6, '#c84a3a'); H.p(10, 7, '#c84a3a'); H.r(6, 12, 4, 2, '#8a94a8'); H.r(4, 14, 8, 1, '#8a94a8'); },
    modo: H => { for (let k = 0; k < 9; k++) H.p(3 + k, 4, '#ffd24a'); H.r(10, 2, 1, 5, '#ffd24a'); H.r(11, 3, 1, 3, '#ffd24a'); for (let k = 0; k < 9; k++) H.p(4 + k, 11, '#8ac0e8'); H.r(5, 9, 1, 5, '#8ac0e8'); H.r(4, 10, 1, 3, '#8ac0e8'); },
    ayuda: H => { H.disco(8, 8, 6.5, '#4a8ad0', true); H.r(6, 4, 4, 1, '#ffffff'); H.r(10, 5, 1, 2, '#ffffff'); H.r(8, 7, 2, 1, '#ffffff'); H.r(8, 8, 1, 2, '#ffffff'); H.r(8, 11, 1, 1, '#ffffff'); H.p(5, 5, '#ffffff'); },
    nuevo: H => { H.disco(8, 8, 6.5, '#4a8ad0', true); H.r(4, 4, 4, 3, '#5aa040'); H.r(3, 6, 3, 3, '#5aa040'); H.r(9, 8, 4, 4, '#5aa040'); H.r(10, 7, 2, 1, '#6ab850'); H.p(6, 11, '#5aa040'); },
  };
  function iconoBarra(nombre) {
    return guardado('icob' + nombre, () => { const H = hoja(16, 16); (BARRA[nombre] || ICONOS.mas)(H); H.contorno(0.7); return H.lienzo(); });
  }
  const iconoBarraURL = nombre => guardado('icoburl' + nombre, () => iconoBarra(nombre).toDataURL());
  M.arte = { tiradorEnPose, BOCA, T, icono, iconoURL, iconoBarra, iconoBarraURL, BARRA, ICONOS, piedraPlaza, pico, barco, vehiculo: (t, c, p) => conId(vehiculo(t, c, p)), avion, aldeano: o => conId(aldeano(o)), tenido, suelo, adorno, arbol, roca, campo, casa, edificio, plaza, mezcla, oscuro, claro, hoja, HIERBA };
