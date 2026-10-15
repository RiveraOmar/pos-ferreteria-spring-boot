/**
 * ─── VALIDACIONES FRONTEND — FerrePOS ────────────────────────────────────────
 * Cubre: texto, números, RFC, email, teléfono, precios, cantidades, URLs,
 *        códigos postales, SKUs, descuentos y validaciones cruzadas.
 * Todas muestran error visual con Bootstrap is-invalid + mensaje debajo.
 */

// ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────

function marcarError(el, mensaje) {
    if (!el) return;
    el.classList.remove('is-valid');
    el.classList.add('is-invalid');
    // Eliminar mensaje previo si existe
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

// ─── 1. TEXTO GENERAL ─────────────────────────────────────────────────────────
/**
 * Valida texto: requerido, longitud, patrón.
 * patronSolo: si true, rechaza caracteres no permitidos en tiempo real
 */
export function validarTexto(id, {
    minLen    = 1,
    maxLen    = 500,
    requerido = true,
    label     = 'Campo',
    patron    = null,       // RegExp string para validar el valor completo
    soloLetras = false,     // Solo letras, espacios y caracteres latinos
    noEspeciales = false,   // Sin caracteres especiales peligrosos
    permitirComillas = false // Deja pasar " y ' — para medidas: 1/2" x 3"
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

    // Rechazar caracteres peligrosos (SQL injection, XSS básico).
    //
    // Con permitirComillas se dejan pasar " y ' porque en una ferretería son
    // parte del dato: 1/2" x 3" ES la medida, no un intento de ataque. Lo que
    // de verdad importa bloquear sigue fuera: < > (etiquetas HTML), el acento
    // invertido (plantillas de JS) y la barra invertida (escapes).
    //
    // Esto es seguro SOLO porque el módulo que lo usa escapa el texto al
    // pintarlo. Si se activa en una pantalla que interpola sin escapar, un
    // nombre con comillas le va a romper la fila.
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

// ─── 2. NÚMEROS ───────────────────────────────────────────────────────────────
export function validarNumero(id, {
    min       = 0,
    max       = null,
    decimales = 2,
    requerido = true,
    label     = 'Campo',
    entero    = false     // Solo enteros (sin decimales)
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

// ─── 3. PRECIO (no puede ser 0 si es requerido) ───────────────────────────────
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

// ─── 4. VALIDACIÓN CRUZADA: costo vs precio de venta ────────────────────────
/**
 * Valida que el precio de venta sea >= costo (evitar vender a pérdida sin aviso).
 * Retorna true siempre (solo advierte, no bloquea — es decisión del negocio).
 */
export function validarCostoVsPrecio(idCosto, idPrecio) {
    const costo  = parseFloat(getEl(idCosto)?.value  || '0') || 0;
    const precio = parseFloat(getEl(idPrecio)?.value || '0') || 0;
    if (costo > 0 && precio > 0 && precio < costo) {
        const elPrecio = getEl(idPrecio);
        // Solo advertencia visual — no bloquea
        elPrecio?.classList.remove('is-valid');
        elPrecio?.classList.add('is-invalid');
        elPrecio?.parentElement?.querySelector('.invalid-feedback')?.remove();
        const div = document.createElement('div');
        div.className   = 'invalid-feedback d-block text-warning';
        div.style.color = '#d97706';
        div.innerHTML   = `⚠ El precio de venta ($${precio.toFixed(2)}) es menor al costo ($${costo.toFixed(2)}). ¿Es correcto?`;
        getEl(idPrecio)?.after(div);
        return false; // Retorna false para que el llamador decida si bloquear
    }
    return true;
}

// ─── 5. RFC MEXICANO ──────────────────────────────────────────────────────────
export function validarRFC(id, requerido = false) {
    const el  = getEl(id);
    const val = el?.value?.trim().toUpperCase() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'RFC es obligatorio');
        return false;
    }

    // Caracteres extraños
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

// ─── 6. EMAIL ─────────────────────────────────────────────────────────────────
export function validarEmail(id, requerido = false) {
    const el  = getEl(id);
    const val = el?.value?.trim() || '';

    el?.classList.remove('is-invalid', 'is-valid');

    if (!val && !requerido) return true;
    if (!val &&  requerido) {
        marcarError(el, 'Email es obligatorio');
        return false;
    }

    // Caracteres especiales peligrosos
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

// ─── 7. TELÉFONO MEXICANO ─────────────────────────────────────────────────────
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

    // Primer dígito no puede ser 0 ni 1
    if (['0','1'].includes(val[0])) {
        marcarError(el, 'Teléfono inválido (no puede iniciar con 0 o 1)');
        return false;
    }

    marcarOk(el);
    return true;
}

// ─── 8. CÓDIGO POSTAL MEXICANO ────────────────────────────────────────────────
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

// ─── 9. SKU / CÓDIGO DE PRODUCTO ─────────────────────────────────────────────
// Aquí NO se permiten comillas a propósito: el SKU se imprime en etiquetas, se
// escanea y se usa dentro de URLs. Las medidas van en el nombre, no en el código.
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

    // Solo alfanumérico, guiones y guiones bajos
    if (!/^[a-zA-Z0-9\-_\.]+$/.test(val)) {
        marcarError(el, 'SKU solo puede contener letras, números, guiones y puntos');
        return false;
    }

    marcarOk(el);
    return true;
}

// ─── 10. CANTIDAD ENTERA (stock, restock) ────────────────────────────────────
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

// ─── 11. URL DE IMAGEN ────────────────────────────────────────────────────────
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

// ─── 12. DESCUENTO (0-100%) ───────────────────────────────────────────────────
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

// ─── 13. SELECT REQUERIDO ─────────────────────────────────────────────────────
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

// ─── 14. MONTO DE PAGO ────────────────────────────────────────────────────────
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

// ─── 15. LIMPIAR TODAS LAS VALIDACIONES DE UN FORM ───────────────────────────
export function limpiarValidaciones(formId) {
    const form = typeof formId === 'string'
        ? document.getElementById(formId)
        : formId;
    form?.querySelectorAll('.is-valid, .is-invalid')
        .forEach(el => el.classList.remove('is-valid', 'is-invalid'));
    form?.querySelectorAll('.invalid-feedback')
        .forEach(el => el.remove());
}

// ─── 16. SANITIZAR TEXTO (limpiar antes de enviar al backend) ────────────────
/**
 * Limpia un string: elimina espacios extra, caracteres peligrosos.
 * Úsalo en el payload antes de fetchAPI.
 *
 * permitirComillas deja pasar " y ' porque en ferretería son el dato mismo:
 * Tornillo 1/2" x 3". Se usa SOLO en los campos donde hacen falta — nombre y
 * descripción de producto, y valores de atributos.
 *
 * No se activó por defecto A PROPÓSITO: sanitizar() la usa TODO el sistema, y
 * los módulos que todavía pintan texto sin escapar se romperían con una
 * comilla en el dato (una comilla doble cierra el atributo HTML a media
 * instrucción y deja el botón de la fila muerto — es justo lo que pasó con
 * el botón de Abastecer cuando entraron los tornillos).
 */
export function sanitizar(texto, { permitirComillas = false } = {}) {
    if (!texto) return '';
    const peligrosos = permitirComillas ? /[<>`\\]/g : /[<>'"`;\\]/g;
    return texto
        .trim()
        .replace(/\s+/g, ' ')                  // espacios múltiples → uno
        .replace(peligrosos, '')               // caracteres peligrosos
        .substring(0, 1000);                   // máximo de seguridad
}

// ─── 17. PREVENIR CARACTERES EN TIEMPO REAL ───────────────────────────────────
/**
 * Agrégalo en oninput o addEventListener('input') de cualquier campo.
 * Llama: aplicarFiltroInput(el, 'soloNumeros')
 * Tipos: 'soloNumeros', 'soloLetras', 'alfanumerico', 'sinEspeciales',
 *        'conMedidas', 'telefono', 'sku'
 */
export function aplicarFiltroInput(el, tipo) {
    const filtros = {
        soloNumeros:   (v) => v.replace(/[^\d]/g, ''),
        soloLetras:    (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s\-]/g, ''),
        alfanumerico:  (v) => v.replace(/[^a-zA-Z0-9\s\-_\.áéíóúÁÉÍÓÚüÜñÑ]/g, ''),
        sinEspeciales: (v) => v.replace(/[<>'"`;\\]/g, ''),
        // Como sinEspeciales, pero DEJA las comillas: en ferretería 1/2" es
        // la medida. Se usa en nombre y descripción de producto, y en los
        // valores de los atributos dinámicos.
        conMedidas:    (v) => v.replace(/[<>`\\]/g, ''),
        telefono:      (v) => v.replace(/[^\d]/g, '').slice(0, 10),
        sku:           (v) => v.replace(/[^a-zA-Z0-9\-_\.]/g, '').slice(0, 50),
        rfc:           (v) => v.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '').slice(0, 13),
        cp:            (v) => v.replace(/[^\d]/g, '').slice(0, 5),
        decimal:       (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'),
    };
    if (filtros[tipo]) el.value = filtros[tipo](el.value);
}