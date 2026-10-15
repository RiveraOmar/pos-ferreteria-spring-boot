import { fetchAPI } from '../services/api.js';
import { APP_CONFIG, getAuthHeader } from '../config.js';


export function initFacturacion(container) {
    if (!document.getElementById('estilo-factura-global')) {
        const s = document.createElement('style');
        s.id = 'estilo-factura-global';
        s.textContent = `
            .vg-fila:hover { background:#F7F9FB; }
            .vg-fila { transition: background .1s; }
        `;
        document.head.appendChild(s);
    }
    container.innerHTML =
        '<div class="d-flex justify-content-between align-items-center mb-4">' +
        '<div>' +
        '<h2 class="fw-bold mb-0"><i class="bi bi-receipt-cutoff me-2"></i>Facturación CFDI</h2>' +
        '<p class="text-muted mb-0 small">Comprobantes fiscales digitales emitidos ante el SAT</p>' +
        '</div>' +
        '<button class="btn btn-outline-primary btn-sm" id="btn-refrescar-cfdi">' +
        '<i class="bi bi-arrow-clockwise me-1"></i>Actualizar</button>' +
        '</div>' +

        // Tarjeta Factura Global
        '<div class="card shadow-sm border-0 mb-4 border-start border-success border-4">' +
        '<div class="card-header bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">' +
        '<div class="d-flex align-items-center gap-2">' +
        '<i class="bi bi-people-fill fs-4 text-success"></i>' +
        '<div>' +
        '<div id="fg-titulo" class="fw-bold">Factura Global — Público en General</div>' +
        '<span id="fg-badge" class="badge bg-light text-muted border small">Cargando configuración...</span>' +
        '</div></div>' +
        '<div class="d-flex align-items-center gap-2 flex-wrap">' +
        '<label class="small text-muted mb-0" for="fg-periodo">Periodo</label>' +
        '<select class="form-select form-select-sm" id="fg-periodo" style="width:230px"></select>' +
        '<button class="btn btn-sm btn-outline-success" id="btn-ver-pendientes">' +
        '<i class="bi bi-arrow-clockwise me-1"></i>Ver ventas</button>' +
        '<button class="btn btn-sm btn-outline-secondary" id="btn-config-periodicidad" ' +
        'title="Cambiar cada cuánto se factura (diaria, semanal, quincenal o mensual)">' +
        '<i class="bi bi-gear-fill"></i></button>' +
        '</div>' +
        '</div>' +
        '<div id="factura-global-hoy" class="card-body py-3">' +
        '<p class="text-muted small mb-0"><i class="bi bi-info-circle me-1"></i>' +
        'Elige el periodo y haz clic en "Ver ventas" para cargar ' +
        'las ventas al público general que faltan por facturar.</p>' +
        '</div></div>' +

        // Tabs
        '<ul class="nav nav-tabs mb-0" id="cfdi-tabs">' +
        '<li class="nav-item"><a class="nav-link active" href="#" data-tab="vigentes">' +
        '<i class="bi bi-check-circle text-success me-1"></i>Vigentes</a></li>' +
        '<li class="nav-item"><a class="nav-link" href="#" data-tab="cancelados">' +
        '<i class="bi bi-x-circle text-danger me-1"></i>Cancelados</a></li>' +
        '</ul>' +

        // Tabla
        '<div class="card shadow-sm border-0 rounded-top-0">' +
        '<div id="cfdi-content">' +
        '<div class="text-center py-5"><div class="spinner-border text-primary"></div>' +
        '<p class="text-muted mt-2 small">Cargando CFDIs...</p></div>' +
        '</div></div>' +

        // Modal ver CFDI
        '<div class="modal fade" id="modal-cfdi" tabindex="-1">' +
        '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<div>' +
        '<h5 class="modal-title fw-bold" id="modal-cfdi-titulo">Comprobante Fiscal Digital</h5>' +
        '<p class="text-muted small mb-0" id="modal-cfdi-subtitulo"></p>' +
        '</div>' +
        '<div class="ms-auto d-flex gap-2 me-3">' +
        '<button class="btn btn-sm btn-outline-info" id="modal-btn-verpdf">' +
        '<i class="bi bi-filetype-pdf me-1"></i>Ver PDF</button>' +
        '<button class="btn btn-sm btn-outline-primary" id="modal-btn-pdf" style="display:none">' +
        '<i class="bi bi-file-pdf me-1"></i>Descargar PDF</button>' +
        '<button class="btn btn-sm btn-outline-secondary" id="modal-btn-xml">' +
        '<i class="bi bi-file-code me-1"></i>Ver XML</button>' +
        '<button class="btn btn-sm btn-outline-secondary" id="modal-btn-uuid">' +
        '<i class="bi bi-clipboard me-1"></i>Copiar UUID</button>' +
        '</div>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
        '</div>' +
        '<div class="modal-body p-0" id="modal-cfdi-body"></div>' +
        '</div></div></div>';

    // ─── Barra de búsqueda del historial (auditoría) ─────────────────────
    // Se inserta arriba de las pestañas: texto libre + rango de fechas.
    document.getElementById('cfdi-tabs').insertAdjacentHTML('beforebegin',
        '<div class="card border-0 shadow-sm mb-2"><div class="card-body py-2">' +
        '<div class="row g-2 align-items-end">' +
            '<div class="col-md-5">' +
                '<label class="form-label small fw-bold mb-1">' +
                '<i class="bi bi-search me-1"></i>Buscar factura</label>' +
                '<input type="text" class="form-control form-control-sm" id="cfdi-buscar" ' +
                'placeholder="Folio (A742), UUID, receptor, RFC o ticket (INV-000015)...">' +
            '</div>' +
            '<div class="col-6 col-md-2">' +
                '<label class="form-label small fw-bold mb-1">Desde</label>' +
                '<input type="date" class="form-control form-control-sm" id="cfdi-desde">' +
            '</div>' +
            '<div class="col-6 col-md-2">' +
                '<label class="form-label small fw-bold mb-1">Hasta</label>' +
                '<input type="date" class="form-control form-control-sm" id="cfdi-hasta">' +
            '</div>' +
            '<div class="col-md-2">' +
                '<label class="form-label small fw-bold mb-1">Tipo</label>' +
                '<select class="form-select form-select-sm" id="cfdi-tipo">' +
                    '<option value="">Todas</option>' +
                    '<option value="global">Globales</option>' +
                    '<option value="nominativa">Nominativas</option>' +
                '</select>' +
            '</div>' +
            '<div class="col-md-1 text-end">' +
                '<button class="btn btn-sm btn-outline-secondary w-100" id="cfdi-limpiar" ' +
                'title="Limpiar filtros"><i class="bi bi-eraser"></i></button>' +
            '</div>' +
        '</div>' +
        '<div class="small text-muted mt-1" id="cfdi-resumen-filtro"></div>' +
        '</div></div>');

    let tFiltro = null;
    ['cfdi-desde', 'cfdi-hasta', 'cfdi-tipo'].forEach(function(id) {
        document.getElementById(id).addEventListener('change', function() { cargarCfdis(tabActual); });
    });
    document.getElementById('cfdi-buscar').addEventListener('input', function() {
        clearTimeout(tFiltro);
        tFiltro = setTimeout(function() { cargarCfdis(tabActual); }, 300);
    });
    document.getElementById('cfdi-limpiar').addEventListener('click', function() {
        ['cfdi-buscar', 'cfdi-desde', 'cfdi-hasta', 'cfdi-tipo'].forEach(function(id) {
            document.getElementById(id).value = '';
        });
        cargarCfdis(tabActual);
    });

    // Eventos tabs
    let tabActual = 'vigentes';
    document.querySelectorAll('#cfdi-tabs .nav-link').forEach(function(tab) {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('#cfdi-tabs .nav-link').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            tabActual = tab.dataset.tab;
            cargarCfdis(tabActual);
        });
    });

    document.getElementById('btn-refrescar-cfdi').addEventListener('click', function() { cargarCfdis(tabActual, true); });

    // Cargar la configuración de periodicidad activa y armar el selector de periodos
    document.getElementById('btn-config-periodicidad').addEventListener('click', abrirConfigPeriodicidad);
    document.getElementById('btn-ver-pendientes').addEventListener('click', function() {
        cargarFacturaGlobal();
    });
    inicializarPeriodicidad();

    cargarCfdis('vigentes');
}

// ══════════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE PERIODICIDAD (Diaria / Semanal / Quincenal / Mensual)
// ══════════════════════════════════════════════════════════════════════════════

// Estado en memoria de la periodicidad activa, para no repetir el fetch
// cada vez que se genera el selector de periodos.
let periodicidadConfig = null; // { periodicidad, periodicidadNombre, periodicidadDescripcion, periodicidadLetra, codigoSat, autoTimbradoHabilitado }

const BADGES_POR_TIPO = {
    DIARIA:    '1 factura al día · se timbra sola cada mañana',
    SEMANAL:   '1 factura a la semana · se timbra sola los lunes',
    QUINCENAL: '2 facturas al mes · se timbra sola el día 1 y el 16',
    MENSUAL:   '1 factura al mes · se timbra sola el día 1'
};

async function inicializarPeriodicidad() {
    try {
        periodicidadConfig = await fetchAPI('/configuracion/facturacion');
    } catch (e) {
        // Si falla (instalación vieja sin el endpoint, o sin permiso), usar quincenal
        // como estaba antes, para no dejar la pantalla rota.
        periodicidadConfig = {
            periodicidad: 'QUINCENAL', periodicidadNombre: 'Quincenal',
            periodicidadLetra: 'Q', codigoSat: '03', autoTimbradoHabilitado: true
        };
        console.warn('[FACTURACION] No se pudo leer la configuración de periodicidad:', e.message);
    }
    aplicarPeriodicidadEnUI();
}

function aplicarPeriodicidadEnUI() {
    const tipo = periodicidadConfig.periodicidad;
    const nombre = periodicidadConfig.periodicidadNombre || 'Quincenal';

    const titulo = document.getElementById('fg-titulo');
    const badge  = document.getElementById('fg-badge');
    if (titulo) titulo.textContent = 'Factura Global ' + nombre + ' — Público en General';
    if (badge)  badge.textContent  = BADGES_POR_TIPO[tipo] || periodicidadConfig.periodicidadDescripcion || '';

    const selPeriodo = document.getElementById('fg-periodo');
    if (selPeriodo) llenarSelectorPeriodos(selPeriodo, tipo);
}

async function abrirConfigPeriodicidad() {
    const tipoActual = periodicidadConfig ? periodicidadConfig.periodicidad : 'QUINCENAL';

    let opciones;
    try {
        opciones = await fetchAPI('/configuracion/facturacion/opciones');
    } catch (e) {
        opciones = [
            { valor: 'DIARIA',    nombre: 'Diaria',    descripcion: '1 factura cada día' },
            { valor: 'SEMANAL',   nombre: 'Semanal',   descripcion: '1 factura cada semana' },
            { valor: 'QUINCENAL', nombre: 'Quincenal', descripcion: '2 facturas al mes' },
            { valor: 'MENSUAL',   nombre: 'Mensual',   descripcion: '1 factura al mes' }
        ];
    }

    const opcionesHtml = opciones.map(o => `
        <div class="form-check mb-2 text-start border rounded p-2 ${o.valor === tipoActual ? 'border-success bg-light' : ''}">
            <input class="form-check-input" type="radio" name="cfg-periodicidad"
                id="cfg-p-${o.valor}" value="${o.valor}" ${o.valor === tipoActual ? 'checked' : ''}>
            <label class="form-check-label w-100" for="cfg-p-${o.valor}">
                <strong>${o.nombre}</strong><br>
                <span class="text-muted small">${o.descripcion}</span>
            </label>
        </div>`).join('');

    const r = await Swal.fire({
        title: 'Configurar periodicidad de factura global',
        width: 520,
        html: `
            <div class="text-start">
                <p class="small text-muted">Elige cada cuánto quieres facturar las ventas
                al público en general. El cambio aplica de inmediato.</p>
                ${opcionesHtml}
                <div class="alert alert-warning small mt-2 mb-0">
                    <i class="bi bi-exclamation-triangle me-1"></i>
                    Cambiar la periodicidad no borra ventas ni facturas ya emitidas —
                    solo cambia cómo se AGRUPAN las ventas pendientes de aquí en adelante.
                </div>
            </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg me-1"></i>Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#198754',
        preConfirm: () => {
            const sel = document.querySelector('input[name="cfg-periodicidad"]:checked');
            if (!sel) {
                Swal.showValidationMessage('Elige una periodicidad.');
                return false;
            }
            return sel.value;
        }
    });
    if (!r.isConfirmed) return;
    if (r.value === tipoActual) return; // sin cambios

    try {
        const res = await fetchAPI('/configuracion/facturacion', {
            method: 'PUT',
            body: { periodicidad: r.value }
        });
        periodicidadConfig = res;
        aplicarPeriodicidadEnUI();
        await Swal.fire({
            icon: 'success', title: 'Periodicidad actualizada',
            text: res.mensaje || ('Ahora factura ' + (res.periodicidadNombre || '').toLowerCase() + '.'),
            timer: 2500, showConfirmButton: false
        });
        // Refrescar la vista de pendientes con el nuevo periodo por default
        cargarFacturaGlobal();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// ─── CARGA Y RENDER DE LA TABLA ────────────────────────────────────────────

let cfdisCache = null;   // se invalida al refrescar/timbrar/cancelar

async function cargarCfdis(status, forzar) {
    const content = document.getElementById('cfdi-content');
    if (!content) return;
    if (!cfdisCache || forzar) {
        content.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        try {
            cfdisCache = await fetchAPI('/cfdi/todos');
        } catch (e) {
            content.innerHTML = '<div class="alert alert-danger m-3">' + e.message + '</div>';
            return;
        }
    }
    // Los estados posibles son tres, no dos: VIGENTE, CANCELADO y
    // CANCELACION_PENDIENTE (la solicitud se envió al SAT pero todavía no
    // se resuelve — pasa cuando el receptor tiene buzón tributario y tiene
    // 72 horas para aceptar).
    //
    // Antes el filtro solo miraba VIGENTE y CANCELADO, así que una factura
    // en proceso de cancelación DESAPARECÍA de las dos pestañas: no estaba
    // ni aquí ni allá, y parecía que se había borrado.
    //
    // Ahora las pendientes se muestran junto con las canceladas (que es
    // donde uno las va a buscar), con su propia insignia amarilla. Y por si
    // algún día aparece un estado nuevo, el "else" lo manda a Cancelados en
    // vez de tragárselo.
    let lista = status === 'vigentes'
        ? cfdisCache.filter(function(c) { return c.status === 'VIGENTE'; })
        : cfdisCache.filter(function(c) { return c.status !== 'VIGENTE'; });

    lista = aplicarFiltrosCfdi(lista);
    renderTabla(content, lista, status);
}

// ─── FILTROS DEL HISTORIAL (auditoría) ──────────────────────────────────────
// Texto libre: folio, UUID, receptor, RFC — y también FOLIO DE TICKET:
// buscar "INV-000015" encuentra la factura global que lo incluye (para
// eso viaja en NoIdentificacion y en la trazabilidad).
function aplicarFiltrosCfdi(lista) {
    const q     = (document.getElementById('cfdi-buscar')?.value || '').trim().toLowerCase();
    const desde = document.getElementById('cfdi-desde')?.value || '';
    const hasta = document.getElementById('cfdi-hasta')?.value || '';
    const tipo  = document.getElementById('cfdi-tipo')?.value  || '';

    let r = lista;

    if (tipo === 'global')     r = r.filter(function(c) { return c.esGlobal; });
    if (tipo === 'nominativa') r = r.filter(function(c) { return !c.esGlobal; });

    // fechaTimbrado viene ISO: "2026-07-17T10:52:04" → comparar el día
    if (desde) r = r.filter(function(c) { return (c.fechaTimbrado || '').substring(0, 10) >= desde; });
    if (hasta) r = r.filter(function(c) { return (c.fechaTimbrado || '').substring(0, 10) <= hasta; });

    if (q) {
        r = r.filter(function(c) {
            const campos = [
                (c.serie || '') + (c.folio || ''),   // "A742"
                c.folio, c.uuid, c.nombreReceptor, c.rfcReceptor,
                c.invoiceNumber                       // ticket de nominativa
            ].filter(Boolean).join(' ').toLowerCase();
            return campos.includes(q);
        });
    }

    // Resumen para auditoría: cuántas y cuánto suman las filtradas
    const res = document.getElementById('cfdi-resumen-filtro');
    if (res) {
        const hayFiltro = q || desde || hasta || tipo;
        if (hayFiltro) {
            const suma = r.reduce(function(s, c) { return s + Number(c.total || 0); }, 0);
            res.innerHTML = '<i class="bi bi-funnel me-1"></i>' +
                'Filtro activo: <strong>' + r.length + '</strong> factura(s) — suma: <strong>$' +
                suma.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + '</strong>';
        } else {
            res.innerHTML = '';
        }
    }
    return r;
}

function renderTabla(container, cfdis, status) {
    if (!cfdis.length) {
        container.innerHTML =
            '<div class="text-center py-5 text-muted">' +
            '<i class="bi bi-receipt fs-1 d-block mb-3 opacity-25"></i>' +
            '<p>No hay CFDIs ' + (status === 'vigentes' ? 'vigentes' : 'cancelados ni en proceso') + ' aún.</p>' +
            (status === 'vigentes' ? '<p class="small">Timbra ventas desde el módulo <strong>Historial</strong>.</p>' : '') +
            '</div>';
        return;
    }

    const totalMonto = cfdis.reduce(function(s, c) { return s + Number(c.total || 0); }, 0);

    const filas = cfdis.map(function(c) {
        const esCancelado = c.status === 'CANCELADO';
        const fecha = c.fechaTimbrado ? c.fechaTimbrado.substring(0, 10) : '';
        const hora  = c.fechaTimbrado ? c.fechaTimbrado.substring(11, 16) : '';
        const folio = (c.serie || '') + (c.folio || '');
        const uuidCorto = c.uuid ? c.uuid.substring(0, 8) + '...' : '';

        return '<tr class="align-middle' + (esCancelado ? ' text-muted' : '') + '">' +
            // Folio
            '<td class="ps-3">' +
            '<span class="fw-bold font-monospace">' + (folio || '—') + '</span>' +
            (c.esGlobal
                ? '<span class="badge bg-success-subtle text-success border border-success ms-1" style="font-size:.62rem">GLOBAL</span>'
                : '') +
            '</td>' +
            // Fecha
            '<td>' +
            '<div class="small">' + fecha + '</div>' +
            '<div class="text-muted" style="font-size:.7rem">' + hora + '</div>' +
            '</td>' +
            // Receptor
            '<td>' +
            '<div class="small fw-bold">' + (c.nombreReceptor || 'PUBLICO EN GENERAL') + '</div>' +
            '<div class="text-muted font-monospace" style="font-size:.7rem">' + (c.rfcReceptor || '') + '</div>' +
            (c.esGlobal && c.ticketsIncluidos != null
                ? '<div class="text-success" style="font-size:.7rem"><i class="bi bi-receipt me-1"></i>' +
                  c.ticketsIncluidos + ' ticket(s) incluido(s)</div>'
                : '') +
            '</td>' +
            // UUID
            '<td>' +
            '<span class="font-monospace text-muted" style="font-size:.7rem" title="' + (c.uuid || '') + '">' + uuidCorto + '</span>' +
            '</td>' +
            // Total
            '<td class="text-end fw-bold' + (esCancelado ? '' : ' text-success') + '">' +
            '$' + Number(c.total || 0).toFixed(2) +
            '</td>' +
            // Estado
            '<td class="text-center">' +
            '<span class="badge ' + 
            (esCancelado ? 'bg-danger' : 
             c.status === 'CANCELACION_PENDIENTE' ? 'bg-warning text-dark' : 'bg-success') + '">' + 
            (c.status === 'CANCELACION_PENDIENTE' ? '⏳ Pendiente' : c.status) + 
            '</span>' +
            '</td>' +
            // Acciones — botones pequeños como FEL
            '<td class="text-end pe-3">' +
            '<div class="btn-group btn-group-sm">' +
            (c.esGlobal
                ? '<button class="btn btn-outline-success btn-sm" title="Ver tickets incluidos" onclick="window.verTicketsGlobal(' + c.id + ',\'' + folio + '\')">' +
                  '<i class="bi bi-list-ul"></i></button>'
                : '') +
            '<button class="btn btn-outline-secondary btn-sm" title="Ver comprobante" onclick="window.verCfdi(\'' + c.uuid + '\')">' +
            '<i class="bi bi-eye"></i></button>' +
            '<button class="btn btn-outline-info btn-sm" title="Ver PDF" onclick="window.previsualizarPdfCfdi(\'' + c.uuid + '\',\'' + folio + '\')">' +
            '<i class="bi bi-filetype-pdf"></i></button>' +
            '<button class="btn btn-outline-primary btn-sm" title="Descargar PDF" onclick="window.descargarPdfCfdi(\'' + c.uuid + '\',\'' + folio + '\')">' +
            '<i class="bi bi-file-pdf"></i></button>' +
            '<button class="btn btn-outline-secondary btn-sm" title="Copiar UUID" onclick="window.copiarUuid(\'' + (c.uuid || '') + '\')">' +
            '<i class="bi bi-clipboard"></i></button>' +
            (!esCancelado
                ? '<button class="btn btn-outline-danger btn-sm" title="Cancelar CFDI" onclick="window.cancelarCfdiFacturacion(\'' + c.uuid + '\')">' +
                  '<i class="bi bi-x-circle"></i></button>'
                : '') +
            '</div></td></tr>';
    }).join('');

    container.innerHTML =
        '<div class="table-responsive">' +
        '<table class="table table-hover table-sm align-middle mb-0">' +
        '<thead class="table-light" style="font-size:.78rem">' +
        '<tr>' +
        '<th class="ps-3">Folio</th>' +
        '<th>Fecha timbrado</th>' +
        '<th>Receptor</th>' +
        '<th>UUID</th>' +
        '<th class="text-end">Total</th>' +
        '<th class="text-center">Estado</th>' +
        '<th class="text-end pe-3">Acciones</th>' +
        '</tr></thead>' +
        '<tbody style="font-size:.82rem">' + filas + '</tbody>' +
        '</table></div>' +
        '<div class="card-footer bg-light d-flex justify-content-between align-items-center py-2">' +
        '<small class="text-muted">' + cfdis.length + ' comprobante(s) ' +
            (status === 'vigentes'
                ? 'vigente(s)'
                : 'cancelado(s) o en proceso') + '</small>' +
        '<strong class="text-success">Total: $' + totalMonto.toFixed(2) + '</strong>' +
        '</div>';
}

// ─── VER COMPROBANTE EN MODAL (como FEL) ────────────────────────────────────

window.verCfdi = async function(uuid) {
    const modal = new bootstrap.Modal(document.getElementById('modal-cfdi'));
    const body = document.getElementById('modal-cfdi-body');
    const titulo = document.getElementById('modal-cfdi-titulo');
    const subtitulo = document.getElementById('modal-cfdi-subtitulo');

    body.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted small">Cargando comprobante...</p></div>';
    modal.show();

    try {
        const todos = await fetchAPI('/cfdi/todos');
        const cfdi = todos.find(function(c) { return c.uuid === uuid; });
        if (!cfdi) { body.innerHTML = '<div class="alert alert-danger m-3">CFDI no encontrado.</div>'; return; }

        const folio = (cfdi.serie || '') + (cfdi.folio || '');
        titulo.textContent = 'Factura ' + folio;
        subtitulo.textContent = 'UUID: ' + (cfdi.uuid || '') + ' — ' + (cfdi.fechaTimbrado ? cfdi.fechaTimbrado.substring(0,16).replace('T',' ') : '');

        // Guardar uuid para botones del modal
        document.getElementById('modal-btn-uuid').onclick = function() { window.copiarUuid(cfdi.uuid); };
        document.getElementById('modal-btn-xml').onclick = function() { mostrarXml(cfdi); };

        // Ver PDF dentro del propio modal (sin descargar)
        document.getElementById('modal-btn-verpdf').onclick = function() {
            mostrarPdfEnModal(cfdi.uuid, body);
        };

        const btnPdf = document.getElementById('modal-btn-pdf');
        if (cfdi.pdfBase64) {
            btnPdf.style.display = '';
            btnPdf.onclick = function() { window.descargarPdfCfdi(cfdi.uuid, folio); };
        } else {
            btnPdf.style.display = 'none';
        }

        // Renderizar el XML como vista de comprobante
        body.innerHTML = renderComprobanteHtml(cfdi);

    } catch (e) {
        body.innerHTML = '<div class="alert alert-danger m-3">' + e.message + '</div>';
    }
};

function renderComprobanteHtml(cfdi) {
    // Parsear el XML timbrado para extraer datos
    let conceptos = [];
    let emisorNombre = '', emisorRfc = '', emisorRegimen = '';
    let receptorNombre = '', receptorRfc = '', receptorRegimen = '', receptorUsoCfdi = '', receptorCp = '';
    let fechaEmision = '', selloSat = '', noCertSat = '', rfcPac = '', fechaTfd = '';
    let subTotal = '', total = '', moneda = '', formaPago = '', metodoPago = '', tipoComprobante = '', exportacion = '';

    if (cfdi.tieneXml && cfdi.xmlTimbrado) {
        // lo mostramos parseado si podemos, o fallback a tabla con datos que ya tenemos
    }

    const folio = (cfdi.serie || '') + (cfdi.folio || '');
    const fecha = cfdi.saleCreatedAt ? cfdi.saleCreatedAt.substring(0,16).replace('T',' ') : '';
    const fechaTimbrado = cfdi.fechaTimbrado ? cfdi.fechaTimbrado.substring(0,16).replace('T',' ') : '';

    // Items de la venta
    const itemsHtml = (cfdi.items && cfdi.items.length)
        ? cfdi.items.map(function(i) {
            return '<tr>' +
                '<td>' + Number(i.quantity).toFixed(3).replace(/\.?0+$/,'') + '</td>' +
                '<td>H87</td>' +
                '<td>' +
                '<div class="fw-bold">' + (i.productName || '') + '</div>' +
                '<small class="text-muted font-monospace">' + (i.sku || '') + '</small>' +
                '</td>' +
                '<td class="text-end">$' + Number(i.unitPrice).toFixed(2) + '</td>' +
                '<td class="text-end">$' + Number(i.total).toFixed(2) + '</td>' +
                '</tr>';
          }).join('')
        : '<tr><td colspan="5" class="text-muted text-center">Sin detalle de productos</td></tr>';

    const totalMonto = Number(cfdi.total || 0);
    const subtotalMonto = totalMonto / 1.16;
    const ivaMonto = totalMonto - subtotalMonto;

    return '<div class="p-4" style="font-family:Arial,sans-serif;font-size:.85rem">' +

        // Encabezado emisor / folio
        '<div class="row mb-3">' +
        '<div class="col-8">' +
        '<div class="fw-bold fs-6">' + (cfdi.nombreReceptor || 'PÚBLICO EN GENERAL') + '</div>' +
        '<div class="text-muted small">RFC: ' + (cfdi.rfcReceptor || '') + '</div>' +
        '<div class="text-muted small">Régimen Fiscal: 626 - Régimen Simplificado de Confianza</div>' +
        '</div>' +
        '<div class="col-4 text-end">' +
        '<div class="fw-bold text-primary fs-5">Factura ' + folio + '</div>' +
        '<div class="text-muted small"><strong>FOLIO FISCAL (UUID)</strong></div>' +
        '<div class="font-monospace text-break" style="font-size:.65rem">' + (cfdi.uuid || '') + '</div>' +
        '<div class="text-muted small mt-1"><strong>FECHA:</strong> ' + fechaTimbrado + '</div>' +
        '</div></div>' +

        '<hr>' +

        // Receptor
        '<div class="row mb-3">' +
        '<div class="col-12">' +
        '<div class="bg-light rounded p-2">' +
        '<strong class="small text-uppercase text-muted">CLIENTE</strong>' +
        '<div class="fw-bold mt-1">' + (cfdi.nombreReceptor || 'PUBLICO EN GENERAL') + '</div>' +
        '<div class="small text-muted">RFC: ' + (cfdi.rfcReceptor || 'XAXX010101000') + '</div>' +
        (cfdi.paymentMethod ? '<div class="small text-muted">Forma de pago: ' + cfdi.paymentMethod + '</div>' : '') +
        '</div></div></div>' +

        // Tabla de conceptos
        '<div class="mb-3">' +
        '<div class="fw-bold text-center bg-dark text-white py-1 rounded-top small">CONCEPTOS</div>' +
        '<div class="table-responsive">' +
        '<table class="table table-sm table-bordered mb-0" style="font-size:.8rem">' +
        '<thead class="table-secondary">' +
        '<tr><th>Cantidad</th><th>Unidad</th><th>Descripción</th><th class="text-end">P. Unitario</th><th class="text-end">Importe</th></tr>' +
        '</thead><tbody>' + itemsHtml + '</tbody>' +
        '</table></div></div>' +

        // Totales
        '<div class="row">' +
        '<div class="col-8"></div>' +
        '<div class="col-4">' +
        '<table class="table table-sm table-bordered" style="font-size:.85rem">' +
        '<tr><td>Subtotal</td><td class="text-end">$' + subtotalMonto.toFixed(2) + '</td></tr>' +
        '<tr><td>IVA 16%</td><td class="text-end">$' + ivaMonto.toFixed(2) + '</td></tr>' +
        '<tr class="table-success fw-bold"><td>Total</td><td class="text-end">$' + totalMonto.toFixed(2) + '</td></tr>' +
        '</table></div></div>' +

        // Sello SAT info
        '<div class="border rounded p-2 bg-light mt-2" style="font-size:.65rem">' +
        '<div class="text-muted"><strong>RFC Proveedor de Certificación:</strong> STA0903206B9</div>' +
        '<div class="text-muted"><strong>Fecha de timbrado:</strong> ' + fechaTimbrado + '</div>' +
        '<div class="text-muted"><strong>UUID:</strong> <span class="font-monospace">' + (cfdi.uuid || '') + '</span></div>' +
        '</div>' +

        '</div>';
}

async function mostrarXml(cfdi) {
    const body = document.getElementById('modal-cfdi-body');
    body.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted small">Cargando XML...</p></div>';
    try {
        const resp = await fetch(APP_CONFIG.API_BASE + '/cfdi/xml/' + cfdi.uuid, {
            headers: { 'Authorization': getAuthHeader() }
        });
        if (!resp.ok) {
            let msg = 'Error ' + resp.status;
            try { const j = await resp.json(); msg = j.error || msg; } catch (e) {}
            throw new Error(msg);
        }
        const xml = await resp.text();
        const escaped = xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        body.innerHTML =
            '<div class="d-flex justify-content-between align-items-center px-3 pt-3">' +
            '<small class="text-muted"><i class="bi bi-file-code me-1"></i>XML timbrado (el comprobante fiscal real — consérvalo como respaldo)</small>' +
            '<button class="btn btn-sm btn-outline-primary" id="btn-descargar-xml">' +
            '<i class="bi bi-download me-1"></i>Descargar XML</button>' +
            '</div>' +
            '<pre class="m-3 p-3 bg-dark text-success rounded" style="font-size:.7rem;overflow-x:auto;max-height:65vh">' + escaped + '</pre>';

        document.getElementById('btn-descargar-xml').onclick = function() {
            const blob = new Blob([xml], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'CFDI-' + ((cfdi.serie || '') + (cfdi.folio || '') || cfdi.uuid.substring(0, 8)) + '.xml';
            link.click();
            URL.revokeObjectURL(url);
        };
    } catch (e) {
        body.innerHTML = '<div class="alert alert-info m-3">' + e.message + '</div>';
    }
}

// ─── PDF: helpers compartidos ───────────────────────────────────────────────

// Pide el PDF al backend y devuelve una URL temporal en memoria (blob).
// No guarda nada en disco.
async function obtenerPdfUrl(uuid) {
    const resp = await fetch(APP_CONFIG.API_BASE + '/cfdi/pdf/' + uuid, {
        headers: { 'Authorization': getAuthHeader() }
    });
    if (!resp.ok) {
        let msg = 'Error ' + resp.status;
        try { const j = await resp.json(); msg = j.error || msg; } catch(e) {}
        throw new Error(msg);
    }
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
}

// ─── PREVISUALIZAR PDF (sin descargar) ──────────────────────────────────────

window.previsualizarPdfCfdi = async function(uuid, folio) {
    try {
        Swal.fire({
            title: 'Generando vista previa...',
            html: '<div class="spinner-border text-primary"></div>',
            allowOutsideClick: false,
            showConfirmButton: false
        });

        const url = await obtenerPdfUrl(uuid);

        Swal.fire({
            title: 'Factura ' + (folio || uuid.substring(0, 8)),
            html: '<iframe src="' + url + '" ' +
                  'style="width:100%; height:75vh; border:none;"></iframe>',
            width: '85%',
            showConfirmButton: true,
            confirmButtonText: '<i class="bi bi-download me-1"></i>Descargar',
            showCancelButton: true,
            cancelButtonText: 'Cerrar',
            didDestroy: function() {
                // Liberar la memoria del blob al cerrar
                URL.revokeObjectURL(url);
            }
        }).then(function(result) {
            if (result.isConfirmed) {
                window.descargarPdfCfdi(uuid, folio);
            }
        });

    } catch (e) {
        Swal.fire('Error', 'No se pudo generar la vista previa: ' + e.message, 'error');
    }
};

// Vista del PDF dentro del modal de detalle (botón "Ver PDF" del header)
async function mostrarPdfEnModal(uuid, body) {
    body.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted small">Generando PDF...</p></div>';
    try {
        const url = await obtenerPdfUrl(uuid);
        body.innerHTML = '<iframe src="' + url + '" style="width:100%; height:75vh; border:none;"></iframe>';
        // Liberar el blob cuando se cierre el modal
        const modalEl = document.getElementById('modal-cfdi');
        modalEl.addEventListener('hidden.bs.modal', function limpiar() {
            URL.revokeObjectURL(url);
            modalEl.removeEventListener('hidden.bs.modal', limpiar);
        });
    } catch (e) {
        body.innerHTML = '<div class="alert alert-danger m-3">No se pudo generar el PDF: ' + e.message + '</div>';
    }
}

// ─── DESCARGAR PDF ──────────────────────────────────────────────────────────

window.descargarPdfCfdi = async function(uuid, folio) {
    try {
        Swal.fire({
            title: 'Generando PDF...',
            html: '<div class="spinner-border text-primary"></div>',
            allowOutsideClick: false,
            showConfirmButton: false
        });
        const url = await obtenerPdfUrl(uuid);
        const link = document.createElement('a');
        link.href     = url;
        link.download = 'CFDI-' + (folio || uuid.substring(0, 8)) + '.pdf';
        link.click();
        URL.revokeObjectURL(url);
        Swal.close();
    } catch (e) {
        Swal.fire('Error al generar PDF', e.message, 'error');
    }
};

// ─── COPIAR UUID ────────────────────────────────────────────────────────────

window.copiarUuid = function(uuid) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(uuid).then(function() {
            const t = document.createElement('div');
            t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;background:#16a34a;color:white;padding:.5rem 1rem;border-radius:8px;font-size:.85rem';
            t.innerHTML = '<i class="bi bi-check-circle me-1"></i>UUID copiado';
            document.body.appendChild(t);
            setTimeout(function() { t.remove(); }, 2000);
        });
    } else {
        Swal.fire({ title: 'UUID del CFDI', html: '<input class="form-control font-monospace" value="' + uuid + '" readonly onclick="this.select()">', confirmButtonText: 'Cerrar' });
    }
};

window.verUuidCfdi = window.copiarUuid; // alias por compatibilidad

// ─── CANCELAR CFDI ──────────────────────────────────────────────────────────

window.cancelarCfdiFacturacion = async function(uuid) {
    const result = await Swal.fire({
        title: 'Cancelar CFDI',
        html: '<div class="alert alert-warning small text-start">' +
            '<i class="bi bi-exclamation-triangle me-1"></i>' +
            '<strong>Importante:</strong> La cancelación se envía al SAT vía FEL y es <strong>definitiva</strong>. ' +
            'Si el receptor tiene buzón tributario, tiene <strong>72 horas</strong> para aceptar o rechazar. ' +
            'El estado en FEL puede tardar en actualizarse.</div>' +
            '<p class="small text-muted text-start mb-0">Motivo: 02 — Comprobante emitido con errores sin relación.</p>',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-x-circle me-1"></i>Enviar al SAT',
        cancelButtonText: 'Atrás',
        confirmButtonColor: '#dc3545'
    });
    if (!result.isConfirmed) return;

    Swal.fire({ title: 'Enviando al SAT...', html: '<div class="spinner-border text-danger"></div>', allowOutsideClick: false, showConfirmButton: false });

    try {
        await fetchAPI('/cfdi/cancelar/' + uuid, { method: 'PATCH', body: { motivo: '02' } });
        cfdisCache = null;
        await Swal.fire({
            icon: 'success',
            title: 'Cancelación enviada al SAT',
            html: '<div class="text-start">' +
                '<p>La solicitud fue enviada correctamente a través de FEL Premium.</p>' +
                '<div class="alert alert-info small">' +
                '<i class="bi bi-info-circle me-1"></i>' +
                'El estado en el portal de FEL puede tardar unos minutos en actualizarse. ' +
                'Si el receptor tiene buzón tributario activo, tiene 72h para aceptar.' +
                '</div></div>',
            confirmButtonText: 'Aceptar'
        });
        document.querySelector('#cfdi-tabs .nav-link.active') && document.querySelector('#cfdi-tabs .nav-link.active').click();
    } catch (e) {
        // Distinguir entre error real y cancelación en proceso
        const msg = e.message || '';
        if (msg.includes('EN PROCESO') || msg.includes('PENDIENTE')) {
            await Swal.fire({
                icon: 'info',
                title: 'Cancelación en proceso',
                html: '<div class="text-start">' +
                    '<p>' + msg + '</p>' +
                    '<div class="alert alert-warning small">' +
                    '<i class="bi bi-clock me-1"></i>' +
                    'Verifica el estado en el portal de FEL en unos minutos.' +
                    '</div></div>',
                confirmButtonText: 'Entendido'
            });
            document.querySelector('#cfdi-tabs .nav-link.active') && document.querySelector('#cfdi-tabs .nav-link.active').click();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error al cancelar',
                html: '<div class="text-start"><p>' + msg + '</p>' +
                    '<div class="alert alert-secondary small"><i class="bi bi-box-arrow-up-right me-1"></i>' +
                    'Puedes intentar cancelar directamente en <a href="https://fel.blikon.com" target="_blank">fel.blikon.com</a></div></div>',
                confirmButtonText: 'Aceptar'
            });
        }
    }
};

// ─── HISTORIAL DE TICKETS DE UNA FACTURA GLOBAL ─────────────────────────────
// Muestra la cadena de respaldo: Factura Global → tickets → productos.
// Cada renglón de ticket se expande para ver qué productos se vendieron.

window.verTicketsGlobal = async function(cfdiId, folio) {
    const modal = new bootstrap.Modal(document.getElementById('modal-cfdi'));
    const body = document.getElementById('modal-cfdi-body');
    const titulo = document.getElementById('modal-cfdi-titulo');
    const subtitulo = document.getElementById('modal-cfdi-subtitulo');

    // Ocultar botones de PDF/XML que no aplican a esta vista
    document.getElementById('modal-btn-verpdf').style.display = 'none';
    document.getElementById('modal-btn-pdf').style.display = 'none';
    document.getElementById('modal-btn-xml').style.display = 'none';

    titulo.textContent = 'Tickets de la Factura Global ' + (folio || '');
    subtitulo.textContent = 'Cadena de respaldo: Factura Global → tickets → productos';
    body.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success"></div><p class="mt-2 text-muted small">Cargando historial de tickets...</p></div>';
    modal.show();

    // Restaurar botones al cerrar
    const modalEl = document.getElementById('modal-cfdi');
    modalEl.addEventListener('hidden.bs.modal', function restaurar() {
        document.getElementById('modal-btn-verpdf').style.display = '';
        document.getElementById('modal-btn-xml').style.display = '';
        modalEl.removeEventListener('hidden.bs.modal', restaurar);
    });

    try {
        const data = await fetchAPI('/cfdi/global/' + cfdiId + '/tickets');
        document.getElementById('modal-btn-uuid').onclick = function() { window.copiarUuid(data.uuid); };
        body.innerHTML = renderHistorialTickets(data);
    } catch (e) {
        body.innerHTML = '<div class="alert alert-danger m-3">' + e.message + '</div>';
    }
};

function renderHistorialTickets(data) {
    if (!data.tickets || !data.tickets.length) {
        return '<div class="alert alert-info m-3 small">' +
            '<i class="bi bi-info-circle me-1"></i>' +
            (data.nota || 'Esta factura global no tiene tickets ligados.') +
            '</div>';
    }

    const filas = data.tickets.map(function(t, idx) {
        const fecha = t.fecha ? t.fecha.substring(0, 10) : '';
        const hora  = t.fecha ? t.fecha.substring(11, 16) : '';
        const numProductos = (t.items || []).length;

        // Sub-tabla de productos del ticket (colapsable)
        const productosHtml = (t.items || []).map(function(i) {
            return '<tr>' +
                '<td class="text-muted font-monospace" style="font-size:.72rem">' + (i.sku || '') + '</td>' +
                '<td>' + (i.productName || '') + '</td>' +
                '<td class="text-center">' + Number(i.quantity).toFixed(3).replace(/\.?0+$/, '') + '</td>' +
                '<td class="text-end">$' + Number(i.unitPrice).toFixed(2) + '</td>' +
                '<td class="text-end fw-bold">$' + Number(i.total).toFixed(2) + '</td>' +
                '</tr>';
        }).join('');

        return '' +
            // Renglón del ticket
            '<tr class="align-middle" style="cursor:pointer" ' +
            'data-bs-toggle="collapse" data-bs-target="#ticket-det-' + idx + '">' +
            '<td class="ps-3"><i class="bi bi-chevron-down text-muted me-2" style="font-size:.7rem"></i>' +
            '<span class="fw-bold font-monospace">' + (t.folio || t.saleId) + '</span></td>' +
            '<td><div class="small">' + fecha + '</div>' +
            '<div class="text-muted" style="font-size:.7rem">' + hora + '</div></td>' +
            '<td class="small">' + (t.vendedor || '—') + '</td>' +
            '<td class="small">' + (t.metodoPago || '—') + '</td>' +
            '<td class="text-center"><span class="badge bg-light text-dark border">' + numProductos + '</span></td>' +
            '<td class="text-end fw-bold text-success pe-3">$' + Number(t.total).toFixed(2) + '</td>' +
            '</tr>' +
            // Detalle colapsable con los productos
            '<tr><td colspan="6" class="p-0 border-0">' +
            '<div class="collapse" id="ticket-det-' + idx + '">' +
            '<div class="bg-light px-4 py-2">' +
            '<table class="table table-sm mb-1" style="font-size:.78rem">' +
            '<thead><tr class="text-muted">' +
            '<th>SKU</th><th>Producto</th><th class="text-center">Cant.</th>' +
            '<th class="text-end">P. Unit.</th><th class="text-end">Importe</th>' +
            '</tr></thead>' +
            '<tbody>' + productosHtml + '</tbody>' +
            '</table></div></div>' +
            '</td></tr>';
    }).join('');

    const fechaTimbrado = data.fechaTimbrado ? data.fechaTimbrado.substring(0, 16).replace('T', ' ') : '';

    return '<div class="p-3">' +
        // Encabezado con datos del CFDI
        '<div class="d-flex justify-content-between align-items-center bg-success-subtle border border-success rounded p-3 mb-3">' +
        '<div>' +
        '<div class="fw-bold text-success"><i class="bi bi-receipt-cutoff me-1"></i>Factura Global ' + ((data.serie || '') + (data.folio || '')) + '</div>' +
        '<div class="text-muted small font-monospace" style="font-size:.7rem">' + (data.uuid || '') + '</div>' +
        '<div class="text-muted small">Timbrada: ' + fechaTimbrado + ' — Estado: <strong>' + (data.status || '') + '</strong></div>' +
        '</div>' +
        '<div class="text-end">' +
        '<div class="fw-bold fs-4 text-success">$' + Number(data.total || 0).toFixed(2) + '</div>' +
        '<small class="text-muted">' + data.totalTickets + ' ticket(s)</small>' +
        '</div></div>' +
        // Tabla de tickets
        '<p class="text-muted small mb-2"><i class="bi bi-hand-index me-1"></i>Haz clic en un ticket para ver los productos que se vendieron en él.</p>' +
        '<div class="table-responsive border rounded">' +
        '<table class="table table-hover table-sm align-middle mb-0">' +
        '<thead class="table-light" style="font-size:.78rem">' +
        '<tr><th class="ps-3">Ticket</th><th>Fecha</th><th>Vendedor</th>' +
        '<th>Pago</th><th class="text-center">Productos</th><th class="text-end pe-3">Total</th></tr>' +
        '</thead>' +
        '<tbody style="font-size:.82rem">' + filas + '</tbody>' +
        '</table></div>' +
        '</div>';
}

// ─── FACTURA GLOBAL ─────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
//  PERIODOS — genérico para las 4 periodicidades (Diaria/Semanal/Quincenal/Mensual)
//  Formato de periodo (igual que el backend): "LETRA:AAAA-MM-DD"
//    D:2026-08-29  → un día        S:2026-08-24  → una semana (cualquier día de ella)
//    Q:2026-08-16  → una quincena  M:2026-08-01  → un mes
// ══════════════════════════════════════════════════════════════════════════════
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                  'agosto','septiembre','octubre','noviembre','diciembre'];

function fechaISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        + '-' + String(d.getDate()).padStart(2, '0');
}

// Periodo "ahora" según la periodicidad activa
function periodoActual(tipoLetra) {
    const d = new Date();
    switch (tipoLetra) {
        case 'D': return 'D:' + fechaISO(d);
        case 'S': return 'S:' + fechaISO(d); // cualquier día de la semana sirve
        case 'Q': return 'Q:' + fechaISO(d); // cualquier día de la quincena sirve
        case 'M': return 'M:' + fechaISO(new Date(d.getFullYear(), d.getMonth(), 1));
        default:  return 'Q:' + fechaISO(d);
    }
}

// "D:2026-08-29" → "el 29 de agosto de 2026", etc. Autodescriptivo por la letra.
function etiquetaPeriodo(periodo) {
    if (!periodo) return '';
    const match = periodo.match(/^([DSQM]):(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return periodo;
    const [, letra, y, m, dia] = match;
    const mesNombre = MESES_ES[parseInt(m, 10) - 1] || m;
    const fecha = new Date(parseInt(y), parseInt(m, 10) - 1, parseInt(dia, 10));

    switch (letra) {
        case 'D':
            return 'el ' + parseInt(dia, 10) + ' de ' + mesNombre + ' de ' + y;
        case 'S': {
            // Lunes de esa semana
            const diaSemana = fecha.getDay(); // 0=domingo
            const offsetLunes = (diaSemana === 0) ? -6 : (1 - diaSemana);
            const lunes = new Date(fecha); lunes.setDate(fecha.getDate() + offsetLunes);
            const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
            const mesFin = MESES_ES[domingo.getMonth()];
            return 'la semana del ' + lunes.getDate() + ' al ' + domingo.getDate()
                + ' de ' + mesFin + ' de ' + domingo.getFullYear();
        }
        case 'Q': {
            const ord = (parseInt(dia, 10) <= 15) ? '1ª' : '2ª';
            return ord + ' quincena de ' + mesNombre + ' ' + y;
        }
        case 'M':
            return mesNombre + ' ' + y;
        default:
            return periodo;
    }
}

function periodoSeleccionado() {
    const sel = document.getElementById('fg-periodo');
    const tipoLetra = periodicidadConfig ? periodicidadConfig.periodicidadLetra : 'Q';
    return (sel && sel.value) ? sel.value : periodoActual(tipoLetra);
}

// "quincena" / "quincenas", "día" / "días", etc. — según la periodicidad activa
function nombrePeriodo(plural) {
    const tipo = periodicidadConfig ? periodicidadConfig.periodicidad : 'QUINCENAL';
    const nombres = {
        DIARIA:    plural ? 'días'      : 'día',
        SEMANAL:   plural ? 'semanas'   : 'semana',
        QUINCENAL: plural ? 'quincenas' : 'quincena',
        MENSUAL:   plural ? 'meses'     : 'mes'
    };
    return nombres[tipo] || (plural ? 'quincenas' : 'quincena');
}

// Genera las últimas ~12 opciones de periodo según la periodicidad activa
function generarOpcionesPeriodo(tipoLetra) {
    const opciones = [];
    const hoy = new Date();

    if (tipoLetra === 'D') {
        for (let i = 0; i < 30; i++) {
            const d = new Date(hoy); d.setDate(hoy.getDate() - i);
            opciones.push('D:' + fechaISO(d));
        }
    } else if (tipoLetra === 'S') {
        for (let i = 0; i < 12; i++) {
            const d = new Date(hoy); d.setDate(hoy.getDate() - (i * 7));
            opciones.push('S:' + fechaISO(d));
        }
    } else if (tipoLetra === 'M') {
        for (let i = 0; i < 12; i++) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            opciones.push('M:' + fechaISO(d));
        }
    } else { // Q — quincenal (default)
        let d = new Date(hoy);
        for (let i = 0; i < 12; i++) {
            const y = d.getFullYear(), m = d.getMonth();
            opciones.push('Q:' + fechaISO(new Date(y, m, 16))); // 2ª quincena
            opciones.push('Q:' + fechaISO(new Date(y, m, 1)));  // 1ª quincena
            d.setMonth(d.getMonth() - 1);
        }
    }
    return opciones;
}

// Llenar el <select> con las últimas opciones de periodo, según la periodicidad activa
function llenarSelectorPeriodos(select, tipo) {
    const tipoLetra = (periodicidadConfig && periodicidadConfig.periodicidadLetra)
        ? periodicidadConfig.periodicidadLetra
        : { DIARIA: 'D', SEMANAL: 'S', QUINCENAL: 'Q', MENSUAL: 'M' }[tipo] || 'Q';

    const actual = periodoActual(tipoLetra);
    let opciones = generarOpcionesPeriodo(tipoLetra);

    // Quitar duplicados y quedarse solo con periodos <= el actual
    opciones = [...new Set(opciones)].filter(o => o <= actual || o === actual);
    opciones.sort().reverse();

    select.innerHTML = opciones.map(o =>
        '<option value="' + o + '"' + (o === actual ? ' selected' : '')
        + '>' + etiquetaPeriodo(o) + '</option>'
    ).join('');
}

async function cargarFacturaGlobal() {
    const div = document.getElementById('factura-global-hoy');
    if (!div) return;
    const periodo = periodoSeleccionado();
    div.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-success"></div>' +
        '<span class="ms-2 text-muted small">Cargando ventas de la ' + etiquetaPeriodo(periodo) + '...</span></div>';
    try {
        const data = await fetchAPI('/sales/publico-general/periodo?periodo=' + encodeURIComponent(periodo));
        renderFacturaGlobalPendiente(div, data);
    } catch (e) {
        div.innerHTML = '<div class="alert alert-danger small mb-0">' + e.message + '</div>';
    }
}

function renderFacturaGlobalPendiente(div, data) {
    const periodo = data.periodo || periodoSeleccionado();
    const etiqueta = etiquetaPeriodo(periodo);

    if (!data.ventas || !data.ventas.length) {
        div.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-success py-2">
                <i class="bi bi-check-circle-fill fs-4"></i>
                <span>No hay ventas pendientes en la ${etiqueta}: el periodo ya está facturado.</span>
            </div>`;
        return;
    }

    // esDelPeriodo = pertenece al mes que se está facturando.
    // Las demás son de meses anteriores que quedaron sin timbrar y van en
    // SU PROPIA factura global (InformacionGlobal lleva un solo mes).
    const hoy      = data.ventas.filter(v => v.esDelPeriodo);
    const antiguas = data.ventas.filter(v => !v.esDelPeriodo);

    const filaVenta = v => {
        const fecha = (v.fecha || '').substring(0, 10);
        const hora  = (v.fecha || '').substring(11, 16);
        return `
        <div class="vg-fila d-flex align-items-center gap-2 px-3 py-2">
            <input type="checkbox" class="form-check-input vg-check flex-shrink-0"
                value="${v.id}" data-total="${v.total}"
                data-folio="${v.folio || v.id}" data-fecha="${v.fecha || ''}"
                ${v.esDelPeriodo ? 'checked' : ''}>
            <div class="flex-grow-1" style="min-width:0">
                <a href="#" class="vg-detalle fw-bold font-monospace text-decoration-none"
                    data-id="${v.id}" data-folio="${v.folio || v.id}" title="Ver qué se llevó">
                    <i class="bi bi-eye-fill me-1" style="color:#2B6CA3"></i>${v.folio || v.id}
                </a>
                <span class="text-muted small ms-2">${fecha} · ${hora}</span>
            </div>
            <div class="fw-bold flex-shrink-0" style="min-width:80px;text-align:right">
                $${Number(v.total).toFixed(2)}
            </div>
            <button class="btn btn-sm btn-outline-danger vg-descartar flex-shrink-0"
                data-id="${v.id}" data-folio="${v.folio || v.id}"
                title="Descartar esta venta">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>`;
    };

    const seccion = (titulo, icono, color, lista, idCheckTodas, extraHtml = '') => !lista.length ? '' : `
        <div class="mb-3">
            <div class="d-flex align-items-center gap-2 px-3 py-2"
                style="background:${color};border-radius:8px 8px 0 0">
                <input type="checkbox" class="form-check-input" id="${idCheckTodas}"
                    ${lista.every(v => v.esDelPeriodo) ? 'checked' : ''}
                    title="Marcar/desmarcar todas las de esta sección">
                <i class="bi ${icono}"></i>
                <strong class="small text-uppercase" style="letter-spacing:.03em">
                    ${titulo}</strong>
                <span class="badge bg-white text-dark border ms-1">${lista.length}</span>
            </div>
            <div class="border border-top-0 rounded-bottom" style="background:#fff">
                ${lista.map(filaVenta).join('<hr class="my-0 text-muted opacity-25">')}
            </div>
            ${extraHtml}
        </div>`;

    div.innerHTML = `
        ${seccion('Ventas de la ' + etiqueta, 'bi-calendar-check', '#E3EEF5', hoy, 'vg-check-hoy')}
        ${seccion(nombrePeriodo(true).charAt(0).toUpperCase() + nombrePeriodo(true).slice(1)
            + ' anteriores — van en OTRA factura global', 'bi-exclamation-triangle-fill',
            '#FEF6E7', antiguas, 'vg-check-antiguas', antiguas.length ? `
            <div class="d-flex justify-content-between align-items-center px-3 py-2 small text-muted">
                <span><i class="bi bi-info-circle me-1"></i>
                    Cada ${nombrePeriodo(false)} lleva su propia global: no las mezcles con las de la
                    ${etiqueta} o el timbrado se rechaza. Cambia el periodo
                    arriba para facturarlas por separado.</span>
                <button class="btn btn-sm btn-outline-danger" id="vg-descartar-antiguas">
                    <i class="bi bi-eraser me-1"></i>Descartar las ${antiguas.length} de ${nombrePeriodo(true)} anteriores
                </button>
            </div>` : '')}

        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top">
            <div class="fs-6" id="vg-resumen"></div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-danger" id="vg-descartar-seleccionadas">
                    <i class="bi bi-trash3 me-1"></i>Descartar seleccionadas
                </button>
                <button class="btn btn-outline-secondary" id="btn-prev-global"
                    title="Ver cómo quedará la factura antes de timbrar">
                    <i class="bi bi-eye me-1"></i>Previsualizar
                </button>
                <button class="btn btn-success" id="btn-timbrar-global">
                    <i class="bi bi-send-check me-1"></i>Timbrar seleccionadas
                </button>
            </div>
        </div>`;

    function actualizarResumen() {
        const checks = document.querySelectorAll('.vg-check:checked');
        let suma = 0;
        checks.forEach(c => suma += Number(c.dataset.total));
        document.getElementById('vg-resumen').innerHTML =
            `<strong>${checks.length}</strong> venta(s) seleccionadas — ` +
            `Total: <strong class="text-success">$${suma.toFixed(2)}</strong>`;
        document.getElementById('btn-timbrar-global').disabled = !checks.length;
        document.getElementById('vg-descartar-seleccionadas').disabled = !checks.length;
    }
    document.querySelectorAll('.vg-check').forEach(c => c.addEventListener('change', actualizarResumen));

    // "Marcar todas" por sección (hoy y antiguas se controlan por separado)
    ['vg-check-hoy', 'vg-check-antiguas'].forEach(idGrupo => {
        const master = document.getElementById(idGrupo);
        if (!master) return;
        const lista = idGrupo === 'vg-check-hoy' ? hoy : antiguas;
        master.addEventListener('change', () => {
            lista.forEach(v => {
                const chk = document.querySelector(`.vg-check[value="${v.id}"]`);
                if (chk) chk.checked = master.checked;
            });
            actualizarResumen();
        });
    });
    actualizarResumen();

    document.getElementById('btn-timbrar-global')
        .addEventListener('click', () => timbrarFacturaGlobal(data));

    // Descartar TODAS las seleccionadas de un jalón (cualquier sección) —
    // reutiliza el mismo endpoint de descarte individual, en paralelo.
    document.getElementById('vg-descartar-seleccionadas').addEventListener('click', async () => {
        const seleccion = [...document.querySelectorAll('.vg-check:checked')];
        if (!seleccion.length) return;
        const r = await Swal.fire({
            title: `¿Descartar ${seleccion.length} venta(s) seleccionada(s)?`,
            html: `<p class="small mb-0">No se incluirán en ninguna factura global
                (tampoco en el timbrado automático). Puedes volver a incluirlas
                más adelante si vuelven a aparecer como pendientes.</p>`,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Sí, descartar todas', cancelButtonText: 'Atrás',
            confirmButtonColor: '#dc3545'
        });
        if (!r.isConfirmed) return;
        try {
            await Promise.all(seleccion.map(c =>
                fetchAPI('/sales/' + c.value + '/descartar-global', { method: 'PATCH' })));
            Swal.fire({ icon: 'success', title: seleccion.length + ' venta(s) descartadas',
                timer: 1600, showConfirmButton: false });
            cargarFacturaGlobal();
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });

    // Ver el detalle de un ticket (qué productos se llevó)
    document.querySelectorAll('.vg-detalle').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            verDetalleTicket(a.dataset.id, a.dataset.folio);
        });
    });

    document.getElementById('btn-prev-global').addEventListener('click', previsualizarGlobal);

    // Descartar UNA venta
    document.querySelectorAll('.vg-descartar').forEach(b => {
        b.addEventListener('click', async () => {
            const r = await Swal.fire({
                title: `¿Descartar ${b.dataset.folio}?`,
                html: `<p class="small mb-0">La venta dejará de aparecer como pendiente y
                    <strong>no se incluirá en ninguna factura global</strong>
                    (tampoco en el timbrado automático).</p>`,
                icon: 'warning', showCancelButton: true,
                confirmButtonText: 'Sí, descartar', cancelButtonText: 'Atrás',
                confirmButtonColor: '#dc3545'
            });
            if (!r.isConfirmed) return;
            try {
                await fetchAPI('/sales/' + b.dataset.id + '/descartar-global', { method: 'PATCH' });
                cargarFacturaGlobal();
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        });
    });

    // Descartar TODAS las de días anteriores (atajo específico, sigue existiendo)
    const btnAnt = document.getElementById('vg-descartar-antiguas');
    if (btnAnt) btnAnt.addEventListener('click', async () => {
        const r = await Swal.fire({
            title: `¿Descartar las ${antiguas.length} de ${nombrePeriodo(true)} anteriores?`,
            html: `<p class="small mb-0">Todas las ventas pendientes de <strong>${nombrePeriodo(true)}
                anteriores a la ${etiqueta}</strong> se descartarán del flujo de factura
                global. Las de la ${etiqueta} no se tocan.</p>
                <p class="small text-danger mb-0">Descartar no es facturar: esos
                ingresos quedarían sin comprobante ante el SAT.</p>`,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Sí, descartar todas', cancelButtonText: 'Atrás',
            confirmButtonColor: '#dc3545'
        });
        if (!r.isConfirmed) return;
        try {
            const res = await fetchAPI('/sales/descartar-global-anteriores?periodo=' + periodo,
                { method: 'PATCH' });
            Swal.fire({ icon: 'success', title: res.descartadas + ' venta(s) descartadas',
                timer: 1600, showConfirmButton: false });
            cargarFacturaGlobal();
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });
}

// ─── PREVISUALIZADOR DE LA FACTURA GLOBAL ────────────────────────────────────
// Muestra el CFDI EXACTAMENTE como se timbrará: un concepto por ticket
// (regla de la guía SAT), con la misma matemática del backend:
// base = total/1.16 y IVA = total − base, por venta (cuadre exacto).
function previsualizarGlobal() {
    const sel = [...document.querySelectorAll('.vg-check:checked')];
    if (!sel.length) {
        Swal.fire({ icon: 'info', title: 'Nada seleccionado',
            text: 'Palomea al menos una venta para previsualizar.' });
        return;
    }
    let subtotal = 0, iva = 0, total = 0;
    const meses = new Set();
    const filas = sel.map(function(c, i) {
        const t    = Number(c.dataset.total);
        const base = Math.round((t / 1.16) * 100) / 100;
        const imp  = Math.round((t - base) * 100) / 100;
        subtotal += base; iva += imp; total += t;
        if (c.dataset.fecha) meses.add(c.dataset.fecha.substring(0, 7));
        return '<tr>' +
            '<td class="text-muted">' + (i + 1) + '</td>' +
            '<td class="font-monospace">' + c.dataset.folio + '</td>' +
            '<td>Venta</td>' +
            '<td class="text-center">1</td>' +
            '<td class="text-end">$' + base.toFixed(2) + '</td>' +
            '<td class="text-end">$' + imp.toFixed(2) + '</td>' +
            '<td class="text-end fw-bold">$' + t.toFixed(2) + '</td>' +
            '</tr>';
    }).join('');

    const mesTxt = [...meses].sort().join(', ') || '—';
    const avisoMeses = meses.size > 1
        ? '<div class="alert alert-danger small py-1 px-2 mb-2">' +
          '<i class="bi bi-x-octagon me-1"></i>Hay ventas de MESES DISTINTOS (' + mesTxt + '): ' +
          'el timbrado se rechazará. Timbra cada mes por separado.</div>'
        : '';

    Swal.fire({
        title: 'Previsualización — Factura Global '
            + (periodicidadConfig ? periodicidadConfig.periodicidadNombre : 'Quincenal'),
        width: 720,
        html:
            '<div class="text-start small border rounded p-2 mb-2 bg-light">' +
            '<strong>Receptor:</strong> PÚBLICO EN GENERAL (XAXX010101000) · ' +
            '<strong>Uso:</strong> S01 · <strong>Periodicidad:</strong> ' +
            (periodicidadConfig ? periodicidadConfig.codigoSat : '03') + ' ' +
            (periodicidadConfig ? periodicidadConfig.periodicidadNombre : 'Quincenal') + ' · ' +
            '<strong>Mes:</strong> ' + mesTxt + '</div>' +
            avisoMeses +
            '<div class="text-start" style="max-height:300px;overflow-y:auto">' +
            '<table class="table table-sm" style="font-size:.75rem">' +
            '<thead class="table-light"><tr>' +
                '<th>#</th><th>No. Ident. (ticket)</th><th>Descripción</th>' +
                '<th class="text-center">Cant.</th>' +
                '<th class="text-end">Valor unit.</th>' +
                '<th class="text-end">IVA</th>' +
                '<th class="text-end">Importe</th></tr></thead>' +
            '<tbody>' + filas + '</tbody>' +
            '<tfoot class="fw-bold">' +
            '<tr><td colspan="4"></td><td class="text-end">Subtotal:</td>' +
                '<td></td><td class="text-end">$' + subtotal.toFixed(2) + '</td></tr>' +
            '<tr><td colspan="4"></td><td class="text-end">IVA 16%:</td>' +
                '<td></td><td class="text-end">$' + iva.toFixed(2) + '</td></tr>' +
            '<tr><td colspan="4"></td><td class="text-end">Total:</td>' +
                '<td></td><td class="text-end text-success">$' + total.toFixed(2) + '</td></tr>' +
            '</tfoot></table></div>' +
            '<p class="small text-muted text-start mb-0">' +
            '<i class="bi bi-info-circle me-1"></i>' +
            'Un concepto por ticket con clave 01010101 y unidad ACT — ' +
            'formato de la guía de llenado del SAT para factura global.</p>',
        confirmButtonText: 'Cerrar'
    });
}


// ─── DETALLE DE UN TICKET (qué se llevó) ─────────────────────────────────────
async function verDetalleTicket(saleId, folio) {
    Swal.fire({ title: 'Cargando ticket...',
        html: '<div class="spinner-border text-primary"></div>',
        allowOutsideClick: false, showConfirmButton: false });
    try {
        const ventas = await fetchAPI('/sales/by-ids?ids=' + saleId);
        const v = Array.isArray(ventas) ? ventas[0] : ventas;
        if (!v || !v.items) { Swal.fire('Sin datos', 'No se pudo cargar el ticket.', 'info'); return; }

        const filas = v.items.map(function(it) {
            const cant = Number(it.quantity);
            const cantTxt = Number.isInteger(cant) ? cant : cant.toFixed(3).replace(/\.?0+$/, '');
            const importe = cant * Number(it.unitPrice);
            return '<tr>' +
                '<td class="text-start">' + (it.productName || '') + '</td>' +
                '<td class="text-center">' + cantTxt + '</td>' +
                '<td class="text-end">$' + Number(it.unitPrice).toFixed(2) + '</td>' +
                '<td class="text-end fw-bold">$' + importe.toFixed(2) + '</td>' +
                '</tr>';
        }).join('');

        const fecha = (v.saleDate || v.createdAt || '').replace('T', ' ').substring(0, 16);

        Swal.fire({
            title: 'Ticket ' + folio,
            width: 560,
            html: '<div class="text-start">' +
                '<p class="small text-muted mb-2">' + fecha +
                    ' · ' + v.items.length + ' producto(s)</p>' +
                '<table class="table table-sm" style="font-size:.85rem">' +
                '<thead class="table-light"><tr>' +
                    '<th class="text-start">Producto</th>' +
                    '<th class="text-center">Cant.</th>' +
                    '<th class="text-end">Precio</th>' +
                    '<th class="text-end">Importe</th></tr></thead>' +
                '<tbody>' + filas + '</tbody>' +
                '<tfoot><tr class="fw-bold">' +
                    '<td colspan="3" class="text-end">Total:</td>' +
                    '<td class="text-end text-success">$' + Number(v.totalAmount || v.total).toFixed(2) + '</td>' +
                '</tr></tfoot></table></div>',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#2B6CA3'
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function timbrarFacturaGlobal(data) {
    // Solo las ventas PALOMEADAS en el mini-historial
    const seleccion = [...document.querySelectorAll('.vg-check:checked')];
    const ids  = seleccion.map(c => parseInt(c.value));
    const suma = seleccion.reduce((s, c) => s + Number(c.dataset.total), 0);
    if (!ids.length) return;

    const conf = await Swal.fire({
        title: 'Timbrar Factura Global ' + (periodicidadConfig ? periodicidadConfig.periodicidadNombre : 'Quincenal'),
        html: '<div class="alert alert-info py-2 small mb-3"><i class="bi bi-info-circle me-1"></i>' +
            'Se generará <strong>UN</strong> CFDI 4.0 que ampara el periodo seleccionado, ' +
            'con un concepto por ticket y Periodicidad ' +
            (periodicidadConfig ? periodicidadConfig.codigoSat : '03') + ' (' +
            (periodicidadConfig ? periodicidadConfig.periodicidadNombre : 'Quincenal') + ').</div>' +
            '<div><strong>Ventas:</strong> ' + ids.length + ' | <strong>Total:</strong> <span class="text-success fw-bold">$' + suma.toFixed(2) + '</span></div>' +
            '<p class="small text-muted mt-2 mb-0">Una vez timbrada, las ventas de ese ' + nombrePeriodo(false) + ' ' +
            'quedan amparadas y ya no aparecerán como pendientes.</p>',
        icon: 'question', showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send-check me-1"></i>Sí, timbrar',
        cancelButtonText: 'Cancelar', confirmButtonColor: '#198754'
    });
    if (!conf.isConfirmed) return;
    Swal.fire({ title: 'Timbrando...', html: '<div class="spinner-border text-success"></div><p class="mt-2 text-muted small">Comunicando con FEL Premium...</p>', allowOutsideClick: false, showConfirmButton: false });
    try {
        const cfdi = await fetchAPI('/cfdi/timbrar/factura-global', { method: 'POST', body: { saleIds: ids } });
        cfdisCache = null;
        await Swal.fire({
            icon: 'success', title: '¡Factura Global ' + (periodicidadConfig ? periodicidadConfig.periodicidadNombre : 'Quincenal') + ' Timbrada!',
            html: '<div class="text-start"><div class="mb-2"><strong>UUID:</strong><br><span class="font-monospace small text-muted">' + cfdi.uuid + '</span></div>' +
                '<div class="mb-1"><strong>Folio:</strong> <span class="badge bg-light text-dark border font-monospace">' + cfdi.folio + '</span></div>' +
                '<div><strong>Total:</strong> <span class="text-success fw-bold">$' + Number(cfdi.total).toFixed(2) + '</span></div></div>',
            confirmButtonText: 'Aceptar'
        });
        cargarFacturaGlobal();
        document.querySelector('#cfdi-tabs .nav-link.active') && document.querySelector('#cfdi-tabs .nav-link.active').click();
    } catch (e) {
        Swal.fire('Error al timbrar', e.message, 'error');
    }
}