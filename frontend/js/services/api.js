import { APP_CONFIG, getAuthHeader, resetAuth } from '../config.js';

const API_BASE = APP_CONFIG.API_BASE;
// ─── TABLA DE TRADUCCIÓN DE ERRORES ──────────────────────────────────────────
// Mapea fragmentos de mensajes técnicos del backend a mensajes para el usuario.
// Se evalúan en orden — el primero que coincida gana.

const ERRORES_CONOCIDOS = [

    // ── CFDI / CANCELACIÓN ────────────────────────────────────────────────────
    {
        match: /CANC\d+|ya se encuentra cancelado|no acept[oó] la cancelaci[oó]n|rechaz[oó] la cancelaci[oó]n|permanece VIGENTE/i,
        msg: (raw) => {
            // FEL manda: "Código: CANC999- Mensaje: <detalle>."
            const men = raw.match(/Mensaje:\s*(.+?)(?:\.\s*$|$)/i);
            if (men) return 'Cancelación: ' + men[1].trim();
            // Mensajes ya legibles de nuestro backend
            if (raw.length < 300) return raw;
            return 'El SAT no aceptó la cancelación. El CFDI permanece vigente.';
        }
    },

    // ── CFDI / TIMBRADO (PAC) ─────────────────────────────────────────────────
    // Va PRIMERO para que los errores del PAC (FEL) lleguen completos al usuario
    // en lugar de caer al mensaje genérico por superar los 120 caracteres.
    {
        match: /CFDI\d{3,5}|validaciones de CFDI|error.*timbrar|timbrado|\bPAC\b|GenerarCFDI/i,
        msg: (raw) => {
            // FEL manda: "...descripción: X, detalle: Y. / Código de error: CFDIxxxxx"
            // Extraemos el "detalle:" que es la parte útil para el usuario.
            const det = raw.match(/detalle:\s*(.+?)(?:\s*\/\s*C[oó]digo|$)/i);
            if (det) {
                return `Error al timbrar: ${det[1].trim()}`;
            }
            // Si no hay "detalle:", intentamos la "descripción:"
            const desc = raw.match(/descripci[oó]n:\s*(.+?)(?:,\s*detalle|$)/i);
            if (desc) {
                return `Error al timbrar: ${desc[1].trim()}`;
            }
            return 'El PAC rechazó la factura al validarla. Revisa los datos e intenta de nuevo.';
        }
    },

    // ── PRODUCTOS ─────────────────────────────────────────────────────────────
    {
        match: /duplicate.*sku|unique.*sku|ya existe.*sku|sku.*already/i,
        msg:   'Ya existe un producto con ese código SKU. Usa uno diferente.'
    },
    {
        match: /price.*less.*cost|precio.*menor.*costo|listprice.*cost/i,
        msg:   'El precio de venta no puede ser menor al costo del producto.'
    },
    {
        match: /insufficient.*stock|stock.*insuficiente|not enough stock|sin stock/i,
        msg:   'No hay suficiente stock disponible para completar esta operación.'
    },
    {
        match: /product.*not found|producto.*no encontrado/i,
        msg:   'El producto no fue encontrado. Puede haber sido eliminado.'
    },
    {
        match: /minprice|min.*price|precio.*minimo/i,
        msg:   'El precio mínimo no puede ser mayor al precio de venta.'
    },

    // ── CLIENTES ──────────────────────────────────────────────────────────────
    {
        match: /duplicate.*rfc|unique.*rfc|rfc.*already|ya existe.*rfc/i,
        msg:   'Ya existe un cliente registrado con ese RFC.'
    },
    {
        match: /duplicate.*email|unique.*email|email.*already/i,
        msg:   'Ya existe un cliente registrado con ese correo electrónico.'
    },
    {
        match: /duplicate.*phone|unique.*phone_number|telefono.*already/i,
        msg:   'Ya existe un cliente registrado con ese número de teléfono.'
    },
    {
        match: /customer.*not found|cliente.*no encontrado/i,
        msg:   'El cliente no fue encontrado. Puede haber sido dado de baja.'
    },
    {
        match: /cannot.*delete.*customer|no.*eliminar.*cliente|cliente.*con.*ventas/i,
        msg:   'No se puede eliminar este cliente porque tiene ventas o deudas registradas.'
    },

    // ── VENTAS ────────────────────────────────────────────────────────────────
    {
        match: /sale.*not found|venta.*no encontrada/i,
        msg:   'La venta no fue encontrada en el sistema.'
    },
    {
        match: /already.*cancelled|venta.*ya.*cancelada|sale.*cancelled/i,
        msg:   'Esta venta ya fue cancelada anteriormente.'
    },
    {
        match: /cannot.*cancel.*paid|no.*cancelar.*pagada/i,
        msg:   'No se puede cancelar una venta que ya fue pagada y tiene factura emitida.'
    },
    {
        match: /amount.*received.*less|monto.*insuficiente/i,
        msg:   'El monto recibido es menor al total de la venta.'
    },

    // ── DEUDAS ────────────────────────────────────────────────────────────────
    {
        match: /debt.*not found|deuda.*no encontrada/i,
        msg:   'La deuda no fue encontrada.'
    },
    {
        match: /debt.*already.*paid|deuda.*ya.*liquidada/i,
        msg:   'Esta deuda ya está liquidada. No se pueden registrar más pagos.'
    },
    {
        match: /payment.*exceeds|pago.*excede|amount.*greater.*remaining/i,
        msg:   'El monto del pago supera el saldo pendiente de la deuda.'
    },

    // ── INVENTARIO ────────────────────────────────────────────────────────────
    {
        match: /inventory.*not found|inventario.*no encontrado/i,
        msg:   'No se encontró el registro de inventario para este producto.'
    },
    {
        match: /negative.*stock|stock.*negativo|quantity.*negative/i,
        msg:   'La operación resultaría en stock negativo. Verifica la cantidad.'
    },
    {
        match: /quantity.*must.*positive|cantidad.*positiva/i,
        msg:   'La cantidad debe ser un número positivo mayor a cero.'
    },

    // ── PRE-FACTURAS ──────────────────────────────────────────────────────────
    {
        match: /prefactura.*not found|pre.*factura.*no encontrada/i,
        msg:   'La pre-factura no fue encontrada.'
    },
    {
        match: /cannot.*edit.*emitida|no.*editar.*emitida/i,
        msg:   'No se puede editar una pre-factura que ya fue emitida.'
    },
    {
        match: /cannot.*edit.*cancelada|no.*editar.*cancelada/i,
        msg:   'No se puede editar una pre-factura cancelada.'
    },
    {
        match: /stock.*insuficiente.*para|stock insuficiente para/i,
        msg: (raw) => {
            // Extrae el nombre del producto del mensaje original si es posible
            const match = raw.match(/para "([^"]+)"\. disponible: (\d+), solicitado: (\d+)/i);
            if (match) {
                return `Stock insuficiente para "${match[1]}". Solo hay ${match[2]} unidad(es) disponible(s), solicitaste ${match[3]}.`;
            }
            return 'Stock insuficiente para uno o más productos de la pre-factura.';
        }
    },

    // ── CATEGORÍAS ────────────────────────────────────────────────────────────
    {
        match: /category.*not found|categoria.*no encontrada/i,
        msg:   'La categoría seleccionada no existe.'
    },
    {
        match: /duplicate.*category|categoria.*duplicada/i,
        msg:   'Ya existe una categoría con ese nombre.'
    },

    // ── BASE DE DATOS / INTEGRIDAD ─────────────────────────────────────────────
    {
        match: /constraint.*violation|integrity.*constraint|violacion.*integridad|foreign key/i,
        msg:   'No se puede realizar esta operación porque el registro está relacionado con otros datos del sistema.'
    },
    {
        match: /duplicate.*entry|duplicate key|unique constraint|ya existe un registro/i,
        msg:   'Ya existe un registro con esos datos. Verifica que no estés duplicando información.'
    },
    {
        match: /null.*value|cannot be null|valor.*nulo|not-null/i,
        msg:   'Faltan datos obligatorios. Revisa que todos los campos requeridos estén completos.'
    },
    {
        match: /data.*too long|value too long|dato.*largo/i,
        msg:   'Uno de los campos excede el límite de caracteres permitido.'
    },
    {
        match: /numeric.*overflow|out of range|valor.*fuera.*rango/i,
        msg:   'Uno de los valores numéricos está fuera del rango permitido.'
    },
    {
        match: /jdbc|hibernate|sql|datasource|connection.*refused|could not.*connect/i,
        msg:   'Error de conexión con la base de datos. Verifica que el servidor esté activo.'
    },

    // ── RED / SERVIDOR ─────────────────────────────────────────────────────────
    {
        match: /failed to fetch|network.*error|net::err/i,
        msg:   'No se pudo conectar con el servidor. Verifica que el backend esté corriendo en el puerto 9090.'
    },
    {
        match: /timeout|timed out/i,
        msg:   'La operación tardó demasiado. Intenta de nuevo.'
    },

    // ── AUTENTICACIÓN ──────────────────────────────────────────────────────────
    {
        match: /unauthorized|401|403|forbidden/i,
        msg:   'No tienes permisos para realizar esta acción. Verifica tu sesión.'
    },
    {
        match: /404|not found/i,
        msg:   'El recurso solicitado no existe en el servidor.'
    },
    {
        match: /500|internal server error/i,
        msg:   'Error interno del servidor. Contacta al administrador si persiste.'
    },
];

// ─── FUNCIÓN TRADUCTORA ───────────────────────────────────────────────────────

function traducirError(mensajeOriginal) {
    if (!mensajeOriginal) return 'Ocurrió un error inesperado. Intenta de nuevo.';

    const texto = String(mensajeOriginal);

    for (const regla of ERRORES_CONOCIDOS) {
        if (regla.match.test(texto)) {
            return typeof regla.msg === 'function'
                ? regla.msg(texto)
                : regla.msg;
        }
    }

    // Si el mensaje no parece técnico, mostrarlo directo.
    //
    // El límite era 120 caracteres y se quedaba corto: mensajes legítimos del
    // negocio ("no se puede borrar porque tiene N ventas, déjalo desactivado")
    // pasaban de 120 y caían al genérico, dejando al usuario sin saber qué
    // pasó. Se subió a 250. Lo que de verdad filtra la basura técnica es el
    // patrón de abajo (stack traces, nombres de clase, SQL), no el largo.
    if (texto.length < 250 && !/\bat\b|\.java|hibernate|jdbc|sql|\$\d/i.test(texto)) {
        return texto;
    }

    // Mensaje genérico de último recurso — pero más informativo
    return 'Ocurrió un error al procesar la solicitud. Si el problema persiste, contacta al administrador.';
}

// ─── fetchAPI ─────────────────────────────────────────────────────────────────

export async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const defaultHeaders = {
        'Authorization': getAuthHeader(),
        'Content-Type':  'application/json',
        'Accept':        'application/json'
    };
    const config = {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : null
    };

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            // Credenciales incorrectas: borrarlas y volver a pedirlas
            resetAuth();
            throw new Error('Credenciales incorrectas.');
        }
        if (response.status === 403) {
            throw new Error('No tienes permisos para realizar esta acción.');
        }

        if (!response.ok) {
            // Intentar extraer el mensaje del backend
            let mensajeBackend = `Error HTTP: ${response.status}`;
            try {
                const errorData = await response.json();
                // El backend puede mandar el mensaje en distintos campos
                mensajeBackend = errorData.message
                    || errorData.error
                    || errorData.detail
                    || errorData.msg
                    || JSON.stringify(errorData);
            } catch {
                try {
                    mensajeBackend = await response.text();
                } catch { /* ignorar */ }
            }

            throw new Error(traducirError(mensajeBackend));
        }

        if (response.status === 204) return null;

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
            return await response.json();
        }
        return null;

    } catch (error) {
        // Si ya es un error traducido (lo lanzamos nosotros), no traducir de nuevo
        const esTecnico = /\bat\b|\.java|hibernate|jdbc|sql|\$\d|failed to fetch/i
            .test(error.message);

        const mensajeFinal = esTecnico
            ? traducirError(error.message)
            : error.message;

        console.error(`[API Error] ${endpoint}:`, error.message);
        throw new Error(mensajeFinal);
    }
}