/*
 * Utilidades de texto: normalizar, separar palabras, raíces (stemming),
 * corrección de faltas y la mini-gramática que usa el Narrador.
 */
(function (RF) {
  'use strict';

  // Palabras que no aportan significado al decreto.
  const VACIAS = new Set((
    'el la los las lo un una unos unas de del al a en y e o u que se por para con sin ' +
    'su sus tu tus es son ser sea sean esta este estos estas ese esa eso esos esas ' +
    'aquel aquella muy pero como cuando donde desde hasta sobre entre hacia le les me te nos ' +
    'ha han he hay todo todos toda todas partir hoy dia adelante decreto decreta decreto ' +
    'ordeno ordena ordenamos quiero queremos sera seran va van vamos ahora nuevo nueva ' +
    'pais nacion nacional ciudadanos gente pueblo excelencia'
  ).split(/\s+/));

  // Negaciones que pueden dar la vuelta a un decreto ("ya no se vende el agua").
  const NEGACIONES = new Set(['no', 'nunca', 'jamas', 'dejar', 'dejen', 'deja', 'dejara', 'dejaran', 'basta']);

  const SUFIJOS = [
    'aciones', 'iciones', 'amiento', 'imiento', 'mente', 'acion', 'icion',
    'ando', 'iendo', 'ados', 'adas', 'idos', 'idas', 'ado', 'ada', 'ido', 'ida',
    'aran', 'eran', 'iran', 'aron', 'ieron', 'aras', 'eras', 'ara', 'era', 'ira',
    'ar', 'er', 'ir', 'an', 'en', 'as', 'es', 'os', 'a', 'e', 'o', 's'
  ];

  function normalizar(txt) {
    return String(txt || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9%\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function palabras(txt) {
    const n = normalizar(txt);
    return n ? n.split(' ') : [];
  }

  function raiz(p) {
    if (p.length <= 4) return p;
    for (const s of SUFIJOS) {
      if (p.endsWith(s) && p.length - s.length >= 4) return p.slice(0, p.length - s.length);
    }
    return p;
  }

  function distancia(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let minFila = i;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (cur[j] < minFila) minFila = cur[j];
      }
      if (minFila > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // Corrige una palabra desconocida con la más parecida del vocabulario.
  // Palabras reales que el bot no conoce pero no son faltas: no se "corrigen" ("caminar" no es "cambiar",
  // "volar" no es "votar"). Son las que más salen en los decretos absurdos.
  const REALES = new Set((
    'caminar camine caminen volar vuele vuelen nadar bailar bailen cantar canten llorar reir rian correr saltar dormir duerman ' +
    'soñar besar abrazar silbar gritar hablar hablen callar comer coman beber fumar respirar pensar leer escribir jugar pescar ' +
    'cazar cocinar llover llueva nevar sonreir estornudar bostezar toser rezar mentir amar odiar sentarse parpadear aplaudir ' +
    'peinar peinarse vestir desnudo desnudos desnudas lunes martes miercoles jueves viernes sabado sabados domingo domingos ' +
    'luna sol lluvia nubes nube viento vientos gatos gato perro perros loro loros palomas paloma patos pato vaca vacas cabra ' +
    'cabras gallina gallinas burro burros caballo caballos mono monos peces sombrero sombreros bigote bigotes barba barbas ' +
    'calcetines zapatos corbata corbatas pijama pijamas colores rojo azul verde amarillo rosado morado musica himno baile ' +
    'chiste chistes risa risas tristeza gravedad tiempo reloj relojes numero numeros impares pares letra letras nombre ' +
    'nombres apellido apellidos cumpleaños navidad siesta queso helado helados chocolate mango mangos piña espejo espejos ' +
    'paraguas bicicleta bicicletas patines globo globos pelota pelotas futbol beisbol dados cartas ajedrez hacia atras ' +
    'adelante izquierda derecha cabeza pies manos ojos orejas nariz dientes calvo calvos zurdo zurdos gordo ' +
    'gordos flaco flacos feos bonitos altos bajos abuelas abuelos niños niñas bebes payaso payasos magos brujas fantasmas ' +
    'extraterrestres marcianos dragones unicornios sirenas vampiros zombis piratas ninjas robots'
  ).split(' '));

  function corregir(p, vocab) {
    if (p.length < 4 || vocab.has(p) || VACIAS.has(p) || NEGACIONES.has(p) || REALES.has(p) || /\d/.test(p)) return p;
    const max = p.length <= 6 ? 1 : 2;
    let mejor = p, mejorD = max + 1;
    for (const v of vocab) {
      if (v[0] !== p[0]) continue; // las faltas reales casi nunca cambian la primera letra
      const d = distancia(p, v, max);
      if (d < mejorD) { mejor = v; mejorD = d; if (d === 1 && max === 1) break; }
    }
    return mejorD <= max ? mejor : p;
  }

  function azar(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

  // Mini-gramática: [a|b|c] elige una opción al azar, {var} inserta variables.
  function expandir(plantilla, vars) {
    let t = plantilla;
    const re = /\[([^\[\]]*)\]/;
    let m, guardia = 0;
    while ((m = re.exec(t)) && guardia++ < 200) {
      t = t.slice(0, m.index) + azar(m[1].split('|')) + t.slice(m.index + m[0].length);
    }
    // Variables globales (nombres de los ministros actuales) + las de esta llamada.
    const todas = Object.assign({}, RF.VARS || {}, vars || {});
    return t.replace(/\{(\w+)\}/g, (_, k) => (todas[k] != null ? todas[k] : '{' + k + '}'))
      .replace(/\b([Aa]) el\b/g, '$1l').replace(/\b([Dd])e el\b/g, '$1el'); // "a el aire" -> "al aire"
  }

  function de(nombre) { return /^el /i.test(nombre) ? 'del ' + nombre.slice(3) : 'de ' + nombre; }
  function a(nombre) { return /^el /i.test(nombre) ? 'al ' + nombre.slice(3) : 'a ' + nombre; }
  function mayus(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

  RF.VARS = RF.VARS || {
    garrote: 'Garrote', n_garrote: 'General Bruno Garrote', cifuentes: 'Cifuentes', n_cifuentes: 'Leonor Cifuentes',
    sombra: 'Sombra', n_sombra: 'Octavio Sombra', paredes: 'Rolo', n_paredes: 'Rolo Paredes',
    montiel: 'Montiel', n_montiel: 'Isabela Montiel', ventura: 'Ventura', n_ventura: 'Dr. Aurelio Ventura', lider: 'Su Excelencia'
  };

  RF.texto = { VACIAS, NEGACIONES, normalizar, palabras, raiz, distancia, corregir, azar, expandir, de, a, mayus };
})(globalThis.RF = globalThis.RF || {});
