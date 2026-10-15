import { fetchAPI } from '../services/api.js';
import { fmtFecha, hoyISO } from '../services/fechas.js';


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

export function initHistorial(container) {
    // hoyISO() devuelve string "YYYY-MM-DD" directamente
    const hoy = hoyISO();

    container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
            <h2 class="mb-0 fw-bold"><i class="bi bi-clock-history me-2 text-primary"></i>Historial de Ventas</h2>
            <p class="text-muted mb-0 small">Busca, consulta y cancela ventas registradas.</p>
        </div>
        <button class="btn btn-outline-secondary btn-sm" id="btn-exportar-historial" disabled
                title="Descargar lo que estás viendo, para el contador o Excel">
            <i class="bi bi-download me-1"></i>Exportar CSV
        </button>
    </div>

    <!-- Filtros -->
    <div class="card shadow-sm border-0 mb-4">
        <div class="card-body py-3">
            <div class="row g-3 align-items-end">
                <div class="col-md-2">
                    <label class="form-label fw-bold small">Desde</label>
                    <input type="date" id="filtro-fecha-inicio" class="form-control" value="${hoy}">
                </div>
                <div class="col-md-2">
                    <label class="form-label fw-bold small">Hasta</label>
                    <input type="date" id="filtro-fecha-fin" class="form-control" value="${hoy}">
                </div>
                <div class="col-md-2">
                    <label class="form-label fw-bold small">Estado</label>
                    <select id="filtro-estado" class="form-select">
                        <option value="">Todos</option>
                        <option value="COMPLETED">Completadas</option>
                        <option value="CANCELLED">Canceladas</option>
                        <option value="DEUDA">Deuda</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label fw-bold small">Folio, cliente o RFC</label>
                    <div class="input-group">
                        <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                        <input type="text" id="filtro-texto" class="form-control border-start-0"
                            placeholder="Buscar...">
                    </div>
                </div>
                <div class="col-md-2 d-flex gap-2">
                    <button class="btn btn-primary flex-grow-1" id="btn-buscar-historial">
                        <i class="bi bi-search"></i> Buscar
                    </button>
                    <button class="btn btn-outline-secondary" id="btn-limpiar-filtros" title="Limpiar">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- KPIs rápidos -->
    <div class="row g-3 mb-4" id="resumen-historial" style="display:none">
        <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center bg-primary text-white">
                <div class="card-body py-3">
                    <h4 class="fw-bold mb-0" id="res-total-ventas">0</h4>
                    <small>Ventas</small>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center bg-success text-white">
                <div class="card-body py-3">
                    <h4 class="fw-bold mb-0" id="res-total-ingresos">$0.00</h4>
                    <small>Ingresos</small>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center bg-warning text-dark">
                <div class="card-body py-3">
                    <h4 class="fw-bold mb-0" id="res-total-canceladas">0</h4>
                    <small>Canceladas</small>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center bg-info text-white">
                <div class="card-body py-3">
                    <h4 class="fw-bold mb-0" id="res-promedio">$0.00</h4>
                    <small>Promedio / venta</small>
                </div>
            </div>
        </div>
    </div>

    <!-- Tabla -->
    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-3">Folio</th>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th class="text-center">Método</th>
                            <th class="text-end">Total</th>
                            <th class="text-center">Estado</th>
                            <th class="text-center pe-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-historial-body">
                        <tr>
                            <td colspan="7" class="text-center py-5 text-muted">
                                <i class="bi bi-search fs-2 d-block mb-2 opacity-25"></i>
                                Usa los filtros para buscar ventas
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    document.getElementById('btn-buscar-historial').addEventListener('click', cargarHistorial);
    document.getElementById('btn-exportar-historial')
        ?.addEventListener('click', exportarHistorialCSV);
    document.getElementById('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);
    document.getElementById('filtro-texto').addEventListener('keydown', e => {
        if (e.key === 'Enter') cargarHistorial();
    });

    cargarHistorial();
}

// ─── CARGAR HISTORIAL ─────────────────────────────────────────────────────────

async function cargarHistorial() {
    const tbody = document.getElementById('tabla-historial-body');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-2 text-muted small mb-0">Buscando ventas...</p>
    </td></tr>`;

    const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
    const fechaFin    = document.getElementById('filtro-fecha-fin').value;
    const estado      = document.getElementById('filtro-estado').value;
    const texto       = document.getElementById('filtro-texto').value.trim();

    const params = new URLSearchParams();
    if (fechaInicio) params.set('inicio', `${fechaInicio}T00:00:00`);
    if (fechaFin)    params.set('fin',    `${fechaFin}T23:59:59`);
    if (estado && estado !== 'DEUDA') params.set('status', estado);
    if (texto)       params.set('texto',  texto);

    try {
        let ventas = await fetchAPI(`/sales/search?${params}`);

        if (estado === 'DEUDA') {
            ventas = ventas.filter(v => v.paymentMethod === 'DEUDA');
        }

        actualizarResumen(ventas);
        renderTabla(ventas);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle me-2"></i>Error: ${e.message}</td></tr>`;
    }
}

function limpiarFiltros() {
    const hoy = hoyISO(); // string "YYYY-MM-DD"
    document.getElementById('filtro-fecha-inicio').value = hoy;
    document.getElementById('filtro-fecha-fin').value    = hoy;
    document.getElementById('filtro-estado').value       = '';
    document.getElementById('filtro-texto').value        = '';
    cargarHistorial();
}

// ─── RESUMEN KPIs ─────────────────────────────────────────────────────────────

// Lo que se está mostrando ahora mismo (para exportar exactamente eso)
let ventasMostradas = [];

function actualizarResumen(ventas) {
    ventasMostradas = ventas;
    const btnExp = document.getElementById('btn-exportar-historial');
    if (btnExp) btnExp.disabled = !ventas.length;

    const resumen = document.getElementById('resumen-historial');
    resumen.style.display = 'flex';

    const completadas   = ventas.filter(v => v.status === 'COMPLETED');
    const canceladas    = ventas.filter(v => v.status === 'CANCELLED');
    const totalIngresos = completadas.reduce((s, v) => s + Number(v.totalAmount), 0);
    const promedio      = completadas.length ? totalIngresos / completadas.length : 0;

    document.getElementById('res-total-ventas').innerText   = completadas.length;
    document.getElementById('res-total-ingresos').innerText =
        `$${totalIngresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    document.getElementById('res-total-canceladas').innerText = canceladas.length;
    document.getElementById('res-promedio').innerText =
        `$${promedio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────────────
// Descarga EXACTAMENTE lo que estás viendo (con los filtros aplicados), en un
// CSV que Excel en español abre en columnas y con los acentos correctos.
// Pensado para mandárselo al contador sin tener que capturar nada a mano.
function exportarHistorialCSV() {
    if (!ventasMostradas.length) return;

    const filas = [[
        'Folio', 'Fecha', 'Hora', 'Cliente', 'RFC',
        'Metodo de pago', 'Estado',
        'Subtotal', 'IVA', 'Total'
    ]];

    ventasMostradas.forEach(v => {
        const total = Number(v.totalAmount) || 0;
        const iva   = Number(v.taxAmount) || 0;
        const f     = (v.createdAt || '').split('T');
        filas.push([
            v.invoiceNumber || v.id,
            f[0] || '',
            (f[1] || '').substring(0, 5),
            v.customerName || 'Publico General',
            v.customerRfc || '',
            v.paymentMethod || '',
            v.status || '',
            (total - iva).toFixed(2),
            iva.toFixed(2),
            total.toFixed(2)
        ]);
    });

    // Fila de totales al final: solo lo que de verdad se cobró
    const validas = ventasMostradas.filter(v =>
        !String(v.status || '').toUpperCase().includes('CANCEL'));
    const sumTotal = validas.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);
    const sumIva   = validas.reduce((s, v) => s + (Number(v.taxAmount) || 0), 0);
    filas.push([]);
    filas.push(['', '', '', '', '', '', 'TOTAL (sin canceladas)',
        (sumTotal - sumIva).toFixed(2), sumIva.toFixed(2), sumTotal.toFixed(2)]);

    // Punto y coma + BOM: así Excel en español lo abre bien y respeta acentos
    const csv = filas
        .map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    const ini = document.getElementById('filtro-fecha-inicio')?.value || 'historial';
    const fin = document.getElementById('filtro-fecha-fin')?.value || '';
    a.download = `ventas_${ini}${fin ? '_a_' + fin : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    window.mostrarToast?.(`${ventasMostradas.length} ventas exportadas`, 'success');
}

// ─── TABLA ────────────────────────────────────────────────────────────────────

function renderTabla(ventas) {
    const tbody = document.getElementById('tabla-historial-body');

    if (!ventas.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="bi bi-inbox fs-2 d-block mb-2 opacity-25"></i>
            No se encontraron ventas con esos filtros.</td></tr>`;
        return;
    }

    const metodoBadge = {
        EFECTIVO:      `<span class="badge bg-success-subtle text-success border"><i class="bi bi-cash"></i> Efectivo</span>`,
        TARJETA:       `<span class="badge bg-primary-subtle text-primary border"><i class="bi bi-credit-card"></i> Tarjeta</span>`,
        TRANSFERENCIA: `<span class="badge bg-info-subtle text-info border"><i class="bi bi-phone"></i> Transf.</span>`,
        DEUDA:         `<span class="badge bg-warning-subtle text-warning border"><i class="bi bi-clock-history"></i> Deuda</span>`,
    };

    tbody.innerHTML = ventas.map(v => {
        const fecha       = fmtFecha(v.createdAt); // ← usa utilidad de zona horaria
        const esCancelada = v.status === 'CANCELLED';
        const esDeuda     = v.paymentMethod === 'DEUDA';

        const estadoBadge = esCancelada
            ? `<span class="badge bg-danger">Cancelada</span>`
            : esDeuda
                ? `<span class="badge bg-warning text-dark">Deuda</span>`
                : `<span class="badge bg-success">Completada</span>`;

        const accionCancelar = esCancelada
            ? `<button class="btn btn-sm btn-outline-secondary" disabled title="Ya cancelada">
                   <i class="bi bi-x-circle"></i></button>`
            : `<button class="btn btn-sm btn-outline-danger"
                   onclick="window.cancelarVenta(${v.id}, '${escAttr(v.invoiceNumber)}')"
                   title="Cancelar venta"><i class="bi bi-x-circle"></i></button>`;

        return `
        <tr class="${esCancelada ? 'opacity-50' : ''}">
            <td class="ps-3">
                <span class="badge bg-light text-dark border font-monospace fw-bold">${v.invoiceNumber}</span>
            </td>
            <td><small class="text-muted">${fecha}</small></td>
            <td>
                <div class="fw-bold small">${v.customerName || 'Público General'}</div>
                ${v.customerRfc ? `<small class="text-muted">${v.customerRfc}</small>` : ''}
            </td>
            <td class="text-center">${metodoBadge[v.paymentMethod] || `<span class="badge bg-secondary">${v.paymentMethod}</span>`}</td>
            <td class="text-end fw-bold">$${Number(v.totalAmount).toFixed(2)}</td>
            <td class="text-center">${estadoBadge}</td>
            <td class="text-center pe-3">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary"
                        onclick="window.verDetalleVenta(${v.id})" title="Ver detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${!esCancelada
                        ? `<button class="btn btn-outline-success"
                               onclick="window.timbrarVentaHistorial(${v.id}, '${escAttr(v.invoiceNumber)}')"
                               title="Facturar / Ver CFDI">
                               <i class="bi bi-receipt-cutoff"></i>
                           </button>`
                        : ''}
                    ${accionCancelar}
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ─── VER DETALLE ──────────────────────────────────────────────────────────────

window.verDetalleVenta = async (id) => {
    Swal.fire({
        title: 'Cargando detalle...',
        html: `<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>`,
        showConfirmButton: false,
        allowOutsideClick: false
    });

    try {
        const ventas = await fetchAPI('/sales/recent');
        let venta = ventas.find(v => v.id === id);

        if (!venta) {
            const params = new URLSearchParams();
            params.set('inicio', '2020-01-01T00:00:00');
            params.set('fin',    new Date().toISOString().substring(0, 19));
            const todas = await fetchAPI(`/sales/search?${params}`);
            venta = todas.find(v => v.id === id);
        }

        if (!venta) { Swal.fire('Error', 'No se encontró la venta.', 'error'); return; }

        const fecha = fmtFecha(venta.createdAt);
        const items = venta.items.map(i => `
            <tr>
                <td class="small">${i.productName}</td>
                <td class="text-center">${i.quantity}</td>
                <td class="text-end">$${Number(i.unitPrice).toFixed(2)}</td>
                <td class="text-end fw-bold">$${(i.quantity * Number(i.unitPrice)).toFixed(2)}</td>
            </tr>`).join('');

        const cancelInfo = venta.status === 'CANCELLED' ? `
            <div class="alert alert-danger mt-3 mb-0 small">
                <i class="bi bi-x-circle me-1"></i>
                <strong>Cancelada:</strong> ${venta.cancelReason || 'Sin motivo'}
            </div>` : '';

        Swal.fire({
            title: `<span class="font-monospace fs-6">${venta.invoiceNumber}</span>`,
            html: `
                <div style="text-align:left;font-size:14px">
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <small class="text-muted d-block">Fecha</small>
                            <strong>${fecha}</strong>
                        </div>
                        <div class="col-6">
                            <small class="text-muted d-block">Cliente</small>
                            <strong>${venta.customerName || 'Público General'}</strong>
                            ${venta.customerRfc ? `<br><small class="text-muted">${venta.customerRfc}</small>` : ''}
                        </div>
                        <div class="col-6">
                            <small class="text-muted d-block">Método de pago</small>
                            <strong>${venta.paymentMethod || '---'}</strong>
                        </div>
                        <div class="col-6">
                            <small class="text-muted d-block">Estado</small>
                            <strong class="${venta.status === 'CANCELLED' ? 'text-danger' : 'text-success'}">
                                ${venta.status === 'CANCELLED' ? '✗ Cancelada' : '✓ Completada'}
                            </strong>
                        </div>
                    </div>
                    <table class="table table-sm table-bordered mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Producto</th>
                                <th class="text-center">Cant</th>
                                <th class="text-end">P.U.</th>
                                <th class="text-end">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${items}</tbody>
                    </table>
                    <div class="mt-3 text-end">
                        <div class="text-muted small">Subtotal sin IVA: $${(Number(venta.totalAmount)/1.16).toFixed(2)}</div>
                        <div class="text-muted small">IVA (16%): $${Number(venta.taxAmount).toFixed(2)}</div>
                        <div class="fw-bold fs-5">Total: $${Number(venta.totalAmount).toFixed(2)}</div>
                        ${venta.amountReceived
                            ? `<div class="text-success small">Recibido: $${Number(venta.amountReceived).toFixed(2)}</div>
                               <div class="text-primary small">Cambio: $${Number(venta.changeGiven).toFixed(2)}</div>`
                            : ''}
                    </div>
                    ${cancelInfo}
                </div>`,
            confirmButtonText: '<i class="bi bi-printer"></i> Reimprimir',
            showCancelButton: true,
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#0d6efd',
            width: '600px'
        }).then(r => { if (r.isConfirmed) reimprimirTicket(venta); });

    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// ─── CANCELAR VENTA ───────────────────────────────────────────────────────────

window.cancelarVenta = async (id, folio) => {
    const result = await Swal.fire({
        title: `¿Cancelar ${folio}?`,
        html: `
            <p class="text-danger small mb-3">
                <i class="bi bi-exclamation-triangle me-1"></i>
                Regresa el stock al inventario. No se puede deshacer.
            </p>
            <label class="form-label fw-bold small text-start d-block">Motivo *</label>
            <textarea id="motivo-cancelacion" class="form-control" rows="2"
                placeholder="Ej: Error en el cobro, producto devuelto..."></textarea>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-x-circle"></i> Cancelar venta',
        cancelButtonText: 'Mantener',
        confirmButtonColor: '#dc3545',
        preConfirm: () => {
            const m = document.getElementById('motivo-cancelacion').value.trim();
            if (!m) { Swal.showValidationMessage('El motivo es obligatorio'); return false; }
            return m;
        }
    });
    if (!result.isConfirmed) return;

    try {
        await fetchAPI(`/sales/${id}/cancel`, { method: 'POST', body: { reason: result.value } });
        Swal.fire({ icon: 'success', title: 'Venta cancelada',
            text: 'El stock fue regresado.', timer: 2000, showConfirmButton: false });
        cargarHistorial();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// ─── REIMPRIMIR ───────────────────────────────────────────────────────────────

function reimprimirTicket(venta) {
    const fecha = fmtFecha(venta.createdAt);

    const items = venta.items.map(i => {
        const cantFmt = parseFloat(i.quantity) % 1 === 0
            ? parseInt(i.quantity)
            : parseFloat(i.quantity).toFixed(3).replace(/\.?0+$/,'');

        const totalItem = (parseFloat(i.quantity) * Number(i.unitPrice)).toFixed(2);
        const puFmt = Number(i.unitPrice).toFixed(2);

        return `
        <div class="item-producto" style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px dotted #000;">
            <div class="prod-nombre" style="font-weight: bold; text-transform: uppercase;">${i.productName}</div>
            <div class="prod-detalles" style="display:flex;justify-content:space-between;font-size:12px;color:#444;">
                <span>${cantFmt} pza(s) x $${puFmt}</span>
                <span style="font-weight:bold;color:#000;">$${totalItem}</span>
            </div>
        </div>`;
    }).join('');

    const contenido = `
    <div id="ticket-content" style="font-family:'Courier New',Courier,monospace;font-size:12px;text-align:left;padding:4px;color:#000;margin:0 auto;max-width:100%;">

        <div style="text-align:center;margin-bottom:8px;">
            <strong style="font-size:18px;">⚙ Ferretería Fermín</strong><br>
            <small style="font-weight:bold;color:#F26100;">*** REIMPRESIÓN ***</small><br>
            <small>${fecha}</small>
        </div>

        <hr style="border:none;border-top:2px dashed #000;margin:8px 0;">

        <div><strong>Folio:</strong> ${venta.invoiceNumber}</div>
        <div><strong>Cliente:</strong> ${venta.customerName || 'Público General'}</div>
        <div><strong>Método:</strong> ${venta.paymentMethod}</div>

        <hr style="border:none;border-top:2px dashed #000;margin:8px 0;">

        <div id="lista-productos-ticket" style="margin:8px 0;">
            ${items}
        </div>

        <hr style="border:none;border-top:2px dashed #000;margin:8px 0;">

        <div style="display:flex;justify-content:space-between;">
            <span>Subtotal sin IVA:</span>
            <span>$${(Number(venta.totalAmount)/1.16).toFixed(2)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;">
            <span>IVA (16%):</span>
            <span>$${Number(venta.taxAmount).toFixed(2)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:2px;">
            <span>TOTAL:</span>
            <span>$${Number(venta.totalAmount).toFixed(2)}</span>
        </div>

        <hr style="border:none;border-top:2px dashed #000;margin:8px 0;">

        <div style="text-align:center;margin-top:6px;">
            <small style="display:block;font-style:italic;margin-bottom:2px;">Precios incluyen IVA</small>
            <small style="font-weight:bold;">¡Gracias por su compra!</small>
        </div>

    </div>`;

    const w = window.open('', '_blank', 'width=380,height=650');

    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Ticket ${venta.invoiceNumber}</title>

<style>

@page{
    size:58mm auto;
    margin:0mm !important;
}

*{
    box-sizing:border-box !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
}

html,body{
    margin:0 !important;
    padding:0 !important;
    width:44mm !important;
    background:#fff;
    overflow-x:hidden;
}

body{
    font-family:'Courier New',Courier,monospace;
    font-size:10px;
    line-height:1.15;
    color:#000 !important;
}

#ticket-content{
    width:100% !important;
    margin:0 !important;
    padding:0 !important;
}

#ticket-content,
#ticket-content *{
    color:#000 !important;
    font-size:10px !important;
    font-weight:600;
    word-break:break-word;
}

#ticket-content h1,
#ticket-content h2,
#ticket-content h3,
#ticket-content [style*="font-size"]{
    font-size:11px !important;
}

table{
    width:100%;
    border-collapse:collapse;
}

th,td{
    padding:1px 0;
    font-size:10px;
}

.ticket-corte{
    text-align:center;
    margin-top:8px;
    padding-top:4px;
    padding-bottom:12px;
    font-size:9px;
    font-weight:bold;
    border-top:2px dashed #000;
}

@media print{
    html,body{
        width:44mm !important;
        margin:0 !important;
        padding:0 !important;
    }
}

</style>

</head>

<body>

${contenido}

<div class="ticket-corte">
¡GRACIAS POR SU COMPRA!
</div>

<script>
window.onload=function(){
    window.focus();
    window.print();
    setTimeout(function(){
        window.close();
    },300);
};
</script>

</body>
</html>`);

    w.document.close();
}
// ─── TIMBRAR / VER CFDI DESDE HISTORIAL ──────────────────────────────────────
window.timbrarVentaHistorial = async (saleId, invoiceNumber) => {
    // Primero verificar si ya tiene CFDI timbrado
    let cfdiExistente = null;
    try {
        cfdiExistente = await fetchAPI(`/cfdi/venta/${saleId}`);
    } catch (e) { /* no tiene CFDI aún */ }

    if (cfdiExistente && cfdiExistente.uuid) {
        // Ya tiene CFDI — mostrar opciones
        const r = await Swal.fire({
            title: `<i class="bi bi-receipt-cutoff me-2 text-success"></i>CFDI Timbrado`,
            html: `
                <div class="text-start">
                    <div class="mb-2">
                        <strong>Folio fiscal (UUID):</strong><br>
                        <span class="font-monospace small text-muted">${cfdiExistente.uuid}</span>
                    </div>
                    <div class="mb-2">
                        <strong>Total:</strong>
                        <span class="text-success fw-bold">$${Number(cfdiExistente.total).toFixed(2)}</span>
                    </div>
                    <div>
                        <strong>Estado:</strong>
                        <span class="badge ${cfdiExistente.status === 'VIGENTE' ? 'bg-success' : 'bg-danger'}">
                            ${cfdiExistente.status}
                        </span>
                    </div>
                </div>`,
            showCancelButton: true,
            showDenyButton: cfdiExistente.status === 'VIGENTE',
            confirmButtonText: '<i class="bi bi-download me-1"></i>Descargar PDF',
            denyButtonText: '<i class="bi bi-x-circle me-1"></i>Cancelar CFDI',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#0d6efd',
            denyButtonColor: '#dc3545'
        });

        if (r.isConfirmed && cfdiExistente.pdfBase64) {
            // Descargar PDF
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${cfdiExistente.pdfBase64}`;
            link.download = `CFDI-${invoiceNumber}.pdf`;
            link.click();
        } else if (r.isDenied) {
            await cancelarCfdiDesdeHistorial(cfdiExistente.uuid, saleId);
        }
        return;
    }

    // No tiene CFDI — confirmar timbrado
    const conf = await Swal.fire({
        title: `Facturar venta ${invoiceNumber}`,
        html: `<p class="text-muted">Se generará un CFDI 4.0 y se timbrará con el SAT via FEL Premium.</p>
               <p class="small text-muted mb-0">Esta acción no se puede deshacer fácilmente.</p>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send-check me-1"></i>Sí, timbrar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#198754'
    });

    if (!conf.isConfirmed) return;

    // Mostrar spinner
    Swal.fire({
        title: 'Timbrando con el SAT...',
        html: '<div class="spinner-border text-primary"></div><p class="mt-2 text-muted small">Esto puede tardar unos segundos</p>',
        allowOutsideClick: false,
        showConfirmButton: false
    });

    try {
        const cfdi = await fetchAPI(`/cfdi/timbrar/venta/${saleId}`, { method: 'POST' });
        await Swal.fire({
            icon: 'success',
            title: '¡CFDI Timbrado!',
            html: `
                <div class="text-start">
                    <div class="mb-2">
                        <strong>UUID:</strong><br>
                        <span class="font-monospace small text-muted">${cfdi.uuid}</span>
                    </div>
                    <div>
                        <strong>Total:</strong>
                        <span class="text-success fw-bold">$${Number(cfdi.total).toFixed(2)}</span>
                    </div>
                </div>`,
            confirmButtonText: 'Aceptar'
        });
    } catch (e) {
        Swal.fire('Error al timbrar', e.message, 'error');
    }
};

async function cancelarCfdiDesdeHistorial(uuid, saleId) {
    const { value: motivo } = await Swal.fire({
        title: 'Cancelar CFDI',
        html: `
            <p class="text-danger small">Esta operación solicita la cancelación ante el SAT.</p>
            <label class="form-label fw-bold small text-start d-block">Motivo de cancelación</label>
            <select id="motivo-cancelacion" class="form-select">
                <option value="02">02 — Comprobante emitido con errores sin relación</option>
                <option value="01">01 — Comprobante emitido con errores con relación</option>
                <option value="03">03 — No se llevó a cabo la operación</option>
            </select>`,
        showCancelButton: true,
        confirmButtonText: 'Cancelar CFDI',
        cancelButtonText: 'Atrás',
        confirmButtonColor: '#dc3545',
        preConfirm: () => document.getElementById('motivo-cancelacion').value
    });

    if (!motivo) return;

    try {
        await fetchAPI(`/cfdi/cancelar/${uuid}`, {
            method: 'PATCH',
            body: { motivo }
        });
        await Swal.fire({
            icon: 'success',
            title: 'Solicitud enviada',
            text: 'La cancelación fue enviada al SAT. Puede tardar hasta 72h en procesarse.',
            timer: 3000
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}