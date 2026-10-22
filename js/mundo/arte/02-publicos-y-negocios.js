  // ── GÉNESIS · EL ARTE · El adoquín, los edificios públicos y los negocios privados ──

  // ---------- Los edificios públicos (cada uno con su porqué en vida.js), de cada fase ----------
  function pozo(H, fase, col) {
    if (fase === 3) {
      // Depósito de agua sobre patas de hierro, con su escalera y un grifo abajo.
      for (const x of [3, 12]) H.r(x, 7, 1, 8, '#6a6a72'); H.r(5, 9, 1, 6, '#5a5a62'); H.r(10, 9, 1, 6, '#5a5a62');
      for (let y = 8; y < 15; y += 2) H.r(3, y, 10, 1, '#7a7a82');
      H.r(2, 1, 12, 6, '#b8c4cc'); H.r(2, 1, 12, 1, '#dce4ea'); H.r(2, 6, 12, 1, '#8a949c'); H.r(5, 3, 6, 2, col);
      H.r(7, 13, 2, 2, '#3a7ac8'); H.contorno(); return H.lienzo();
    }
    // Brocal de piedra, cubo y (desde la Edad Media) un tejadillo con su torno.
    H.r(3, 10, 10, 5, PIEDRA); H.r(3, 10, 10, 1, claro(PIEDRA, 0.2)); for (let x = 4; x < 13; x += 3) H.p(x, 12, oscuro(PIEDRA, 0.15)); H.r(4, 10, 8, 1, '#2a5a9a'); H.p(6, 10, '#6aa0e0');
    if (fase === 0) { H.r(2, 6, 1, 5, MADERA); H.r(13, 6, 1, 5, MADERA); H.r(2, 6, 12, 1, MADERA); H.r(8, 7, 1, 3, '#c8b494'); H.r(7, 9, 3, 2, '#8a5a32'); }
    else { H.r(3, 4, 1, 7, MADERA); H.r(12, 4, 1, 7, MADERA); tejado(H, 1, 14, 1, 4, fase === 2 ? oscuro(col, 0.1) : '#a0603a'); H.r(4, 6, 8, 1, '#5a3a20'); H.r(8, 7, 1, 2, '#c8b494'); H.r(7, 8, 3, 2, '#6a6a72'); H.p(13, 6, '#5a3a20'); }
    H.p(14, 14, '#4a8a3a'); H.p(1, 14, '#5a9a4a');
    H.contorno(); return H.lienzo();
  }
  function granero(H, fase, col) {
    if (fase === 0) {
      // Silo de barro sobre pilotes, con su techo de paja y una escalera.
      for (const x of [4, 7, 10]) H.r(x, 12, 1, 3, MADERA);
      H.r(3, 6, 9, 6, '#b8905a'); H.r(3, 6, 1, 6, '#d0a870'); H.r(6, 8, 2, 2, '#4a3020');
      const paja = mezcla(col, '#d8b060', 0.8); tejado(H, 2, 12, 2, 6, paja);
      for (let y = 8; y < 15; y += 2) H.p(13, y, MADERA); H.r(12, 7, 1, 8, '#6a4a2a'); H.r(14, 7, 1, 8, '#6a4a2a');
      H.contorno(); return H.lienzo();
    }
    if (fase === 3) {
      // Silos de metal y una nave.
      for (const x of [2, 7]) { H.r(x, 3, 5, 12, '#c8ccd4'); H.r(x, 3, 1, 12, '#e4e8ee'); H.r(x + 4, 3, 1, 12, '#9aa0aa'); for (let y = 5; y < 15; y += 3) H.r(x, y, 5, 1, '#aab0ba'); H.r(x, 2, 5, 1, '#9aa0aa'); H.p(x + 2, 1, '#9aa0aa'); }
      H.r(12, 8, 3, 7, col); H.r(12, 8, 3, 1, claro(col, 0.25)); H.contorno(); return H.lienzo();
    }
    // Granero de tablones (medieval) o de piedra (pólvora), con portón de cruz y gavillas.
    const pared = fase === 2 ? PIEDRA : '#a0603a';
    H.r(2, 7, 12, 8, pared); H.r(2, 7, 1, 8, claro(pared, 0.15)); H.r(13, 7, 1, 8, oscuro(pared, 0.2));
    if (fase !== 2) for (let x = 4; x < 13; x += 3) H.r(x, 8, 1, 7, oscuro(pared, 0.15));
    tejado(H, 1, 14, 2, 7, fase === 2 ? oscuro(col, 0.1) : '#6a4a32');
    H.r(6, 10, 4, 5, '#5a3a20'); for (let k = 0; k < 4; k++) { H.p(6 + k, 10 + k, '#e8d8b4'); H.p(9 - k, 10 + k, '#e8d8b4'); }
    H.r(7, 4, 2, 2, '#2a2a30'); H.p(1, 13, '#e0c060'); H.p(1, 14, '#c8a040'); H.p(14, 14, '#e0c060');
    H.contorno(); return H.lienzo();
  }
  function fuente(H, fase, col) {
    // Plaza pública: adoquín en anillos alrededor de una fuente (pilón de piedra, taza con surtidor, estatua
    // con surtidor; en la era moderna, una fuente de hormigón con chorros). Bancos y macetas con flores.
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) H.p(x, y, piedraPlaza(x - 7.5, y - 7.5, fase));
    const borde = fase === 3 ? '#e4e4e0' : fase === 0 ? '#9a8e76' : '#d8d0bc';
    H.disco(7.5, 8, 5.4, oscuro(borde, 0.25)); H.disco(7.5, 7.6, 5, borde, true); H.disco(7.5, 7.8, 3.9, '#2a6ab0'); H.disco(6.8, 7.1, 1.7, '#5a9ae0');
    H.p(9, 9, '#8ac4f4'); H.p(5, 8, '#8ac4f4');
    if (fase === 0) { H.r(7, 6, 2, 3, '#8a867c'); H.p(7, 5, '#bcd8f0'); }
    else if (fase === 3) { H.r(6, 6, 4, 3, '#d8d8d4'); H.p(7, 3, '#e8f4ff'); H.p(8, 2, '#ffffff'); H.p(6, 4, '#bcd8f0'); H.p(9, 4, '#bcd8f0'); H.p(5, 5, '#bcd8f0'); H.p(10, 5, '#bcd8f0'); }
    else {
      H.r(7, 5, 2, 4, '#e0d8c8'); H.r(6, 5, 4, 1, '#f0ece0'); H.p(7, 4, '#c8c0b0');
      if (fase === 2) { H.r(7, 1, 2, 3, '#b8a060'); H.p(7, 1, '#d8c080'); }
      H.p(7, 2 + (fase === 2 ? -1 : 1), '#ffffff'); H.p(6, 3, '#bcd8f0'); H.p(9, 3, '#bcd8f0'); H.p(5, 4, '#bcd8f0'); H.p(10, 4, '#bcd8f0');
    }
    // Macetas con flores en las esquinas y un banco.
    for (const [x, y] of [[0, 0], [14, 0]]) { H.r(x, y + 1, 2, 1, '#a0583a'); H.p(x, y, '#ff5a7a'); H.p(x + 1, y, '#ffd84a'); }
    H.r(1, 14, 4, 1, MADERA); H.p(1, 15, oscuro(MADERA, 0.25)); H.p(4, 15, oscuro(MADERA, 0.25));
    H.r(11, 14, 4, 1, MADERA); H.p(11, 15, oscuro(MADERA, 0.25)); H.p(14, 15, oscuro(MADERA, 0.25));
    H.p(15, 15, col);
    return H.lienzo();
  }
  // El campamento de los colonos: dos tiendas (de pieles al principio, de lona con el color del pueblo después),
  // la hoguera con sus piedras, un montón de leña y el banderín. En la era industrial y moderna, carros y casetas.
  function campamento(H, fase, col) {
    const lona = fase === 0 ? '#c8a070' : mezcla(col, '#e8e0cc', 0.55), sombra = oscuro(lona, 0.25);
    for (const [x0, y0, w] of [[1, 3, 6], [8, 6, 6]]) {
      for (let y = 0; y < w; y++) { const half = Math.round(y * 0.6); for (let x = -half; x <= half; x++) H.p(x0 + 3 + x, y0 + y, x < 0 ? lona : sombra); }
      H.p(x0 + 3, y0 - 1, MADERA); H.r(x0 + 3, y0 + w - 3, 1, 3, '#2a1a10');
    }
    H.disco(5, 12.5, 2, '#7a7a74'); H.p(5, 12, '#ff8a1e'); H.p(4, 12, '#ffd84a'); H.p(5, 11, '#ffd84a'); H.p(6, 12, '#ff5a1e');
    H.r(10, 13, 4, 1, '#7a4a24'); H.r(11, 12, 3, 1, '#8a5a2a'); H.p(10, 13, '#c89a62'); H.p(11, 12, '#c89a62');
    H.r(14, 1, 1, 6, MADERA); H.r(15, 1, 1, 2, col);
    if (fase >= 2) { H.r(0, 13, 3, 2, '#7a5530'); H.p(0, 15, '#2a2a2a'); H.p(2, 15, '#2a2a2a'); }
    H.contorno(); return H.lienzo();
  }
  // El gremio de mercaderes (Edad Media): casa de entramado de dos pisos con soportal, el cartel colgado del gremio,
  // fardos y toneles a la puerta.
  function gremio(H, fase, col) {
    if (fase >= 2) {
      // La sede de la compañía (Era Moderna): edificio de oficinas de cuatro pisos, cristal y hormigón, con el nombre arriba
      // en el color del reino.
      const hor = '#c4c8d0';
      H.r(2, 1, 12, 14, hor); H.r(2, 1, 1, 14, '#dfe2e8'); H.r(13, 1, 1, 14, '#8a8e98');
      H.r(2, 1, 12, 2, col); for (const x of [4, 6, 7, 9, 11]) H.p(x, 2, '#f0c040');
      for (let y = 4; y < 12; y += 2) for (let x = 3; x < 13; x += 2) H.r(x, y, 1, 1, (x + y) % 6 === 1 ? LUZ : CRISTAL);
      H.r(6, 12, 4, 3, '#3a4250'); H.r(7, 12, 2, 3, CRISTAL);
      H.r(0, 15, 16, 1, '#6a6e78');
      H.contorno(); return H.lienzo();
    }
    if (fase >= 1) {
      // La compañía comercial (Revolución Industrial): almacén de ladrillo de dos pisos con oficinas, el portón de carga,
      // el rótulo pintado y cajas a la puerta.
      const lad = '#9a4a38', jun = oscuro(lad, 0.18);
      H.r(1, 4, 14, 11, lad); for (let y = 5; y < 15; y += 2) for (let x = (y % 4 ? 1 : 2); x < 15; x += 3) H.p(x, y, jun);
      H.r(0, 3, 16, 1, '#4a3a34'); H.r(1, 2, 14, 1, '#5a4a44');
      H.r(2, 5, 12, 2, '#efe6d0'); for (const x of [3, 4, 6, 8, 9, 11, 12]) H.p(x, 6, '#3a2a24'); H.p(3, 5, '#3a2a24'); H.p(8, 5, '#3a2a24');
      for (const x of [2, 5, 10, 13]) H.r(x, 8, 1, 2, LUZ);
      H.r(6, 9, 4, 6, '#5a3a24'); H.r(6, 9, 4, 1, '#3a2618'); H.r(8, 10, 1, 5, '#3a2618');
      H.r(11, 12, 3, 3, '#b08a54'); H.p(12, 13, '#7a5a34'); H.r(1, 13, 2, 2, '#b08a54'); H.p(13, 8, col); H.p(2, 8, col);
      H.r(0, 15, 16, 1, oscuro(lad, 0.45));
      H.contorno(); return H.lienzo();
    }
    const muro = '#e8dcc0', viga = '#5a3a22', teja = '#8a3a2a';
    H.r(1, 5, 14, 9, muro);
    for (const x of [1, 5, 10, 14]) H.r(x, 5, 1, 9, viga);
    H.r(1, 9, 14, 1, viga); H.r(1, 5, 14, 1, viga);
    for (let k = 0; k < 4; k++) H.r(k, 4 - k, 16 - 2 * k, 1, k === 3 ? oscuro(teja, 0.2) : teja);
    H.r(3, 6, 2, 2, LUZ); H.r(11, 6, 2, 2, LUZ); H.r(7, 6, 2, 2, LUZ);
    H.r(7, 10, 3, 4, '#3a2618'); H.p(9, 12, '#c8a050');
    // El letrero de madera sobre la puerta, con letras doradas.
    H.r(4, 8, 8, 2, '#7a4a22'); H.r(4, 8, 8, 1, '#8a5a2b');
    for (const x of [5, 6, 8, 9, 10]) H.p(x, 9, '#f0c040');
    H.p(5, 8, '#f0c040'); H.p(8, 8, '#f0c040'); H.p(10, 8, '#f0c040');
    // El cartel del gremio, colgado de un brazo de hierro, con el color del reino y una balanza dorada.
    H.r(11, 10, 1, 1, '#3a3a40'); H.r(11, 11, 3, 2, col); H.p(12, 11, '#f0c040'); H.p(13, 12, '#f0c040');
    // Fardos y un tonel.
    H.r(1, 12, 2, 2, '#c8a870'); H.p(1, 12, '#e0c890'); H.r(3, 13, 2, 1, '#8a5a2b'); H.p(4, 12, '#8a5a2b');
    H.r(0, 14, 16, 1, oscuro(muro, 0.4));
    H.contorno(); return H.lienzo();
  }
  // La casa del rico: casona de entramado con chimenea (Edad Media), palacete de piedra con balcones (Renacimiento) o
  // mansión de ladrillo con columnas y verja (Revolución Industrial en adelante).
  function casona(H, fase, col) {
    if (fase >= 2) {
      const lad = '#a8584a', bl = '#efe8dc';
      H.r(1, 5, 14, 9, lad); for (let y = 6; y < 14; y += 2) for (let x = (y % 4 ? 1 : 2); x < 15; x += 3) H.p(x, y, oscuro(lad, 0.15));
      H.r(0, 3, 16, 2, '#3a3a44'); H.r(2, 2, 12, 1, '#4a4a54'); H.r(12, 0, 2, 3, '#6a3a2e');
      for (const x of [2, 5, 10, 13]) H.r(x, 6, 1, 3, LUZ);
      H.r(6, 8, 4, 1, bl); for (const x of [6, 9]) H.r(x, 9, 1, 5, bl);
      H.r(7, 10, 2, 4, '#3a2618');
      for (let x = 0; x < 16; x += 2) H.p(x, 14, '#2a2a30'); H.r(0, 15, 16, 1, '#2a2a30');
      H.p(8, 5, col);
    } else if (fase >= 1) {
      const pie = '#e6dcc8';
      H.r(1, 5, 14, 9, pie); H.r(1, 13, 14, 1, oscuro(pie, 0.2));
      for (let k = 0; k < 3; k++) H.r(1 + k, 4 - k, 14 - 2 * k, 1, k === 2 ? '#7a3424' : '#9a4430');
      for (const x of [2, 5, 10, 13]) { H.r(x, 6, 1, 2, LUZ); H.r(x - 1, 8, 3, 1, '#4a4a54'); H.r(x, 10, 1, 2, LUZ); }
      H.r(7, 9, 2, 5, '#3a2618'); H.r(6, 8, 4, 1, oscuro(pie, 0.2)); H.p(8, 2, col);
      H.r(0, 14, 16, 1, oscuro(pie, 0.4));
    } else {
      const muro = '#ecdfc2', viga = '#5a3a22';
      H.r(1, 6, 14, 8, muro); for (const x of [1, 4, 8, 11, 14]) H.r(x, 6, 1, 8, viga); H.r(1, 10, 14, 1, viga);
      for (let k = 0; k < 5; k++) H.r(k, 5 - k, 16 - 2 * k, 1, k === 4 ? '#5a2a1a' : '#7a3a2a');
      H.r(12, 0, 2, 3, '#7a6a5a');
      H.r(2, 7, 2, 2, LUZ); H.r(12, 7, 2, 2, LUZ); H.r(5, 7, 2, 2, LUZ); H.r(9, 11, 2, 3, '#3a2618'); H.p(6, 12, col);
      H.r(0, 14, 16, 1, oscuro(muro, 0.4));
    }
    H.contorno(); return H.lienzo();
  }
  // El banco central (del reino, desde el Renacimiento): edificio grande de piedra con cúpula dorada y la bandera del
  // reino, frontón, seis columnas y una escalinata ancha.
  function banco(H, fase, col) {
    const muro = fase >= 3 ? '#e8e8e2' : '#e6dcc2', som = oscuro(muro, 0.2);
    H.disco(8, 4, 3.2, '#d8a838'); H.r(5, 4, 7, 2, '#c89828'); H.p(7, 2, '#ffe890'); H.p(8, 2, '#ffe890');
    H.r(8, 0, 1, 2, '#5a5a5a'); H.r(9, 0, 2, 1, col);
    for (let y = 5; y < 8; y++) H.r(8 - (y - 4) * 2.3, y, Math.round((y - 4) * 4.6), 1, y === 7 ? som : muro);
    H.r(1, 8, 14, 1, som);
    H.r(1, 9, 14, 4, oscuro(muro, 0.1));
    for (const x of [1, 3, 5, 10, 12, 14]) H.r(x, 9, 1, 4, '#fafaf4');
    H.r(7, 10, 2, 3, '#4a3020'); H.p(7, 9, '#e0b040'); H.p(8, 9, '#e0b040');
    H.r(0, 13, 16, 1, muro); H.r(0, 14, 16, 1, som); H.r(0, 15, 16, 1, oscuro(muro, 0.35));
    H.contorno(); return H.lienzo();
  }
  // El muelle de una casa comercial: tablones de madera sobre pilotes, una grúa de madera con su cuerda, cajas y
  // toneles, y el banderín de la casa.
  function muelle(H, fase, col) {
    if (fase >= 3) {
      // La terminal de mercancías (Era Moderna): muelle de hormigón, grúa pórtico y contenedores de colores apilados.
      H.r(0, 9, 16, 5, '#9a9ea6'); H.r(0, 9, 16, 1, '#b8bcc4'); H.r(0, 13, 16, 1, '#6a6e76');
      H.r(2, 1, 1, 8, '#d0a020'); H.r(9, 1, 1, 8, '#d0a020'); H.r(1, 1, 13, 1, '#d0a020'); H.r(12, 1, 1, 3, '#d0a020'); H.r(6, 2, 1, 3, '#3a3a40');
      const cont = [col, '#3a7ab8', '#c84a3a', '#4a9a5a', '#e0a030'];
      for (let i = 0; i < 4; i++) { H.r(3 + (i % 2) * 3, 7 - Math.floor(i / 2) * 2, 3, 2, cont[i]); H.p(3 + (i % 2) * 3, 7 - Math.floor(i / 2) * 2, '#ffffff'); }
      H.r(10, 7, 3, 2, cont[4]); H.r(13, 7, 3, 2, cont[1]);
      for (const x of [1, 8, 15]) H.r(x, 14, 1, 2, '#5a5e66');
      H.contorno(); return H.lienzo();
    }
    if (fase >= 2) {
      // La dársena (Revolución Industrial): muelle de piedra, grúa de hierro con su pluma, sacos y el almacén de ladrillo.
      H.r(0, 9, 16, 5, '#a8a090'); for (let x = 0; x < 16; x += 4) H.r(x, 9, 1, 5, '#8a8274'); H.r(0, 9, 16, 1, '#c4bcac');
      H.r(10, 3, 6, 6, '#9a4a38'); H.r(10, 2, 6, 1, '#4a3a34'); H.r(12, 5, 2, 4, '#3a2618'); H.p(11, 4, LUZ); H.p(14, 4, LUZ);
      H.r(3, 1, 1, 8, '#3a3e48'); H.r(3, 1, 6, 1, '#3a3e48'); for (let k = 0; k < 3; k++) H.p(4 + k, 2 + k, '#3a3e48');
      H.r(8, 2, 1, 4, '#8a8a8a'); H.r(7, 6, 3, 2, '#c8b890'); H.r(5, 7, 2, 2, '#c8b890');
      H.r(0, 0, 1, 9, '#4a4a4a'); H.r(1, 0, 2, 2, col);
      for (const x of [1, 6, 11, 15]) H.r(x, 14, 1, 2, '#6a6458');
      H.contorno(); return H.lienzo();
    }
    if (fase >= 1) {
      // El muelle de piedra con su almacén (Renacimiento): sillares, un almacén de madera con tejado y la grúa de madera.
      H.r(0, 9, 16, 5, '#b0a48c'); for (let x = 2; x < 16; x += 4) H.r(x, 10, 1, 4, '#90846c'); H.r(0, 9, 16, 1, '#c8bca4'); H.r(0, 12, 16, 1, '#90846c');
      H.r(9, 4, 7, 5, '#8a5a32'); for (let k = 0; k < 3; k++) H.r(9 + k, 3 - k, 7 - 2 * k, 1, '#7a3a2a'); H.r(11, 6, 2, 3, '#3a2618');
      H.r(3, 1, 1, 8, '#5a3a1e'); H.r(3, 1, 5, 1, '#5a3a1e'); H.r(7, 2, 1, 4, '#c8b890'); H.r(6, 6, 3, 2, '#8a5a2b');
      H.r(0, 0, 1, 9, '#4a4a4a'); H.r(1, 0, 2, 2, col);
      for (const x of [1, 6, 11, 15]) H.r(x, 14, 1, 2, '#6a5e48');
      H.contorno(); return H.lienzo();
    }
    const tabla = '#9a6a3a', junta = '#6a4424';
    H.r(0, 9, 16, 5, tabla); for (let x = 1; x < 16; x += 3) H.r(x, 9, 1, 5, junta); H.r(0, 9, 16, 1, '#b07a44');
    for (const x of [1, 6, 11, 15]) H.r(x, 14, 1, 2, '#4a3018');
    H.r(3, 1, 1, 8, '#5a3a1e'); H.r(3, 1, 7, 1, '#5a3a1e'); H.r(9, 2, 1, 4, '#c8b890'); H.r(8, 6, 3, 2, '#8a5a2b');
    H.r(11, 6, 3, 3, '#a87a44'); H.p(12, 7, '#6a4424'); H.r(13, 5, 2, 4, '#7a4a22'); H.p(13, 6, '#c8a050');
    H.r(0, 0, 1, 9, '#4a4a4a'); H.r(1, 0, 2, 2, col);
    H.contorno(); return H.lienzo();
  }
  // El banco de un banquero (privado): local de piedra más pequeño, con el letrero de letras doradas, rejas en las
  // ventanas y la puerta con la moneda.
  function bancoPrivado(H, fase, col) {
    if (fase >= 2) {
      // La torre del banco (Era Moderna): rascacielos estrecho de piedra clara y cristal, con la moneda dorada arriba.
      const pie = '#d8d4cc';
      H.r(4, 2, 8, 13, pie); H.r(4, 2, 1, 13, '#ecead4'); H.r(11, 2, 1, 13, '#a8a49c');
      H.r(5, 0, 6, 2, '#b8b4ac'); H.disco(8, 1, 1.2, '#e0b040');
      for (let y = 3; y < 12; y += 2) for (const x of [5, 7, 9]) H.r(x, y, 2, 1, (x + y) % 4 === 0 ? LUZ : CRISTAL);
      H.r(2, 12, 12, 3, oscuro(pie, 0.1)); for (const x of [3, 5, 10, 12]) H.r(x, 12, 1, 3, '#f4f2ec');
      H.r(7, 12, 2, 3, '#3a2a20'); H.r(6, 11, 4, 1, col);
      H.r(0, 15, 16, 1, oscuro(pie, 0.4));
      H.contorno(); return H.lienzo();
    }
    if (fase >= 1) {
      // El banco (Revolución Industrial): fachada de piedra con frontón, cuatro columnas, el nombre en oro y la escalinata.
      const pie = '#e2d8c4', som = oscuro(pie, 0.22);
      for (let y = 2; y < 5; y++) H.r(8 - (y - 1) * 2.4, y, Math.round((y - 1) * 4.8), 1, y === 4 ? som : pie);
      H.p(8, 3, '#e0b040'); H.r(1, 5, 14, 1, som);
      H.r(1, 6, 14, 7, oscuro(pie, 0.08)); for (const x of [2, 5, 10, 13]) H.r(x, 6, 1, 7, '#f6f2e8');
      H.r(3, 6, 10, 1, '#2a2a34'); for (const x of [4, 6, 8, 9, 11]) H.p(x, 6, '#f0c040');
      H.r(7, 8, 2, 5, '#3a2618'); H.p(8, 10, '#e0b040'); H.r(6, 7, 4, 1, col);
      H.r(0, 13, 16, 1, pie); H.r(0, 14, 16, 1, som); H.r(0, 15, 16, 1, oscuro(pie, 0.4));
      H.contorno(); return H.lienzo();
    }
    const muro = fase >= 3 ? '#cfc8bc' : '#d8c8a8';
    H.r(2, 4, 12, 11, muro); H.r(2, 4, 12, 1, oscuro(muro, 0.25)); H.r(1, 3, 14, 1, oscuro(muro, 0.35));
    H.r(3, 5, 10, 2, '#2a2a34'); for (const x of [4, 6, 8, 10, 11]) H.p(x, 6, '#f0c040'); H.p(4, 5, '#f0c040'); H.p(8, 5, '#f0c040'); H.p(11, 5, '#f0c040');
    for (const x of [3, 11]) { H.r(x, 8, 2, 3, CRISTAL); H.p(x, 9, '#3a3a40'); H.p(x + 1, 9, '#3a3a40'); }
    H.r(7, 9, 2, 6, '#3a2618'); H.p(8, 11, '#e0b040'); H.r(6, 8, 4, 1, col);
    H.r(0, 15, 16, 1, oscuro(muro, 0.4));
    H.contorno(); return H.lienzo();
  }
  // La fábrica (Revolución Industrial): nave de ladrillo con tejado de dientes de sierra, ventanales y una chimenea alta.
  function fabrica(H, fase, col) {
    const lad = fase >= 3 ? '#8a8e96' : '#a0503a', jun = oscuro(lad, 0.15);
    H.r(0, 8, 13, 7, lad); for (let y = 9; y < 15; y += 2) for (let x = (y % 4 ? 0 : 1); x < 13; x += 3) H.p(x, y, jun);
    for (const x0 of [0, 4, 8]) for (let k = 0; k < 4; k++) { H.r(x0 + k, 7 - k, 1, k + 1, k === 3 ? '#a8c0d0' : oscuro(lad, 0.25)); }
    for (const x of [1, 5, 9]) H.r(x, 10, 2, 2, LUZ);
    H.r(13, 1, 3, 14, '#7a3a2a'); H.r(13, 1, 3, 1, '#3a2a2a'); for (let y = 3; y < 15; y += 3) H.r(13, y, 3, 1, '#5a2a1e');
    H.r(4, 12, 3, 3, '#3a2a2a'); H.p(12, 14, col);
    H.contorno(); return H.lienzo();
  }
  // LAS FÁBRICAS PRIVADAS de los capitalistas, cada una de su industria (fase 3: Era Moderna, más gris).
  // La fábrica textil: nave larga de ladrillo con muchas ventanas, tejado de dientes de sierra y rollos de tela de colores.
  function fabTextil(H, fase, col) {
    const lad = fase >= 3 ? '#9a9ca4' : '#b06048', jun = oscuro(lad, 0.15);
    H.r(0, 6, 16, 9, lad); for (let y = 7; y < 15; y += 2) for (let x = (y % 4 ? 0 : 1); x < 16; x += 3) H.p(x, y, jun);
    for (const x0 of [0, 4, 8, 12]) for (let k = 0; k < 4; k++) H.r(x0 + k, 5 - k, 1, k + 1, k === 3 ? '#b8d0e0' : oscuro(lad, 0.25));
    for (const x of [1, 4, 7, 10, 13]) H.r(x, 8, 2, 2, LUZ);
    H.r(6, 11, 3, 4, '#3a2a2a');
    for (const [x, c] of [[1, '#e8e0c8'], [3, col], [11, '#4a7ab8'], [13, '#c8a040']]) { H.r(x, 12, 2, 3, c); H.p(x, 12, claro(c, 0.3)); }
    H.contorno(); return H.lienzo();
  }
  // El aserradero: cobertizo de madera con la sierra circular, la pila de troncos y una chimenea de vapor pequeña.
  function fabAserradero(H, fase, col) {
    const mad = fase >= 3 ? '#8a7a6a' : '#9a6a3a';
    H.r(1, 6, 10, 9, mad); for (let x = 2; x < 11; x += 2) H.r(x, 6, 1, 9, oscuro(mad, 0.15));
    for (let k = 0; k < 3; k++) H.r(k, 5 - k, 12 - 2 * k, 1, k === 2 ? '#5a3a22' : '#6a4424');
    H.r(9, 0, 2, 4, '#5a5a5a'); H.r(9, 0, 2, 1, '#3a3a3a');
    H.disco(5, 11, 2.2, '#c8ccd4'); H.p(5, 11, '#5a5e66'); H.r(3, 13, 5, 1, '#3a2618');
    for (const [x, y] of [[12, 13], [14, 13], [13, 11], [12, 9], [14, 9]]) { H.r(x, y, 2, 2, '#8a5a2b'); H.p(x, y, '#d8b080'); }
    H.p(2, 7, col); H.p(3, 7, col);
    H.contorno(); return H.lienzo();
  }
  // La fundición: nave de ladrillo oscuro con la chimenea alta, la boca del horno encendida y lingotes de metal.
  function fabFundicion(H, fase, col) {
    const lad = fase >= 3 ? '#6a6e78' : '#6a3a30', jun = oscuro(lad, 0.2);
    H.r(0, 6, 12, 9, lad); for (let y = 7; y < 15; y += 2) for (let x = (y % 4 ? 0 : 1); x < 12; x += 3) H.p(x, y, jun);
    H.r(0, 5, 12, 1, '#2a2a30');
    H.r(12, 0, 3, 15, '#4a2a24'); H.r(12, 0, 3, 1, '#2a1a18'); for (let y = 3; y < 15; y += 3) H.r(12, y, 3, 1, '#3a2018');
    H.r(3, 9, 5, 6, '#2a1a14'); H.r(4, 10, 3, 5, '#e86a20'); H.r(5, 11, 1, 4, '#ffd040');
    H.r(1, 7, 2, 1, LUZ); H.r(9, 7, 2, 1, LUZ);
    // (Desde la Era Moderna también hace máquinas de guerra: un tanque espera en el patio.)
    if (fase >= 3) { H.r(7, 13, 5, 2, '#5a6a48'); H.r(8, 12, 3, 1, '#6a7a56'); H.r(10, 11, 3, 1, '#4a5a3a'); H.r(7, 15, 5, 1, '#2a2a2a'); H.p(0, 13, col); }
    else { for (const x of [9, 10]) H.r(x, 13, 1, 2, '#a8acb4'); H.r(9, 12, 2, 1, '#c8ccd4'); H.p(0, 13, col); }
    H.contorno(); return H.lienzo();
  }
  // La conservera: edificio claro de dos pisos con el rótulo de la lata, el muelle de carga y latas apiladas.
  function fabConservera(H, fase, col) {
    const muro = fase >= 3 ? '#d4d8de' : '#e4dcc8', som = oscuro(muro, 0.22);
    H.r(1, 4, 14, 11, muro); H.r(1, 4, 14, 1, som); H.r(0, 3, 16, 1, '#5a5a62');
    H.r(4, 5, 8, 3, col); H.r(7, 5, 2, 3, '#d8dce4'); H.p(7, 5, '#ffffff'); H.r(7, 7, 2, 1, '#8a8e96');
    for (const x of [2, 5, 10, 13]) H.r(x, 9, 1, 2, LUZ);
    H.r(6, 10, 4, 5, '#4a4e58'); H.r(6, 10, 4, 1, '#2a2e38');
    for (const [x, y] of [[1, 13], [3, 13], [2, 11], [12, 13], [14, 13], [13, 11]]) { H.r(x, y, 2, 2, '#c8ccd4'); H.p(x, y, col); }
    H.contorno(); return H.lienzo();
  }
  // La mina de una compañía minera: la boca en la roca con su entibado de madera, los raíles con la vagoneta cargada de
  // mineral, la caseta de la compañía con su rótulo y, desde la Era Moderna, una torre de extracción de hierro.
  function minaPrivada(H, fase, col) {
    const roca = '#8a8478', osc = '#5a564e';
    H.r(0, 4, 16, 11, roca); for (let k = 0; k < 4; k++) H.r(k, 4 - k, 16 - 2 * k, 1, k === 3 ? '#a8a296' : roca);
    for (const [x, y] of [[2, 6], [12, 7], [4, 11], [13, 12]]) H.p(x, y, osc);
    H.r(2, 7, 6, 8, '#1a1612'); H.r(2, 7, 1, 8, '#7a5232'); H.r(7, 7, 1, 8, '#7a5232'); H.r(2, 7, 6, 1, '#7a5232');
    H.r(0, 14, 16, 1, '#5a3a22'); for (let x = 0; x < 16; x += 3) H.p(x, 13, '#6a4a2a');
    H.r(4, 11, 4, 2, '#4a4e58'); H.r(4, 10, 4, 1, '#c87a3a'); H.p(5, 10, '#e0a060'); H.p(4, 13, '#2a2a2a'); H.p(7, 13, '#2a2a2a');
    if (fase >= 3) { H.r(11, 0, 1, 8, '#3a3e48'); H.r(14, 0, 1, 8, '#3a3e48'); H.r(11, 0, 4, 1, '#3a3e48'); H.disco(12.5, 1, 1, '#6a6e78'); }
    H.r(10, 8, 6, 5, '#9a6a3a'); H.r(10, 7, 6, 1, '#5a3a22'); H.r(11, 9, 4, 2, col); H.p(12, 9, '#f0c040'); H.p(13, 10, '#f0c040'); H.r(12, 11, 2, 2, '#3a2618');
    H.contorno(); return H.lienzo();
  }
  // La estación de tren: edificio con reloj, marquesina sobre el andén y las vías delante.
  function estacion(H, fase, col) {
    const muro = fase >= 3 ? '#d8d4cc' : '#c8a878';
    H.r(2, 3, 12, 7, muro); tejado(H, 1, 14, 0, 3, oscuro(col, 0.2)); H.r(6, 0, 4, 1, oscuro(col, 0.3));
    H.disco(8, 5, 1.8, '#f4f4ec'); H.p(8, 5, '#2a2a2a'); H.p(8, 4, '#2a2a2a');
    for (const x of [3, 11]) H.r(x, 6, 2, 3, CRISTAL);
    H.r(0, 9, 16, 1, '#5a5e66'); for (const x of [1, 7, 14]) H.r(x, 10, 1, 2, '#5a5e66'); H.r(0, 10, 16, 2, null);
    H.r(0, 12, 16, 1, '#c8c4ba');
    for (let x = 0; x < 16; x += 2) H.r(x, 13, 1, 3, '#7a5530'); H.r(0, 13, 16, 1, '#8a8e96'); H.r(0, 15, 16, 1, '#8a8e96');
    H.contorno(); return H.lienzo();
  }
  // La estación de una compañía de ferrocarril: de ladrillo, con el letrero de la compañía en su color, el reloj, el
  // andén y una locomotora negra con su chimenea humeante (diésel, más moderna, desde la Era Moderna).
  function estacionPrivada(H, fase, col) {
    const muro = fase >= 3 ? '#b86a4a' : '#a8583a', jun = oscuro(muro, 0.25);
    H.r(1, 3, 10, 7, muro); for (let y = 4; y < 10; y += 2) for (let x = (y % 4 ? 1 : 2); x < 11; x += 3) H.p(x, y, jun);
    tejado(H, 0, 11, 0, 3, '#4a4e58'); H.r(2, 2, 8, 2, col); H.p(4, 2, '#f4f0e0'); H.p(6, 2, '#f4f0e0'); H.p(8, 2, '#f4f0e0');
    H.disco(6, 6, 1.5, '#f4f4ec'); H.p(6, 6, '#2a2a2a'); H.p(6, 5, '#2a2a2a');
    for (const x of [2, 9]) H.r(x, 6, 1, 3, CRISTAL); H.r(5, 8, 2, 2, '#3a2618');
    H.r(0, 10, 16, 2, '#c8c4ba');
    if (fase >= 3) { H.r(10, 9, 6, 4, col); H.r(10, 9, 6, 1, oscuro(col, 0.3)); H.r(11, 10, 2, 1, CRISTAL); }
    else { H.r(11, 9, 5, 4, '#2a2a30'); H.r(12, 6, 1, 3, '#2a2a30'); H.p(12, 5, '#c8c8c8'); H.p(11, 4, '#e0e0e0'); H.r(14, 8, 2, 1, '#2a2a30'); H.p(11, 11, col); }
    for (const x of [11, 14]) H.p(x, 13, '#d83a32');
    for (let x = 0; x < 16; x += 2) H.r(x, 14, 1, 2, '#7a5530'); H.r(0, 14, 16, 1, '#8a8e96');
    H.contorno(); return H.lienzo();
  }
  // La oficina de una inmobiliaria: un bloque moderno de cristal con el letrero de la empresa en su color, la puerta
  // giratoria y, al lado, la grúa amarilla de obra con su gancho y un montón de ladrillos.
  function inmobiliaria(H, fase, col) {
    const muro = '#c8ccd4', som = oscuro(muro, 0.2);
    H.r(1, 3, 9, 12, muro); H.r(9, 3, 1, 12, som); H.r(1, 3, 9, 1, '#8a8e96');
    for (let y = 5; y < 12; y += 2) for (let x = 2; x < 9; x += 2) H.r(x, y, 1, 1, CRISTAL);
    H.r(2, 1, 7, 2, col); H.p(3, 1, '#f4f0e0'); H.p(5, 1, '#f4f0e0'); H.p(7, 1, '#f4f0e0');
    H.r(4, 12, 3, 3, '#3a3e48'); H.p(5, 12, '#8ab8d8');
    H.r(12, 1, 1, 14, '#e0b020'); H.r(10, 1, 6, 1, '#e0b020'); H.p(12, 0, '#c89010'); H.r(15, 2, 1, 3, '#5a5a5a'); H.p(15, 5, '#3a3a3a');
    for (const [x, y] of [[13, 13], [14, 13], [13, 14], [14, 14], [15, 14]]) H.p(x, y, '#b85a3a');
    H.contorno(); return H.lienzo();
  }
  // El hospital: edificio blanco de varias plantas con la cruz roja, ventanas y una ambulancia (o un carro) en la puerta.
  function hospital(H, fase, col) {
    H.r(1, 3, 14, 12, '#f0f0ec'); H.r(1, 3, 14, 1, '#d8d8d4'); H.r(14, 4, 1, 11, '#c8c8c4');
    for (const y of [5, 8]) for (const x of [2, 5, 10, 13]) H.r(x, y, 1, 2, CRISTAL);
    H.r(7, 4, 2, 6, '#e03a3a'); H.r(5, 6, 6, 2, '#e03a3a');
    H.r(6, 11, 4, 4, '#a8c8d8'); H.r(7, 11, 2, 4, '#88a8b8');
    if (fase >= 3) { H.r(11, 12, 4, 3, '#f8f8f4'); H.p(12, 12, '#e03a3a'); H.p(11, 15, '#2a2a2a'); H.p(14, 15, '#2a2a2a'); }
    H.p(1, 2, col);
    H.contorno(); return H.lienzo();
  }
  // El puesto fronterizo: garita con tejadillo y ventanuco, la barrera a franjas rojas y blancas cruzando la
  // carretera y la bandera del reino; en la era moderna, de hormigón con sacos terreros.
  function aduana(H, fase, col) {
    const muro = fase >= 3 ? '#b8b4ac' : '#a87a4a', tejado = fase >= 3 ? '#6a6e74' : '#7a3a2a';
    H.r(2, 6, 6, 8, muro); H.r(1, 5, 8, 1, tejado); H.r(2, 4, 6, 1, tejado); H.r(7, 7, 1, 7, oscuro(muro, 0.2));
    H.r(3, 7, 3, 2, CRISTAL); H.r(4, 11, 2, 3, '#4a3a2a');
    for (let x = 8; x < 16; x++) H.p(x, 10, ((x >> 1) % 2) ? '#f4f0e8' : '#d83a32');
    H.r(8, 9, 1, 5, '#4a4a4a'); H.r(15, 11, 1, 3, '#4a4a4a');
    H.r(1, 0, 1, 5, '#5a5a5a'); H.r(2, 0, 3, 2, col);
    if (fase >= 3) { H.r(9, 13, 3, 2, '#c8b078'); H.r(10, 12, 2, 1, '#b8a068'); }
    H.contorno(); return H.lienzo();
  }
  // La mina: la boca de la galería en la ladera, con su marco de vigas (o de hierro en la era industrial),
  // los raíles de las vagonetas, una vagoneta con mineral y el montón de escombro.
  function mina(H, fase, col) {
    H.r(0, 4, 16, 12, '#8a8478'); H.r(0, 4, 16, 1, '#a8a294'); for (let k = 0; k < 9; k++) H.p((k * 7) % 16, 5 + (k * 5) % 9, '#6a6458');
    H.r(4, 6, 8, 8, '#1a1612'); H.r(5, 7, 6, 7, '#0e0c0a');
    const viga = fase >= 2 ? '#5a5e66' : '#6a4a2a';
    H.r(3, 6, 1, 9, viga); H.r(12, 6, 1, 9, viga); H.r(3, 5, 10, 1, viga); H.p(8, 4, col); H.r(8, 2, 1, 2, '#3a3a3a'); H.r(9, 2, 2, 1, col);
    H.r(5, 14, 6, 1, '#7a7e86'); H.r(5, 15, 6, 1, '#5a3c22');
    H.r(9, 11, 4, 3, '#4a4e56'); H.r(9, 11, 4, 1, '#6a6e76'); H.p(10, 10, '#d0703a'); H.p(11, 10, fase >= 2 ? '#1a1a1e' : '#a3a1aa'); H.p(12, 10, '#ffd23a');
    H.p(9, 14, '#1e1e22'); H.p(12, 14, '#1e1e22');
    H.r(13, 12, 3, 3, '#7a7468'); H.p(14, 11, '#8a8478');
    if (fase >= 1) { H.p(2, 7, '#ffe08a'); H.p(2, 8, '#c8a050'); }
    H.contorno(); return H.lienzo();
  }
  // El pozo de petróleo: el balancín de hierro (la cabeza de caballo) sobre su torre, el tanque de crudo y
  // la mancha negra del suelo.
  function pozoPetroleo(H, fase, col) {
    H.r(1, 13, 14, 2, '#2a2420'); H.r(3, 12, 8, 1, '#3a302a');
    H.r(4, 7, 1, 6, '#5a5e66'); H.r(8, 7, 1, 6, '#5a5e66'); H.r(5, 9, 3, 1, '#4a4e56'); H.r(6, 6, 1, 1, '#6a6e76');
    H.r(1, 5, 11, 1, '#3a3e46'); H.r(1, 4, 2, 4, '#3a3e46'); H.r(2, 8, 1, 4, '#5a5e66');
    H.r(10, 5, 2, 3, '#c8402a'); H.r(11, 8, 1, 4, '#5a5e66');
    H.r(12, 8, 3, 5, '#a8acb4'); H.r(12, 8, 3, 1, '#c8ccd4'); H.p(13, 10, col);
    H.contorno(); return H.lienzo();
  }
  // El aeródromo: pista de hormigón con marcas, un hangar de chapa abovedado, un avión y la manga de viento.
  function aerodromo(H, fase, col) {
    H.r(0, 9, 16, 7, '#6a6e74'); for (let x = 1; x < 16; x += 4) H.r(x, 12, 2, 1, '#f0f0e8');
    for (let y = 2; y < 9; y++) { const w = Math.round(Math.sqrt(Math.max(0, 36 - (y - 8) * (y - 8))) ); H.r(7 - w, y, w * 2, 1, y % 2 ? '#9aa4ae' : '#8a949e'); }
    H.r(5, 6, 4, 3, '#2a2e34');
    H.r(10, 13, 5, 1, '#5a6a4a'); H.r(12, 11, 1, 4, '#5a6a4a'); H.r(11, 14, 3, 1, '#5a6a4a'); H.p(15, 13, col);
    H.r(14, 2, 1, 7, '#c8c8c8'); H.r(15, 2, 1, 2, '#ff7a30'); H.p(15, 4, '#ffffff');
    H.contorno(); return H.lienzo();
  }
  // La central eléctrica (Era Moderna, solo en ciudades): nave de ladrillo con ventanales, dos chimeneas
  // altas a franjas, el transformador y un poste de alta tensión.
  function central(H, fase, col) {
    H.r(1, 7, 10, 8, '#9a4a36'); for (let y = 8; y < 15; y += 2) for (let x = 1 + (y % 4 ? 0 : 1); x < 11; x += 3) H.p(x, y, '#843c2a');
    H.r(1, 6, 10, 1, '#6a3022'); for (const x of [2, 5, 8]) { H.r(x, 9, 2, 3, '#e8e0a0'); H.p(x, 9, '#fff4c0'); H.p(x + 1, 11, '#c8b070'); }
    for (const [x, h] of [[3, 7], [7, 9]]) { H.r(x, 6 - h, 2, h, '#c8c4bc'); for (let y = 6 - h; y < 6; y += 3) H.r(x, y, 2, 1, '#c84a3a'); H.r(x - 0, 5 - h, 2, 1, '#5a5a5a'); }
    H.r(11, 10, 4, 5, '#7a7e86'); H.r(11, 10, 4, 1, '#9aa0aa'); for (let x = 11; x < 15; x += 2) H.r(x, 11, 1, 3, '#5a5e66'); H.p(13, 12, '#f0d040');
    H.r(13, 1, 1, 9, '#5a5e66'); H.r(11, 2, 5, 1, '#5a5e66'); H.p(11, 3, '#c8ccd4'); H.p(15, 3, '#c8ccd4'); H.r(12, 4, 3, 1, '#5a5e66');
    H.p(14, 9, col);
    H.contorno(); return H.lienzo();
  }
  function parque(H, fase, col) {
    // Parque: césped, un sendero de tierra, árboles redondos, flores de colores, un banco y un estanque.
    H.r(0, 0, 16, 16, '#5aa040'); for (let k = 0; k < 18; k++) H.p((k * 7) % 16, (k * 11) % 16, '#6ab450');
    for (let k = 0; k < 16; k++) { const y = Math.round(8 + Math.sin(k / 2.4) * 2); H.r(k, y, 1, 2, fase === 3 ? '#d4d0c8' : '#c8a878'); }
    H.disco(12, 12.5, 2.6, '#3a7ac8'); H.p(11, 12, '#7ab4ec');
    for (const [x, y, r] of [[3.5, 3.5, 3], [12, 3, 2.6], [3, 13, 2.2]]) { H.r(Math.round(x) - 1, Math.round(y) + 1, 1, 3, '#6a4a2a'); H.disco(x, y, r, '#3a8a30', true); }
    for (const [x, y, c] of [[7, 4, '#ff5a7a'], [8, 5, '#ffd84a'], [6, 5, '#ffffff'], [9, 3, '#c86ae8'], [7, 13, '#ff8a3a'], [8, 14, '#ffd84a']]) H.p(x, y, c);
    H.r(8, 11, 3, 1, MADERA); H.p(8, 12, oscuro(MADERA, 0.2)); H.p(10, 12, oscuro(MADERA, 0.2));
    if (fase >= 2) { H.r(14, 6, 1, 4, '#3a3a40'); H.p(14, 5, LUZ); }
    H.p(15, 0, col);
    return H.lienzo();
  }
  function palacio(H, fase, col) {
    if (fase === 0) {
      // Gran casa del jefe: tronco tallado, techo alto de paja, pieles y estandarte.
      H.r(1, 8, 14, 7, '#9a6a3a'); for (let x = 1; x < 15; x += 2) H.r(x, 8, 1, 7, '#8a5a2a');
      tejado(H, 0, 15, 2, 8, mezcla(col, '#d8b060', 0.7)); H.r(6, 10, 4, 5, '#3a2416'); H.r(7, 9, 2, 1, col);
      H.r(14, 0, 1, 8, MADERA); H.r(12, 0, 2, 3, col); H.p(2, 12, '#e8d8b4'); H.p(13, 12, '#e8d8b4');
      H.contorno(); return H.lienzo();
    }
    if (fase === 3) {
      // Palacio de gobierno moderno: fachada blanca, columnata, cúpula de cristal y banderas.
      H.r(0, 7, 16, 8, '#ecece6'); H.r(0, 14, 16, 1, '#b8b8b2'); for (let x = 1; x < 16; x += 2) H.r(x, 9, 1, 5, '#fafaf6');
      H.r(4, 5, 8, 2, '#dcdcd6'); for (let y = 1; y < 5; y++) { const half = Math.round(Math.sqrt(16 - (y - 5) * (y - 5)) ); H.r(8 - half, y, half * 2, 1, y < 3 ? '#a8c8e8' : '#88a8c8'); }
      H.r(7, 11, 2, 4, '#3a3a40'); H.r(0, 1, 1, 6, '#5a5a62'); H.r(1, 1, 3, 2, col); H.r(15, 1, 1, 6, '#5a5a62'); H.r(12, 1, 3, 2, col);
      H.contorno(); return H.lienzo();
    }
    // Palacio de piedra: cuerpo central con frontón, dos alas con torrecillas, escalinata y estandartes.
    const muro = fase === 2 ? '#e4d8bc' : PIEDRA;
    H.r(0, 7, 16, 8, muro); H.r(0, 7, 16, 1, claro(muro, 0.15)); H.r(0, 14, 16, 1, oscuro(muro, 0.2));
    H.r(0, 3, 3, 5, muro); H.r(13, 3, 3, 5, muro); tejado(H, 0, 2, 0, 3, oscuro(col, 0.1)); tejado(H, 13, 15, 0, 3, oscuro(col, 0.1));
    tejado(H, 3, 12, 3, 7, col);
    for (const x of [1, 4, 10, 13]) ventana(H, x, 9, fase === 2);
    H.r(6, 9, 4, 6, '#4a3020'); H.r(6, 9, 4, 1, '#e0b040'); H.r(5, 14, 6, 1, '#d8d0bc');
    H.r(7, 1, 2, 3, '#e0b040'); H.p(7, 0, col); H.p(8, 0, col);
    H.contorno(); return H.lienzo();
  }
  // Iglesia románica de la Edad Media: nave de piedra, ábside, campanario cuadrado y una cruz.
  function iglesia(H, col) {
    H.r(1, 8, 10, 7, PIEDRA); H.r(1, 8, 1, 7, claro(PIEDRA, 0.15)); tejado(H, 0, 11, 4, 8, oscuro(col, 0.25));
    H.r(11, 3, 4, 12, oscuro(PIEDRA, 0.04)); H.r(14, 3, 1, 12, oscuro(PIEDRA, 0.2)); H.r(11, 2, 4, 1, oscuro(col, 0.25));
    H.r(12, 5, 2, 2, '#2a2a30'); H.p(12, 6, '#e0b040'); H.r(13, 0, 1, 2, '#e0c060'); H.p(12, 1, '#e0c060'); H.p(14, 1, '#e0c060');
    H.r(4, 11, 3, 4, '#3a2a1e'); H.p(4, 10, '#3a2a1e'); H.p(6, 10, '#3a2a1e'); H.p(5, 9, '#3a2a1e');
    H.r(8, 10, 1, 2, CRISTAL); H.r(2, 10, 1, 2, CRISTAL); H.r(12, 9, 2, 2, CRISTAL);
    H.contorno(); return H.lienzo();
  }
