import { fetchAPI } from '../services/api.js';
import { fmtFecha } from '../services/fechas.js';


// Escapa un texto que va DENTRO de un onclick="...('AQUI')".
// Ahi conviven dos lenguajes y cada uno tiene su comilla: el atributo HTML
// esta delimitado por " y la cadena de JavaScript por '. Por eso hay que
// escapar para LOS DOS, en este orden:
//   1. la barra invertida, o los escapes de abajo se rompen entre si
//   2. la comilla simple, con \' — es escape de JAVASCRIPT
//   3. y hasta el final el HTML: & " < >
// La comilla simple NO se convierte a &#39; a proposito: el navegador la
// decodificaria de vuelta a ' y cerraria la cadena de JS a media instruccion.
function escAttr(s) {
    return String(s ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ══════════════════════════════════════════════════════════════════════════════
// DEUDAS — "LIBRETA DE REMISIONES"
// Índice de clientes con deuda → hoja por cliente con movimientos cronológicos
// (cargos con productos y nota de quién llevó, abonos, y saldo corrido).
// Indicador visual 🧾 de si el cliente tiene datos fiscales para facturar.
// ══════════════════════════════════════════════════════════════════════════════

let clientesMap = {};        // id → datos del cliente (para saber si es facturable)
let clienteAbierto = null;   // id de la hoja abierta (para refrescar tras un pago)
let mostrarHistorial = false; // ¿mostrar también las notas ya liquidadas?
let hojaActual = null;       // datos de la hoja abierta (para imprimir)
let pestanaLibreta = 'nueva'; // 'nueva' (libreta de apuntes) | 'clasica' (hoja tipo factura)
let mostrarHistorialNb = false; // (heredado; la hoja nueva usa pestañas)

// Pestaña abierta dentro de la hoja de un cliente: 'pendientes' | 'pagadas'
let pestanaHoja = 'pendientes';

// Texto del buscador del índice. Vive aquí y no dentro de la función para
// que sobreviva al repintado: al volver de la hoja de un cliente, o al darle
// a Actualizar, la búsqueda que traías no se borra.
let filtroClientes = '';

// Tope de cada nota de fiado (regla de deducibilidad de pagos en efectivo).
// Debe coincidir con LIMITE_EFECTIVO de services/facturaDividida.js
const LIMITE_NOTA = 2000;

// Encabezado de las impresiones — edítalo con los datos de tu negocio
const NEGOCIO = {
    nombre: 'FERRETERÍA',
    telefono: ''
};

export function initDeudas(container) {
    inyectarEstiloNotebook();
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
                <h2 class="mb-0 fw-bold"><i class="bi bi-journal-bookmark-fill me-2"></i>Libreta de Deudas</h2>
                <p class="text-muted mb-0 small">Como la libreta de apuntes del mostrador.</p>
            </div>
            <button class="btn btn-outline-primary btn-sm" id="btn-refrescar-libreta">
                <i class="bi bi-arrow-clockwise me-1"></i>Actualizar</button>
        </div>

        <ul class="nav nav-pills mb-3" id="tabs-libreta" style="gap:6px">
            <li class="nav-item">
                <button type="button" class="nav-link active" data-tab-libreta="nueva">
                    <i class="bi bi-journal-text me-1"></i>Libreta
                </button>
            </li>
            <li class="nav-item">
                <button type="button" class="nav-link" data-tab-libreta="clasica">
                    <i class="bi bi-table me-1"></i>Vista clásica (tipo factura)
                </button>
            </li>
        </ul>

        <div id="deudas-container"></div>`;

    document.querySelectorAll('#tabs-libreta [data-tab-libreta]').forEach(btn => {
        btn.addEventListener('click', () => {
            pestanaLibreta = btn.dataset.tabLibreta;
            document.querySelectorAll('#tabs-libreta [data-tab-libreta]').forEach(b =>
                b.classList.toggle('active', b === btn));
            clienteAbierto = null;
            pestanaLibreta === 'nueva' ? cargarIndiceNotebook() : cargarLibreta();
        });
    });

    document.getElementById('btn-refrescar-libreta').onclick = () => refrescarVista();

    clienteAbierto = null;
    pestanaLibreta = 'nueva';

    // Deep-link desde el Dashboard: si se hizo clic en la deuda de un cliente,
    // se abre directamente SU hoja (en la libreta nueva) en vez del índice.
    const destino = sessionStorage.getItem('deudas_abrir_cliente');
    if (destino) {
        sessionStorage.removeItem('deudas_abrir_cliente');
        abrirDesdeDashboardNotebook(Number(destino));
    } else {
        cargarIndiceNotebook();
    }
}

// Deep-link desde el Dashboard, pero hacia la vista NUEVA (primaria)
async function abrirDesdeDashboardNotebook(clienteId) {
    if (!Object.keys(clientesMap).length) {
        try {
            const clientes = await fetchAPI('/customers?active=true');
            clientes.forEach(c => clientesMap[c.id] = c);
        } catch (e) {}
    }
    abrirLibretaNotebook(clienteId);
}

// La hoja necesita clientesMap (badge de facturable, botón Facturar), que
// normalmente llena cargarLibreta. Al llegar directo, se carga primero.
async function abrirDesdeDashboard(clienteId) {
    try {
        const clientes = await fetchAPI('/customers?active=true');
        clientesMap = {};
        clientes.forEach(c => clientesMap[c.id] = c);
    } catch (e) { clientesMap = {}; }
    window.abrirHojaCliente(clienteId);
}

const fmt = n => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s || '').replace(/'/g, "\\'");

// ─── FACTURABLE: ¿el cliente tiene datos fiscales completos? ─────────────────

function datosFiscalesFaltantes(c) {
    if (!c) return ['cliente no encontrado'];
    const faltan = [];
    if (!c.rfc || c.rfc === 'XAXX010101000') faltan.push('RFC');
    if (!c.regimenFiscal) faltan.push('régimen fiscal');
    if (!c.codigoPostal)  faltan.push('C.P. fiscal');
    if (!c.usoCfdi)       faltan.push('uso CFDI');
    return faltan;
}

function badgeFacturable(clienteId, chico) {
    const c = clientesMap[clienteId];
    const faltan = datosFiscalesFaltantes(c);
    if (!faltan.length) {
        return `<span class="badge bg-success bg-opacity-10 text-success border border-success ${chico ? 'small' : ''}"
                    title="Cliente con datos fiscales completos: se le puede timbrar factura">
                    🧾 Facturable</span>`;
    }
    return `<span class="badge bg-secondary bg-opacity-10 text-secondary border ${chico ? 'small' : ''}"
                title="Faltan datos fiscales: ${faltan.join(', ')}. Complétalos en el módulo Clientes.">
                ⚠️ Sin datos fiscales</span>`;
}

// ─── ÍNDICE DE LA LIBRETA ─────────────────────────────────────────────────────

async function cargarLibreta() {
    clienteAbierto = null;
    const container = document.getElementById('deudas-container');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-warning"></div></div>`;

    try {
        const [deudas, clientes] = await Promise.all([
            fetchAPI('/debts'),
            fetchAPI('/customers?active=true')
        ]);
        clientesMap = {};
        clientes.forEach(c => clientesMap[c.id] = c);

        // Agrupar deudas pendientes por cliente
        const porCliente = {};
        deudas.forEach(d => {
            if (d.status === 'PAID') return;
            if (!porCliente[d.customerId]) {
                porCliente[d.customerId] = {
                    id: d.customerId, nombre: d.customerName,
                    telefono: d.customerPhone, notas: 0, total: 0, masAntigua: null
                };
            }
            const g = porCliente[d.customerId];
            g.notas++;
            g.total += parseFloat(d.remainingAmount);
            const f = d.createdAt ? new Date(d.createdAt) : null;
            if (f && (!g.masAntigua || f < g.masAntigua)) g.masAntigua = f;
        });

        // Más antiguas primero: el cliente que más tiempo lleva debiendo
        // encabeza la libreta (prioridad natural de cobranza)
        const lista = Object.values(porCliente).sort((a, b) => {
            const fa = a.masAntigua ? a.masAntigua.getTime() : Infinity;
            const fb = b.masAntigua ? b.masAntigua.getTime() : Infinity;
            return fa - fb || b.total - a.total;
        });

        if (!lista.length) {
            container.innerHTML = `<div class="text-center py-5 text-muted">
                <i class="bi bi-journal-check fs-1 d-block mb-3 text-success"></i>
                <p class="mb-1 fw-bold">La libreta está limpia</p>
                <p class="small">No hay clientes con deudas pendientes.</p></div>`;
            return;
        }

        const totalPorCobrar = lista.reduce((s, g) => s + g.total, 0);
        const masVieja = lista.reduce((max, g) => Math.max(max, diasDesde(g.masAntigua)), 0);

        container.innerHTML = `
            <!-- KPIs -->
            <div class="row g-3 mb-4">
                <div class="col-md-4"><div class="card border-0 shadow-sm text-center bg-danger text-white">
                    <div class="card-body py-3"><h4 class="fw-bold mb-0">$${fmt(totalPorCobrar)}</h4>
                    <small>Total por cobrar</small></div></div></div>
                <div class="col-md-4"><div class="card border-0 shadow-sm text-center bg-warning text-dark">
                    <div class="card-body py-3"><h4 class="fw-bold mb-0">${lista.length}</h4>
                    <small>Clientes en la libreta</small></div></div></div>
                <div class="col-md-4"><div class="card border-0 shadow-sm text-center bg-secondary text-white">
                    <div class="card-body py-3"><h4 class="fw-bold mb-0">${masVieja} días</h4>
                    <small>Deuda más antigua</small></div></div></div>
            </div>

            <!-- Buscador -->
            <div class="input-group mb-3">
                <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                <input type="text" id="filtro-libreta" class="form-control"
                    placeholder="Buscar cliente en la libreta...">
            </div>

            <!-- Índice de clientes: TARJETAS -->
            <div class="row g-3" id="indice-libreta">
                ${lista.map(g => tarjetaCliente(g)).join('')}
            </div>
            <p class="text-muted small mt-3 mb-0"><i class="bi bi-info-circle me-1"></i>
                Para anotar productos en la libreta, registra una <strong>venta a crédito</strong>
                desde el módulo Ventas; aparecerá aquí automáticamente con su nota.</p>`;

        // Autofocus: llegar y teclear el nombre del cliente directo
        setTimeout(() => document.getElementById('filtro-libreta')?.focus(), 50);

        // Filtro en vivo
        document.getElementById('filtro-libreta').addEventListener('input', e => {
            const normalizar = texto => String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const q = normalizar(e.target.value);

document.querySelectorAll('#indice-libreta .hoja-item').forEach(el => {
    el.style.display = normalizar(el.dataset.nombre).includes(q) ? '' : 'none';
});
        });

    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

function diasDesde(fecha) {
    if (!fecha) return 0;
    return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function chipAntiguedad(dias) {
    if (dias > 30) return `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger">${dias} días</span>`;
    if (dias > 15) return `<span class="badge bg-warning bg-opacity-25 text-dark border border-warning">${dias} días</span>`;
    return `<span class="badge bg-light text-muted border">${dias} días</span>`;
}

function tarjetaCliente(g) {
    const inicial = (g.nombre || '?').trim().charAt(0).toUpperCase();
    const dias = diasDesde(g.masAntigua);
    // Borde según urgencia: rojo >30 días, ámbar >15, gris normal
    const borde = dias > 30 ? '#dc3545' : dias > 15 ? '#2B6CA3' : 'var(--linea, #DCE0E5)';
    return `
    <div class="col-sm-6 col-lg-4 col-xxl-3 hoja-item"
         data-nombre="${((g.nombre || '') + ' ' + (g.telefono || '')).toLowerCase()}">
        <div class="card h-100 shadow-sm tarjeta-deudor"
             style="cursor:pointer;border-left:4px solid ${borde};transition:transform .12s, box-shadow .12s"
             onclick="window.abrirHojaCliente(${g.id})"
             onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(27,29,33,.15)'"
             onmouseout="this.style.transform='';this.style.boxShadow=''">
            <div class="card-body p-3">
                <div class="d-flex align-items-center gap-2 mb-2">
                    <div class="rounded-circle text-white fw-bold d-flex align-items-center
                                justify-content-center flex-shrink-0"
                         style="width:42px;height:42px;font-size:1.15rem;background:#26292F">
                        ${inicial}</div>
                    <div style="min-width:0">
                        <div class="fw-bold text-truncate" title="${g.nombre}">
                            ${g.nombre}</div>
                        <div class="text-muted" style="font-size:.72rem">
                            ${g.telefono
                                ? `<i class="bi bi-telephone me-1"></i>${g.telefono}`
                                : '<span class="opacity-50">Sin teléfono</span>'}
                        </div>
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-end">
                    <div>
                        <div class="text-muted" style="font-size:.7rem">DEBE</div>
                        <div class="fw-bold text-danger fs-4 lh-1">$${fmt(g.total)}</div>
                    </div>
                    <div class="text-end">
                        <div class="mb-1">${chipAntiguedad(dias)}</div>
                        <span class="badge bg-light text-dark border"
                            style="font-size:.65rem">${g.notas} nota(s)</span>
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    ${badgeFacturable(g.id, true) || '<span></span>'}
                    <small class="text-muted">Abrir hoja
                        <i class="bi bi-chevron-right"></i></small>
                </div>
            </div>
        </div>
    </div>`;
}

// ─── HOJA DEL CLIENTE (la página de la libreta) ──────────────────────────────

window.abrirHojaCliente = async (clienteId) => {
    if (clienteAbierto !== clienteId) mostrarHistorial = false; // hoja nueva: ocultar liquidadas
    clienteAbierto = clienteId;
    const container = document.getElementById('deudas-container');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-warning"></div>
        <p class="text-muted small mt-2">Abriendo hoja del cliente...</p></div>`;

    try {
        // 1. Todas las deudas del cliente (incluye pagadas: la libreta guarda historia)
        const deudas = await fetchAPI(`/debts/customer/${clienteId}`);
        if (!deudas.length) {
            container.innerHTML = `<div class="alert alert-info">Este cliente no tiene movimientos.
                <a href="#" onclick="window.volverALibreta();return false">Volver a la libreta</a></div>`;
            return;
        }
        const cliente = clientesMap[clienteId] || {};
        const nombre = deudas[0].customerName || cliente.fullName || '';
        const telefono = deudas[0].customerPhone || cliente.phoneNumber || '';

        // 2. Ventas vinculadas (para listar los productos que se llevó)
        const saleIds = deudas.filter(d => d.saleId).map(d => d.saleId);
        let ventasMap = {};
        if (saleIds.length) {
            const ventas = await fetchAPI(`/sales/by-ids?ids=${saleIds.join(',')}`);
            ventas.forEach(v => ventasMap[v.id] = v);
        }

        // 3. Pagos de cada deuda (los abonos de la libreta)
        const pagosPorDeuda = await Promise.all(
            deudas.map(d => fetchAPI(`/debts/${d.id}/payments`).catch(() => []))
        );

        // Guardar los datos de la hoja para las impresiones
        hojaActual = { clienteId, nombre, telefono, deudas, ventasMap, pagosPorDeuda };

        // 4. Armar movimientos cronológicos: cargos y abonos
        const movs = [];
        deudas.forEach((d, i) => {
            movs.push({ tipo: 'CARGO', fecha: d.createdAt, deuda: d, venta: ventasMap[d.saleId] });
            (pagosPorDeuda[i] || []).forEach(p => {
                movs.push({ tipo: 'ABONO', fecha: p.paymentDate, pago: p,
                    folio: d.invoiceNumber, deudaLiquidada: d.status === 'PAID' });
            });
        });
        movs.sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));

        // Por defecto solo se muestran las notas pendientes (y sus abonos parciales);
        // las liquidadas se despliegan con el botón "Ver liquidadas".
        const numLiquidadas = deudas.filter(d => d.status === 'PAID').length;
        const movsVisibles = mostrarHistorial
            ? movs
            : movs.filter(m => m.tipo === 'CARGO'
                ? m.deuda.status !== 'PAID'
                : !m.deudaLiquidada);

        // 5. Saldo corrido, como en la libreta física
        let saldo = 0;
        const filas = movsVisibles.map(m => {
            if (m.tipo === 'CARGO') {
                saldo += Number(m.deuda.totalAmount);
                return filaCargo(m, saldo, nombre);
            }
            saldo -= Number(m.pago.amount);
            return filaAbono(m, saldo);
        }).join('') || `<tr><td colspan="10" class="text-center text-muted py-4">
            Sin notas pendientes. ${numLiquidadas ? 'Usa "Ver liquidadas" para el historial.' : ''}</td></tr>`;

        const totalPendiente = deudas.reduce((s, d) =>
            d.status !== 'PAID' ? s + Number(d.remainingAmount) : s, 0);
        const pendientes = deudas.filter(d => d.status !== 'PAID');

        // Botón WhatsApp de recordatorio (si hay teléfono)
        const tel = (telefono || '').replace(/\D/g, '');
        const btnWhats = tel.length >= 10 ? `
            <a class="btn btn-outline-success btn-sm" target="_blank"
               href="https://wa.me/52${tel.slice(-10)}?text=${encodeURIComponent(
                   `Hola ${nombre}, le recordamos que tiene un saldo pendiente de $${fmt(totalPendiente)} en la ferretería. ¡Gracias!`)}">
               <i class="bi bi-whatsapp me-1"></i>Recordatorio</a>` : '';

        // Botón Facturar: solo si el cliente tiene datos fiscales completos
        // y hay notas pendientes con venta vinculada
        const facturable = datosFiscalesFaltantes(clientesMap[clienteId]).length === 0;
        // Se puede facturar CUALQUIER nota que venga de una venta, esté
        // pagada o no. Antes solo las pendientes, y eso dejaba fuera el caso
        // más común del mostrador: el cliente liquida su cuenta y HASTA
        // ENTONCES pide su factura.
        //
        // Fiscalmente además es el caso más limpio: una nota ya pagada se
        // timbra como PUE (pago en una sola exhibición), que es justo lo que
        // manda el sistema.
        const notasTimbrables = deudas.filter(d => d.saleId);
        const marcadasInicio  = pendientes.filter(d => d.saleId).length;
        const btnFacturar = (facturable && notasTimbrables.length) ? `
            <button class="btn btn-primary btn-sm" id="btn-facturar-notas"
                ${marcadasInicio === 0 ? 'disabled' : ''}
                onclick="window.facturarNotasCliente(${clienteId}, '${escAttr(nombre)}')">
                <i class="bi bi-receipt me-1"></i>Facturar seleccionadas
                (<span id="cnt-facturar">${marcadasInicio}</span>)</button>` : '';

        const btnImprimir = `
            <button class="btn btn-outline-dark btn-sm" title="Imprimir la hoja completa del cliente"
                onclick="window.imprimirHoja()">
                <i class="bi bi-printer me-1"></i>Imprimir hoja</button>`;

        container.innerHTML = `
            <button class="btn btn-link text-decoration-none ps-0 mb-2" onclick="window.volverALibreta()">
                <i class="bi bi-arrow-left me-1"></i>Volver a la libreta</button>

            <!-- Encabezado de la hoja -->
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                        <h4 class="fw-bold mb-1"><i class="bi bi-journal-text me-2 text-warning"></i>${nombre}
                            ${badgeFacturable(clienteId, false)}</h4>
                        <div class="text-muted small">
                            ${telefono ? `<i class="bi bi-telephone me-1"></i>${telefono} · ` : ''}
                            ${pendientes.length} nota(s) pendiente(s)
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="text-muted small">Saldo actual</div>
                        <div class="fw-bold fs-3 ${totalPendiente > 0 ? 'text-danger' : 'text-success'}">
                            $${fmt(totalPendiente)}</div>
                        <div class="d-flex gap-2 justify-content-end mt-1 flex-wrap">
                            ${btnWhats}
                            ${btnImprimir}
                            ${btnFacturar}
                            ${totalPendiente > 0 ? `<button class="btn btn-success btn-sm"
                                onclick="window.abonarCuenta(${clienteId}, '${escAttr(nombre)}', ${totalPendiente.toFixed(2)})">
                                <i class="bi bi-cash-coin me-1"></i>Abonar a la cuenta</button>` : ''}
                            ${totalPendiente > 0 ? `<button class="btn btn-danger btn-sm"
                                onclick="window.saldarTodo(${clienteId}, '${escAttr(nombre)}', ${totalPendiente.toFixed(2)})">
                                <i class="bi bi-check-all me-1"></i>Saldar todo</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- La hoja: estilo tabla de factura -->
            <div class="d-flex justify-content-end mb-2">
                ${numLiquidadas ? `<button class="btn btn-sm ${mostrarHistorial ? 'btn-secondary' : 'btn-outline-secondary'}"
                    onclick="window.toggleHistorialLibreta()">
                    <i class="bi bi-${mostrarHistorial ? 'eye-slash' : 'clock-history'} me-1"></i>
                    ${mostrarHistorial ? 'Ocultar liquidadas' : `Ver liquidadas (${numLiquidadas})`}</button>` : ''}
            </div>
            <div class="card border-0 shadow-sm">
                <div class="fw-bold text-center bg-dark text-white py-1 small">MOVIMIENTOS DE LA CUENTA</div>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered align-middle mb-0" style="font-size:.82rem">
                        <thead>
                            <tr class="text-center" style="background:#212529;color:#fff;font-size:.75rem">
                                <th style="width:80px">Fecha</th>
                                <th style="width:110px">Folio</th>
                                <th style="width:55px">Cant.</th>
                                <th>Descripción</th>
                                <th style="width:90px">P. Unitario</th>
                                <th style="width:90px">Importe</th>
                                <th style="width:95px">Cargo</th>
                                <th style="width:95px">Abono</th>
                                <th style="width:100px">Saldo</th>
                                <th style="width:95px"></th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                        <tfoot>
                            <tr style="background:#f8f9fa">
                                <td colspan="8" class="fw-bold text-end">SALDO PENDIENTE</td>
                                <td class="text-end fw-bold ${totalPendiente > 0 ? 'text-danger' : 'text-success'}">
                                    $${fmt(totalPendiente)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>`;

    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>
            <button class="btn btn-link" onclick="window.volverALibreta()">Volver</button>`;
    }
};

window.volverALibreta = () => cargarLibreta();

// ─── FACTURAR TODAS LAS NOTAS DEL CLIENTE ─────────────────────────────────────
// Cobro mensual: el cliente junta 6, 7, 15 notas y todas se facturan el mismo
// día, cada una como su propio CFDI (todas < $2,000 por construcción).
// Usa el mismo endpoint que el Historial: POST /cfdi/timbrar/venta/{saleId}

window.facturarNotasCliente = async (clienteId, clienteNombre) => {
    Swal.fire({ title: 'Revisando notas...',
        html: '<div class="spinner-border text-primary"></div>',
        allowOutsideClick: false, showConfirmButton: false });

    try {
        // 1. Solo las notas SELECCIONADAS con su casilla en la hoja
        const seleccionadas = new Set(
            [...document.querySelectorAll('.chk-facturar:checked')]
                .map(c => Number(c.dataset.debtId)));
        const deudas = await fetchAPI(`/debts/customer/${clienteId}`);
        // Ya NO se excluyen las pagadas: si el cliente liquidó su cuenta y
        // ahora pide su factura, tiene derecho y la venta existe igual. El
        // backend sigue impidiendo timbrar dos veces la misma venta.
        const notas = deudas.filter(d => d.saleId && seleccionadas.has(d.id));
        if (!notas.length) {
            Swal.fire('Nada seleccionado',
                'Marca la casilla "Facturar" de las notas que quieras timbrar.', 'info');
            return;
        }

        // 2. Detectar cuáles ya tienen CFDI vigente (no gastar timbres dobles)
        const estados = await Promise.all(notas.map(async d => {
            try {
                const cfdi = await fetchAPI(`/cfdi/venta/${d.saleId}`);
                return (cfdi && cfdi.status === 'VIGENTE') ? 'FACTURADA' : 'PENDIENTE';
            } catch (e) { return 'PENDIENTE'; } // 404 = sin CFDI
        }));
        const porTimbrar   = notas.filter((d, i) => estados[i] === 'PENDIENTE');
        const yaFacturadas = notas.filter((d, i) => estados[i] === 'FACTURADA');

        if (!porTimbrar.length) {
            Swal.fire('Todo facturado',
                'Todas las notas pendientes de este cliente ya tienen CFDI vigente.', 'success');
            return;
        }

        // 3. Previsualización
        const totalFacturar = porTimbrar.reduce((s, d) => s + Number(d.totalAmount), 0);
        const lista = porTimbrar.map(d => `
            <div class="d-flex justify-content-between border-bottom py-1">
                <span><span class="badge bg-light text-dark border font-monospace">${d.invoiceNumber || '---'}</span></span>
                <strong>$${fmt(d.totalAmount)}</strong>
            </div>`).join('');
        const listaYa = yaFacturadas.length ? `
            <p class="small text-muted mt-2 mb-0"><i class="bi bi-check-circle me-1"></i>
            ${yaFacturadas.length} nota(s) ya facturada(s) — se omiten para no gastar timbres.</p>` : '';

        const conf = await Swal.fire({
            title: `Facturar ${porTimbrar.length} notas`,
            html: `<div class="text-start">
                <p class="mb-2">Cliente: <strong>${clienteNombre}</strong><br>
                <small class="text-muted">Cada nota se timbra como su propia factura
                (todas menores a $${fmt(LIMITE_NOTA)}).</small></p>
                <div style="max-height:45vh;overflow-y:auto">${lista}</div>
                <div class="d-flex justify-content-between pt-2">
                    <strong>Total a facturar</strong>
                    <strong class="text-success">$${fmt(totalFacturar)}</strong>
                </div>${listaYa}</div>`,
            width: '480px',
            showCancelButton: true,
            confirmButtonText: `<i class="bi bi-send-check me-1"></i>Timbrar ${porTimbrar.length} facturas`,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#0d6efd'
        });
        if (!conf.isConfirmed) return;

        // 4. Timbrar una por una (secuencial); si una falla, se continúa
        //    con las demás y al final se reporta todo.
        Swal.fire({ title: 'Timbrando con FEL...',
            html: `<div class="spinner-border text-primary"></div>
                   <p class="text-muted small mt-2" id="progreso-timbrado">0 de ${porTimbrar.length}</p>`,
            allowOutsideClick: false, showConfirmButton: false });

        const resultados = [];
        for (let i = 0; i < porTimbrar.length; i++) {
            const d = porTimbrar[i];
            try {
                const cfdi = await fetchAPI(`/cfdi/timbrar/venta/${d.saleId}`, { method: 'POST' });
                resultados.push({ nota: d.invoiceNumber, ok: true,
                    folio: (cfdi.serie || '') + (cfdi.folio || ''), uuid: cfdi.uuid,
                    total: Number(cfdi.total) });
            } catch (e) {
                resultados.push({ nota: d.invoiceNumber, ok: false, error: e.message });
            }
            const p = document.getElementById('progreso-timbrado');
            if (p) p.textContent = `${i + 1} de ${porTimbrar.length}`;
        }

        // 5. Resumen final
        const exitos = resultados.filter(r => r.ok);
        const fallos = resultados.filter(r => !r.ok);
        await Swal.fire({
            icon: fallos.length ? (exitos.length ? 'warning' : 'error') : 'success',
            title: fallos.length
                ? `${exitos.length} facturadas, ${fallos.length} con error`
                : `¡${exitos.length} facturas timbradas!`,
            html: `<div class="text-start" style="max-height:50vh;overflow-y:auto">
                ${exitos.map(r => `<div class="d-flex justify-content-between border-bottom py-1">
                    <span><i class="bi bi-check-circle text-success me-1"></i>
                        <span class="font-monospace small">${r.nota}</span>
                        → Factura <strong>${r.folio}</strong></span>
                    <strong>$${fmt(r.total)}</strong></div>`).join('')}
                ${fallos.map(r => `<div class="border-bottom py-1">
                    <i class="bi bi-x-circle text-danger me-1"></i>
                    <span class="font-monospace small">${r.nota}</span>
                    <div class="small text-danger ps-4">${r.error}</div></div>`).join('')}
                <p class="small text-muted mt-2 mb-0">Los PDF y XML están en el módulo
                <strong>Facturación</strong>.${fallos.length
                    ? ' Las que fallaron se pueden reintentar con este mismo botón (las ya timbradas se omiten solas).' : ''}</p>
            </div>`,
            confirmButtonText: 'Aceptar', width: '520px'
        });
        window.abrirHojaCliente(clienteId);

    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.toggleHistorialLibreta = () => {
    mostrarHistorial = !mostrarHistorial;
    if (clienteAbierto) window.abrirHojaCliente(clienteAbierto);
};

// Actualiza el contador del botón "Facturar seleccionadas" al marcar/desmarcar
window.actualizarBotonFacturar = () => {
    const n = document.querySelectorAll('.chk-facturar:checked').length;
    const cnt = document.getElementById('cnt-facturar');
    const btn = document.getElementById('btn-facturar-notas');
    if (cnt) cnt.textContent = n;
    if (btn) btn.disabled = n === 0;
};

// ─── IMPRESIÓN: nota individual y hoja completa (remisión para el cliente) ────

const fechaHoy = () => new Date().toLocaleDateString('es-MX',
    { day: '2-digit', month: '2-digit', year: 'numeric' });

function estiloImpresion() { return `<style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;margin:24px}
    h2{margin:0;font-size:16px;text-align:center}
    h3{margin:2px 0 10px;font-size:12px;text-align:center;font-weight:normal}
    h4{margin:14px 0 2px;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th,td{border:1px solid #999;padding:3px 5px;font-size:10.5px}
    th{background:#000;color:#fff;text-align:center}
    .der{text-align:right}.cen{text-align:center}.tot{font-weight:bold}
    .sinb td{border:none}
    .nota{background:#f5f5f5;font-style:italic;padding:4px 6px;margin:4px 0}
    @media print{body{margin:8mm}}
</style>`; }

// Tabla de productos con fecha, quién llevó, cantidad, descripción y precios
function tablaProductosImpresion(venta, notaOriginal) {
    const items = venta?.items?.length ? venta.items : [];
    if (!items.length) return '<p><em>Sin detalle de productos</em></p>';
    return `<table><thead><tr>
            <th style="width:95px">Fecha</th><th style="width:110px">Llevó</th>
            <th style="width:45px">Cant.</th><th>Descripción</th>
            <th style="width:70px">P. Unit.</th><th style="width:75px">Importe</th>
        </tr></thead><tbody>` +
        items.map(i => `<tr>
            <td class="cen">${i.addedAt ? fmtFecha(i.addedAt) : ''}</td>
            <td>${i.llevadoPor || notaOriginal || ''}</td>
            <td class="der">${Number(i.quantity)}</td>
            <td>${i.productName}</td>
            <td class="der">$${fmt(i.unitPrice)}</td>
            <td class="der">$${fmt(i.quantity * Number(i.unitPrice))}</td>
        </tr>`).join('') + '</tbody></table>';
}

// La ventana se abre ANTES de consultar la API (si se abriera después del
// await, el navegador la bloquearía como popup no solicitado)
function abrirVentanaImpresion() {
    const w = window.open('', '_blank');
    if (!w) {
        Swal.fire('Ventana bloqueada',
            'El navegador bloqueó la impresión. Permite ventanas emergentes para este sitio.',
            'warning');
        return null;
    }
    w.document.write('<p style="font-family:Arial;font-size:13px;color:#666">Preparando impresión...</p>');
    return w;
}

function escribirImpresion(w, titulo, cuerpo) {
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${titulo}</title>${estiloImpresion()}</head>
        <body>${cuerpo}
        <script>window.onload = () => window.print();<\/script>
        </body></html>`);
    w.document.close();
}

function abrirImpresion(titulo, cuerpo) {
    const w = abrirVentanaImpresion();
    if (w) escribirImpresion(w, titulo, cuerpo);
}

// Folio fiscal (serie+folio del CFDI vigente) de cada nota.
// Devuelve un mapa debtId → "A727"; las notas sin facturar no aparecen.
async function foliosFactura(listaNotas) {
    const mapa = {};
    await Promise.all(listaNotas.map(async d => {
        if (!d.saleId) return;
        try {
            const c = await fetchAPI(`/cfdi/venta/${d.saleId}`);
            if (c && c.status === 'VIGENTE')
                mapa[d.id] = (c.serie || '') + (c.folio || '');
        } catch (e) { /* 404 = aún sin factura */ }
    }));
    return mapa;
}

// Imprimir UNA nota: productos con fecha y portador, total, abonos y resta
window.imprimirNota = (debtId) => {
    if (!hojaActual) return;
    const d = hojaActual.deudas.find(x => x.id === debtId);
    if (!d) return;
    const venta = hojaActual.ventasMap[d.saleId];
    const idx = hojaActual.deudas.indexOf(d);
    const pagos = hojaActual.pagosPorDeuda[idx] || [];
    const notaOriginal = (d.notes || '').split('|')[0].trim();

    const abonosHtml = pagos.length ? `
        <h4>Abonos</h4>
        <table><thead><tr><th style="width:110px">Fecha</th><th>Nota</th>
            <th style="width:90px">Monto</th></tr></thead><tbody>
        ${pagos.map(p => `<tr>
            <td class="cen">${p.paymentDate ? fmtFecha(p.paymentDate) : ''}</td>
            <td>${p.notes || ''}</td>
            <td class="der">$${fmt(p.amount)}</td></tr>`).join('')}
        </tbody></table>` : '';

    const cuerpo = `
        <h2>${NEGOCIO.nombre}</h2>
        <h3>Nota de fiado <strong>${d.invoiceNumber || ''}</strong> —
            Cliente: <strong>${hojaActual.nombre}</strong> —
            Abierta: ${d.createdAt ? fmtFecha(d.createdAt) : ''} —
            Impresa: ${fechaHoy()}</h3>
        ${tablaProductosImpresion(venta, notaOriginal)}
        <table class="sinb"><tbody>
            <tr><td class="der tot">TOTAL DE LA NOTA</td>
                <td class="der tot" style="width:110px;border:1px solid #999">$${fmt(d.totalAmount)}</td></tr>
            <tr><td class="der">Abonado</td>
                <td class="der" style="width:110px;border:1px solid #999">$${fmt(d.paidAmount)}</td></tr>
            <tr><td class="der tot">RESTA</td>
                <td class="der tot" style="width:110px;border:1px solid #999">$${fmt(d.remainingAmount)}</td></tr>
        </tbody></table>
        ${d.notes ? `<p class="nota">✎ ${d.notes}</p>` : ''}
        ${abonosHtml}`;
    abrirImpresion('Nota ' + (d.invoiceNumber || ''), cuerpo);
};

// Imprimir la HOJA del cliente: UNA sola tabla continua estilo libreta con
// todos los productos de las notas SELECCIONADAS (casillas "Facturar").
// Si no hay ninguna marcada, se imprimen todas las visibles.
window.imprimirHoja = async () => {
    if (!hojaActual) return;

    const marcadas = new Set([...document.querySelectorAll('.chk-facturar:checked')]
        .map(c => Number(c.dataset.debtId)));
    const pendientes = hojaActual.deudas.filter(d => d.status !== 'PAID');
    const lista = marcadas.size
        ? hojaActual.deudas.filter(d => marcadas.has(d.id))
        : (mostrarHistorial ? hojaActual.deudas : pendientes);

    if (!lista.length) {
        Swal.fire('Nada que imprimir', 'No hay notas seleccionadas ni pendientes.', 'info');
        return;
    }

    // Abrir la ventana ANTES de consultar folios (evita bloqueo de popups)
    const w = abrirVentanaImpresion();
    if (!w) return;

    // Folio de factura de cada nota (si ya fue timbrada).
    // Si aún no se factura, se numera simple: N-1, N-2... en orden cronológico
    // (los folios internos INV-xxx no le dicen nada al cliente).
    lista.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const facturas = await foliosFactura(lista);
    const numeroSimple = {};
    lista.forEach((d, i) => numeroSimple[d.id] = 'N-' + (i + 1));
    const folioDe = d => facturas[d.id] || numeroSimple[d.id];

    // Todos los productos de todas las notas, en una sola lista cronológica
    const renglones = [];
    lista.forEach(d => {
        const venta = hojaActual.ventasMap[d.saleId];
        const notaOriginal = (d.notes || '').split('|')[0].trim();
        (venta?.items || []).forEach(i => renglones.push({
            fecha: i.addedAt || d.createdAt,
            llevo: i.llevadoPor || notaOriginal || '',
            folio: folioDe(d),
            i
        }));
    });
    renglones.sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));

    const filas = renglones.map(r => `<tr>
        <td class="cen">${r.fecha ? fmtFecha(r.fecha) : ''}</td>
        <td>${r.llevo}</td>
        <td class="cen" style="font-family:monospace;font-size:9px">${r.folio}</td>
        <td class="der">${Number(r.i.quantity)}</td>
        <td>${r.i.productName}</td>
        <td class="der">$${fmt(r.i.unitPrice)}</td>
        <td class="der">$${fmt(r.i.quantity * Number(r.i.unitPrice))}</td>
    </tr>`).join('');

    const totalNotas = lista.reduce((s, d) => s + Number(d.totalAmount), 0);
    const abonado    = lista.reduce((s, d) => s + Number(d.paidAmount || 0), 0);
    const resta      = lista.reduce((s, d) => s + Number(d.remainingAmount), 0);

    // Leyenda: qué facturas ampara esta hoja (para cotejar con los CFDI)
    const resumenNotas = lista.map(d =>
        `${facturas[d.id] ? 'Factura ' + facturas[d.id] : numeroSimple[d.id]}
         ($${fmt(d.totalAmount)})`).join(' &nbsp;·&nbsp; ');

    const cuerpo = `
        <h2>${NEGOCIO.nombre}</h2>
        <h3>Hoja de cliente — <strong>${hojaActual.nombre}</strong>
            ${hojaActual.telefono ? ' — Tel: ' + hojaActual.telefono : ''}
            — Impresa: ${fechaHoy()}</h3>
        <p style="font-size:10px;margin:2px 0 0">
            <strong>Facturas que ampara esta hoja:</strong> ${resumenNotas}</p>
        <table><thead><tr>
            <th style="width:92px">Fecha</th><th style="width:105px">Llevó</th>
            <th style="width:70px">Factura</th><th style="width:42px">Cant.</th>
            <th>Descripción</th>
            <th style="width:68px">P. Unit.</th><th style="width:75px">Importe</th>
        </tr></thead><tbody>${filas}</tbody></table>
        <table class="sinb" style="margin-top:8px"><tbody>
            <tr><td class="der tot">TOTAL DE LAS NOTAS</td>
                <td class="der tot" style="width:120px;border:1px solid #999">$${fmt(totalNotas)}</td></tr>
            ${abonado > 0 ? `<tr><td class="der">Abonado</td>
                <td class="der" style="width:120px;border:1px solid #999">$${fmt(abonado)}</td></tr>
            <tr><td class="der tot">RESTA</td>
                <td class="der tot" style="width:120px;border:1px solid #999">$${fmt(resta)}</td></tr>` : ''}
        </tbody></table>`;
    escribirImpresion(w, 'Hoja de cliente ' + hojaActual.nombre, cuerpo);
};

// Fila de CARGO estilo factura: un renglón por producto, con Fecha/Folio/Cargo/Saldo
// compartidos mediante rowspan (como la tabla de CONCEPTOS del PDF).
function filaCargo(m, saldo, nombreCliente) {
    const d = m.deuda;
    const liquidada = d.status === 'PAID';
    const claseTr = liquidada ? ' class="opacity-50"' : '';

    const items = (m.venta?.items?.length)
        ? m.venta.items
        : [{ quantity: '', productName: 'Sin detalle de productos', unitPrice: null, __sinDetalle: true }];

    // filas: productos + 1 extra si hay nota (post-it)
    const R = items.length + (d.notes ? 1 : 0);

    const badges = `
        <span class="badge bg-light text-dark border font-monospace d-block mb-1">${d.invoiceNumber || '---'}</span>
        ${liquidada ? '<span class="badge bg-success">Liquidada</span>'
            : d.status === 'PARTIAL' ? '<span class="badge bg-warning text-dark">Abonando</span>'
            : '<span class="badge bg-danger">Pendiente</span>'}
        ${!liquidada && Number(d.paidAmount) > 0
            ? `<span class="badge bg-light text-danger border d-block mt-1">Resta $${fmt(d.remainingAmount)}</span>`
            : ''}
        ${!liquidada && d.saleId ? `
        <div class="form-check d-flex justify-content-center mt-1" title="Incluir esta nota al facturar">
            <input type="checkbox" class="form-check-input chk-facturar me-1" checked
                id="chk-fact-${d.id}" data-debt-id="${d.id}"
                onchange="window.actualizarBotonFacturar()">
            <label class="form-check-label text-muted" style="font-size:.68rem"
                for="chk-fact-${d.id}">Facturar</label>
        </div>` : ''}`;

    // Nota original de la nota (el primer "quién llevó", para los productos
    // iniciales que no traen portador propio)
    const notaOriginal = (d.notes || '').split('|')[0].trim();

    const celdaProducto = i => {
        if (i.__sinDetalle) return `
           <td class="text-center text-muted">—</td>
           <td class="text-muted fst-italic">${i.productName}</td>
           <td class="text-end text-muted">—</td>
           <td class="text-end text-muted">—</td>`;
        // Trazabilidad por producto: cuándo se llevó y quién
        const quien = i.llevadoPor || notaOriginal;
        const traza = (i.addedAt || quien) ? `
           <div class="text-muted" style="font-size:.68rem">
               ${i.addedAt ? '<i class="bi bi-calendar3 me-1"></i>' + fmtFecha(i.addedAt) : ''}
               ${quien ? '<span class="ms-2"><i class="bi bi-person me-1"></i>' + quien + '</span>' : ''}
           </div>` : '';
        return `
           <td class="text-end">${Number(i.quantity)}</td>
           <td><div>${i.productName}</div>${traza}</td>
           <td class="text-end">$${fmt(i.unitPrice)}</td>
           <td class="text-end">$${fmt(i.quantity * Number(i.unitPrice))}</td>`;
    };

    let html = `
    <tr${claseTr}>
        <td rowspan="${R}" class="text-center align-top pt-2"><small>${m.fecha ? fmtFecha(m.fecha) : '---'}</small></td>
        <td rowspan="${R}" class="text-center align-top pt-2">${badges}</td>
        ${celdaProducto(items[0])}
        <td rowspan="${R}" class="text-end align-top pt-2 fw-bold">$${fmt(d.totalAmount)}</td>
        <td rowspan="${R}" class="text-center align-top pt-2 text-muted">—</td>
        <td rowspan="${R}" class="text-end align-top pt-2 fw-bold ${saldo > 0 ? 'text-danger' : 'text-success'}">$${fmt(saldo)}</td>
        <td rowspan="${R}" class="text-center align-top pt-2">
            ${!liquidada ? `<button class="btn btn-success btn-sm mb-1 d-block mx-auto"
                onclick="window.abrirPago(${d.id}, ${d.remainingAmount}, '${escAttr(nombreCliente)}')">
                <i class="bi bi-cash"></i> Abonar</button>` : ''}
            <button class="btn btn-outline-secondary btn-sm" title="Imprimir esta nota"
                onclick="window.imprimirNota(${d.id})">
                <i class="bi bi-printer"></i></button>
        </td>
    </tr>`;

    // Resto de productos de la misma nota
    for (let i = 1; i < items.length; i++) {
        html += `<tr${claseTr}>${celdaProducto(items[i])}</tr>`;
    }

    // Nota de quién llevó (post-it), ocupa las 4 columnas de producto
    if (d.notes) {
        html += `
        <tr${claseTr}>
            <td colspan="4" style="background:#fff8e1;color:#7a5c00" class="small">
                <i class="bi bi-pencil me-1"></i>${d.notes}
            </td>
        </tr>`;
    }
    return html;
}

// Fila de ABONO estilo factura
function filaAbono(m, saldo) {
    return `
    <tr style="background:#e8f5e9">
        <td class="text-center"><small>${m.fecha ? fmtFecha(m.fecha) : '---'}</small></td>
        <td class="text-center"><span class="badge bg-light text-dark border font-monospace">${m.folio || ''}</span></td>
        <td colspan="4">
            <i class="bi bi-cash-coin text-success me-1"></i>
            <strong class="text-success">Abono</strong>
            ${m.pago.notes ? `<span class="text-muted small ms-2 fst-italic">${m.pago.notes}</span>` : ''}
        </td>
        <td class="text-center text-muted">—</td>
        <td class="text-end fw-bold text-success">$${fmt(m.pago.amount)}</td>
        <td class="text-end fw-bold ${saldo > 0 ? 'text-danger' : 'text-success'}">$${fmt(saldo)}</td>
        <td></td>
    </tr>`;
}

// ─── SALDAR TODO (igual que antes, refresca la hoja) ─────────────────────────

window.saldarTodo = async (clienteId, clienteNombre, totalPendiente) => {
    const result = await Swal.fire({
        title: '¿Saldar toda la deuda?',
        html: `<p class="mb-1">Cliente: <strong>${clienteNombre}</strong></p>
               <p class="mb-3">Total: <strong class="text-danger fs-5">$${fmt(totalPendiente)}</strong></p>
               <div class="input-group mb-2">
                   <span class="input-group-text">$</span>
                   <input type="number" id="monto-saldar" class="form-control form-control-lg text-center"
                       step="0.01" placeholder="Monto recibido" autofocus>
               </div>
               <div class="form-check">
                   <input type="checkbox" class="form-check-input" id="check-exacto">
                   <label class="form-check-label" for="check-exacto">
                       Pago exacto ($${fmt(totalPendiente)})
                   </label>
               </div>
               <div id="cambio-saldar" class="mt-2 fw-bold" style="display:none"></div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-all"></i> Liquidar todo',
        cancelButtonText: 'Cancelar', confirmButtonColor: '#198754',
        didOpen: () => {
            document.getElementById('check-exacto').addEventListener('change', e => {
                const input = document.getElementById('monto-saldar');
                input.value = e.target.checked ? Number(totalPendiente).toFixed(2) : '';
                input.disabled = e.target.checked;
                document.getElementById('cambio-saldar').style.display = 'none';
            });
            document.getElementById('monto-saldar').addEventListener('input', e => {
                const rec = parseFloat(e.target.value) || 0;
                const cambio = rec - totalPendiente;
                const div = document.getElementById('cambio-saldar');
                if (rec >= totalPendiente) { div.style.display = 'block';
                    div.className = 'mt-2 fw-bold text-success';
                    div.innerHTML = `Cambio: $${cambio.toFixed(2)}`; }
                else if (rec > 0) { div.style.display = 'block';
                    div.className = 'mt-2 fw-bold text-danger';
                    div.innerHTML = `Faltan: $${Math.abs(cambio).toFixed(2)}`; }
                else { div.style.display = 'none'; }
            });
        },
        preConfirm: () => {
            const monto = parseFloat(document.getElementById('monto-saldar').value);
            if (!monto || monto < totalPendiente) {
                Swal.showValidationMessage(`Mínimo $${fmt(totalPendiente)}`); return false;
            }
            return monto;
        }
    });
    if (!result.isConfirmed) return;
    try {
        const deudas     = await fetchAPI(`/debts/customer/${clienteId}`);
        const pendientes = deudas.filter(d => d.status !== 'PAID');
        // Secuencial para no saturar el backend con pagos simultáneos
        for (const d of pendientes) {
            await fetchAPI(`/debts/${d.id}/pay`, { method: 'POST',
                body: { amount: Number(d.remainingAmount), notes: 'Saldo completo' } });
        }
        const cambio = result.value - totalPendiente;
        await Swal.fire({ icon: 'success', title: '¡Deuda saldada!',
            html: `${pendientes.length} nota(s) liquidadas<br>
                   Cobrado: <strong class="text-success">$${result.value.toFixed(2)}</strong>
                   ${cambio > 0 ? `<br>Cambio: <strong class="text-primary">$${cambio.toFixed(2)}</strong>` : ''}`,
            timer: 3000, showConfirmButton: false });
        refrescarVista();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// ─── REGISTRAR ABONO (igual que antes, refresca la hoja) ─────────────────────

window.abrirPago = async (debtId, remaining, clienteNombre) => {
    const result = await Swal.fire({
        title: 'Registrar Abono',
        html: `<p class="mb-1">Cliente: <strong>${clienteNombre}</strong></p>
               <p class="mb-3">Saldo de la nota: <strong class="text-danger">$${fmt(remaining)}</strong></p>
               <div class="input-group mb-3">
                   <span class="input-group-text">$</span>
                   <input type="number" id="monto-pago" class="form-control" step="0.01"
                       min="0.01" max="${remaining}" placeholder="Monto a abonar" autofocus>
               </div>
               <div class="form-check mb-2 text-start">
                   <input type="checkbox" class="form-check-input" id="pago-total-check">
                   <label class="form-check-label" for="pago-total-check">
                       Liquidar la nota ($${fmt(remaining)})</label>
               </div>
               <textarea id="nota-pago" class="form-control mt-2" rows="2"
                   placeholder="Nota opcional (ej. Pagó Taller Juan)"></textarea>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg"></i> Confirmar abono',
        cancelButtonText: 'Cancelar', confirmButtonColor: '#198754',
        didOpen: () => {
            document.getElementById('pago-total-check').addEventListener('change', e => {
                const input = document.getElementById('monto-pago');
                input.value = e.target.checked ? Number(remaining).toFixed(2) : '';
                input.disabled = e.target.checked;
            });
        },
        preConfirm: () => {
            const monto = parseFloat(document.getElementById('monto-pago').value);
            if (!monto || monto <= 0) { Swal.showValidationMessage('Monto válido > 0'); return false; }
            if (monto > remaining) { Swal.showValidationMessage(`Máximo $${fmt(remaining)}`); return false; }
            return { amount: monto, notes: document.getElementById('nota-pago').value };
        }
    });
    if (!result.isConfirmed) return;
    try {
        const deuda = await fetchAPI(`/debts/${debtId}/pay`, { method: 'POST', body: result.value });
        await Swal.fire({ icon: deuda.status === 'PAID' ? 'success' : 'info',
            title: deuda.status === 'PAID' ? '¡Nota Liquidada!' : '¡Abono Registrado!',
            html: `Abonado: <strong class="text-success">$${result.value.amount.toFixed(2)}</strong><br>
                   Resta: <strong class="${deuda.status === 'PAID' ? 'text-success' : 'text-danger'}">
                       $${fmt(deuda.remainingAmount)}</strong>`,
            timer: 2500, showConfirmButton: false });
        refrescarVista();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// ─── ABONAR A LA CUENTA ───────────────────────────────────────────────────────
// El cliente entrega dinero a su cuenta (no a una nota específica).
// El abono se reparte automáticamente entre sus notas pendientes,
// empezando por la más antigua — igual que en la libreta física.

window.abonarCuenta = async (clienteId, clienteNombre, totalPendiente) => {
    const result = await Swal.fire({
        title: 'Abonar a la cuenta',
        html: `<p class="mb-1">Cliente: <strong>${clienteNombre}</strong></p>
               <p class="mb-3">Saldo total: <strong class="text-danger fs-5">$${fmt(totalPendiente)}</strong></p>
               <div class="input-group mb-2">
                   <span class="input-group-text">$</span>
                   <input type="number" id="monto-cuenta" class="form-control form-control-lg text-center"
                       step="0.01" min="0.01" max="${totalPendiente}"
                       placeholder="¿Cuánto entrega?" autofocus>
               </div>
               <div class="text-muted small mb-2">El abono se aplica a las notas más antiguas primero.</div>
               <div id="reparto-preview" class="text-start small"></div>
               <textarea id="nota-cuenta" class="form-control mt-2" rows="2"
                   placeholder="Nota opcional (ej. Abonó Taller Juan)"></textarea>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-cash-coin"></i> Registrar abono',
        cancelButtonText: 'Cancelar', confirmButtonColor: '#198754',
        preConfirm: () => {
            const monto = parseFloat(document.getElementById('monto-cuenta').value);
            if (!monto || monto <= 0) { Swal.showValidationMessage('Escribe un monto válido'); return false; }
            if (monto > totalPendiente + 0.001) {
                Swal.showValidationMessage(`El saldo total es $${fmt(totalPendiente)}. Si entrega más, usa "Saldar todo" (ahí se calcula el cambio).`);
                return false;
            }
            return { amount: monto, notes: document.getElementById('nota-cuenta').value };
        }
    });
    if (!result.isConfirmed) return;

    Swal.fire({ title: 'Registrando abono...', html: '<div class="spinner-border text-success"></div>',
        allowOutsideClick: false, showConfirmButton: false });

    try {
        // Notas pendientes, de la más antigua a la más nueva
        const deudas = await fetchAPI(`/debts/customer/${clienteId}`);
        const pendientes = deudas
            .filter(d => d.status !== 'PAID')
            .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

        // Repartir el monto entre las notas
        let restante = result.value.amount;
        const aplicados = [];
        for (const d of pendientes) {
            if (restante <= 0.001) break;
            const aplicar = Math.min(restante, Number(d.remainingAmount));
            await fetchAPI(`/debts/${d.id}/pay`, { method: 'POST',
                body: {
                    amount: Number(aplicar.toFixed(2)),
                    notes: result.value.notes || 'Abono a cuenta'
                } });
            aplicados.push({ folio: d.invoiceNumber || '---', monto: aplicar,
                liquidada: aplicar >= Number(d.remainingAmount) - 0.001 });
            restante -= aplicar;
        }

        const detalle = aplicados.map(a =>
            `<div class="d-flex justify-content-between border-bottom py-1">
                <span><span class="font-monospace">${a.folio}</span>
                ${a.liquidada ? '<span class="badge bg-success ms-1">Liquidada</span>' : ''}</span>
                <strong class="text-success">$${fmt(a.monto)}</strong>
            </div>`).join('');

        await Swal.fire({ icon: 'success', title: '¡Abono registrado!',
            html: `<div class="text-start">
                <p class="mb-2">Se abonaron <strong class="text-success">$${fmt(result.value.amount)}</strong>
                repartidos así:</p>${detalle}
                <p class="mt-2 mb-0">Nuevo saldo:
                <strong class="text-danger">$${fmt(totalPendiente - result.value.amount)}</strong></p></div>`,
            timer: 2600, timerProgressBar: true, showConfirmButton: false });
        refrescarVista();
    } catch (e) {
        Swal.fire('Error', e.message + '<br><small>Refresca la hoja para ver qué abonos sí se aplicaron.</small>', 'error');
        refrescarVista();
    }
};

function refrescarVista() {
    if (pestanaLibreta === 'clasica') {
        if (clienteAbierto) window.abrirHojaCliente(clienteAbierto);
        else cargarLibreta();
    } else {
        if (clienteAbierto) abrirLibretaNotebook(clienteAbierto);
        else cargarIndiceNotebook();
    }
    // El saldo pudo cambiar → actualizar el badge del sidebar
    if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
}
// ═════════════════════════════════════════════════════════════════════════════
//  LIBRETA NUEVA — vista principal, estilo "libreta de apuntes de mostrador"
//  Renglones apilados (no tabla de bordes), más nuevo arriba, sin tener que
//  entrar a cada venta: los productos ya vienen desglosados de una vez.
// ═════════════════════════════════════════════════════════════════════════════

function inyectarEstiloNotebook() {
    if (document.getElementById('estilo-libreta-notebook')) return;
    const s = document.createElement('style');
    s.id = 'estilo-libreta-notebook';
    s.textContent = `
        .nb-papel{background:repeating-linear-gradient(#fff,#fff 51px,#EDF1F5 52px);
            border:1px solid var(--linea,#DCE0E5);border-radius:12px;padding:.25rem 0;
            box-shadow:0 2px 10px rgba(20,30,40,.05)}
        .nb-entrada{display:flex;align-items:flex-start;gap:.9rem;
            padding:.65rem 1.1rem;border-bottom:1px dashed #E3E8ED;min-height:52px}
        .nb-entrada:last-child{border-bottom:none}
        .nb-fecha{flex:0 0 74px;color:#8A93A0;font-size:.72rem;line-height:1.25;
            padding-top:.15rem;text-align:right}
        .nb-cuerpo{flex:1;min-width:0}
        .nb-titulo{font-weight:700;font-size:1rem;color:var(--tinta,#22252A);
            line-height:1.3}
        .nb-detalle{color:#8A93A0;font-size:.78rem;margin-top:.1rem}
        .nb-monto{flex:0 0 auto;font-weight:800;font-size:1.05rem;
            white-space:nowrap;padding-top:.15rem}
        .nb-entrada.cargo .nb-monto{color:#C0392B}
        .nb-entrada.abono .nb-monto{color:#1E8449}
        .nb-entrada.abono{background:#F4FBF6}
        .nb-tag{display:inline-block;font-size:.65rem;font-weight:700;
            padding:.05rem .4rem;border-radius:4px;margin-left:.4rem;
            vertical-align:middle}
        .nb-tag.pend{background:#FDECEA;color:#C0392B}
        .nb-tag.part{background:#FEF6E7;color:#B7791F}
        .nb-tag.paid{background:#E9F7EF;color:#1E8449}
        #tabs-libreta .nav-link{color:var(--carbon,#1B1D21);background:#EDEFF2;
            border-radius:8px;font-weight:700;font-size:.85rem}
        #tabs-libreta .nav-link.active{background:var(--carbon,#1B1D21);color:#fff}
        .nb-cliente-card{cursor:pointer;transition:transform .12s,box-shadow .12s}
        .nb-cliente-card:hover{transform:translateY(-2px);
            box-shadow:0 8px 20px rgba(20,30,40,.12)}
    `;
    document.head.appendChild(s);
}

// ─── ÍNDICE (compartido visualmente con el de la vista clásica) ─────────────
async function cargarIndiceNotebook() {
    clienteAbierto = null;
    const container = document.getElementById('deudas-container');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

    try {
        const [deudas, clientes] = await Promise.all([
            fetchAPI('/debts'),
            fetchAPI('/customers?active=true')
        ]);
        clientesMap = {};
        clientes.forEach(c => clientesMap[c.id] = c);

        const porCliente = {};
        deudas.forEach(d => {
            if (d.status === 'PAID') return;
            if (!porCliente[d.customerId]) {
                porCliente[d.customerId] = {
                    id: d.customerId, nombre: d.customerName,
                    telefono: d.customerPhone, notas: 0, total: 0, masAntigua: null
                };
            }
            const g = porCliente[d.customerId];
            g.notas++;
            g.total += parseFloat(d.remainingAmount);
            const f = d.createdAt ? new Date(d.createdAt) : null;
            if (f && (!g.masAntigua || f < g.masAntigua)) g.masAntigua = f;
        });

        // Los clientes SIN deuda también entran a la lista, para poder
        // contestar "oye, ¿te debo algo?" de cualquiera y no solo de los que
        // ya deben. No se muestran de entrada (llenarían la pantalla de gente
        // que no debe nada): aparecen al escribir en el buscador.
        clientes.forEach(c => {
            if (!porCliente[c.id]) {
                porCliente[c.id] = {
                    id: c.id, nombre: c.fullName, telefono: c.phoneNumber,
                    notas: 0, total: 0, masAntigua: null, sinDeuda: true
                };
            }
        });

        const lista = Object.values(porCliente).sort((a, b) => {
            // Primero los que deben, ordenados por antigüedad; los que no
            // deben van al final en orden alfabético.
            if (a.sinDeuda !== b.sinDeuda) return a.sinDeuda ? 1 : -1;
            if (a.sinDeuda) return (a.nombre || '').localeCompare(b.nombre || '');
            const fa = a.masAntigua ? a.masAntigua.getTime() : Infinity;
            const fb = b.masAntigua ? b.masAntigua.getTime() : Infinity;
            return fa - fb || b.total - a.total;
        });

        if (!lista.length) {
            container.innerHTML = `<div class="text-center py-5 text-muted">
                <i class="bi bi-journal-check fs-1 d-block mb-3 text-success"></i>
                <p class="mb-1 fw-bold">La libreta está limpia</p>
                <p class="small">No hay clientes con deudas pendientes.</p></div>`;
            return;
        }

        const totalPorCobrar = lista.reduce((s, g) => s + g.total, 0);

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                    <div class="text-muted small">Total por cobrar</div>
                    <div class="fw-bold fs-3 text-danger">$${fmt(totalPorCobrar)}</div>
                </div>
                <div style="min-width:260px;flex:1;max-width:360px">
                    <input type="text" id="filtro-nb" class="form-control"
                        placeholder="Buscar cliente...">
                </div>
            </div>
            <div class="row g-3" id="indice-nb">
                ${lista.map(g => tarjetaClienteNotebook(g)).join('')}
            </div>
            <p class="text-muted small mt-3 mb-0" id="pista-buscador">
                <i class="bi bi-search me-1"></i>
                Se muestran los ${lista.filter(g => !g.sinDeuda).length} cliente(s)
                con adeudo. Escribe arriba para buscar entre
                <strong>todos</strong> tus clientes, incluidos los que no deben nada.
            </p>`;

        setTimeout(() => document.getElementById('filtro-nb')?.focus(), 50);
        // Sin texto: solo los que deben (la pantalla de trabajo del día).
        // Con texto: busca entre TODOS, deban o no.
       const normalizar = texto => String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const aplicarFiltroNb = (q) => {
    q = normalizar(q);
            let visibles = 0;
            document.querySelectorAll('#indice-nb .nb-cliente-card-wrap').forEach(el => {
                const coincide = el.dataset.nombre.includes(q);
                const debe     = el.dataset.debe === '1';
                const mostrar  = q ? coincide : debe;
                el.style.display = mostrar ? '' : 'none';
                if (mostrar) visibles++;
            });
            const pista = document.getElementById('pista-buscador');
            if (pista && q) {
                pista.innerHTML = '<i class="bi bi-search me-1"></i>' +
                    visibles + ' cliente(s) coinciden con "' + escAttr(q) + '".';
            }
            const vacio = document.getElementById('nb-sin-resultados');
            if (vacio) vacio.style.display = (q && visibles === 0) ? '' : 'none';
        };
        const inputNb = document.getElementById('filtro-nb');
        inputNb.value = filtroClientes;          // recuperar lo que se traía
        inputNb.addEventListener('input', e => {
            filtroClientes = e.target.value;     // recordarlo para el próximo repintado
            aplicarFiltroNb(filtroClientes);
        });
        aplicarFiltroNb(filtroClientes);
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

function tarjetaClienteNotebook(g) {
    const inicial = (g.nombre || '?').trim().charAt(0).toUpperCase();
    const dias = diasDesde(g.masAntigua);
    // Verde para quien no debe nada: se distingue de un vistazo al buscarlo
    const borde = g.sinDeuda ? '#157F3D'
                : dias > 30 ? '#C0392B'
                : dias > 15 ? '#B7791F' : 'var(--linea,#DCE0E5)';
    return `
    <div class="col-sm-6 col-lg-4 col-xxl-3 nb-cliente-card-wrap"
         data-debe="${g.sinDeuda ? '0' : '1'}"
         style="${g.sinDeuda ? 'display:none' : ''}"
         data-nombre="${((g.nombre||'')+' '+(g.telefono||'')).toLowerCase()}">
        <div class="card h-100 shadow-sm nb-cliente-card"
             style="border-left:4px solid ${borde}"
             onclick="window.abrirLibretaNotebook(${g.id})">
            <div class="card-body p-3">
                <div class="d-flex align-items-center gap-2 mb-2">
                    <div class="rounded-circle text-white fw-bold d-flex align-items-center
                                justify-content-center flex-shrink-0"
                         style="width:42px;height:42px;font-size:1.1rem;background:var(--carbon,#1B1D21)">
                        ${inicial}</div>
                    <div style="min-width:0">
                        <div class="fw-bold text-truncate" title="${g.nombre}">${g.nombre}</div>
                        <div class="text-muted" style="font-size:.72rem">
                            ${g.telefono ? `<i class="bi bi-telephone me-1"></i>${g.telefono}`
                                : '<span class="opacity-50">Sin teléfono</span>'}</div>
                    </div>
                </div>
                ${g.sinDeuda ? `
                <div class="d-flex justify-content-between align-items-end">
                    <div>
                        <div class="text-muted" style="font-size:.7rem">DEBE</div>
                        <div class="fw-bold fs-4 lh-1" style="color:#157F3D">$0.00</div>
                    </div>
                    <div class="text-end">
                        <span class="badge" style="background:#157F3D;font-size:.65rem">
                            <i class="bi bi-check-circle me-1"></i>Sin adeudo</span>
                        <div class="mt-1"><small class="text-muted"
                            style="font-size:.65rem">Ver su historial</small></div>
                    </div>
                </div>` : `
                <div class="d-flex justify-content-between align-items-end">
                    <div>
                        <div class="text-muted" style="font-size:.7rem">DEBE</div>
                        <div class="fw-bold text-danger fs-4 lh-1">$${fmt(g.total)}</div>
                    </div>
                    <div class="text-end">
                        ${chipAntiguedad(dias)}
                        <div class="mt-1"><span class="badge bg-light text-dark border"
                            style="font-size:.65rem">${g.notas} nota(s)</span></div>
                    </div>
                </div>`}
            </div>
        </div>
    </div>`;
}

// ─── DETALLE: la libreta de apuntes de UN cliente ────────────────────────────
window.abrirLibretaNotebook = async (clienteId) => {
    // Al cambiar de cliente siempre se abre en Pendientes, que es lo que se
    // consulta el 95% de las veces.
    if (clienteAbierto !== clienteId) pestanaHoja = 'pendientes';
    clienteAbierto = clienteId;
    const container = document.getElementById('deudas-container');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div>
        <p class="text-muted small mt-2">Abriendo la libreta...</p></div>`;

    try {
        const [entradas, deudas] = await Promise.all([
            fetchAPI(`/debts/customer/${clienteId}/libreta`),
            fetchAPI(`/debts/customer/${clienteId}`)
        ]);

        if (!Object.keys(clientesMap).length) {
            const clientes = await fetchAPI('/customers?active=true');
            clientes.forEach(c => clientesMap[c.id] = c);
        }
        const cliente = clientesMap[clienteId] || {};
        const nombre   = deudas[0]?.customerName  || cliente.fullName    || '';
        const telefono = deudas[0]?.customerPhone || cliente.phoneNumber || '';

        const totalPendiente = deudas.reduce((s, d) =>
            d.status !== 'PAID' ? s + Number(d.remainingAmount) : s, 0);
        const pendientes = deudas.filter(d => d.status !== 'PAID');
        const numLiquidadas = deudas.filter(d => d.status === 'PAID').length;

        // DOS PESTAÑAS: Pendientes y Pagadas.
        //
        // Antes era un botón de "Ver liquidadas" que mezclaba todo en una
        // sola lista. Con dos pestañas se contesta directo la pregunta del
        // mostrador: "¿te debo algo?" (Pendientes) y "¿qué te he pagado?"
        // (Pagadas), sin que una tape a la otra.
        const visibles = pestanaHoja === 'pagadas'
            ? entradas.filter(e => e.debtStatus === 'PAID')
            : entradas.filter(e => e.debtStatus !== 'PAID');

        const numPendientes = entradas.filter(e => e.debtStatus !== 'PAID').length;

        const filasHtml = visibles.length ? visibles.map(e => {
            const fecha = e.fecha ? fmtFecha(e.fecha) : '';
            const esCargo = e.tipo === 'CARGO';
            const tag = e.debtStatus === 'PAID' ? '<span class="nb-tag paid">Liquidada</span>'
                      : e.debtStatus === 'PARTIAL' ? '<span class="nb-tag part">Abonando</span>'
                      : esCargo ? '<span class="nb-tag pend">Pendiente</span>' : '';
            return `
            <div class="nb-entrada ${esCargo ? 'cargo' : 'abono'}">
                <div class="nb-fecha">${fecha}</div>
                <div class="nb-cuerpo">
                    <div class="nb-titulo">
                        ${esCargo ? '' : '<i class="bi bi-cash-coin me-1"></i>'}${e.descripcion}${tag}
                    </div>
                    <div class="nb-detalle">
                        ${e.detalle ? e.detalle + ' · ' : ''}${e.folioTicket ? 'Folio ' + e.folioTicket : 'Sin folio'}
                    </div>
                </div>
                <div class="nb-monto">${esCargo ? '−' : '+'}$${fmt(e.monto)}</div>
            </div>`;
        }).join('') : `<div class="text-center text-muted py-5">
            Sin movimientos pendientes.
            ${numLiquidadas ? 'Usa "Ver liquidadas" para el historial.' : ''}</div>`;

        const tel = (telefono || '').replace(/\\D/g, '');
        const btnWhats = tel.length >= 10 ? `
            <a class="btn btn-outline-success" target="_blank"
               href="https://wa.me/52${tel.slice(-10)}?text=${encodeURIComponent(
                   `Hola ${nombre}, le recordamos que tiene un saldo pendiente de $${fmt(totalPendiente)} en la ferretería. ¡Gracias!`)}">
               <i class="bi bi-whatsapp me-1"></i>Recordar</a>` : '';

        const facturable = datosFiscalesFaltantes(clientesMap[clienteId]).length === 0;
        // Se puede facturar CUALQUIER nota que venga de una venta, esté
        // pagada o no. Antes solo las pendientes, y eso dejaba fuera el caso
        // más común del mostrador: el cliente liquida su cuenta y HASTA
        // ENTONCES pide su factura.
        //
        // Fiscalmente además es el caso más limpio: una nota ya pagada se
        // timbra como PUE (pago en una sola exhibición), que es justo lo que
        // manda el sistema.
        const notasTimbrables = deudas.filter(d => d.saleId);
        const marcadasInicio  = pendientes.filter(d => d.saleId).length;
        const btnFacturar = (facturable && notasTimbrables.length) ? `
            <button class="btn btn-outline-primary" id="btn-facturar-notas"
                ${marcadasInicio === 0 ? 'disabled' : ''}
                onclick="window.facturarNotasCliente(${clienteId}, '${escAttr(nombre)}')">
                <i class="bi bi-receipt me-1"></i>Facturar
                (<span id="cnt-facturar">${marcadasInicio}</span>)</button>` : '';

        container.innerHTML = `
            <button class="btn btn-link text-decoration-none ps-0 mb-2" onclick="cargarIndiceNotebook()">
                <i class="bi bi-arrow-left me-1"></i>Volver a la libreta</button>

            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div>
                        <h4 class="fw-bold mb-1"><i class="bi bi-journal-text me-2 text-primary"></i>${nombre}
                            ${badgeFacturable(clienteId, false)}</h4>
                        <div class="text-muted small">
                            ${telefono ? `<i class="bi bi-telephone me-1"></i>${telefono} · ` : ''}
                            ${pendientes.length} nota(s) pendiente(s)</div>
                    </div>
                    <div class="text-end">
                        <div class="text-muted small">Saldo actual</div>
                        <div class="fw-bold fs-2 ${totalPendiente > 0 ? 'text-danger' : 'text-success'}">
                            $${fmt(totalPendiente)}</div>
                    </div>
                </div>
                <div class="card-footer bg-white d-flex flex-wrap gap-2 justify-content-end">
                    ${totalPendiente > 0 ? `<button class="btn btn-success"
                        onclick="window.abonarCuenta(${clienteId}, '${escAttr(nombre)}', ${totalPendiente.toFixed(2)})">
                        <i class="bi bi-cash-coin me-1"></i>Abonar</button>` : ''}
                    ${totalPendiente > 0 ? `<button class="btn btn-outline-danger"
                        onclick="window.saldarTodo(${clienteId}, '${escAttr(nombre)}', ${totalPendiente.toFixed(2)})">
                        <i class="bi bi-check-all me-1"></i>Saldar todo</button>` : ''}
                    ${btnWhats}
                    ${btnFacturar}
                    <button class="btn btn-outline-dark" onclick="window.imprimirHoja()">
                        <i class="bi bi-printer me-1"></i>Imprimir</button>
                </div>
            </div>

            <ul class="nav nav-pills mb-2" style="gap:6px">
                <li class="nav-item">
                    <button type="button"
                        class="nav-link ${pestanaHoja === 'pendientes' ? 'active' : ''}"
                        onclick="window.cambiarPestanaHoja('pendientes')">
                        <i class="bi bi-hourglass-split me-1"></i>Pendientes
                        <span class="badge bg-danger ms-1">${numPendientes}</span>
                    </button>
                </li>
                <li class="nav-item">
                    <button type="button"
                        class="nav-link ${pestanaHoja === 'pagadas' ? 'active' : ''}"
                        onclick="window.cambiarPestanaHoja('pagadas')">
                        <i class="bi bi-check2-all me-1"></i>Pagadas
                        <span class="badge bg-success ms-1">${numLiquidadas}</span>
                    </button>
                </li>
            </ul>

            <div class="d-flex justify-content-between align-items-center mb-2">
                <small class="text-muted"><i class="bi bi-clock-history me-1"></i>
                    Más nuevo arriba</small>
                ${pestanaHoja === 'pagadas' ? `<small class="text-success">
                    <i class="bi bi-info-circle me-1"></i>
                    Estas ya se liquidaron. Se pueden facturar: marca su casilla.
                    </small>` : ''}
            </div>
            <div class="nb-papel">${filasHtml}</div>`;

        // Reutiliza hojaActual (para imprimir/facturar) con los mismos datos
        // que usaba la vista clásica, para no duplicar esa lógica.
        const saleIds = deudas.filter(d => d.saleId).map(d => d.saleId);
        let ventasMap = {};
        if (saleIds.length) {
            const ventas = await fetchAPI(`/sales/by-ids?ids=${saleIds.join(',')}`);
            ventas.forEach(v => ventasMap[v.id] = v);
        }
        const pagosPorDeuda = await Promise.all(
            deudas.map(d => fetchAPI(`/debts/${d.id}/payments`).catch(() => [])));
        hojaActual = { clienteId, nombre, telefono, deudas, ventasMap, pagosPorDeuda };

    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
};

window.toggleHistorialNb = () => {
    // Se conserva por si alguna vista vieja todavía lo llama: ahora solo
    // salta entre las dos pestañas.
    pestanaHoja = pestanaHoja === 'pagadas' ? 'pendientes' : 'pagadas';
    abrirLibretaNotebook(clienteAbierto);
};

window.cambiarPestanaHoja = (cual) => {
    pestanaHoja = cual;
    abrirLibretaNotebook(clienteAbierto);
};