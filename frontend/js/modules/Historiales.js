// ═════════════════════════════════════════════════════════════════════════════
//  HISTORIALES — un solo lugar para toda la historia del negocio
//
//  Pestañas:
//    · Ventas    → reutiliza el módulo historial.js existente (sin duplicar)
//    · Compras   → vista NUEVA: órdenes de compra con filtros y detalle
//    · Facturas  → reutiliza facturacion.js (con sus pestañas Vigentes /
//                  Cancelados y el buscador de auditoría)
// ═════════════════════════════════════════════════════════════════════════════
import { fetchAPI }        from '../services/api.js';
import { initHistorial }   from './historial.js';
import { initFacturacion } from './facturacion.js';

export function initHistoriales(container) {
    container.innerHTML = `
        <h2 class="fw-bold mb-3"><i class="bi bi-clock-history me-2"></i>Historiales</h2>

        <ul class="nav nav-tabs mb-3" id="hist-tabs">
            <li class="nav-item"><a href="#" class="nav-link active" data-htab="ventas">
                <i class="bi bi-cart-check me-1"></i>Ventas</a></li>
            <li class="nav-item"><a href="#" class="nav-link" data-htab="compras">
                <i class="bi bi-truck me-1"></i>Compras</a></li>
            <li class="nav-item"><a href="#" class="nav-link" data-htab="facturas">
                <i class="bi bi-receipt me-1"></i>Facturas</a></li>
        </ul>

        <div id="hist-contenido"></div>`;

    const contenido = document.getElementById('hist-contenido');

    document.querySelectorAll('#hist-tabs .nav-link').forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('#hist-tabs .nav-link')
                .forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            abrirTab(tab.dataset.htab, contenido);
        });
    });

    abrirTab('ventas', contenido);
}

function abrirTab(cual, contenido) {
    contenido.innerHTML = '';
    if (cual === 'ventas')   { initHistorial(contenido);   return; }
    if (cual === 'facturas') { initFacturacion(contenido); return; }
    initHistorialCompras(contenido);
}

// ═════════════════════════════════════════════════════════════════════════════
//  HISTORIAL DE COMPRAS
//  Filtros: texto (proveedor, folio, factura del proveedor, producto),
//  rango de fechas y estado. Cada compra se expande para ver sus renglones.
//  Incluye resumen (cuántas y cuánto suman) para revisiones/auditoría.
// ═════════════════════════════════════════════════════════════════════════════
let comprasCache = null;

function initHistorialCompras(container) {
    container.innerHTML = `
        <div class="card border-0 shadow-sm mb-2"><div class="card-body py-2">
            <div class="row g-2 align-items-end">
                <div class="col-md-5">
                    <label class="form-label small fw-bold mb-1">
                        <i class="bi bi-search me-1"></i>Buscar compra</label>
                    <input type="text" class="form-control form-control-sm"
                        id="comp-buscar"
                        placeholder="Proveedor, folio, factura del proveedor o producto...">
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label small fw-bold mb-1">Desde</label>
                    <input type="date" class="form-control form-control-sm" id="comp-desde">
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label small fw-bold mb-1">Hasta</label>
                    <input type="date" class="form-control form-control-sm" id="comp-hasta">
                </div>
                <div class="col-md-2">
                    <label class="form-label small fw-bold mb-1">Estado</label>
                    <select class="form-select form-select-sm" id="comp-estado">
                        <option value="">Todas</option>
                        <option value="RECIBIDA">Recibidas</option>
                        <option value="CANCELADA">Canceladas</option>
                    </select>
                </div>
                <div class="col-md-1 text-end">
                    <button class="btn btn-sm btn-outline-secondary w-100"
                        id="comp-limpiar" title="Limpiar filtros">
                        <i class="bi bi-eraser"></i></button>
                </div>
            </div>
            <div class="small text-muted mt-1" id="comp-resumen"></div>
        </div></div>

        <div class="card border-0 shadow-sm">
            <div id="comp-tabla" class="table-responsive">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary"></div>
                </div>
            </div>
        </div>`;

    let t = null;
    document.getElementById('comp-buscar').addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(renderCompras, 300);
    });
    ['comp-desde', 'comp-hasta', 'comp-estado'].forEach(id =>
        document.getElementById(id).addEventListener('change', renderCompras));
    document.getElementById('comp-limpiar').addEventListener('click', () => {
        ['comp-buscar', 'comp-desde', 'comp-hasta', 'comp-estado']
            .forEach(id => document.getElementById(id).value = '');
        renderCompras();
    });

    cargarCompras();
}

async function cargarCompras() {
    try {
        // Sin filtros de fecha el backend regresa todo el historial
        comprasCache = await fetchAPI('/purchase-orders/search');
        renderCompras();
    } catch (e) {
        document.getElementById('comp-tabla').innerHTML =
            `<div class="alert alert-danger m-3">${e.message}</div>`;
    }
}

function renderCompras() {
    const cont = document.getElementById('comp-tabla');
    if (!cont || !comprasCache) return;

    const q      = (document.getElementById('comp-buscar').value || '').trim().toLowerCase();
    const desde  = document.getElementById('comp-desde').value;
    const hasta  = document.getElementById('comp-hasta').value;
    const estado = document.getElementById('comp-estado').value;

    let lista = comprasCache;
    if (estado) lista = lista.filter(c => c.status === estado);
    if (desde)  lista = lista.filter(c => (c.createdAt || '').substring(0, 10) >= desde);
    if (hasta)  lista = lista.filter(c => (c.createdAt || '').substring(0, 10) <= hasta);
    if (q) {
        lista = lista.filter(c => {
            const enItems = (c.items || []).some(i =>
                `${i.productName || ''} ${i.productSku || ''}`
                    .toLowerCase().includes(q));
            return `${c.supplierName || ''} ${c.folio || ''} ${c.invoiceNumber || ''}`
                .toLowerCase().includes(q) || enItems;
        });
    }

    // Resumen para revisiones: cuántas compras y cuánto suman
    const res = document.getElementById('comp-resumen');
    const suma = lista.reduce((s, c) => s + Number(c.total || 0), 0);
    res.innerHTML = (q || desde || hasta || estado)
        ? `<i class="bi bi-funnel me-1"></i>Filtro activo: <strong>${lista.length}</strong>` +
          ` compra(s) — suma: <strong>$${suma.toLocaleString('es-MX',
              { minimumFractionDigits: 2 })}</strong>`
        : `${lista.length} compra(s) registradas — total histórico: $` +
          suma.toLocaleString('es-MX', { minimumFractionDigits: 2 });

    if (!lista.length) {
        cont.innerHTML = `<div class="text-center py-5 text-muted">
            <i class="bi bi-truck fs-1 d-block mb-3 opacity-25"></i>
            <p>No hay compras que coincidan.</p></div>`;
        return;
    }

    const filas = lista.map((c, idx) => {
        const fecha = c.createdAt ? c.createdAt.substring(0, 10) : '';
        const hora  = c.createdAt ? c.createdAt.substring(11, 16) : '';
        const cancelada = c.status === 'CANCELADA';
        const numItems = (c.items || []).length;

        const itemsHtml = (c.items || []).map(i => `
            <tr>
                <td class="text-muted font-monospace" style="font-size:.72rem">
                    ${i.productSku || ''}</td>
                <td>${i.productName || ''}</td>
                <td class="text-center">${Number(i.quantity)
                    .toFixed(3).replace(/\.?0+$/, '')}</td>
                <td class="text-end">$${Number(i.unitCost).toFixed(2)}</td>
                <td class="text-end fw-bold">$${Number(i.subtotal).toFixed(2)}</td>
            </tr>`).join('');

        return `
        <tr class="align-middle${cancelada ? ' text-muted' : ''}"
            style="cursor:pointer" data-bs-toggle="collapse"
            data-bs-target="#comp-det-${idx}">
            <td class="ps-3">
                <i class="bi bi-chevron-down text-muted me-2"
                    style="font-size:.7rem"></i>
                <span class="fw-bold font-monospace">${c.folio || c.id}</span>
            </td>
            <td><div class="small">${fecha}</div>
                <div class="text-muted" style="font-size:.7rem">${hora}</div></td>
            <td class="small fw-bold">${c.supplierName || '—'}</td>
            <td class="small font-monospace">${c.invoiceNumber || '—'}</td>
            <td class="text-center">
                <span class="badge bg-light text-dark border">${numItems}</span></td>
            <td class="text-end fw-bold ${cancelada ? '' : 'text-success'}">
                $${Number(c.total).toFixed(2)}</td>
            <td class="text-center">
                <span class="badge ${cancelada ? 'bg-danger' : 'bg-success'}">
                    ${c.status}</span></td>
        </tr>
        <tr><td colspan="7" class="p-0 border-0">
            <div class="collapse" id="comp-det-${idx}">
                <div class="bg-light px-4 py-2">
                    ${c.notes ? `<div class="small text-muted mb-1">
                        <i class="bi bi-sticky me-1"></i>${c.notes}</div>` : ''}
                    <table class="table table-sm mb-1" style="font-size:.78rem">
                        <thead><tr class="text-muted">
                            <th>SKU</th><th>Producto</th>
                            <th class="text-center">Cant.</th>
                            <th class="text-end">Costo unit.</th>
                            <th class="text-end">Importe</th>
                        </tr></thead>
                        <tbody>${itemsHtml}</tbody>
                        <tfoot class="fw-bold">
                            <tr><td colspan="4" class="text-end">Subtotal:</td>
                                <td class="text-end">$${Number(c.subtotal).toFixed(2)}</td></tr>
                            <tr><td colspan="4" class="text-end">IVA:</td>
                                <td class="text-end">$${Number(c.taxAmount).toFixed(2)}</td></tr>
                            <tr><td colspan="4" class="text-end">Total:</td>
                                <td class="text-end">$${Number(c.total).toFixed(2)}</td></tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </td></tr>`;
    }).join('');

    cont.innerHTML = `
        <p class="text-muted small px-3 pt-2 mb-1">
            <i class="bi bi-hand-index me-1"></i>
            Haz clic en una compra para ver los productos que incluyó.</p>
        <table class="table table-hover align-middle mb-0">
            <thead class="table-light" style="font-size:.78rem">
                <tr>
                    <th class="ps-3">Folio</th><th>Fecha</th><th>Proveedor</th>
                    <th>Factura prov.</th>
                    <th class="text-center">Productos</th>
                    <th class="text-end">Total</th>
                    <th class="text-center">Estado</th>
                </tr>
            </thead>
            <tbody style="font-size:.85rem">${filas}</tbody>
        </table>`;
}