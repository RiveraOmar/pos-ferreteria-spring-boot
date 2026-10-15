import { fetchAPI } from '../services/api.js';
import { fmtFecha } from '../services/fechas.js';
import { SearchSelect } from '../services/searchSelect.js';
import { sanitizar } from '../services/validaciones.js';

// ─── MAPA SAT → decimales (mismo que productos.js / ventas.js) ───────────────
// Determina si el producto se compra por fracciones (kg, m, L...) o solo
// piezas completas (pza, juego, par, caja...).
const UNIDADES_DECIMALES = new Set([
    'MTR','KGM','GRM','LTR','MLT','CMT','MTK','DMT',
    'DMQ','HLT','TNE','MGM','H87P'
]);
const ETIQUETA_UNIDAD = {
    H87:'pza', SET:'juego', KT:'kit', PR:'par', BX:'caja',
    MTR:'m',   CMT:'cm',   MMT:'mm', MTK:'m²',
    KGM:'kg',  GRM:'g',    MGM:'mg', TNE:'ton',
    LTR:'L',   MLT:'mL',   HLT:'hL',
};
function esDecimal(clave) {
    return UNIDADES_DECIMALES.has((clave||'').toUpperCase());
}
function etiqueta(clave) {
    return ETIQUETA_UNIDAD[(clave||'').toUpperCase()] || 'pza';
}

let itemsCompra      = [];
let proveedorElegido = null;
let ssProveedor       = null;

export function initCompras(container) {
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
                <h2 class="mb-0 fw-bold">
                    <i class="bi bi-cart-plus me-2"></i>Registrar Compra
                </h2>
                <p class="text-muted mb-0 small">
                    Captura lo que recibiste de un proveedor. El stock y costo se actualizan solos.
                </p>
            </div>
            <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-outline-primary" id="btn-sugerencia-compra"
                    title="Qué pedir y a quién, según tu stock bajo">
                    <i class="bi bi-clipboard-check me-1"></i>Sugerencia de compra
                </button>
                <button class="btn btn-outline-secondary" id="btn-ver-historial-compras">
                    <i class="bi bi-clock-history"></i> Historial de Compras
                </button>
            </div>
        </div>

        <div id="compras-main">
            <!-- ── PASO 1: Proveedor ─────────────────────────────────────── -->
            <div class="card shadow-sm border-0 mb-3">
                <div class="card-body">
                    <label class="form-label fw-bold small">
                        Proveedor <span class="text-danger">*</span>
                    </label>
                    <div class="search-wrapper">
                        <i class="bi bi-truck search-icon"></i>
                        <input type="text" class="search-input form-control"
                            id="input-proveedor-compra"
                            placeholder="Buscar proveedor por nombre, contacto o teléfono...">
                        <div class="search-dropdown" id="dropdown-proveedor-compra"></div>
                    </div>
                    <div id="info-proveedor-elegido" class="mt-2" style="display:none"></div>
                </div>
            </div>

            <!-- ── Productos previamente comprados a este proveedor ───────── -->
            <div class="card shadow-sm border-0 mb-3" id="card-historial-proveedor" style="display:none">
                <div class="card-header bg-white py-2">
                    <small class="fw-bold text-muted">
                        <i class="bi bi-clock-history me-1"></i>
                        Productos que ya le has comprado — clic para agregar rápido
                    </small>
                </div>
                <div class="card-body py-2" id="lista-historial-proveedor"
                    style="max-height:140px;overflow-y:auto"></div>
            </div>

            <!-- ── PASO 2: Agregar productos ──────────────────────────────── -->
            <div class="card shadow-sm border-0 mb-3">
                <div class="card-body">
                    <label class="form-label fw-bold small mb-2">
                        <i class="bi bi-search me-1"></i>Agregar Producto a la Compra
                    </label>
                    <div class="d-flex gap-2 align-items-start">
                        <div class="search-wrapper flex-grow-1">
                            <i class="bi bi-box search-icon"></i>
                            <input type="text" class="search-input form-control"
                                id="buscar-prod-compra"
                                placeholder="Buscar por nombre o SKU...">
                            <div class="search-dropdown" id="resultados-prod-compra"></div>
                        </div>
                        <button class="btn btn-outline-danger position-relative"
                            id="btn-agregar-faltantes" type="button"
                            style="height:fit-content;padding:.65rem .9rem;white-space:nowrap"
                            title="Agregar de un jalón todos los productos con stock bajo">
                            <i class="bi bi-cart-dash me-1"></i>Faltantes
                            <span class="badge bg-danger rounded-pill position-absolute top-0 start-100
                                         translate-middle" id="badge-faltantes-compra"
                                  style="display:none;font-size:.6rem">0</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- ── PASO 3: Tabla de items ─────────────────────────────────── -->
            <div class="card shadow-sm border-0 mb-3">
                <div class="card-header bg-white fw-bold small py-2
                    d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-list-check me-2"></i>Productos en esta compra</span>
                    <button class="btn btn-sm btn-outline-danger" id="btn-quitar-seleccionados-compra"
                        style="display:none">
                        <i class="bi bi-trash3 me-1"></i>Quitar seleccionados
                        (<span id="cnt-seleccionados-compra">0</span>)
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-3" style="width:32px">
                                    <input type="checkbox" class="form-check-input"
                                        id="check-todos-items-compra">
                                </th>
                                <th>Producto</th>
                                <th class="text-center" style="width:130px">Cantidad</th>
                                <th class="text-end" style="width:140px">Costo Unit.</th>
                                <th class="text-end" style="width:130px">Subtotal</th>
                                <th style="width:50px"></th>
                            </tr>
                        </thead>
                        <tbody id="items-compra-body">
                            <tr><td colspan="6" class="text-center text-muted py-4">
                                <i class="bi bi-cart fs-3 d-block mb-2 opacity-25"></i>
                                Sin productos. Busca arriba para agregar.
                            </td></tr>
                        </tbody>
                        <tfoot class="table-light">
                            <tr>
                                <td colspan="4" class="text-end fw-bold fs-5 pe-3">Total:</td>
                                <td class="text-end fw-bold fs-5 text-success" id="total-compra">
                                    $0.00
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- ── PASO 4: Datos finales ──────────────────────────────────── -->
            <div class="card shadow-sm border-0 mb-3">
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label small">
                                Folio / Factura del proveedor (opcional)
                            </label>
                            <input type="text" id="compra-invoice" class="form-control"
                                placeholder="Ej: A-1024" maxlength="50">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small">Notas (opcional)</label>
                            <input type="text" id="compra-notes" class="form-control"
                                placeholder="Ej: pagado en efectivo" maxlength="300">
                        </div>
                    </div>
                </div>
            </div>

            <div class="text-end">
                <button class="btn btn-success btn-lg shadow-sm" id="btn-registrar-compra" disabled>
                    <i class="bi bi-check-circle"></i> Registrar Compra
                </button>
            </div>
        </div>`;

    cargarProveedores();
    configurarEventos();
}

// ══════════════════════════════════════════════════════════════════════════════
// AGREGAR FALTANTES DE UN JALÓN
// El motivo real de casi toda compra es reponer lo que se acabó. En vez de
// buscar producto por producto, este botón trae todos los que están en o bajo
// su stock mínimo, con la cantidad ya sugerida para volver a nivel.
// ══════════════════════════════════════════════════════════════════════════════

let faltantesCache = [];

function esFaltante(p) {
    const stock = parseFloat(p.currentStock) || 0;
    const min   = parseFloat(p.minStockLevel) || 0;
    return p.active !== false && min > 0 && stock <= min;
}

async function contarFaltantes() {
    try {
        const productos = await fetchAPI('/products');
        faltantesCache = productos.filter(esFaltante);
        const badge = document.getElementById('badge-faltantes-compra');
        if (badge && faltantesCache.length) {
            badge.textContent = faltantesCache.length > 99 ? '99+' : faltantesCache.length;
            badge.style.display = 'inline-block';
        }
    } catch (e) { /* sin conexión: el botón sigue, solo sin globito */ }
}

async function agregarFaltantes() {
    if (!faltantesCache.length) await contarFaltantes();

    if (!faltantesCache.length) {
        Swal.fire({ icon: 'success', title: 'Nada que reponer',
            text: 'Ningún producto está por debajo de su stock mínimo.' });
        return;
    }

    // Si ya hay proveedor elegido, se sugiere su último costo conocido
    let costosProveedor = {};
    const supplierId = proveedorElegido;   // guarda el id directamente
    if (supplierId) {
        try {
            const sps = await fetchAPI(`/suppliers/${supplierId}/products`);
            sps.forEach(sp => costosProveedor[sp.productId] = Number(sp.lastCost) || 0);
        } catch (e) { /* sin historial con ese proveedor */ }
    }

    // Cantidad sugerida: lo que falta para volver al mínimo, con un colchón de 1
    const sugeridos = faltantesCache.map(p => {
        const stock = parseFloat(p.currentStock) || 0;
        const min   = parseFloat(p.minStockLevel) || 0;
        const dec   = esDecimal(p.satClaveUnidad);
        let cant = (min - stock) + (dec ? 0 : 1);
        if (cant <= 0) cant = 1;
        return {
            p,
            cantidad: dec ? parseFloat(cant.toFixed(2)) : Math.ceil(cant),
            costo: costosProveedor[p.id] || 0
        };
    });

    const html = `
        <div class="text-start">
            <p class="small text-muted mb-2">
                Se agregarán con la cantidad necesaria para volver a su stock mínimo.
                Puedes ajustar todo después.
            </p>
            <div style="max-height:260px;overflow-y:auto">
                <table class="table table-sm table-hover mb-0" style="font-size:.8rem">
                    <thead class="table-light"><tr>
                        <th style="width:32px"></th>
                        <th>Producto</th>
                        <th class="text-center">Stock</th>
                        <th class="text-center">Pedir</th>
                    </tr></thead>
                    <tbody>
                        ${sugeridos.map((s, i) => `
                        <tr>
                            <td><input type="checkbox" class="form-check-input chk-faltante"
                                    data-idx="${i}" checked></td>
                            <td>
                                <div class="fw-bold">${s.p.name}</div>
                                <small class="text-muted font-monospace">${s.p.sku}</small>
                                ${s.costo ? `<small class="text-success"> · último: $${s.costo.toFixed(2)}</small>` : ''}
                            </td>
                            <td class="text-center">
                                <span class="badge bg-danger-subtle text-danger border">
                                    ${parseFloat(s.p.currentStock) || 0} / ${parseFloat(s.p.minStockLevel) || 0}
                                </span>
                            </td>
                            <td class="text-center fw-bold">${s.cantidad}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

    const r = await Swal.fire({
        title: `<i class="bi bi-cart-dash me-2"></i>${sugeridos.length} producto(s) por reponer`,
        html,
        width: '640px',
        showCancelButton: true,
        confirmButtonText: 'Agregar los seleccionados',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d97706',
        didOpen: () => {
            // Al abrir, todos marcados; el usuario desmarca lo que no quiera
        },
        preConfirm: () => [...document.querySelectorAll('.chk-faltante:checked')]
            .map(c => Number(c.dataset.idx))
    });

    if (!r.isConfirmed || !r.value?.length) return;

    let agregados = 0;
    r.value.forEach(i => {
        const s = sugeridos[i];
        const yaEsta = itemsCompra.find(it => it.productId === s.p.id);
        if (yaEsta) return;   // no duplicar lo que ya pusiste a mano
        agregarItemCompra(
            s.p.id, s.p.name, s.p.sku, s.costo,
            s.p.satClaveUnidad, s.p.price, s.p.imagenUrl);
        // Ajustar a la cantidad sugerida (agregarItemCompra entra con 1)
        const item = itemsCompra.find(it => it.productId === s.p.id);
        if (item) {
            item.cantidad = s.cantidad;
            item.subtotal = parseFloat((item.cantidad * item.costo).toFixed(2));
        }
        agregados++;
    });

    renderItemsCompra();
    window.mostrarToast?.(`${agregados} producto(s) agregados a la compra`, 'success');
}

function configurarEventos() {
    document.getElementById('btn-registrar-compra')
        .addEventListener('click', registrarCompra);
    document.getElementById('btn-agregar-faltantes')
        ?.addEventListener('click', agregarFaltantes);
    contarFaltantes();   // pinta el globito rojo con cuántos faltan
    document.getElementById('btn-ver-historial-compras')
        .addEventListener('click', mostrarHistorialCompras);
    document.getElementById('btn-sugerencia-compra')
        .addEventListener('click', mostrarSugerenciaCompra);
    configurarSeleccionMultipleCompra();

    const inputBuscarProd = document.getElementById('buscar-prod-compra');
    let timeout;
    inputBuscarProd.addEventListener('input', e => {
        clearTimeout(timeout);
        const v = e.target.value.trim();
        if (v.length > 1) timeout = setTimeout(() => buscarProductos(v), 300);
        else document.getElementById('resultados-prod-compra').classList.remove('show');
    });
}


// ═════════════════════════════════════════════════════════════════════════════
//  SUGERENCIA DE COMPRA — stock bajo agrupado por proveedor asignado
//  Cantidades editables · imprimir por proveedor · copiar texto (WhatsApp)
// ═════════════════════════════════════════════════════════════════════════════
async function mostrarSugerenciaCompra() {
    // Dos formas de ver lo mismo:
    //  A) Por urgencia  → lo que está bajo mínimo, repartido por proveedor
    //  B) Por proveedor → eliges UN proveedor y ves TODO su catálogo con
    //     urgencia (para aprovechar el envío incluyendo lo que va cerca)
    const modo = await Swal.fire({
        title: 'Sugerencia de compra',
        input: 'radio',
        inputOptions: {
            urgencia: 'Lo que me falta (agrupado por proveedor)',
            proveedor: 'Voy a pedirle a UN proveedor — ver su catálogo'
        },
        inputValue: 'urgencia',
        confirmButtonText: 'Continuar',
        confirmButtonColor: '#2B6CA3',
        showCancelButton: true, cancelButtonText: 'Cerrar'
    });
    if (!modo.isConfirmed) return;
    if (modo.value === 'proveedor') return sugerenciaPorProveedor();

    Swal.fire({ title: 'Analizando tu stock...', 
        html: '<div class="spinner-border text-primary"></div>',
        allowOutsideClick: false, showConfirmButton: false });
    let grupos;
    try {
        grupos = await fetchAPI('/products/sugerencia-compra');
    } catch (e) { Swal.fire('Error', e.message, 'error'); return; }

    if (!grupos.length) {
        Swal.fire({ icon: 'success', title: 'Nada que pedir',
            text: 'Ningún producto está en o por debajo de su stock mínimo.',
            timer: 2200, showConfirmButton: false });
        return;
    }

    const html = grupos.map((g, gi) => {
        const filas = g.productos.map((p, pi) => `
            <tr>
                <td class="font-monospace" style="font-size:.85rem">${p.sku}</td>
                <td class="fw-bold" style="font-size:.92rem">${p.name}
                    ${p.codigoFabricante ? `<div class="fw-bold" style="font-size:.8rem;color:#2B6CA3">
                        <i class="bi bi-upc"></i> Cód: ${p.codigoFabricante}</div>` : ''}
                    ${p.supplierSku ? `<div class="text-muted" style="font-size:.76rem">
                        Código prov.: ${p.supplierSku}</div>` : ''}</td>
                <td class="text-center small">${Number(p.stock)}</td>
                <td class="text-center small text-muted">${Number(p.minStock)}</td>
                <td style="width:80px">
                    <input type="number" min="0" step="1"
                        class="form-control form-control-sm text-center sug-cant"
                        data-g="${gi}" data-costo="${p.lastCost ?? ''}"
                        data-codfab="${p.codigoFabricante || ''}"
                        value="${Math.ceil(Number(p.sugerido))}"></td>
                <td class="text-end small">${p.lastCost != null
                    ? '$' + Number(p.lastCost).toFixed(2)
                    : '<span class="text-muted">—</span>'}</td>
            </tr>`).join('');
        return `
        <div class="border rounded mb-3 sug-grupo" data-g="${gi}">
            <div class="d-flex justify-content-between align-items-center px-3 py-2"
                style="background:#26292F;color:#fff;border-radius:8px 8px 0 0">
                <div>
                    <strong>${g.supplierName}</strong>
                    ${g.telefono ? `<span class="small ms-2 opacity-75">
                        <i class="bi bi-telephone me-1"></i>${g.telefono}</span>` : ''}
                </div>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-light py-0 sug-copiar"
                        data-g="${gi}" title="Copiar como texto (para WhatsApp)">
                        <i class="bi bi-whatsapp"></i></button>
                    <button class="btn btn-sm btn-outline-light py-0 sug-imprimir"
                        data-g="${gi}" title="Imprimir esta orden">
                        <i class="bi bi-printer"></i></button>
                </div>
            </div>
            <table class="table table-sm mb-0" style="font-size:.92rem">
                <thead class="table-light" style="font-size:.85rem"><tr>
                    <th>SKU</th><th>Producto</th>
                    <th class="text-center">Stock</th>
                    <th class="text-center">Mín.</th>
                    <th class="text-center">Pedir</th>
                    <th class="text-end">Últ. costo</th>
                </tr></thead>
                <tbody>${filas}</tbody>
                <tfoot><tr class="fw-bold">
                    <td colspan="5" class="text-end">Estimado:</td>
                    <td class="text-end sug-total" data-g="${gi}"></td>
                </tr></tfoot>
            </table>
        </div>`;
    }).join('');

    Swal.fire({
        title: '📋 Sugerencia de compra',
        width: 780,
        html: `<p class="text-muted text-start mb-2" style="font-size:.9rem">
                Productos en stock mínimo, agrupados por proveedor asignado.
                Ajusta las cantidades y usa <i class="bi bi-whatsapp"></i> /
                <i class="bi bi-printer"></i> por proveedor. Un producto con
                varios proveedores aparece con cada uno — pídelo al de mejor costo.</p>
            <div class="text-start" style="max-height:56vh;overflow-y:auto">${html}</div>`,
        confirmButtonText: 'Cerrar',
        didOpen: () => {
            window._sugGrupos = grupos;
            const recalc = () => document.querySelectorAll('.sug-total').forEach(t => {
                let s = 0, sin = false;
                document.querySelectorAll(`.sug-cant[data-g="${t.dataset.g}"]`).forEach(i => {
                    if (i.dataset.costo === '') { sin = true; return; }
                    s += (parseFloat(i.value) || 0) * parseFloat(i.dataset.costo);
                });
                t.textContent = '$' + s.toFixed(2) + (sin ? ' *' : '');
            });
            recalc();
            document.querySelectorAll('.sug-cant')
                .forEach(i => i.addEventListener('input', recalc));

            document.querySelectorAll('.sug-copiar').forEach(b =>
                b.addEventListener('click', () => {
                    const g = window._sugGrupos[b.dataset.g];
                    const lineas = [...document.querySelectorAll(
                        `.sug-cant[data-g="${b.dataset.g}"]`)].map((inp, i) => {
                        const p = g.productos[i];
                        const c = parseFloat(inp.value) || 0;
                        // Prioriza el código de fabricante (así pide el proveedor);
                        // si no hay, usa el código del distribuidor.
                        const cod = inp.dataset.codfab || p.supplierSku || '';
                        return c > 0 ? `• ${c} x ${p.name}` +
                            (cod ? ` [${cod}]` : '') : null;
                    }).filter(Boolean);
                    const texto = `Pedido — Ferretería:\n` + lineas.join('\n');
                    navigator.clipboard.writeText(texto).then(() =>
                        b.innerHTML = '<i class="bi bi-check-lg"></i>');
                    setTimeout(() => b.innerHTML = '<i class="bi bi-whatsapp"></i>', 1500);
                }));

            document.querySelectorAll('.sug-imprimir').forEach(b =>
                b.addEventListener('click', () => {
                    const g = window._sugGrupos[b.dataset.g];
                    const filas = [...document.querySelectorAll(
                        `.sug-cant[data-g="${b.dataset.g}"]`)].map((inp, i) => {
                        const p = g.productos[i];
                        const c = parseFloat(inp.value) || 0;
                        const cod = inp.dataset.codfab || p.supplierSku || '';
                        return c > 0 ? `<tr><td>${cod || p.sku}</td><td>${p.name}` +
                            `</td><td style="text-align:center"><strong>${c}</strong></td></tr>` : null;
                    }).filter(Boolean).join('');
                    const w = window.open('', '_blank', 'width=520,height=680');
                    w.document.write(`<!DOCTYPE html><html><head><title>Pedido</title>
                        <style>body{font-family:Arial;font-size:13px;padding:14px}
                        table{width:100%;border-collapse:collapse}
                        td,th{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left}
                        </style></head><body>
                        <h3 style="margin:0">Pedido — ${g.supplierName}</h3>
                        <p style="margin:4px 0 10px;color:#666">
                            ${new Date().toLocaleDateString('es-MX')}
                            ${g.telefono ? ' · Tel: ' + g.telefono : ''}</p>
                        <table><tr><th>Código</th><th>Producto</th><th>Cantidad</th></tr>
                        ${filas}</table>
                        <script>window.print()</` + `script></body></html>`);
                    w.document.close();
                }));
        }
    });
}


// ─── SUGERENCIA POR PROVEEDOR (parte del proveedor, ve todo su catálogo) ─────
async function sugerenciaPorProveedor() {
    let proveedores;
    try { proveedores = (await fetchAPI('/suppliers')).filter(s => s.active !== false); }
    catch (e) { Swal.fire('Error', e.message, 'error'); return; }
    if (!proveedores.length) {
        Swal.fire('Sin proveedores', 'Registra proveedores primero.', 'info'); return;
    }

    const sel = await Swal.fire({
        title: '¿A qué proveedor le vas a pedir?',
        input: 'select',
        inputOptions: Object.fromEntries(
            proveedores.map(p => [p.id, p.companyName])),
        inputPlaceholder: 'Elige un proveedor',
        confirmButtonText: 'Ver su catálogo',
        confirmButtonColor: '#2B6CA3',
        showCancelButton: true
    });
    if (!sel.isConfirmed || !sel.value) return;

    Swal.fire({ title: 'Cargando catálogo...',
        html: '<div class="spinner-border text-primary"></div>',
        allowOutsideClick: false, showConfirmButton: false });
    let data;
    try { data = await fetchAPI('/products/sugerencia-compra/proveedor/' + sel.value); }
    catch (e) { Swal.fire('Error', e.message, 'error'); return; }

    if (!data.productos.length) {
        Swal.fire({ icon: 'info', title: data.supplierName,
            text: 'Este proveedor no tiene productos asignados todavía. ' +
                  'Asígnalos al editar cada producto (sección "Proveedores que lo surten").' });
        return;
    }

    const badge = u => ({
        agotado: '<span class="badge bg-danger">AGOTADO</span>',
        bajo:    '<span class="badge" style="background:#2B6CA3">BAJO</span>',
        proximo: '<span class="badge bg-warning text-dark">PRÓXIMO</span>',
        ok:      '<span class="badge bg-success-subtle text-success border">OK</span>'
    }[u]);

    const filas = data.productos.map((p, i) => `
        <tr class="${p.urgencia === 'ok' ? 'text-muted' : ''}">
            <td class="font-monospace" style="font-size:.85rem">${p.sku}</td>
            <td class="fw-bold" style="font-size:.92rem">${p.name}
                ${p.codigoFabricante ? `<div class="fw-bold" style="font-size:.8rem;color:#2B6CA3">
                    <i class="bi bi-upc"></i> Cód: ${p.codigoFabricante}</div>` : ''}
                ${p.supplierSku ? `<div class="text-muted" style="font-size:.76rem">
                    Código prov.: ${p.supplierSku}</div>` : ''}</td>
            <td class="text-center">${badge(p.urgencia)}</td>
            <td class="text-center small">${Number(p.stock)}</td>
            <td class="text-center small text-muted">${Number(p.minStock)}</td>
            <td style="width:80px">
                <input type="number" min="0" step="1"
                    class="form-control form-control-sm text-center provsug-cant"
                    data-costo="${p.lastCost ?? ''}"
                    data-sku="${p.sku}" data-name="${p.name.replace(/"/g,'&quot;')}"
                    data-provsku="${p.supplierSku || ''}"
                    data-codfab="${p.codigoFabricante || ''}"
                    value="${Math.ceil(Number(p.sugerido))}"></td>
            <td class="text-end small">${p.lastCost != null
                ? '$' + Number(p.lastCost).toFixed(2) : '—'}</td>
        </tr>`).join('');

    Swal.fire({
        title: '📦 ' + data.supplierName,
        width: 800,
        html: `<p class="text-muted text-start mb-2" style="font-size:.9rem">
                Todo lo que te surte este proveedor. Lo urgente viene con cantidad
                sugerida; lo que está OK viene en 0 — súbelo si quieres aprovechar
                el envío. ${data.telefono
                    ? '<i class="bi bi-telephone ms-1"></i> ' + data.telefono : ''}</p>
            <div class="text-start" style="max-height:56vh;overflow-y:auto">
            <table class="table table-sm" style="font-size:.92rem">
                <thead class="table-light" style="position:sticky;top:0"><tr>
                    <th>SKU</th><th>Producto</th><th class="text-center">Estado</th>
                    <th class="text-center">Stock</th><th class="text-center">Mín.</th>
                    <th class="text-center">Pedir</th><th class="text-end">Últ. costo</th>
                </tr></thead><tbody>${filas}</tbody>
                <tfoot><tr class="fw-bold"><td colspan="6" class="text-end">Estimado:</td>
                    <td class="text-end" id="provsug-total"></td></tr></tfoot>
            </table></div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-whatsapp me-1"></i>Copiar pedido',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#198754',
        didOpen: () => {
            const recalc = () => {
                let s = 0, sin = false;
                document.querySelectorAll('.provsug-cant').forEach(i => {
                    if (i.dataset.costo === '') { if (parseFloat(i.value) > 0) sin = true; return; }
                    s += (parseFloat(i.value) || 0) * parseFloat(i.dataset.costo);
                });
                document.getElementById('provsug-total').textContent =
                    '$' + s.toFixed(2) + (sin ? ' *' : '');
            };
            recalc();
            document.querySelectorAll('.provsug-cant')
                .forEach(i => i.addEventListener('input', recalc));
        },
        preConfirm: () => {
            const lineas = [...document.querySelectorAll('.provsug-cant')]
                .map(i => {
                    const c = parseFloat(i.value) || 0;
                    const cod = i.dataset.codfab || i.dataset.provsku || '';
                    return c > 0 ? `• ${c} x ${i.dataset.name}` +
                        (cod ? ` [${cod}]` : '') : null;
                }).filter(Boolean);
            if (!lineas.length) {
                Swal.showValidationMessage('Pon cantidad en al menos un producto');
                return false;
            }
            return `Pedido — ${data.supplierName}:\n` + lineas.join('\n');
        }
    }).then(r => {
        if (r.isConfirmed) {
            navigator.clipboard.writeText(r.value).then(() =>
                Swal.fire({ icon: 'success', title: 'Pedido copiado',
                    text: 'Pégalo en WhatsApp del proveedor.',
                    timer: 2200, showConfirmButton: false }));
        }
    });
}

// ─── PROVEEDOR ────────────────────────────────────────────────────────────────
async function cargarProveedores() {
    try {
        const proveedores = await fetchAPI('/suppliers?active=true');
        ssProveedor = new SearchSelect({
            input:    document.getElementById('input-proveedor-compra'),
            dropdown: document.getElementById('dropdown-proveedor-compra'),
            items:    proveedores.map(p => ({
                id:    p.id,
                label: p.companyName,
                sub:   [p.contactName, p.city].filter(Boolean).join(' · '),
                phone: p.phoneNumber || ''
            })),
            onSelect: item => {
                proveedorElegido = item.id;
                document.getElementById('info-proveedor-elegido').style.display = 'block';
                document.getElementById('info-proveedor-elegido').innerHTML = `
                    <div class="alert alert-success py-2 mb-0 small">
                        <i class="bi bi-check-circle me-1"></i>
                        Comprando a: <strong>${item.label}</strong>
                    </div>`;
                cargarHistorialProveedor(item.id);
                actualizarBotonRegistrar();
            },
            placeholder: 'Buscar proveedor por nombre, contacto o teléfono...'
        });
    } catch (e) { console.error(e); }
}

async function cargarHistorialProveedor(supplierId) {
    const card = document.getElementById('card-historial-proveedor');
    const lista = document.getElementById('lista-historial-proveedor');
    try {
        const productos = await fetchAPI(`/suppliers/${supplierId}/products`);
        if (!productos.length) { card.style.display = 'none'; return; }
        card.style.display = 'block';
        lista.innerHTML = productos.map(sp => `
            <span class="d-inline-flex align-items-center gap-2 border rounded-pill
                bg-light me-2 mb-1 py-1 pe-3" style="cursor:pointer"
                onclick="window._agregarDesdeHistorial(
                    ${sp.productId}, '${sp.productName.replace(/'/g,"\\'")}',
                    '${sp.productSku}', ${sp.lastCost || 0}, ${sp.currentListPrice || 0},
                    '${sp.satClaveUnidad || 'H87'}',
                    '${(sp.productImageUrl||'').replace(/'/g,"\\'")}')">
                ${sp.productImageUrl
                    ? `<img src="${sp.productImageUrl}"
                           style="width:24px;height:24px;object-fit:cover;
                                  border-radius:50%;flex-shrink:0"
                           onerror="this.style.display='none'">`
                    : `<i class="bi bi-plus-circle ms-2"
                           style="font-size:.85rem"></i>`}
                <span style="font-size:.8rem">${sp.productName}</span>
                <span class="text-success" style="font-size:.8rem">
                    $${Number(sp.lastCost||0).toFixed(2)}
                </span>
            </span>`).join('');
    } catch (e) { card.style.display = 'none'; }
}

window._agregarDesdeHistorial = (id, nombre, sku, ultimoCosto, precioVentaActual, claveSat, imagenUrl) => {
    agregarItemCompra(id, nombre, sku, ultimoCosto, claveSat || 'H87', precioVentaActual, imagenUrl);
};

// ─── BUSCAR PRODUCTOS ─────────────────────────────────────────────────────────
async function buscarProductos(termino) {
    const dropdown = document.getElementById('resultados-prod-compra');
    dropdown.innerHTML = `<div class="search-empty">
        <div class="spinner-border spinner-border-sm text-primary"></div></div>`;
    dropdown.classList.add('show');
    try {
        const productos = await fetchAPI(`/products/search?q=${encodeURIComponent(termino)}`);
        if (!productos.length) {
            dropdown.innerHTML = `<div class="search-empty">Sin resultados</div>`;
            return;
        }
        dropdown.innerHTML = productos.map(p => `
            <div class="search-dropdown-item d-flex align-items-center gap-2"
                style="cursor:pointer"
                onclick="window._seleccionarProdCompra(
                    ${p.id}, '${p.name.replace(/'/g,"\\'")}', '${p.sku}',
                    '${p.satClaveUnidad||'H87'}', ${p.price || 0},
                    '${(p.imagenUrl||'').replace(/'/g,"\\'")}')">
                ${p.imagenUrl
                    ? `<img src="${p.imagenUrl}"
                           style="width:36px;height:36px;object-fit:cover;
                                  border-radius:6px;border:1px solid #dee2e6;
                                  flex-shrink:0"
                           onerror="this.style.display='none'">`
                    : `<div style="width:36px;height:36px;background:#f0f0f0;
                                   border-radius:6px;display:flex;
                                   align-items:center;justify-content:center;
                                   flex-shrink:0">
                           <i class="bi bi-image text-muted small"></i>
                       </div>`}
                <div style="flex:1;min-width:0">
                    <div class="item-title">${p.name}</div>
                    <div class="item-sub">
                        ${p.sku} · Stock: ${p.currentStock} ${etiqueta(p.satClaveUnidad)}
                        · Venta actual: $${Number(p.price||0).toFixed(2)}
                    </div>
                </div>
            </div>`).join('');
    } catch (e) {
        dropdown.innerHTML = `<div class="search-empty text-danger">${e.message}</div>`;
    }
}

window._seleccionarProdCompra = (id, nombre, sku, claveSat, precioVentaActual, imagenUrl) => {
    agregarItemCompra(id, nombre, sku, 0, claveSat, precioVentaActual, imagenUrl);
    document.getElementById('resultados-prod-compra').classList.remove('show');
    document.getElementById('buscar-prod-compra').value = '';
};

function agregarItemCompra(id, nombre, sku, costoSugerido, claveSat, precioVentaActual, imagenUrl) {
    const dec = esDecimal(claveSat);
    const existe = itemsCompra.find(i => i.productId === id);
    if (existe) {
        existe.cantidad = parseFloat((existe.cantidad + 1).toFixed(3));
        existe.subtotal = parseFloat((existe.cantidad * existe.costo).toFixed(2));
    } else {
        itemsCompra.push({
            productId: id, nombre, sku,
            cantidad: 1, costo: parseFloat(costoSugerido) || 0,
            subtotal: parseFloat(costoSugerido) || 0,
            precioVenta: null,   // opcional: si se llena, también actualiza el precio de venta
            precioVentaActual: parseFloat(precioVentaActual) || 0, // precio que el producto ya tiene
            claveSat: claveSat || 'H87',
            esDecimal: dec,   // true = acepta fracciones (kg, m, L...); false = solo piezas enteras
            imagenUrl: imagenUrl || null
        });
    }
    renderItemsCompra();
}

// ─── RENDER ITEMS ─────────────────────────────────────────────────────────────
function renderItemsCompra() {
    const tbody = document.getElementById('items-compra-body');
    if (!itemsCompra.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">
            <i class="bi bi-cart fs-3 d-block mb-2 opacity-25"></i>
            Sin productos. Busca arriba para agregar.</td></tr>`;
        actualizarTotalCompra();
        actualizarBotonRegistrar();
        actualizarBarraSeleccionCompra();
        return;
    }
    tbody.innerHTML = itemsCompra.map((item, idx) => {
        const etq = etiqueta(item.claveSat);

        // Caso 1: capturaste precio de venta nuevo, pero quedó por debajo del costo
        const precioNuevoMenorQueCosto = item.precioVenta !== null &&
            item.precioVenta < item.costo;

        // Caso 2: NO capturaste precio nuevo, y el costo nuevo superó el precio
        // de venta que el producto ya tenía — esto bloquea la compra en el backend,
        // así que lo marcamos en rojo aquí mismo para que se note antes de enviar.
        const costoSuperaPrecioActual = item.precioVenta === null &&
            item.precioVentaActual > 0 && item.costo > item.precioVentaActual;

        const hayProblema = precioNuevoMenorQueCosto || costoSuperaPrecioActual;

        return `
        <tr>
            <td class="ps-3">
                <input type="checkbox" class="form-check-input item-compra-check"
                    data-idx="${idx}">
            </td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    ${item.imagenUrl
                        ? `<img src="${item.imagenUrl}"
                               style="width:36px;height:36px;object-fit:cover;
                                      border-radius:6px;border:1px solid #dee2e6;
                                      flex-shrink:0"
                               onerror="this.style.display='none'">`
                        : `<div style="width:36px;height:36px;background:#f0f0f0;
                                       border-radius:6px;display:flex;
                                       align-items:center;justify-content:center;
                                       flex-shrink:0">
                               <i class="bi bi-image text-muted small"></i>
                           </div>`}
                    <div>
                        <div class="fw-bold small">${item.nombre}</div>
                        <small class="text-muted">${item.sku || ''}</small>
                        ${item.precioVentaActual > 0
                            ? `<div class="small text-muted">Venta actual: $${item.precioVentaActual.toFixed(2)}</div>`
                            : ''}
                    </div>
                </div>
            </td>
            <td class="text-center">
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control text-center"
                        step="${item.esDecimal ? '0.001' : '1'}"
                        min="${item.esDecimal ? '0.001' : '1'}"
                        value="${item.esDecimal
                            ? item.cantidad
                            : Math.round(item.cantidad)}"
                        onchange="window._actualizarCantCompra(${idx}, this.value)">
                    <span class="input-group-text">${etq}</span>
                </div>
                ${!item.esDecimal
                    ? `<small class="text-muted d-block mt-1" style="font-size:.65rem">
                           Solo piezas completas
                       </small>` : ''}
            </td>
            <td class="text-end">
                <div class="input-group input-group-sm mb-1
                    ${costoSuperaPrecioActual ? 'border border-danger rounded' : ''}">
                    <span class="input-group-text" title="Costo de compra">$</span>
                    <input type="number" class="form-control text-end"
                        step="0.01" min="0.01" value="${item.costo.toFixed(2)}"
                        onchange="window._actualizarCostoCompra(${idx}, this.value)"
                        title="Costo unitario que pagaste">
                </div>
                <div class="input-group input-group-sm
                    ${precioNuevoMenorQueCosto ? 'border border-danger rounded' : ''}">
                    <span class="input-group-text bg-success-subtle text-success"
                        title="Nuevo precio de venta (opcional)">
                        <i class="bi bi-tag" style="font-size:.7rem"></i>
                    </span>
                    <input type="number" class="form-control text-end"
                        step="0.01" min="0.01"
                        value="${item.precioVenta !== null ? item.precioVenta.toFixed(2) : ''}"
                        placeholder="Sin cambio"
                        onchange="window._actualizarPrecioVentaCompra(${idx}, this.value)"
                        title="Si lo llenas, también actualiza el precio de venta al público">
                </div>
                ${precioNuevoMenorQueCosto ? `
                <small class="text-danger d-block mt-1" style="font-size:.7rem">
                    <i class="bi bi-exclamation-triangle"></i> El precio nuevo es menor al costo
                </small>` : ''}
                ${costoSuperaPrecioActual ? `
                <small class="text-danger d-block mt-1" style="font-size:.7rem">
                    <i class="bi bi-exclamation-triangle"></i>
                    El costo (${item.costo.toFixed(2)}) supera la venta actual
                    (${item.precioVentaActual.toFixed(2)}). Captura un nuevo precio de venta.
                </small>` : ''}
            </td>
            <td class="text-end fw-bold">$${item.subtotal.toFixed(2)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger"
                    onclick="window._eliminarItemCompra(${idx})">
                    <i class="bi bi-trash"></i>

                </button>
            </td>
        </tr>`;
    }).join('');
    actualizarTotalCompra();
    actualizarBotonRegistrar();
    actualizarBarraSeleccionCompra();
}

window._actualizarCantCompra = (idx, val) => {
    const item = itemsCompra[idx];
    const cant = parseFloat(val);
    if (isNaN(cant) || cant <= 0) { renderItemsCompra(); return; }

    // Si el producto se vende por pieza completa, no acepta cantidades fraccionarias
    if (!item.esDecimal && !Number.isInteger(cant)) {
        Swal.fire({ icon:'warning', title:'Solo cantidades enteras',
            text:`"${item.nombre}" se compra por pieza completa, no por fracciones.`,
            timer:2500, showConfirmButton:false });
        renderItemsCompra();
        return;
    }

    item.cantidad = parseFloat(cant.toFixed(3));
    item.subtotal = parseFloat((item.cantidad * item.costo).toFixed(2));
    renderItemsCompra();
};

window._actualizarCostoCompra = (idx, val) => {
    const costo = parseFloat(val);
    if (isNaN(costo) || costo <= 0) { renderItemsCompra(); return; }
    itemsCompra[idx].costo = costo;
    itemsCompra[idx].subtotal = parseFloat((itemsCompra[idx].cantidad * costo).toFixed(2));
    renderItemsCompra();
};

// Campo opcional: si se deja vacío, el precio de venta del producto no cambia.
window._actualizarPrecioVentaCompra = (idx, val) => {
    const valTrim = val.trim();
    if (!valTrim) {
        itemsCompra[idx].precioVenta = null;
        renderItemsCompra();
        return;
    }
    const precio = parseFloat(valTrim);
    if (isNaN(precio) || precio <= 0) {
        Swal.fire({ icon:'warning', title:'Precio inválido',
            text:'El precio de venta debe ser mayor a $0.',
            timer:1800, showConfirmButton:false });
        renderItemsCompra();
        return;
    }
    itemsCompra[idx].precioVenta = precio;
    renderItemsCompra();
};

window._eliminarItemCompra = (idx) => {
    itemsCompra.splice(idx, 1);
    renderItemsCompra();
};

// ─── SELECCIÓN MÚLTIPLE — quitar varios productos de la compra actual ────────
function actualizarBarraSeleccionCompra() {
    const barra = document.getElementById('btn-quitar-seleccionados-compra');
    const cnt   = document.getElementById('cnt-seleccionados-compra');
    const checkTodos = document.getElementById('check-todos-items-compra');
    if (!barra) return;
    const marcados = document.querySelectorAll('.item-compra-check:checked').length;
    cnt.textContent = marcados;
    barra.style.display = marcados ? '' : 'none';
    if (checkTodos) checkTodos.checked =
        itemsCompra.length > 0 && marcados === itemsCompra.length;
}

function configurarSeleccionMultipleCompra() {
    const tbody = document.getElementById('items-compra-body');
    tbody.addEventListener('change', e => {
        if (e.target.classList.contains('item-compra-check')) actualizarBarraSeleccionCompra();
    });
    document.getElementById('check-todos-items-compra').addEventListener('change', e => {
        tbody.querySelectorAll('.item-compra-check').forEach(c => c.checked = e.target.checked);
        actualizarBarraSeleccionCompra();
    });
    document.getElementById('btn-quitar-seleccionados-compra').addEventListener('click', () => {
        const idxs = [...tbody.querySelectorAll('.item-compra-check:checked')]
            .map(c => parseInt(c.dataset.idx))
            .sort((a, b) => b - a);   // de mayor a menor para no correr los índices al hacer splice
        if (!idxs.length) return;
        idxs.forEach(i => itemsCompra.splice(i, 1));
        renderItemsCompra();
    });
}

function actualizarTotalCompra() {
    const total = itemsCompra.reduce((s,i) => s + i.subtotal, 0);
    document.getElementById('total-compra').textContent = `$${total.toFixed(2)}`;
}

function actualizarBotonRegistrar() {
    const btn = document.getElementById('btn-registrar-compra');
    btn.disabled = !(proveedorElegido && itemsCompra.length > 0);
}

// ─── REGISTRAR COMPRA ─────────────────────────────────────────────────────────
async function registrarCompra() {
    if (!proveedorElegido || !itemsCompra.length) return;

    const sinCosto = itemsCompra.filter(i => !i.costo || i.costo <= 0);
    if (sinCosto.length) {
        Swal.fire({ icon:'warning', title:'Falta el costo',
            html: `Estos productos no tienen costo capturado:<br>
                <strong>${sinCosto.map(i => i.nombre).join(', ')}</strong>`,
            confirmButtonText: 'Entendido' });
        return;
    }

    // BLOQUEO DURO: el costo nuevo no puede superar el precio de venta vigente
    // si no se capturó un precio de venta nuevo. A diferencia del caso de abajo,
    // esto no se puede "continuar de todas formas" — hay que corregir el precio.
    const costoSuperaVenta = itemsCompra.filter(i =>
        i.precioVenta === null && i.precioVentaActual > 0 && i.costo > i.precioVentaActual);
    if (costoSuperaVenta.length) {
        Swal.fire({
            icon: 'error',
            title: 'El costo supera el precio de venta',
            html: `Estos productos quedarían vendiéndose a pérdida porque el costo
                   nuevo es mayor a su precio de venta actual:<br><br>
                   ${costoSuperaVenta.map(i =>
                       `<strong>${i.nombre}</strong>: costo $${i.costo.toFixed(2)}
                        vs venta actual $${i.precioVentaActual.toFixed(2)}`).join('<br>')}
                   <br><br>Captura un nuevo precio de venta para estos productos
                   (campo verde con el ícono de etiqueta) antes de registrar la compra.`,
            confirmButtonText: 'Entendido'
        });
        return;
    }

    // Validación: si se capturó precio de venta, no puede ser menor al costo
    const precioMenorCosto = itemsCompra.filter(i =>
        i.precioVenta !== null && i.precioVenta < i.costo);
    if (precioMenorCosto.length) {
        const r = await Swal.fire({
            icon: 'warning',
            title: '¿Precio de venta menor al costo?',
            html: `En estos productos el nuevo precio de venta quedaría
                   por debajo del costo de compra:<br><br>
                   ${precioMenorCosto.map(i =>
                       `<strong>${i.nombre}</strong>: costo $${i.costo.toFixed(2)}
                        vs venta $${i.precioVenta.toFixed(2)}`).join('<br>')}
                   <br><br>Esto significa que venderías a pérdida. ¿Continuar de todas formas?`,
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar así',
            cancelButtonText: 'Corregir precios',
            confirmButtonColor: '#d97706'
        });
        if (!r.isConfirmed) return;
    }

    const total = itemsCompra.reduce((s,i) => s + i.subtotal, 0);
    const itemsConCambioPrecio = itemsCompra.filter(i => i.precioVenta !== null);

    const confirm = await Swal.fire({
        title: '¿Confirmar compra?',
        html: `
            <div class="text-start">
                <p class="mb-1">${itemsCompra.length} producto(s)</p>
                <p class="mb-0">Total: <strong class="text-success fs-5">
                    $${total.toFixed(2)}</strong></p>
                <div class="alert alert-info py-2 small mt-3 mb-0">
                    <i class="bi bi-info-circle me-1"></i>
                    El stock subirá automáticamente y el costo de cada producto
                    se actualizará al precio que indicaste.
                </div>
                ${itemsConCambioPrecio.length ? `
                <div class="alert alert-success py-2 small mt-2 mb-0">
                    <i class="bi bi-tag-fill me-1"></i>
                    También se actualizará el precio de venta de
                    ${itemsConCambioPrecio.length} producto(s):
                    ${itemsConCambioPrecio.map(i =>
                        `${i.nombre} → $${i.precioVenta.toFixed(2)}`).join(', ')}
                </div>` : ''}
            </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg"></i> Sí, registrar',
        cancelButtonText: 'Revisar',
        confirmButtonColor: '#198754'
    });
    if (!confirm.isConfirmed) return;

    const btn = document.getElementById('btn-registrar-compra');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Registrando...';

    try {
        const payload = {
            supplierId: proveedorElegido,
            invoiceNumber: sanitizar(document.getElementById('compra-invoice').value) || null,
            notes: sanitizar(document.getElementById('compra-notes').value) || null,
            items: itemsCompra.map(i => ({
                productId: i.productId,
                quantity: i.cantidad,
                unitCost: i.costo,
                newListPrice: i.precioVenta   // null si no se capturó — el backend no lo toca
            }))
        };
        const orden = await fetchAPI('/purchase-orders', { method:'POST', body:payload });

        await Swal.fire({
            icon: 'success',
            title: '¡Compra registrada!',
            html: `
                <div class="text-start">
                    <div><strong>Folio:</strong>
                        <span class="badge bg-light text-dark border font-monospace ms-1">
                            ${orden.folio}</span>
                    </div>
                    <div><strong>Total:</strong>
                        <span class="text-success fw-bold">$${Number(orden.total).toFixed(2)}</span>
                    </div>
                    <div class="text-muted small mt-2">
                        Stock y costos actualizados.
                    </div>
                </div>`,
            confirmButtonText: 'Continuar', timer: 4000
        });
        limpiarCompra();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo registrar la compra.', 'error');
    } finally {
        const b = document.getElementById('btn-registrar-compra');
        if (b) {
            b.disabled = !(proveedorElegido && itemsCompra.length);
            b.innerHTML = '<i class="bi bi-check-circle"></i> Registrar Compra';
        }
    }
}

function limpiarCompra() {
    itemsCompra = [];
    proveedorElegido = null;
    if (ssProveedor) ssProveedor.clear();
    document.getElementById('info-proveedor-elegido').style.display = 'none';
    document.getElementById('card-historial-proveedor').style.display = 'none';
    document.getElementById('compra-invoice').value = '';
    document.getElementById('compra-notes').value = '';
    renderItemsCompra();
}

// ─── HISTORIAL DE COMPRAS ─────────────────────────────────────────────────────
async function mostrarHistorialCompras() {
    Swal.fire({
        title: '<i class="bi bi-clock-history me-2"></i>Historial de Compras',
        html: `<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>`,
        showConfirmButton: true, confirmButtonText: 'Cerrar',
        confirmButtonColor: '#6c757d', width: '750px',
        didOpen: async () => {
            try {
                const ordenes = await fetchAPI('/purchase-orders/recent');
                if (!ordenes.length) {
                    Swal.update({ html: `<div class="text-center py-4 text-muted">
                        Sin compras registradas aún.</div>` });
                    return;
                }
                Swal.update({ html: `
                    <div style="text-align:left">
                        <table class="table table-sm table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>Folio</th><th>Proveedor</th><th>Fecha</th>
                                    <th class="text-center">Estado</th>
                                    <th class="text-end">Total</th>
                                    <th class="text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ordenes.map(o => `
                                <tr class="${o.status==='CANCELADA'?'opacity-50':''}">
                                    <td><span class="badge bg-light text-dark border font-monospace">
                                        ${o.folio}</span></td>
                                    <td class="small">${o.supplierName}</td>
                                    <td><small>${fmtFecha(o.createdAt)}</small></td>
                                    <td class="text-center">
                                        <span class="badge ${o.status==='RECIBIDA'?'bg-success':'bg-danger'}">
                                            ${o.status}</span>
                                    </td>
                                    <td class="text-end fw-bold">$${Number(o.total).toFixed(2)}</td>
                                    <td class="text-center">
                                        <button class="btn btn-sm btn-outline-info"
                                            onclick="window._verDetalleCompra(${o.id})">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                        ${o.status === 'RECIBIDA' ? `
                                        <button class="btn btn-sm btn-outline-danger"
                                            onclick="window._cancelarCompra(${o.id})">
                                            <i class="bi bi-x-circle"></i>
                                        </button>` : ''}
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` });
            } catch (e) {
                Swal.update({ html: `<div class="alert alert-danger">${e.message}</div>` });
            }
        }
    });
}

window._verDetalleCompra = async (id) => {
    try {
        const o = await fetchAPI(`/purchase-orders/${id}`);
        const items = o.items.map(i => `
            <tr>
                <td>${i.productName}</td>
                <td class="text-center">${i.quantity}</td>
                <td class="text-end">$${Number(i.unitCost).toFixed(2)}</td>
                <td class="text-end fw-bold">$${Number(i.subtotal).toFixed(2)}</td>
            </tr>`).join('');
        Swal.fire({
            title: `Compra ${o.folio}`,
            html: `
                <div style="text-align:left;font-size:14px">
                    <p class="mb-1"><strong>Proveedor:</strong> ${o.supplierName}</p>
                    <p class="mb-3"><strong>Fecha:</strong> ${fmtFecha(o.createdAt)}</p>
                    <table class="table table-sm table-bordered">
                        <thead class="table-light"><tr>
                            <th>Producto</th><th class="text-center">Cant</th>
                            <th class="text-end">Costo</th><th class="text-end">Subtotal</th>
                        </tr></thead>
                        <tbody>${items}</tbody>
                    </table>
                    <div class="text-end fw-bold fs-5">
                        Total: $${Number(o.total).toFixed(2)}
                    </div>
                </div>`,
            confirmButtonText: 'Cerrar', width: '600px'
        });
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

window._cancelarCompra = async (id) => {
    const r = await Swal.fire({
        title: '¿Cancelar esta compra?',
        html: `<textarea id="motivo-cancel-compra" class="form-control" rows="2"
            placeholder="Motivo de la cancelación"></textarea>
            <p class="text-muted small mt-2">El stock que se sumó será descontado.</p>`,
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'No',
        confirmButtonColor: '#dc3545',
        preConfirm: () => {
            const m = document.getElementById('motivo-cancel-compra').value.trim();
            if (!m || m.length < 5) {
                Swal.showValidationMessage('El motivo debe tener al menos 5 caracteres');
                return false;
            }
            return m;
        }
    });
    if (!r.isConfirmed) return;
    try {
        await fetchAPI(`/purchase-orders/${id}/cancel`,
            { method:'PATCH', body:{ reason: r.value } });
        Swal.fire({ icon:'success', title:'Compra cancelada',
            timer:1500, showConfirmButton:false });
        mostrarHistorialCompras();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};