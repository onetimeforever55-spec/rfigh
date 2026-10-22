  // ── GÉNESIS · EL ARTE · Templo, molino, puerto, ayuntamiento, torre, cuartel, castillo y plaza de cada fase ──

  // ---------- Templo, molino, puerto y ayuntamiento de cada fase (0 tribal, 2 pólvora, 3 moderna) ----------
  function temploDeFase(H, fase, col) {
    if (fase === 0) {
      // Círculo de menhires con un altar y una ofrenda.
      for (const [x, y, h] of [[2, 8, 6], [5, 6, 7], [10, 6, 7], [13, 8, 6], [7, 11, 3]]) { H.r(x, y + 7 - h, 2, h, '#9a968c'); H.p(x, y + 7 - h, '#b8b4aa'); }
      H.r(6, 12, 4, 2, '#8a867c'); H.p(7, 11, col); H.p(8, 11, '#ffd84a');
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Catedral con rosetón, arcos y una aguja alta.
      H.r(2, 6, 12, 9, PIEDRA); H.r(2, 6, 1, 9, claro(PIEDRA, 0.15)); H.r(13, 6, 1, 9, oscuro(PIEDRA, 0.2));
      H.r(6, 0, 4, 6, PIEDRA); H.p(7, 0, oscuro(col, 0.1)); H.p(8, 0, oscuro(col, 0.1)); for (let y = 1; y < 4; y++) H.r(7, y, 2, 1, oscuro(PIEDRA, 0.1));
      H.r(7, 8, 2, 2, col); H.p(7, 8, claro(col, 0.3)); H.r(7, 11, 2, 4, '#3a2a1e'); H.p(7, 10, '#3a2a1e'); H.p(8, 10, '#3a2a1e');
      for (const x of [3, 11]) { H.r(x, 9, 2, 3, CRISTAL); H.p(x, 8, CRISTAL); }
      tejado(H, 1, 6, 4, 7, oscuro(col, 0.15)); tejado(H, 10, 15, 4, 7, oscuro(col, 0.15));
      H.contorno(); return H.lienzo();
    }
    // Iglesia moderna: hormigón claro, torre de campanas fina, vidriera alargada.
    H.r(2, 7, 9, 8, '#dcdcd8'); H.r(2, 7, 9, 1, '#f0f0ec'); H.r(4, 9, 1, 5, col); H.r(6, 9, 1, 5, claro(col, 0.2)); H.r(8, 9, 1, 5, col);
    H.r(12, 1, 3, 14, '#c8c8c4'); H.r(12, 3, 3, 1, '#9a9a96'); H.p(13, 0, '#e0b040'); H.r(13, 5, 1, 2, '#2a2a30');
    H.contorno(); return H.lienzo();
  }
  function molinoDeFase(H, fase, col) {
    if (fase === 0) {
      // Granero de barro con techo de paja y una piedra de moler.
      H.r(3, 8, 10, 7, '#b08a5a'); H.r(3, 8, 1, 7, '#c8a070'); H.r(7, 11, 2, 4, '#4a3020');
      const paja = mezcla(col, '#d8b060', 0.8);
      for (let y = 3; y < 9; y++) { const half = Math.round((y - 2) * 1.1) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 ? paja : oscuro(paja, 0.2)); }
      H.r(12, 12, 3, 2, '#8a867c'); H.p(13, 11, '#a8a49a'); H.p(13, 12, '#e8d080');
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Molino de ladrillo, más alto, con galería de madera (las aspas giran aparte).
      for (let y = 4; y < 15; y++) { const half = 2 + Math.round((y - 4) * 0.35); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 ? '#a0503a' : '#8a3e2a'); }
      H.r(4, 9, 8, 1, '#6a4a2a'); H.r(7, 11, 2, 4, '#3a2a1e'); ventana(H, 7, 6, true);
      for (let y = 1; y < 5; y++) { const half = Math.round(y * 0.8) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.1) : oscuro(col, 0.15)); }
      H.contorno(); return H.lienzo();
    }
    // Silos de grano y una nave: metal y hormigón.
    for (const x0 of [2, 7]) { H.r(x0, 3, 4, 12, '#c8ccd4'); H.r(x0, 3, 1, 12, '#e4e8ee'); H.r(x0 + 3, 3, 1, 12, '#9aa0aa'); H.r(x0, 2, 4, 1, '#9aa0aa'); for (let y = 5; y < 15; y += 3) H.r(x0, y, 4, 1, '#aab0ba'); }
    H.r(11, 9, 4, 6, '#8a8e96'); H.r(11, 8, 4, 1, col); H.r(12, 11, 2, 4, '#3a3e48');
    H.contorno(); return H.lienzo();
  }
  function puertoDeFase(H, fase, col) {
    if (fase === 0) {
      // Embarcadero de troncos atados y una canoa varada.
      H.r(1, 7, 9, 3, '#8a5a2b'); for (let x = 1; x < 10; x += 2) H.p(x, 8, '#6a4220');
      for (const x of [2, 8]) H.r(x, 10, 1, 3, '#5a3a22');
      H.r(9, 12, 6, 2, '#7a4a22'); H.r(10, 12, 4, 1, '#5a3418'); H.p(14, 11, '#7a4a22'); H.p(11, 11, col);
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Muelle de piedra con una grúa de madera y fardos.
      H.r(0, 6, 16, 6, PIEDRA); for (let x = 0; x < 16; x += 3) H.r(x, 9, 2, 1, oscuro(PIEDRA, 0.12)); H.r(0, 6, 16, 1, claro(PIEDRA, 0.15));
      H.r(11, 0, 1, 6, '#5a3a22'); H.r(8, 0, 4, 1, '#5a3a22'); H.r(8, 1, 1, 3, '#c8c0a8');
      H.r(3, 3, 3, 3, '#c8a060'); H.r(3, 4, 3, 1, '#8a6a3a'); H.r(6, 4, 2, 2, '#8a5a2a');
      H.contorno(); return H.lienzo();
    }
    // Dársena de hormigón con grúa metálica y contenedores.
    H.r(0, 7, 16, 6, '#a8acb4'); H.r(0, 7, 16, 1, '#c8ccd4'); H.r(0, 12, 16, 1, '#7a7e86');
    H.r(12, 0, 1, 7, '#e0a030'); H.r(7, 0, 6, 1, '#e0a030'); H.r(8, 1, 1, 2, '#3a3a44');
    H.r(2, 4, 4, 3, col); H.r(2, 4, 4, 1, claro(col, 0.25)); H.r(6, 5, 4, 2, '#3a7a5a'); H.r(6, 5, 4, 1, '#5a9a7a');
    H.contorno(); return H.lienzo();
  }
  function ayuntamientoDeFase(H, fase, col) {
    if (fase === 0) {
      // Casa comunal: una choza alargada grande, con postes tallados en la entrada.
      H.r(1, 9, 14, 6, '#b08a5a'); H.r(1, 9, 14, 1, '#c8a070'); H.r(7, 11, 2, 4, '#4a3020');
      const paja = mezcla(col, '#d8b060', 0.8);
      for (let y = 3; y < 10; y++) { const half = Math.round((y - 2) * 1.05) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 ? paja : oscuro(paja, 0.2)); }
      H.r(5, 10, 1, 5, '#8a5a32'); H.r(10, 10, 1, 5, '#8a5a32'); H.p(5, 9, col); H.p(10, 9, col);
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Ayuntamiento con torre del reloj y balcón.
      H.r(1, 8, 14, 7, '#e8d4b0'); H.r(1, 14, 14, 1, '#b0a080'); for (const x of [2, 12]) ventana(H, x, 10, true);
      H.r(5, 9, 6, 1, '#6a4a2a'); H.r(7, 11, 2, 4, '#5a3a22');
      tejado(H, 0, 15, 5, 8, col);
      H.r(6, 0, 4, 6, '#e8d4b0'); H.r(7, 2, 2, 2, '#f8f8f0'); H.p(8, 3, '#2a2a2a'); H.p(7, 0, oscuro(col, 0.2)); H.p(8, 0, oscuro(col, 0.2));
      H.contorno(); return H.lienzo();
    }
    // Edificio de gobierno moderno: columnas, escalinata, bandera.
    H.r(1, 6, 14, 9, '#d8d8d4'); H.r(1, 6, 14, 1, '#f0f0ec'); for (const x of [2, 5, 8, 11, 14]) H.r(x, 7, 1, 7, '#f4f4f0');
    H.r(0, 14, 16, 1, '#a8a8a4'); H.r(7, 10, 2, 4, '#3a3e48');
    H.r(8, 0, 1, 6, '#5a5a62'); H.r(9, 0, 4, 3, col);
    H.contorno(); return H.lienzo();
  }
  function torreDeFase(H, fase, col) {
    if (fase === 0) {
      for (let x = 3; x < 13; x += 2) { H.r(x, 4, 2, 11, '#8a5a2b'); H.r(x + 1, 4, 1, 11, '#6a4220'); H.p(x, 3, '#a8784a'); }
      H.r(3, 7, 10, 1, '#5a3a1e'); H.r(3, 11, 10, 1, '#5a3a1e'); H.r(6, 1, 4, 3, '#8a5a2b'); H.r(6, 0, 4, 1, col);
    } else if (fase === 2) {
      H.r(3, 5, 10, 10, '#b0a48a'); H.r(3, 5, 2, 10, '#c8bca0'); H.r(11, 5, 2, 10, '#8a7e66');
      for (const x of [2, 6, 10]) H.r(x, 3, 3, 2, '#b0a48a');
      H.r(6, 7, 4, 2, '#2a2a30'); H.r(9, 7, 4, 1, '#3a3a40'); H.p(12, 7, '#1a1a20');
      H.r(7, 12, 2, 3, '#4a3020'); H.r(3, 4, 10, 1, col);
    } else {
      // Búnker de hormigón semienterrado con su tronera y una ametralladora.
      H.r(1, 8, 14, 7, '#7a7e74'); H.r(2, 7, 12, 1, '#8a8e84'); H.r(1, 8, 14, 1, '#9a9e94'); H.r(1, 14, 14, 1, '#5a5e56');
      H.r(4, 10, 8, 2, '#1e2022'); H.r(10, 10, 4, 1, '#3a3a40'); H.p(14, 10, '#2a2a2e');
      for (const [x, y] of [[0, 12], [15, 13], [2, 6], [13, 6]]) H.p(x, y, '#c8b07a');
      H.r(7, 5, 1, 2, '#4a4a40'); H.r(8, 5, 3, 1, col);
    }
    H.contorno();
    return H.lienzo();
  }
  // Cuartel de soldados: barracón con armas en la puerta y el estandarte; de hormigón en la última fase.
  function cuartel(H, fase, col) {
    const pared = fase >= 3 ? '#9a9a8a' : fase === 2 ? '#c8a878' : fase === 1 ? '#a8a49a' : '#a07a48';
    H.r(1, 7, 14, 8, pared); H.r(1, 7, 2, 8, claro(pared, 0.15)); H.r(13, 7, 2, 8, oscuro(pared, 0.2));
    if (fase >= 3) { H.r(1, 5, 14, 2, '#6a6e64'); H.r(1, 5, 14, 1, col); }
    else tejado(H, 0, 15, 3, 7, col);
    H.r(6, 10, 4, 5, '#3a2a1e'); H.r(6, 10, 4, 1, '#2a1e14');
    // Las armas apoyadas junto a la puerta: lanzas, espadas o fusiles.
    const arma = fase === 0 ? '#c8a050' : fase === 1 ? '#dfe4ec' : '#3a3a40';
    for (const x of [3, 4, 11, 12]) { H.r(x, 9, 1, 6, fase >= 2 ? '#5a3a1e' : '#7a5232'); H.p(x, 8, arma); }
    H.r(14, 1, 1, 7, '#3a2a1e'); H.r(11, 1, 3, 2, col);
    H.contorno();
    return H.lienzo();
  }
  // Arquería: campo de tiro con dianas (luego de mosqueteros, con sacos terreros en la última fase).
  function arqueria(H, fase, col) {
    H.r(0, 9, 16, 6, fase >= 3 ? '#8a8e74' : '#9a8a5a'); H.r(0, 9, 16, 1, oscuro('#9a8a5a', 0.2));
    // Cobertizo.
    H.r(1, 4, 6, 6, fase >= 2 ? '#a8a49a' : '#a07a48'); tejado(H, 0, 7, 1, 4, col); H.r(3, 7, 2, 3, '#3a2a1e');
    // Dianas.
    for (const [x, y] of [[10, 5], [13, 9]]) {
      if (fase >= 3) { H.r(x - 1, y, 4, 3, '#c8b07a'); H.r(x - 1, y, 4, 1, '#a8905a'); }
      else { H.r(x, y + 3, 1, 3, '#6a4a2a'); H.disco(x + 0.5, y + 1.5, 2.1, '#f4ecd8'); H.disco(x + 0.5, y + 1.5, 1.3, '#d83a3a'); H.p(x, y + 1, '#f4ecd8'); }
    }
    H.contorno();
    return H.lienzo();
  }
  // El castillo de frontera: torre del homenaje de piedra (medieval), fortaleza abaluartada con cañón (pólvora),
  // fortín de hormigón con alambradas (guerras mundiales). En la fase tribal, un recinto de empalizada.
  function castillo(H, fase, col) {
    if (fase === 0) {
      // Recinto tribal: una choza grande tras una empalizada de estacas puntiagudas, con su estandarte.
      for (let y = 2; y < 9; y++) { const half = Math.round((y - 1) * 0.75); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(mezcla(col, '#d8b060', 0.45), 0.08) : oscuro(mezcla(col, '#d8b060', 0.45), 0.1)); }
      H.r(5, 8, 6, 3, '#b08a5a'); H.r(7, 9, 2, 2, '#4a3020');
      for (let x = 0; x < 16; x += 2) { H.r(x, 10, 1, 5, '#8a5a2b'); H.r(x + 1, 10, 1, 5, '#6a4220'); H.p(x, 9, '#a8784a'); }
      H.r(0, 12, 16, 1, '#5a3a1e');
      H.r(14, 1, 1, 9, '#5a3a1e'); H.r(15, 1, 1, 3, col);
    } else if (fase === 1) {
      const P = '#a8a49a';
      H.r(1, 6, 14, 9, P); for (let x = 1; x < 15; x += 3) H.r(x, 4, 2, 2, P);
      H.r(5, 1, 6, 8, claro(P, 0.08)); for (const x of [5, 8]) H.r(x, 0, 2, 1, P); H.r(9, 1, 2, 8, oscuro(P, 0.18));
      H.r(6, 11, 4, 4, '#3a2a1e'); for (let x = 7; x < 10; x += 2) H.r(x, 11, 1, 4, '#5a4030');
      ventana(H, 7, 3, true); H.r(13, 0, 1, 4, '#3a2a1e'); H.r(14, 0, 2, 2, col); H.r(1, 6, 14, 1, oscuro(P, 0.2));
    } else if (fase === 2) {
      // Baluarte en estrella de piedra baja, con un cañón asomando.
      for (let y = 3; y < 15; y++) { const half = y < 9 ? y - 2 : 15 - y; for (let x = 8 - half - 1; x <= 8 + half; x++) H.p(x, y, y < 5 ? '#c8bca0' : (x + y) % 5 ? '#b0a48a' : '#9a8e74'); }
      H.r(6, 7, 4, 3, '#5a5248'); H.r(9, 8, 4, 1, '#2a2a30'); H.p(13, 8, '#1a1a20');
      H.r(8, 0, 1, 4, '#3a2a1e'); H.r(9, 0, 3, 2, col);
    } else {
      H.r(2, 6, 12, 8, '#7a7e74'); H.r(2, 6, 12, 1, '#9a9e94'); H.r(2, 13, 12, 1, '#5a5e56');
      H.r(4, 9, 3, 1, '#1e2022'); H.r(9, 9, 3, 1, '#1e2022'); H.r(6, 3, 4, 3, '#6a6e64'); H.r(6, 3, 4, 1, col);
      for (let x = 0; x < 16; x += 2) { H.p(x, 15, '#5a5a5a'); H.p(x + 1, 14, '#5a5a5a'); }
    }
    H.contorno();
    return H.lienzo();
  }
  // La plaza de cada capital (32×32): gran casa comunal, castillo, palacio o edificio moderno.
  function plaza(ge, col) {
    return guardado('p' + ge + col, () => {
      const H = hoja(32, 32);
      if (ge === 0) {
        // Gran casa comunal con techo de paja del color del pueblo, hoguera y tótem con estandarte.
        H.r(4, 16, 24, 12, '#b08a5a'); H.r(4, 16, 3, 12, '#c8a070'); H.r(25, 16, 3, 12, '#8a6a42');
        for (let x = 6; x < 26; x += 4) H.r(x, 17, 1, 11, '#8a6438');
        H.r(14, 20, 4, 8, '#4a3020');
        const paja = mezcla(col, '#d8b060', 0.4);
        for (let y = 4; y < 18; y++) { const half = Math.round((y - 2) * 1.0); for (let x = 16 - half; x < 16 + half; x++) H.p(x, y, (x + y) % 3 === 0 ? oscuro(paja, 0.2) : x < 16 ? claro(paja, 0.1) : oscuro(paja, 0.1)); }
        H.r(27, 6, 1, 22, '#6a4a2a'); H.r(28, 6, 4, 3, col); H.p(29, 7, '#fff6dc');
        H.r(1, 28, 4, 2, '#5a3a22'); H.p(2, 27, '#ff9a3a'); H.p(3, 26, '#ffd23a'); H.p(2, 26, '#ff6a2a');
      } else if (ge === 1) {
        // Castillo: muralla de piedra con cuatro torres almenadas, torre del homenaje con tejado del color del pueblo.
        const P = PIEDRA;
        H.r(2, 12, 28, 18, P); H.r(2, 12, 28, 2, oscuro(P, 0.18));
        for (let x = 2; x < 30; x += 3) H.r(x, 10, 2, 2, P);
        for (const tx of [0, 25]) { H.r(tx, 6, 7, 24, claro(P, 0.06)); H.r(tx + 5, 6, 2, 24, oscuro(P, 0.2)); for (let x = tx; x < tx + 7; x += 2) H.r(x, 4, 1, 2, P); H.r(tx + 3, 12, 1, 3, '#2a2a30'); }
        H.r(10, 4, 12, 14, claro(P, 0.08)); H.r(19, 4, 3, 14, oscuro(P, 0.18));
        tejado(H, 9, 22, 0, 5, col);
        H.r(13, 22, 6, 8, '#3a2a1e'); H.r(13, 22, 6, 1, '#2a1e14'); for (let x = 14; x < 19; x += 2) H.r(x, 23, 1, 7, '#5a4030');
        ventana(H, 12, 8, true); ventana(H, 18, 8, true);
        for (const fx of [3, 28]) { H.r(fx, 0, 1, 4, '#3a2a1e'); H.r(fx + 1, 0, 3, 2, col); }
        for (let y = 14; y < 30; y += 3) for (let x = 7; x < 25; x += 5) if (x < 13 || x > 18) H.r(x + (y % 2) * 2, y, 2, 1, oscuro(P, 0.1));
      } else if (ge === 2) {
        // Palacio con cúpula dorada, alas con tejado del color del pueblo, columnas y escalinata.
        H.r(1, 14, 30, 14, '#efe4cc'); H.r(1, 14, 30, 1, '#d8ccb0');
        for (let x = 3; x < 30; x += 3) { H.r(x, 16, 1, 10, '#ffffff'); H.p(x, 16, '#d8ccb0'); }
        tejado(H, 0, 12, 9, 14, col); tejado(H, 19, 31, 9, 14, col);
        H.disco(16, 10, 6, '#e8b840', true); H.r(10, 10, 13, 5, '#efe4cc'); H.r(15, 2, 2, 3, '#e8b840'); H.p(15, 1, '#fff0a0');
        for (let k = 0; k < 4; k++) H.r(10 - k, 27 + k, 12 + k * 2, 1, k % 2 ? '#d8d0bc' : '#e8e0cc');
        H.r(14, 20, 4, 7, '#6a4024'); ventana(H, 5, 18, true); ventana(H, 25, 18, true); ventana(H, 10, 18, false); ventana(H, 20, 18, false);
      } else {
        // Edificio moderno: rascacielos de cristal con franjas del color del pueblo y un edificio de gobierno.
        H.r(14, 1, 12, 28, '#5a7aa8'); H.r(14, 1, 2, 28, '#8aaad0'); H.r(24, 1, 2, 28, '#3a5a88');
        for (let y = 3; y < 28; y += 3) H.r(14, y, 12, 1, oscuro('#5a7aa8', 0.25));
        for (let y = 2; y < 28; y += 6) H.r(14, y, 12, 1, col);
        const r = azar(ge + 11);
        for (let y = 4; y < 27; y += 3) for (let x = 16; x < 24; x += 2) if (r() < 0.3) H.p(x, y, LUZ);
        H.r(1, 16, 14, 13, '#d8d4cc'); H.r(1, 15, 14, 2, col); for (let x = 3; x < 14; x += 3) H.r(x, 18, 1, 9, '#f4f0e8');
        H.r(6, 24, 4, 5, '#4a4e58'); H.r(19, 0, 1, 2, '#c8c8d0'); H.p(19, 0, '#ff4a3a');
      }
      H.contorno();
      return H.lienzo();
    });
  }
