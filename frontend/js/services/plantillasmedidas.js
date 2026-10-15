// js/services/plantillasmedidas.js

// ═══════════════════════════════════════════════════════════════════════════
//  PLANTILLAS DE MEDIDAS
//
//  Cada plantilla define los campos que se le capturan a un tipo de producto
//  y con los que se puede buscar desde el mostrador.
//
//  ── "identifica" ──────────────────────────────────────────────────────────
//  Es la lista de atributos que DE VERDAD distinguen a este tipo. Solo estos
//  se usan para decidir si un producto pertenece a la plantilla.
//
//  Hace falta por algo concreto: antes bastaba con que el producto tuviera
//  UNO CUALQUIERA de los campos. Y como el catálogo de Truper trae "marca"
//  en sus 15,758 productos, elegir Balero, Banda o Birlo —las tres que
//  incluyen "marca"— hacía que el buscador considerara TODO el catálogo del
//  tipo y pintara más de 17,000 tarjetas de golpe. De ahí el congelamiento.
//
//  Regla al elegir las claves de "identifica": que no las tenga ningún otro
//  tipo de producto. "marca", "tipo" y "material" NO sirven — los tiene
//  medio catálogo. "sellado", "canales" o "estriado" sí.
//
//  ── "tolerancia" ──────────────────────────────────────────────────────────
//  Qué tanto se permite que la medida buscada se aleje de la del producto
//  para que salga como APROXIMADA. Va por plantilla porque cada producto
//  tiene su realidad: un balero es una pieza de precisión con medidas de
//  catálogo, mientras que una banda da de sí y el tensor absorbe diferencia.
//
//  El número es proporción, no porcentaje: 0.02 = 2%.
//
//  Ojo al bajarlo: equivalenciaExacta() marca como EXACTA todo lo que quede
//  dentro de 0.5%. Poner una tolerancia igual o menor a 0.005 deja la franja
//  de aproximados VACÍA — o es exacta o no aparece.
//
//  ── "exacto" ──────────────────────────────────────────────────────────────
//  Marca los campos que son un NÚMERO DE MODELO, no una medida: 6205, A-42,
//  K060824. En esos la tolerancia de ±8% no aplica — un balero 6204 y uno
//  6205 son piezas distintas, no una aproximación.
// ═══════════════════════════════════════════════════════════════════════════

export const PLANTILLAS_MEDIDAS = {

    // =========================================================
    // BALERO / RODAMIENTO
    // =========================================================
    balero: {
        etiqueta: 'Balero / Rodamiento',
        icono: 'bi-record-circle',
        // ±0.50 mm en un interior de 25 mm.
        //
        // La recomendación que te dieron era 0.005 (0.5%), pero rompe el caso
        // de mostrador: quien mide 31/32" un balero de 25 mm queda a 1.59% y
        // ya NO lo encontraría. Además equivalenciaExacta() usa 0.5% para
        // marcar "exacta", así que con 0.005 la franja de APROXIMADOS queda
        // vacía — o exacta o nada.
        //
        // A 2% ningún diámetro exterior real se confunde: los de catálogo
        // (47, 52, 55, 62, 72, 80 mm) están a más de 5% unos de otros.
        tolerancia: 0.02,
        // Ningún otro tipo lleva medidas interior/exterior ni sellado
        identifica: ['diametro_interior', 'diametro_exterior', 'sellado'],
        campos: [
            { clave: 'numero',            label: 'Número / Clave', ej: '6205', exacto: true },
            { clave: 'diametro_interior', label: 'Ø interior',     ej: '25 mm' },
            { clave: 'diametro_exterior', label: 'Ø exterior',     ej: '52 mm' },
            { clave: 'ancho',             label: 'Ancho',          ej: '15 mm' },
            { clave: 'tipo',              label: 'Tipo',           ej: '6200, 6300, etc.' },
            { clave: 'sellado',           label: 'Sellado',        ej: 'ZZ, 2RS, abierto' },
            { clave: 'marca',             label: 'Marca',          ej: 'SKF' }
        ]
    },

    // =========================================================
    // BANDA
    // =========================================================
    banda: {
        etiqueta: 'Banda',
        icono: 'bi-arrow-repeat',
        // ±1.7 cm en una banda de 42". Las bandas dan de sí y el tensor
        // absorbe diferencia, así que aquí conviene ser flexible.
        tolerancia: 0.04,
        identifica: ['canales', 'longitud', 'equivalencia', 'altura'],
        campos: [
            { clave: 'tipo',         label: 'Tipo / Perfil', ej: 'A, B, K, etc.' },
            { clave: 'numero',       label: 'Número',        ej: 'A-42', exacto: true },
            { clave: 'longitud',     label: 'Longitud',      ej: '42"' },
            { clave: 'ancho',        label: 'Ancho',         ej: '1/2"' },
            { clave: 'altura',       label: 'Altura',        ej: '8 mm' },
            { clave: 'canales',      label: 'Canales',       ej: '6', exacto: true },
            { clave: 'marca',        label: 'Marca',         ej: 'Gates' },
            { clave: 'aplicacion',   label: 'Aplicación',    ej: 'Alternador' },
            { clave: 'equivalencia', label: 'Equivalencia',  ej: 'K060824', exacto: true }
        ]
    },

    // =========================================================
    // BANDA MICRO-V AUTOMOTRIZ GATES
    // =========================================================
    // Estas son las bandas serpentinas Micro-V de perfil K, como:
    // K050474 -> 5PK1204.
    //
    // El catálogo SQL usa los campos:
    // costillas, numero_gates, medida_comercial, longitud_mm,
    // longitud_pulgadas, ancho_seccion_mm, etc.
    microv_gates: {
        etiqueta: 'Banda Micro-V Gates (4, 5 y 6 costillas)',
        icono: 'bi-arrow-repeat',
        tolerancia: 0.015,
        // Se usan los campos propios del catálogo Micro-V.
        identifica: ['costillas', 'medida_comercial', 'numero_gates'],
        campos: [
            { clave: 'numero_gates',              label: 'Número Gates',          ej: 'K050474', exacto: true },
            { clave: 'medida_comercial',          label: 'Medida comercial',       ej: '5PK1204', exacto: true },
            { clave: 'costillas',                 label: 'Costillas / Hilos',      ej: '5', exacto: true },
            { clave: 'longitud_mm',               label: 'Longitud (mm)',          ej: '1204 mm' },
            { clave: 'longitud_pulgadas',         label: 'Longitud (pulgadas)',    ej: '47 3/8"' },
            { clave: 'longitud_pulgadas_texto',   label: 'Pulgadas exactas',       ej: '47 3/8"' },
            { clave: 'ancho_seccion_mm',          label: 'Ancho sección (mm)',     ej: '18 mm' },
            { clave: 'ancho_seccion_pulgadas',    label: 'Ancho sección (pulgadas)', ej: '11/16"' },
            { clave: 'perfil',                    label: 'Perfil',                 ej: 'K / PK' },
            { clave: 'material',                  label: 'Material',               ej: 'EPDM' },
            { clave: 'marca',                     label: 'Marca',                  ej: 'Gates' }
        ]
    },

    // =========================================================
    // BANDA EN V DENTADA GS GATES
    // =========================================================
    gs_gates: {
        etiqueta: 'Banda Gates GS dentada',
        icono: 'bi-arrow-repeat',
        tolerancia: 0.02,
        // El catálogo GS tiene "dientes: Moldeados" y numero_parte "xxxx GS".
        identifica: ['dientes', 'numero_parte'],
        campos: [
            { clave: 'numero_gates',             label: 'Número Gates',           ej: '6580', exacto: true },
            { clave: 'numero_parte',             label: 'Número de parte',        ej: '6580 GS', exacto: true },
            { clave: 'longitud_mm',              label: 'Longitud (mm)',           ej: '1476 mm' },
            { clave: 'longitud_pulgadas',        label: 'Longitud (pulgadas)',     ej: '58"' },
            { clave: 'longitud_pulgadas_texto',  label: 'Pulgadas exactas',        ej: '58"' },
            { clave: 'seccion',                  label: 'Sección',                 ej: '1/2"' },
            { clave: 'ancho_mm',                 label: 'Ancho (mm)',               ej: '12.7 mm' },
            { clave: 'ancho_pulgadas',           label: 'Ancho (pulgadas)',         ej: '1/2"' },
            { clave: 'dientes',                  label: 'Dentado',                  ej: 'Moldeados' },
            { clave: 'marca',                    label: 'Marca',                    ej: 'Gates' }
        ]
    },

    // =========================================================
    // BANDA EN V LISA HI-POWER GATES
    // =========================================================
    hi_power_gates: {
        etiqueta: 'Banda Gates Hi-Power lisa',
        icono: 'bi-arrow-repeat',
        tolerancia: 0.02,
        // El catálogo de la plantilla SQL usa familia="Hi-Power" y perfiles A/B.
        identifica: ['familia', 'numero_gates'],
        campos: [
            { clave: 'numero_gates',             label: 'Número Gates',           ej: 'B74', exacto: true },
            { clave: 'perfil',                   label: 'Perfil',                  ej: 'A o B', exacto: true },
            { clave: 'longitud_mm',              label: 'Longitud (mm)',            ej: '1956 mm' },
            { clave: 'longitud_pulgadas',        label: 'Longitud (pulgadas)',      ej: '77"' },
            { clave: 'longitud_pulgadas_texto',  label: 'Pulgadas exactas',         ej: '77"' },
            { clave: 'ancho_mm',                 label: 'Ancho (mm)',                ej: '17 mm' },
            { clave: 'ancho_pulgadas',           label: 'Ancho (pulgadas)',          ej: '21/32"' },
            { clave: 'familia',                  label: 'Familia',                   ej: 'Hi-Power' },
            { clave: 'tipo_banda',               label: 'Tipo de banda',             ej: 'V lisa Hi-Power' },
            { clave: 'marca',                    label: 'Marca',                     ej: 'Gates' }
        ]
    },

    // =========================================================
    // TORNILLERÍA ESTÁNDAR / PULGADAS
    // =========================================================
    tornillo_estandar: {
        etiqueta: 'Tornillería estándar',
        icono: 'bi-gear',
        // Holgura natural de la rosca.
        tolerancia: 0.02,
        identifica: ['hilos_por_pulgada', 'grado'],
        campos: [
            { clave: 'diametro',          label: 'Diámetro',          ej: '1/4"' },
            { clave: 'hilos_por_pulgada', label: 'Hilos por pulgada', ej: '20', exacto: true },
            { clave: 'largo',             label: 'Largo',             ej: '2"' },
            { clave: 'tipo_cabeza',       label: 'Tipo de cabeza',    ej: 'Hexagonal' },
            { clave: 'tipo_rosca',        label: 'Tipo de rosca',     ej: 'UNC' },
            { clave: 'grado',             label: 'Grado',             ej: 'Grado 5' },
            { clave: 'material',          label: 'Material',          ej: 'Acero' },
            { clave: 'acabado',           label: 'Acabado',           ej: 'Galvanizado' }
        ]
    },

    // =========================================================
    // TORNILLERÍA MÉTRICA
    // =========================================================
    tornillo_metrico: {
        etiqueta: 'Tornillería métrica',
        icono: 'bi-gear-wide-connected',
        // Holgura natural de la rosca.
        tolerancia: 0.02,
        identifica: ['clase', 'paso_rosca'],
        campos: [
            { clave: 'diametro',    label: 'Diámetro',       ej: 'M8' },
            { clave: 'paso_rosca',  label: 'Paso',           ej: '1.25 mm' },
            { clave: 'largo',       label: 'Largo',          ej: '30 mm' },
            { clave: 'tipo_cabeza', label: 'Tipo de cabeza', ej: 'Hexagonal' },
            { clave: 'tipo_rosca',  label: 'Tipo de rosca',  ej: 'Métrica' },
            { clave: 'clase',       label: 'Clase',          ej: '8.8', exacto: true },
            { clave: 'material',    label: 'Material',       ej: 'Acero' },
            { clave: 'acabado',     label: 'Acabado',        ej: 'Galvanizado' }
        ]
    },

    // =========================================================
    // BIRLO
    // =========================================================
    birlo: {
        etiqueta: 'Birlo',
        icono: 'bi-nut',
        // ±0.24 mm en un birlo de 12 mm. El estriado obliga a ser preciso:
        // un birlo que no entra en la maza no sirve de nada.
        // Si notas que no encuentra birlos que sí tienes, súbelo a 0.02.
        tolerancia: 0.01,
        // "estriado" es exclusivo del birlo; grosor_diametro tampoco lo usa nadie más
        identifica: ['estriado', 'grosor_diametro'],
        campos: [
            { clave: 'grosor_diametro', label: 'Grosor / Ø',    ej: '12 mm o 1/2"' },
            { clave: 'paso_rosca',      label: 'Paso de rosca', ej: '1.5 mm o 20 hilos' },
            { clave: 'largo',           label: 'Largo',         ej: '40 mm' },
            { clave: 'estriado',        label: 'Estriado',      ej: '14.3 mm' },
            { clave: 'tipo',            label: 'Tipo',          ej: 'Birlo de rueda' },
            { clave: 'aplicacion',      label: 'Aplicación',    ej: 'Nissan' },
            { clave: 'marca',           label: 'Marca',         ej: 'Dorman' }
        ]
    },

    // =========================================================
    // TORNILLO / TUERCA  (la genérica)
    // =========================================================
    // Es la que usan los 1,807 tornillos cargados por SQL, cuyos atributos
    // son: tipo, sistema, diametro, largo, cuerda, material.
    // "sistema" y "cuerda" los identifican: no los tiene ningún otro tipo.
    tornillo: {
        etiqueta: 'Tornillo / Tuerca',
        icono: 'bi-gear',
        // Holgura natural de la rosca.
        tolerancia: 0.02,
        identifica: ['sistema', 'cuerda', 'paso'],
        campos: [
            { clave: 'diametro', label: 'Diámetro', ej: '1/4" o M6' },
            { clave: 'cuerda',   label: 'Cuerda',   ej: '20 UNC o paso 1.25 mm' },
            { clave: 'largo',    label: 'Largo',    ej: '2" o 50 mm' },
            { clave: 'sistema',  label: 'Sistema',  ej: 'Pulgadas o Milimétrico' },
            { clave: 'tipo',     label: 'Tipo',     ej: 'Hexagonal' },
            { clave: 'material', label: 'Material', ej: 'Acero' }
        ]
    }
};


// ¿Este producto pertenece a la plantilla? Se mira SOLO en las claves de
// "identifica" — ver la explicación de arriba. Si una plantilla no la
// declara, se cae al comportamiento viejo (todos los campos).
export function esDelTipo(attrs, tpl) {
    if (!attrs || !tpl) return false;
    const claves = tpl.identifica && tpl.identifica.length
        ? tpl.identifica
        : tpl.campos.map(c => c.clave);
    return claves.some(k => k in attrs);
}

// Tolerancia de una plantilla, con respaldo si no la declara.
export function toleranciaDe(tpl) {
    return (tpl && typeof tpl.tolerancia === 'number') ? tpl.tolerancia : TOLERANCIA;
}

// ¿Este campo es un número de modelo (comparación exacta) o una medida?
export function campoEsExacto(tpl, clave) {
    const c = tpl && tpl.campos.find(x => x.clave === clave);
    return !!(c && c.exacto);
}

// Tolerancia de respaldo: solo se usa si la plantilla no declara la suya.
// El 8% de antes era demasiado suelto para ferretería — en diámetros
// exteriores de balero hacía que el de 52 mm arrastrara al de 55 mm.
const TOLERANCIA = 0.02;

// Extrae TODAS las medidas de un texto (para valores duales tipo
// '1" (25.4 mm)'). Cada una con su unidad si la trae.
export function parseMedidas(texto) {
    if (texto == null) return [];
    // separar por bloques que contengan número+unidad opcional
    const s = String(texto);
    const bloques = s.split(/[()\/,;·|]| y | o /i)
        // ojo: el split por "/" rompería fracciones — se re-detectan abajo
        .concat([s]);   // el texto completo también, por las fracciones
    const vistos = new Set();
    const out = [];
    for (const b of bloques) {
        const m = parseMedida(b);
        if (m) {
            const firma = m.valor + '|' + (m.unidad || '');
            if (!vistos.has(firma)) { vistos.add(firma); out.push(m); }
        }
    }
    return out;
}

// Genera el texto DUAL de una medida: '1"' → '1" (25.4 mm)',
// "12 mm" → '12 mm (15/32")'. Las pulgadas se expresan como la fracción
// de dieciseisavos más cercana cuando queda muy cerca (como en el
// mostrador); si no, en decimales.
export function textoDual(texto) {
    const m = parseMedida(texto);
    if (!m || !m.unidad) return null;   // sin unidad no se sabe qué convertir
    const IN = 25.4;
    if (m.unidad === 'in') {
        const mm = m.valor * IN;
        const mmTxt = (Math.round(mm * 100) / 100).toString()
            .replace(/\.0+$/, '');
        return `${String(texto).trim()} (${mmTxt} mm)`;
    }
    // mm → pulgadas: buscar fracción bonita en dieciseisavos
    const inches = m.valor / IN;
    const dieciseisavos = Math.round(inches * 16);
    const frac = dieciseisavos / 16;
    let inTxt;
    if (dieciseisavos > 0 && Math.abs(frac - inches) / inches <= 0.015) {
        const entero = Math.floor(dieciseisavos / 16);
        let num = dieciseisavos % 16, den = 16;
        while (num > 0 && num % 2 === 0) { num /= 2; den /= 2; }
        inTxt = num === 0 ? `${entero}"`
              : entero > 0 ? `${entero} ${num}/${den}"`
              : `${num}/${den}"`;
    } else {
        inTxt = (Math.round(inches * 1000) / 1000) + '"';
    }
    return `${String(texto).trim()} (${inTxt})`;
}

// Extrae el número de un texto de medida. Soporta:
//   "25", "25.4 mm", "1/2", '15/16"', "1 1/2 pulgadas", "13 hilos"
// Regresa { valor, unidad: 'mm' | 'in' | null } o null si no hay número.
export function parseMedida(texto) {
    if (texto == null) return null;
    const s = String(texto).toLowerCase().trim();

    // fracción con entero opcional: "1 1/2", "15/16"
    let valor = null;
    // El entero de una fracción mixta debe venir SEPARADO ("1 1/2");
    // sin espacio, "15/16" es solo la fracción 15/16 (no "1 + 5/16").
    const frac = s.match(/(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/);
    if (frac) {
        const entero = frac[1] ? parseFloat(frac[1]) : 0;
        valor = entero + parseFloat(frac[2]) / parseFloat(frac[3]);
    } else {
        const num = s.match(/\d+(?:[.,]\d+)?/);
        if (num) valor = parseFloat(num[0].replace(',', '.'));
    }
    if (valor == null || isNaN(valor)) return null;

    const unidad = /"|''|pulg|inch|\bin\b/.test(s) ? 'in'
                 : /\bmm\b|mil[ií]metro/.test(s)     ? 'mm'
                 : /\bcm\b/.test(s)                  ? 'cm'
                 : null;
    const v = unidad === 'cm' ? valor * 10 : valor;   // cm → mm
    return { valor: v, unidad: unidad === 'cm' ? 'mm' : unidad };
}

// ¿a y b están dentro de la tolerancia? Se prueban las interpretaciones
// razonables de unidades: tal cual, y convirtiendo pulgadas→mm cuando
// alguna trae (o podría traer) pulgadas. Así "15/16" (sin unidad) atrapa
// tanto a '1"' como a "25 mm".
function dentroDeTolerancia(a, b, tol = TOLERANCIA) {
    const pares = [[a.valor, b.valor]];
    const IN = 25.4;
    if (a.unidad === 'in' || a.unidad === null) pares.push([a.valor * IN, b.valor]);
    if (b.unidad === 'in' || b.unidad === null) pares.push([a.valor, b.valor * IN]);
    // si ambas traen unidad conocida y distinta, la conversión correcta:
    if (a.unidad === 'in' && b.unidad === 'mm') pares.push([a.valor * IN, b.valor]);
    if (a.unidad === 'mm' && b.unidad === 'in') pares.push([a.valor, b.valor * IN]);

    return pares.some(([x, y]) => {
        const max = Math.max(Math.abs(x), Math.abs(y));
        return max > 0 && Math.abs(x - y) / max <= tol;
    });
}

// Evaluación completa de un atributo contra lo buscado.
export function evaluarMedida(valorProducto, buscado, exacto = false,
                              tol = TOLERANCIA) {
    if (valorProducto == null) return null;
    const norm = s => String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const q = norm(String(buscado).trim());
    const v = norm(String(valorProducto));

    // Búsqueda numérica ("1", "25", "15/16"): debe coincidir como CIFRA
    // COMPLETA, no como pedazo — si no, buscar "1" marcaría "15/16" como
    // exacta por contener el dígito 1.
    const esNumerica = /^[\d\s./,"']+$/.test(q);
    if (esNumerica) {
        const esc = q.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
                     .replace(/\s+/g, '\\s*');
        if (new RegExp(`(?<![\\d/.,])${esc}(?![\\d/.,])`).test(v))
            return 'exacta';
    } else {
        // Texto (acabados, tipo de cabeza...): contiene, sin espacios
        if (v.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')))
            return 'exacta';
    }

    // Campo marcado como "exacto" (número de modelo: 6205, A-42, K060824).
    // Aquí NO aplica la tolerancia de ±8%: un balero 6204 y uno 6205 son
    // piezas distintas, no una aproximación. Si no coincidió arriba como
    // texto o cifra completa, no coincide y punto.
    //
    // Esto reemplaza al parche de "diff > 0.85" que había antes. Aquel
    // rechazaba cualquier diferencia mayor a 0.85 en TODOS los campos, y de
    // paso mataba la búsqueda aproximada de verdad: un balero de 25 mm ya no
    // encontraba al de 26 mm (4% de diferencia, dentro de la tolerancia).
    if (exacto) return null;

    const b = parseMedida(buscado);
    if (!b) return null;

    let mejor = null;
    for (const a of parseMedidas(valorProducto)) {
        // Equivalencia matemática (1" ≡ 25.4 mm): cuenta como EXACTA
        if (equivalenciaExacta(a, b)) return 'exacta';
        if (dentroDeTolerancia(a, b, tol)) mejor = 'aprox';
    }
    return mejor;
}

// ¿Son la MISMA medida en distinta unidad? (diferencia ≤ 0.5%)
function equivalenciaExacta(a, b) {
    const IN = 25.4;
    const pares = [[a.valor, b.valor]];
    if (a.unidad === 'in') pares.push([a.valor * IN, b.valor]);
    if (b.unidad === 'in') pares.push([a.valor, b.valor * IN]);
    if (a.unidad === null) pares.push([a.valor * IN, b.valor]);
    if (b.unidad === null) pares.push([a.valor, b.valor * IN]);
    return pares.some(([x, y]) => {
        const max = Math.max(Math.abs(x), Math.abs(y));
        return max > 0 && Math.abs(x - y) / max <= 0.005;
    });
}

// Compatibilidad con el uso anterior (true/false)
export function coincideMedida(valorProducto, buscado) {
    return evaluarMedida(valorProducto, buscado) !== null;
}


// ═══════════════════════════════════════════════════════════════════════════
//  PUNTUACIÓN DE COINCIDENCIAS
//
//  evaluarMedida() contesta solo "exacta / aprox / nada". Eso no alcanza para
//  ordenar: entre dos aproximaciones no dice cuál está más cerca, así que el
//  mostrador tenía que revisar la lista a ojo.
//
//  puntuarMedida() devuelve además el ERROR RELATIVO (0 = clavado). Con eso
//  el buscador ordena por cercanía y el de arriba es siempre el mejor.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @returns {{nivel:'exacta'|'aprox'|null, error:number}}
 *          error: 0 es coincidencia perfecta; 0.08 es el borde de la
 *          tolerancia. Si nivel es null, el error no significa nada.
 */
export function puntuarMedida(valorProducto, buscado, exacto = false,
                              tol = TOLERANCIA) {
    const nivel = evaluarMedida(valorProducto, buscado, exacto, tol);
    if (nivel === null) return { nivel: null, error: 1 };
    if (nivel === 'exacta') return { nivel: 'exacta', error: 0 };

    // Aproximada: calcular qué tan lejos quedó, para poder ordenar
    const b = parseMedida(buscado);
    let mejorError = 1;
    if (b) {
        const IN = 25.4;
        for (const a of parseMedidas(valorProducto)) {
            const pares = [[a.valor, b.valor]];
            if (a.unidad === 'in' || a.unidad === null) pares.push([a.valor * IN, b.valor]);
            if (b.unidad === 'in' || b.unidad === null) pares.push([a.valor, b.valor * IN]);
            for (const [x, y] of pares) {
                const max = Math.max(Math.abs(x), Math.abs(y));
                if (max > 0) mejorError = Math.min(mejorError, Math.abs(x - y) / max);
            }
        }
    }
    return { nivel: 'aprox', error: mejorError };
}


// ═══════════════════════════════════════════════════════════════════════════
//  VALIDACIÓN DE LO QUE SE TECLEA EN CADA CAMPO
//
//  Avisa ANTES de buscar cuando lo escrito no cuadra con lo que el campo
//  espera. No bloquea — solo advierte, porque siempre habrá un caso raro que
//  el programa no previó y el del mostrador sabe más que el programa.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @returns {string|null} el aviso, o null si lo escrito se ve bien
 */
export function validarCampoMedida(tpl, clave, texto) {
    const v = String(texto ?? '').trim();
    if (!v) return null;

    const campo = tpl && tpl.campos.find(c => c.clave === clave);
    if (!campo) return null;

    const traeUnidad = /\b(mm|cm|pulg|inch|in)\b|"|''/i.test(v);
    const traeNumero = /\d/.test(v);

    // Campo de NÚMERO DE MODELO (6205, A-42, K060824)
    if (campo.exacto) {
        if (traeUnidad) {
            return `"${campo.label}" es el número de modelo, no la medida. `
                 + `Escribe solo el código (ej: ${campo.ej}).`;
        }
        return null;
    }

    // Campo de MEDIDA
    if (!traeNumero) {
        // Texto puro en un campo de medida: puede ser válido (ej. "Hexagonal"
        // en Tipo de cabeza), así que solo se avisa si el ejemplo del campo
        // sí es numérico.
        if (/\d/.test(campo.ej)) {
            return `"${campo.label}" espera una medida (ej: ${campo.ej}).`;
        }
        return null;
    }

    return null;
}