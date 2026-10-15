

export const PLANTILLAS_MEDIDAS = {

    balero: {
        etiqueta: 'Balero / Rodamiento',
        icono: 'bi-record-circle',
        
        tolerancia: 0.02,
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

    
    banda: {
        etiqueta: 'Banda',
        icono: 'bi-arrow-repeat',
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

    
    microv_gates: {
        etiqueta: 'Banda Micro-V Gates (4, 5 y 6 costillas)',
        icono: 'bi-arrow-repeat',
        tolerancia: 0.015,
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

   
    gs_gates: {
        etiqueta: 'Banda Gates GS dentada',
        icono: 'bi-arrow-repeat',
        tolerancia: 0.02,
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

    
    hi_power_gates: {
        etiqueta: 'Banda Gates Hi-Power lisa',
        icono: 'bi-arrow-repeat',
        tolerancia: 0.02,
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

    
    tornillo_estandar: {
        etiqueta: 'Tornillería estándar',
        icono: 'bi-gear',
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

    
    tornillo_metrico: {
        etiqueta: 'Tornillería métrica',
        icono: 'bi-gear-wide-connected',
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

   
    birlo: {
        etiqueta: 'Birlo',
        icono: 'bi-nut',
        
        tolerancia: 0.01,
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

    
    tornillo: {
        etiqueta: 'Tornillo / Tuerca',
        icono: 'bi-gear',
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


export function esDelTipo(attrs, tpl) {
    if (!attrs || !tpl) return false;
    const claves = tpl.identifica && tpl.identifica.length
        ? tpl.identifica
        : tpl.campos.map(c => c.clave);
    return claves.some(k => k in attrs);
}

export function toleranciaDe(tpl) {
    return (tpl && typeof tpl.tolerancia === 'number') ? tpl.tolerancia : TOLERANCIA;
}

export function campoEsExacto(tpl, clave) {
    const c = tpl && tpl.campos.find(x => x.clave === clave);
    return !!(c && c.exacto);
}

const TOLERANCIA = 0.02;

export function parseMedidas(texto) {
    if (texto == null) return [];
    const s = String(texto);
    const bloques = s.split(/[()\/,;·|]| y | o /i)
        .concat([s]);   
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


export function textoDual(texto) {
    const m = parseMedida(texto);
    if (!m || !m.unidad) return null;   
    const IN = 25.4;
    if (m.unidad === 'in') {
        const mm = m.valor * IN;
        const mmTxt = (Math.round(mm * 100) / 100).toString()
            .replace(/\.0+$/, '');
        return `${String(texto).trim()} (${mmTxt} mm)`;
    }
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

export function parseMedida(texto) {
    if (texto == null) return null;
    const s = String(texto).toLowerCase().trim();

    let valor = null;
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

function dentroDeTolerancia(a, b, tol = TOLERANCIA) {
    const pares = [[a.valor, b.valor]];
    const IN = 25.4;
    if (a.unidad === 'in' || a.unidad === null) pares.push([a.valor * IN, b.valor]);
    if (b.unidad === 'in' || b.unidad === null) pares.push([a.valor, b.valor * IN]);
    if (a.unidad === 'in' && b.unidad === 'mm') pares.push([a.valor * IN, b.valor]);
    if (a.unidad === 'mm' && b.unidad === 'in') pares.push([a.valor, b.valor * IN]);

    return pares.some(([x, y]) => {
        const max = Math.max(Math.abs(x), Math.abs(y));
        return max > 0 && Math.abs(x - y) / max <= tol;
    });
}

export function evaluarMedida(valorProducto, buscado, exacto = false,
                              tol = TOLERANCIA) {
    if (valorProducto == null) return null;
    const norm = s => String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const q = norm(String(buscado).trim());
    const v = norm(String(valorProducto));
const esNumerica = /^[\d\s./,"']+$/.test(q);
    if (esNumerica) {
        const esc = q.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
                     .replace(/\s+/g, '\\s*');
        if (new RegExp(`(?<![\\d/.,])${esc}(?![\\d/.,])`).test(v))
            return 'exacta';
    } else {
        if (v.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')))
            return 'exacta';
    }

    if (exacto) return null;

    const b = parseMedida(buscado);
    if (!b) return null;

    let mejor = null;
    for (const a of parseMedidas(valorProducto)) {
        if (equivalenciaExacta(a, b)) return 'exacta';
        if (dentroDeTolerancia(a, b, tol)) mejor = 'aprox';
    }
    return mejor;
}

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

export function coincideMedida(valorProducto, buscado) {
    return evaluarMedida(valorProducto, buscado) !== null;
}



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

    if (campo.exacto) {
        if (traeUnidad) {
            return `"${campo.label}" es el número de modelo, no la medida. `
                 + `Escribe solo el código (ej: ${campo.ej}).`;
        }
        return null;
    }

    if (!traeNumero) {
        if (/\d/.test(campo.ej)) {
            return `"${campo.label}" espera una medida (ej: ${campo.ej}).`;
        }
        return null;
    }

    return null;
}