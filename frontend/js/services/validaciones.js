
function marcarError(el, mensaje) {
    if (!el) return;
    el.classList.remove('is-valid');
    el.classList.add('is-invalid');
    el.parentElement?.querySelector('.invalid-feedback')?.remove();
    const div = document.createElement('div');
    div.className   = 'invalid-feedback d-block';
    div.textContent = mensaje;
    el.after(div);
}

function marcarOk(el) {
    if (!el) return;
    el.classList.remove('is-invalid');
    el.classList.add('is-valid');
    el.parentElement?.querySelector('.invalid-feedback')?.remove();
}

function getEl(id) {
    return typeof id === 'string' ? document.getElementById(id) : id;
}

export function validarTexto(id, {
    minLen    = 1,
    maxLen    = 500,
    requerido = true,
    label     = 'Campo',
    patron    = null,      
    soloLetras = false,     
    noEspeciales = false,   
    permitirComillas = false 
} = {}) {
    const el  = getEl(id);
    const val = el?.value?.trim() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (requerido && !val) {
        marcarError(el, `${label} es obligatorio`);
        return false;
    }
    if (!requerido && !val) return true;

    if (val.length < minLen) {
        marcarError(el, `${label} debe tener al menos ${minLen} carácter(es)`);
        return false;
    }
    if (val.length > maxLen) {
        marcarError(el, `${label} no puede superar ${maxLen} caracteres`);
        return false;
    }

    
    const CHARS_PELIGROSOS = permitirComillas
        ? /[<>`\\]/
        : /[<>'"`;\\]/;
    if (noEspeciales && CHARS_PELIGROSOS.test(val)) {
        marcarError(el, permitirComillas
            ? `${label} contiene caracteres no permitidos (< > \` \\ )`
            : `${label} contiene caracteres no permitidos (< > ' " \` ; \\ )`);
        return false;
    }

    if (soloLetras && !/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s\-\.]+$/.test(val)) {
        marcarError(el, `${label} solo puede contener letras, espacios y guiones`);
        return false;
    }

    if (patron && !new RegExp(patron).test(val)) {
        marcarError(el, `${label} tiene formato inválido`);
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarNumero(id, {
    min       = 0,
    max       = null,
    decimales = 2,
    requerido = true,
    label     = 'Campo',
    entero    = false    
} = {}) {
    const el  = getEl(id);
    const raw = el?.value?.trim() || '';
    const val = parseFloat(raw);

    el?.classList.remove('is-invalid', 'is-valid');

    if (requerido && raw === '') {
        marcarError(el, `${label} es obligatorio`);
        return false;
    }
    if (!requerido && raw === '') return true;

    if (isNaN(val)) {
        marcarError(el, `${label} debe ser un número válido`);
        return false;
    }
    if (val < 0) {
        marcarError(el, `${label} no puede ser negativo`);
        return false;
    }
    if (val < min) {
        marcarError(el, `${label} debe ser al menos ${min}`);
        return false;
    }
    if (max !== null && val > max) {
        marcarError(el, `${label} no puede ser mayor a ${max}`);
        return false;
    }
    if (entero && !Number.isInteger(val)) {
        marcarError(el, `${label} debe ser un número entero`);
        return false;
    }
    if (!entero) {
        const parteDecimal = raw.split('.')[1];
        if (parteDecimal && parteDecimal.length > decimales) {
            marcarError(el, `${label} máximo ${decimales} decimal(es)`);
            return false;
        }
    }

    marcarOk(el);
    return true;
}

export function validarPrecio(id, {
    label     = 'Precio',
    requerido = true,
    min       = 0.01
} = {}) {
    const el  = getEl(id);
    const raw = el?.value?.trim() || '';
    const val = parseFloat(raw);

    el?.classList.remove('is-invalid', 'is-valid');

    if (requerido && raw === '') {
        marcarError(el, `${label} es obligatorio`);
        return false;
    }
    if (!requerido && raw === '') return true;

    if (isNaN(val) || val < 0) {
        marcarError(el, `${label} debe ser un número positivo`);
        return false;
    }
    if (val < min) {
        marcarError(el, `${label} debe ser mayor a $0.00`);
        return false;
    }

    marcarOk(el);
    return true;
}


export function validarCostoVsPrecio(idCosto, idPrecio) {
    const costo  = parseFloat(getEl(idCosto)?.value  || '0') || 0;
    const precio = parseFloat(getEl(idPrecio)?.value || '0') || 0;
    if (costo > 0 && precio > 0 && precio < costo) {
        const elPrecio = getEl(idPrecio);
        elPrecio?.classList.remove('is-valid');
        elPrecio?.classList.add('is-invalid');
        elPrecio?.parentElement?.querySelector('.invalid-feedback')?.remove();
        const div = document.createElement('div');
        div.className   = 'invalid-feedback d-block text-warning';
        div.style.color = '#d97706';
        div.innerHTML   = `⚠ El precio de venta ($${precio.toFixed(2)}) es menor al costo ($${costo.toFixed(2)}). ¿Es correcto?`;
        getEl(idPrecio)?.after(div);
        return false; 
    }
    return true;
}

export function validarRFC(id, requerido = false) {
    const el  = getEl(id);
    const val = el?.value?.trim().toUpperCase() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'RFC es obligatorio');
        return false;
    }

    if (/[^A-ZÑ&0-9]/.test(val)) {
        marcarError(el, 'RFC solo puede contener letras, números y &');
        return false;
    }

    const rfcFisica  = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
    const rfcMoral   = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;
    const rfcPublico = /^(XAXX010101000|XEXX010101000)$/;

    if (rfcPublico.test(val) || rfcFisica.test(val) || rfcMoral.test(val)) {
        marcarOk(el);
        return true;
    }

    marcarError(el, 'RFC inválido. Persona física: 4 letras + 6 dígitos + 3. Moral: 3 letras + 6 dígitos + 3');
    return false;
}

export function validarEmail(id, requerido = false) {
    const el  = getEl(id);
    const val = el?.value?.trim() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'Email es obligatorio');
        return false;
    }

    if (/[<>'"`;\\]/.test(val)) {
        marcarError(el, 'El email contiene caracteres no permitidos');
        return false;
    }

    const patron = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!patron.test(val)) {
        marcarError(el, 'Formato inválido (ej: nombre@dominio.com)');
        return false;
    }

    if (val.length > 254) {
        marcarError(el, 'Email demasiado largo (máx. 254 caracteres)');
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarTelefono(id, requerido = true) {
    const el  = getEl(id);
    const val = el?.value?.replace(/\D/g, '') || ''; // Solo dígitos

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'Teléfono es obligatorio');
        return false;
    }

    if (!/^\d+$/.test(val)) {
        marcarError(el, 'El teléfono solo puede contener números');
        return false;
    }

    if (val.length !== 10) {
        marcarError(el, `Teléfono debe tener exactamente 10 dígitos (tiene ${val.length})`);
        return false;
    }

    if (['0','1'].includes(val[0])) {
        marcarError(el, 'Teléfono inválido (no puede iniciar con 0 o 1)');
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarCodigoPostal(id, requerido = false) {
    const el  = getEl(id);
    const val = el?.value?.trim() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'Código postal es obligatorio');
        return false;
    }

    if (!/^\d{5}$/.test(val)) {
        marcarError(el, 'Código postal debe tener exactamente 5 dígitos');
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarSKU(id, requerido = true) {
    const el  = getEl(id);
    const val = el?.value?.trim() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'Código / SKU es obligatorio');
        return false;
    }

    if (val.length < 1 || val.length > 50) {
        marcarError(el, 'SKU debe tener entre 1 y 50 caracteres');
        return false;
    }

    if (!/^[a-zA-Z0-9\-_\.]+$/.test(val)) {
        marcarError(el, 'SKU solo puede contener letras, números, guiones y puntos');
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarCantidad(id, { min = 1, max = null, label = 'Cantidad' } = {}) {
    const el  = getEl(id);
    const raw = el?.value?.trim() || '';
    const val = parseInt(raw);

    el?.classList.remove('is-invalid', 'is-valid');

    if (!raw) {
        marcarError(el, `${label} es obligatoria`);
        return false;
    }

    if (raw.includes('.') || raw.includes(',')) {
        marcarError(el, `${label} debe ser un número entero (sin decimales)`);
        return false;
    }

    if (isNaN(val) || !Number.isInteger(val)) {
        marcarError(el, `${label} debe ser un número entero válido`);
        return false;
    }

    if (val < 0) {
        marcarError(el, `${label} no puede ser negativa`);
        return false;
    }

    if (val < min) {
        marcarError(el, `${label} debe ser al menos ${min}`);
        return false;
    }

    if (max !== null && val > max) {
        marcarError(el, `${label} no puede superar ${max}`);
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarURL(id, requerido = false) {
    const el  = getEl(id);
    const val = el?.value?.trim() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'URL es obligatoria');
        return false;
    }

    try {
        const url = new URL(val);
        if (!['http:', 'https:'].includes(url.protocol)) {
            marcarError(el, 'URL debe comenzar con http:// o https://');
            return false;
        }
    } catch {
        marcarError(el, 'URL inválida (ej: https://ejemplo.com/imagen.jpg)');
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarDescuento(id, requerido = false) {
    const el  = getEl(id);
    const raw = el?.value?.trim() || '';
    const val = parseFloat(raw);

    el?.classList.remove('is-invalid', 'is-valid');

    if (!raw && !requerido) return true;
    if (!raw &&  requerido) {
        marcarError(el, 'Descuento es obligatorio');
        return false;
    }

    if (isNaN(val)) {
        marcarError(el, 'Descuento debe ser un número');
        return false;
    }
    if (val < 0) {
        marcarError(el, 'Descuento no puede ser negativo');
        return false;
    }
    if (val > 100) {
        marcarError(el, 'Descuento no puede ser mayor a 100%');
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarSelect(id, label = 'Campo') {
    const el  = getEl(id);
    const val = el?.value || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val) {
        marcarError(el, `${label} es obligatorio`);
        return false;
    }

    marcarOk(el);
    return true;
}

export function validarMontoPago(id, totalRequerido, label = 'Monto') {
    const el  = getEl(id);
    const raw = el?.value?.trim() || '';
    const val = parseFloat(raw);

    el?.classList.remove('is-invalid', 'is-valid');

    if (!raw) {
        marcarError(el, `${label} es obligatorio`);
        return false;
    }
    if (isNaN(val) || val <= 0) {
        marcarError(el, `${label} debe ser mayor a $0.00`);
        return false;
    }
    if (val < totalRequerido) {
        marcarError(el, `${label} insuficiente. Faltan $${(totalRequerido - val).toFixed(2)}`);
        return false;
    }

    marcarOk(el);
    return true;
}

export function limpiarValidaciones(formId) {
    const form = typeof formId === 'string'
        ? document.getElementById(formId)
        : formId;
    form?.querySelectorAll('.is-valid, .is-invalid')
        .forEach(el => el.classList.remove('is-valid', 'is-invalid'));
    form?.querySelectorAll('.invalid-feedback')
        .forEach(el => el.remove());
}


export function sanitizar(texto, { permitirComillas = false } = {}) {
    if (!texto) return '';
    const peligrosos = permitirComillas ? /[<>`\\]/g : /[<>'"`;\\]/g;
    return texto
        .trim()
        .replace(/\s+/g, ' ')                 
        .replace(peligrosos, '')               
        .substring(0, 1000);                   
}


export function aplicarFiltroInput(el, tipo) {
    const filtros = {
        soloNumeros:   (v) => v.replace(/[^\d]/g, ''),
        soloLetras:    (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s\-]/g, ''),
        alfanumerico:  (v) => v.replace(/[^a-zA-Z0-9\s\-_\.áéíóúÁÉÍÓÚüÜñÑ]/g, ''),
        sinEspeciales: (v) => v.replace(/[<>'"`;\\]/g, ''),
        conMedidas:    (v) => v.replace(/[<>`\\]/g, ''),
        telefono:      (v) => v.replace(/[^\d]/g, '').slice(0, 10),
        sku:           (v) => v.replace(/[^a-zA-Z0-9\-_\.]/g, '').slice(0, 50),
        rfc:           (v) => v.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '').slice(0, 13),
        cp:            (v) => v.replace(/[^\d]/g, '').slice(0, 5),
        decimal:       (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'),
    };
    if (filtros[tipo]) el.value = filtros[tipo](el.value);
}