import { fetchAPI } from '../services/api.js';
import { urlImagenCompleta } from '../services/camara.js';
import { fmtFecha } from '../services/fechas.js';
import { SearchSelect } from '../services/searchSelect.js';

export function initPrefacturas(container) {
    container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="mb-0 fw-bold">
                <i class="bi bi-file-earmark-text me-2 text-primary"></i>Pre-Facturas
            </h2>
            <p class="text-muted mb-0 small">
                Prepara y organiza ventas para facturar por separado.
                Ideal para facturas menores a $2,000 en efectivo.
            </p>
        </div>
        <button class="btn btn-primary shadow-sm" id="btn-nueva-prefactura">
            <i class="bi bi-plus-lg"></i> Nueva Pre-Factura
        </button>
    </div>

    <ul class="nav nav-pills mb-4 bg-light p-2 rounded">
        <li class="nav-item">
            <button class="nav-link active" id="tab-pre-activas" type="button">
                <i class="bi bi-hourglass-split"></i> Activas
                <span class="badge bg-primary ms-1" id="badge-pre-activas">0</span>
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="tab-pre-cliente" type="button">
                <i class="bi bi-person-lines-fill"></i> Por Cliente
            </button>
        </li>
    </ul>

    <div id="prefacturas-container"></div>

    <!-- Modal pre-factura -->
    <div class="modal fade" id="prefacturaModal" data-bs-backdrop="static" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-light">
                    <h5 class="modal-title" id="titulo-modal-pre">Nueva Pre-Factura</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label class="form-label fw-bold small">
                                Cliente <span class="text-danger">*</span>
                            </label>
                            <!-- SearchSelect reemplaza el select -->
                            <div class="search-wrapper">
                                <i class="bi bi-person search-icon"></i>
                                <input type="text" class="search-input form-control"
                                    id="input-pre-cliente"
                                    placeholder="Buscar cliente por nombre o RFC...">
                                <div class="search-dropdown" id="dropdown-pre-cliente"></div>
                            </div>
                            <input type="hidden" id="pre-cliente-id">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold small">Notas internas</label>
                            <input type="text" id="pre-notas" class="form-control"
                                placeholder="Ej: Lote 3 de facturación mensual">
                        </div>
                    </div>

                    <!-- Buscador de productos -->
                    <div class="card border-0 bg-light p-3 mb-3">
                        <label class="form-label fw-bold small mb-2">
                            <i class="bi bi-search me-1"></i>Agregar Producto
                        </label>
                        <div class="search-wrapper">
                            <i class="bi bi-box search-icon"></i>
                            <input type="text" class="search-input form-control"
                                id="pre-buscar-prod"
                                placeholder="Buscar por nombre o SKU...">
                            <div class="search-dropdown" id="pre-resultados-prod"></div>
                        </div>
                    </div>

                    <!-- Items -->
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-white fw-bold small py-2">
                            <i class="bi bi-cart3 me-2"></i>Productos en esta pre-factura
                        </div>
                        <div class="table-responsive">
                            <table class="table table-sm align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th class="ps-3">Producto</th>
                                        <th class="text-center" style="width:110px">Cantidad</th>
                                        <th class="text-end" style="width:140px">Precio (c/IVA)</th>
                                        <th class="text-end" style="width:130px">Subtotal</th>
                                        <th style="width:50px"></th>
                                    </tr>
                                </thead>
                                <tbody id="pre-items-body">
                                    <tr>
                                        <td colspan="5" class="text-center text-muted py-4">
                                            <i class="bi bi-cart fs-3 d-block mb-2 opacity-25"></i>
                                            Sin productos. Usa el buscador de arriba.
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot class="table-light">
                                    <tr>
                                        <td colspan="3" class="text-end pe-3 text-muted small">
                                            Subtotal sin IVA:
                                        </td>
                                        <td class="text-end text-muted small" id="pre-subtotal">$0.00</td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td colspan="3" class="text-end pe-3 text-muted small">IVA (16%):</td>
                                        <td class="text-end text-muted small" id="pre-iva">$0.00</td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td colspan="3" class="text-end fw-bold fs-5 pe-3">Total:</td>
                                        <td class="text-end fw-bold fs-5 text-success" id="pre-total">$0.00</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-warning" id="btn-guardar-borrador">
                        <i class="bi bi-floppy"></i> Guardar Borrador
                    </button>
                    <button type="button" class="btn btn-success" id="btn-marcar-lista">
                        <i class="bi bi-check-circle"></i> Marcar como Lista
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    document.getElementById('tab-pre-activas').onclick = () => {
        document.getElementById('tab-pre-activas').classList.add('active');
        document.getElementById('tab-pre-cliente').classList.remove('active');
        renderActivas(document.getElementById('prefacturas-container'));
    };
    document.getElementById('tab-pre-cliente').onclick = () => {
        document.getElementById('tab-pre-cliente').classList.add('active');
        document.getElementById('tab-pre-activas').classList.remove('active');
        renderPorCliente(document.getElementById('prefacturas-container'));
    };

    document.getElementById('btn-nueva-prefactura').onclick = () => abrirModal();
    renderActivas(document.getElementById('prefacturas-container'));
    cargarClientesModal();
}

let itemsModal      = [];
let editandoPreId   = null;
let modalBS         = null;
let ssClienteModal  = null; 
let clientesCache   = [];   

function getModal() {
    if (!modalBS) modalBS = new bootstrap.Modal(document.getElementById('prefacturaModal'));
    return modalBS;
}

async function cargarClientesModal() {
    try {
        clientesCache = await fetchAPI('/customers?active=true');
        ssClienteModal = new SearchSelect({
            input:    document.getElementById('input-pre-cliente'),
            dropdown: document.getElementById('dropdown-pre-cliente'),
            items:    clientesCache.map(c => ({
                id:    c.id,
                label: c.fullName,
                sub:   [c.rfc, c.city].filter(Boolean).join(" · "),
                phone: c.phoneNumber || ""
            })),
            onSelect: (item) => {
                document.getElementById('pre-cliente-id').value = item.id;
            },
            placeholder: 'Buscar cliente por nombre, RFC o teléfono...'
        });
    } catch (e) { console.error('Error cargando clientes:', e); }
}

async function abrirModal(prefactura = null) {
    itemsModal    = [];
    editandoPreId = null;

    document.getElementById('pre-cliente-id').value = '';
    if (ssClienteModal) ssClienteModal.clear();
    document.getElementById('pre-notas').value = '';
    document.getElementById('pre-buscar-prod').value = '';

    document.getElementById('titulo-modal-pre').textContent =
        prefactura ? `Editar — ${prefactura.folio}` : 'Nueva Pre-Factura';

    if (prefactura) {
        editandoPreId = prefactura.id;
        document.getElementById('pre-cliente-id').value = prefactura.customerId;
        if (ssClienteModal) ssClienteModal.setValue(prefactura.customerId);
        document.getElementById('pre-notas').value = prefactura.notes || '';
        itemsModal = prefactura.items.map(i => ({
            productId:   i.productId,
            productName: i.productName,
            productSku:  i.productSku,
            quantity:    i.quantity,
            unitPrice:   Number(i.unitPrice),
            stockMax:    null
        }));
    }

    renderItemsModal();
    iniciarBuscadorProductos();

    document.getElementById('btn-guardar-borrador').onclick = () => guardarPrefactura('BORRADOR');
    document.getElementById('btn-marcar-lista').onclick     = () => guardarPrefactura('LISTA');

    getModal().show();
}

function iniciarBuscadorProductos() {
    const input    = document.getElementById('pre-buscar-prod');
    const dropdown = document.getElementById('pre-resultados-prod');

    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    let timeout;
    newInput.addEventListener('input', async () => {
        clearTimeout(timeout);
        const q = newInput.value.trim();
        if (q.length < 2) { dropdown.classList.remove('show'); return; }

        timeout = setTimeout(async () => {
            dropdown.innerHTML = `<div class="search-empty">
                <div class="spinner-border spinner-border-sm text-primary"></div>
            </div>`;
            dropdown.classList.add('show');

            try {
                const productos = await fetchAPI(`/products/search?q=${encodeURIComponent(q)}`);
                if (!productos.length) {
                    dropdown.innerHTML = `<div class="search-empty">
                        <i class="bi bi-search d-block fs-4 mb-1 opacity-25"></i>Sin resultados
                    </div>`;
                    return;
                }

                dropdown.innerHTML = productos.map(p => {
                    const sinStock = p.currentStock <= 0;
                    const stockClass = p.currentStock > 5 ? 'stock-ok'
                        : p.currentStock > 0 ? 'stock-low' : 'stock-none';
                    return `
                    <div class="search-dropdown-item ${sinStock ? 'opacity-50' : ''}"
                         style="${sinStock ? 'cursor:not-allowed' : 'cursor:pointer'}"
                         ${sinStock ? '' : `onclick="window._preAgregarProducto(
                             ${p.id},'${p.name.replace(/'/g,"\\'")}',
                             '${p.sku}',${p.price},${p.currentStock})"`}>
                        ${p.imagenUrl
                            ? `<img src="${urlImagenCompleta(p.imagenUrl)}" style="width:36px;height:36px;
                                   object-fit:cover;border-radius:6px;flex-shrink:0"
                                   onerror="this.style.display='none'">`
                            : `<div style="width:36px;height:36px;background:#f0f0f0;
                                           border-radius:6px;display:flex;align-items:center;
                                           justify-content:center;flex-shrink:0">
                                   <i class="bi bi-box text-muted small"></i></div>`
                        }
                        <div style="min-width:0;flex:1">
                            <div class="item-title text-truncate">${p.name}</div>
                            <div class="item-sub">${p.sku}</div>
                        </div>
                        <div class="text-end" style="flex-shrink:0">
                            <div class="fw-bold small text-success">$${Number(p.price).toFixed(2)}</div>
                            <span class="badge ${stockClass}">Stock: ${p.currentStock}</span>
                        </div>
                    </div>`;
                }).join('');
            } catch (e) {
                dropdown.innerHTML = `<div class="search-empty text-danger">${e.message}</div>`;
            }
        }, 300);
    });

    newInput.addEventListener('keydown', e => { if (e.key === 'Escape') dropdown.classList.remove('show'); });
    document.addEventListener('click', e => {
        if (!newInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    }, { once: false });
}

window._preAgregarProducto = (id, nombre, sku, precio, stock) => {
    if (stock <= 0) return;
    const existe = itemsModal.find(i => i.productId === id);
    if (existe) {
        if (existe.quantity >= stock) {
            Swal.fire({ icon: 'warning', title: 'Sin más stock',
                text: `Solo hay ${stock} unidad(es) de "${nombre}".`,
                timer: 2000, showConfirmButton: false });
            return;
        }
        existe.quantity++;
    } else {
        itemsModal.push({ productId: id, productName: nombre, productSku: sku,
                          quantity: 1, unitPrice: precio, stockMax: stock });
    }
    renderItemsModal();
    document.getElementById('pre-resultados-prod').classList.remove('show');
    document.getElementById('pre-buscar-prod').value = '';

    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
        background:#16a34a;color:white;padding:.5rem 1rem;border-radius:8px;
        font-size:.85rem;box-shadow:0 4px 12px rgba(0,0,0,.15)`;
    t.innerHTML = `<i class="bi bi-check-circle me-1"></i>${nombre} agregado`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
};

function renderItemsModal() {
    const tbody = document.getElementById('pre-items-body');
    if (!itemsModal.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">
            <i class="bi bi-cart fs-3 d-block mb-2 opacity-25"></i>
            Sin productos. Usa el buscador de arriba.</td></tr>`;
        actualizarTotalesModal();
        return;
    }
    tbody.innerHTML = itemsModal.map((item, idx) => `
        <tr>
            <td class="ps-3">
                <div class="fw-bold small">${item.productName}</div>
                <small class="text-muted">${item.productSku || ''}</small>
                ${item.stockMax != null
                    ? `<span class="badge stock-${item.stockMax > 5 ? 'ok' : item.stockMax > 0 ? 'low' : 'none'} ms-1" style="font-size:.65rem">
                           stock: ${item.stockMax}
                       </span>` : ''}
            </td>
            <td class="text-center">
                <input type="number" class="form-control form-control-sm text-center"
                    style="width:80px;margin:auto" min="1"
                    ${item.stockMax ? `max="${item.stockMax}"` : ''}
                    value="${item.quantity}"
                    onchange="window._preActualizarCantidad(${idx}, this.value)">
            </td>
            <td class="text-end">
                <input type="number" class="form-control form-control-sm text-end"
                    style="width:110px;margin-left:auto"
                    step="0.01" min="0.01" value="${item.unitPrice.toFixed(2)}"
                    onchange="window._preActualizarPrecio(${idx}, this.value)">
            </td>
            <td class="text-end fw-bold">$${(item.quantity * item.unitPrice).toFixed(2)}</td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-danger"
                    onclick="window._preEliminarItem(${idx})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>`).join('');
    actualizarTotalesModal();
}

window._preActualizarCantidad = (idx, val) => {
    const item  = itemsModal[idx];
    const nueva = Math.max(1, parseInt(val) || 1);
    if (item.stockMax != null && nueva > item.stockMax) {
        Swal.fire({ icon: 'warning', title: 'Stock insuficiente',
            text: `Máximo: ${item.stockMax} unidad(es).`, timer: 2000, showConfirmButton: false });
        renderItemsModal(); return;
    }
    item.quantity = nueva;
    renderItemsModal();
};
window._preActualizarPrecio = (idx, val) => {
    itemsModal[idx].unitPrice = Math.max(0.01, parseFloat(val) || 0.01);
    renderItemsModal();
};
window._preEliminarItem = (idx) => { itemsModal.splice(idx, 1); renderItemsModal(); };

function actualizarTotalesModal() {
    const totalConIva = itemsModal.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    const sinIva = totalConIva / 1.16;
    const iva    = totalConIva - sinIva;
    document.getElementById('pre-subtotal').textContent = `$${sinIva.toFixed(2)}`;
    document.getElementById('pre-iva').textContent      = `$${iva.toFixed(2)}`;
    document.getElementById('pre-total').textContent    = `$${totalConIva.toFixed(2)}`;
}

async function guardarPrefactura(statusFinal) {
    const clienteId = document.getElementById('pre-cliente-id').value;
    if (!clienteId) return Swal.fire('Aviso', 'Selecciona un cliente.', 'warning');
    if (!itemsModal.length) return Swal.fire('Aviso', 'Agrega al menos un producto.', 'warning');

    const btnB = document.getElementById('btn-guardar-borrador');
    const btnL = document.getElementById('btn-marcar-lista');
    btnB.disabled = btnL.disabled = true;
    btnB.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    const payload = {
        customerId: parseInt(clienteId),
        notes:      document.getElementById('pre-notas').value.trim() || null,
        items:      itemsModal.map(i => ({
            productId: i.productId, productName: i.productName,
            productSku: i.productSku, quantity: i.quantity, unitPrice: i.unitPrice
        }))
    };

    try {
        let pref = editandoPreId
            ? await fetchAPI(`/prefacturas/${editandoPreId}`, { method: 'PUT', body: payload })
            : await fetchAPI('/prefacturas', { method: 'POST', body: payload });

        if (statusFinal === 'LISTA')
            await fetchAPI(`/prefacturas/${pref.id}/status`, { method: 'PATCH', body: { status: 'LISTA' } });

        getModal().hide();
        Swal.fire({ icon: 'success',
            title: statusFinal === 'LISTA' ? '¡Lista para emitir!' : 'Borrador guardado',
            text: `Folio: ${pref.folio}`, timer: 2000, showConfirmButton: false });
        renderActivas(document.getElementById('prefacturas-container'));
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar.', 'error');
    } finally {
        btnB.disabled = btnL.disabled = false;
        btnB.innerHTML = '<i class="bi bi-floppy"></i> Guardar Borrador';
    }
}

async function renderActivas(container) {
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;
    try {
        const prefacturas = await fetchAPI('/prefacturas');
        document.getElementById('badge-pre-activas').textContent = prefacturas.length;

        if (!prefacturas.length) {
            container.innerHTML = `<div class="text-center py-5 text-muted">
                <i class="bi bi-file-earmark-text fs-1 d-block mb-3 opacity-25"></i>
                No hay pre-facturas activas.</div>`;
            return;
        }

        const porCliente = {};
        prefacturas.forEach(p => {
            if (!porCliente[p.customerId])
                porCliente[p.customerId] = { nombre: p.customerName, rfc: p.customerRfc, items: [] };
            porCliente[p.customerId].items.push(p);
        });

        container.innerHTML = Object.entries(porCliente).map(([cid, data]) => {
            const totalCliente = data.items.reduce((s, p) => s + Number(p.total), 0);
            const listas = data.items.filter(p => p.status === 'LISTA').length;
            return `
            <div class="card shadow-sm border-0 mb-4">
                <div class="card-header bg-white d-flex justify-content-between align-items-center py-3">
                    <div>
                        <i class="bi bi-person-fill text-primary me-2"></i>
                        <strong>${data.nombre}</strong>
                        ${data.rfc ? `<span class="text-muted ms-2 small">${data.rfc}</span>` : ''}
                        <span class="badge bg-secondary ms-2">${data.items.length} pre-factura(s)</span>
                        ${listas ? `<span class="badge bg-success ms-1">${listas} lista(s)</span>` : ''}
                    </div>
                    <span class="badge bg-primary fs-6">Total: $${totalCliente.toFixed(2)}</span>
                </div>
                <div class="card-body p-0">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-3">Folio</th><th>Fecha</th><th>Nota</th>
                                <th class="text-center">Prods.</th>
                                <th class="text-end">Sin IVA</th><th class="text-end">IVA</th>
                                <th class="text-end">Total</th>
                                <th class="text-center">Estado</th>
                                <th class="text-center pe-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${data.items.map(p => filaPreFactura(p)).join('')}</tbody>
                    </table>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

function filaPreFactura(p) {
    const statusBadge = {
        BORRADOR: `<span class="badge bg-secondary">Borrador</span>`,
        LISTA:    `<span class="badge bg-success">Lista</span>`,
        EMITIDA:  `<span class="badge bg-primary">Emitida</span>`,
        CANCELADA:`<span class="badge bg-danger">Cancelada</span>`
    }[p.status] || `<span class="badge bg-secondary">${p.status}</span>`;

    const editable = p.status !== 'EMITIDA' && p.status !== 'CANCELADA';
    const acciones = editable ? `
        <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="window.editarPrefactura(${p.id})" title="Editar">
                <i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-success" onclick="window.cambiarEstadoPre(${p.id},'LISTA')"
                ${p.status === 'LISTA' ? 'disabled' : ''} title="Marcar lista">
                <i class="bi bi-check-circle"></i></button>
            <button class="btn btn-outline-info" onclick="window.imprimirPrefactura(${p.id})" title="Imprimir">
                <i class="bi bi-printer"></i></button>
            <button class="btn btn-outline-danger" onclick="window.cambiarEstadoPre(${p.id},'CANCELADA')" title="Cancelar">
                <i class="bi bi-x-circle"></i></button>
        </div>` :
        `<button class="btn btn-sm btn-outline-info" onclick="window.imprimirPrefactura(${p.id})">
            <i class="bi bi-printer"></i></button>`;

    return `
    <tr class="${p.status === 'CANCELADA' ? 'opacity-50' : ''}">
        <td class="ps-3"><span class="badge bg-light text-dark border font-monospace fw-bold">${p.folio}</span></td>
        <td><small class="text-muted">${fmtFecha(p.createdAt)}</small></td>
        <td><small class="text-muted">${p.notes || '---'}</small></td>
        <td class="text-center"><span class="badge bg-light text-dark border">${p.items?.length || 0}</span></td>
        <td class="text-end text-muted small">$${Number(p.subtotal).toFixed(2)}</td>
        <td class="text-end text-muted small">$${Number(p.taxAmount).toFixed(2)}</td>
        <td class="text-end fw-bold text-success">$${Number(p.total).toFixed(2)}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center pe-3">${acciones}</td>
    </tr>`;
}

async function renderPorCliente(container) {
    container.innerHTML = `
        <div class="card shadow-sm border-0 mb-3">
            <div class="card-body">
                <label class="form-label fw-bold small">Buscar Cliente</label>
                <div class="search-wrapper">
                    <i class="bi bi-person search-icon"></i>
                    <input type="text" class="search-input form-control"
                        id="input-pre-cliente-filtro"
                        placeholder="Escribe nombre, RFC o teléfono...">
                    <div class="search-dropdown" id="dropdown-pre-cliente-filtro"></div>
                </div>
            </div>
        </div>
        <div id="resultado-pre-cliente"></div>`;

    try {
        const clientes = clientesCache.length
            ? clientesCache
            : await fetchAPI('/customers?active=true');

        new SearchSelect({
            input:    document.getElementById('input-pre-cliente-filtro'),
            dropdown: document.getElementById('dropdown-pre-cliente-filtro'),
            items:    clientes.map(c => ({
                id:    c.id,
                label: c.fullName,
                sub:   [c.rfc, c.city].filter(Boolean).join(" · "),
                phone: c.phoneNumber || ""
            })),
            onSelect: async (item) => {
                const res = document.getElementById('resultado-pre-cliente');
                res.innerHTML = `<div class="text-center py-3">
                    <div class="spinner-border spinner-border-sm text-primary"></div>
                    <p class="text-muted small mt-2">Cargando pre-facturas de ${item.label}...</p>
                </div>`;
                try {
                    const prefs = await fetchAPI(`/prefacturas/customer/${item.id}`);
                    if (!prefs.length) {
                        res.innerHTML = `<div class="text-center text-muted py-5">
                            <i class="bi bi-file-earmark fs-1 d-block mb-2 opacity-25"></i>
                            ${item.label} no tiene pre-facturas.</div>`;
                        return;
                    }
                    const totalActivo = prefs
                        .filter(p => p.status !== 'CANCELADA')
                        .reduce((s, p) => s + Number(p.total), 0);
                    const listas = prefs.filter(p => p.status === 'LISTA').length;

                    res.innerHTML = `
                        <div class="alert alert-info py-2 mb-3 d-flex justify-content-between align-items-center">
                            <span>
                                <i class="bi bi-info-circle me-1"></i>
                                <strong>${item.label}</strong> —
                                ${prefs.length} pre-factura(s), ${listas} lista(s)
                            </span>
                            <strong>Total activo: $${totalActivo.toFixed(2)}</strong>
                        </div>
                        <div class="card shadow-sm border-0">
                            <div class="table-responsive">
                                <table class="table table-hover align-middle mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th class="ps-3">Folio</th><th>Fecha</th><th>Nota</th>
                                            <th class="text-end">Total</th>
                                            <th class="text-center">Estado</th>
                                            <th class="text-center pe-3">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${prefs.map(p => `
                                        <tr class="${p.status === 'CANCELADA' ? 'opacity-50' : ''}">
                                            <td class="ps-3">
                                                <span class="badge bg-light text-dark border font-monospace">
                                                    ${p.folio}
                                                </span>
                                            </td>
                                            <td><small class="text-muted">${fmtFecha(p.createdAt)}</small></td>
                                            <td><small>${p.notes || '---'}</small></td>
                                            <td class="text-end fw-bold text-success">
                                                $${Number(p.total).toFixed(2)}
                                            </td>
                                            <td class="text-center">${{
                                                BORRADOR: '<span class="badge bg-secondary">Borrador</span>',
                                                LISTA:    '<span class="badge bg-success">Lista</span>',
                                                EMITIDA:  '<span class="badge bg-primary">Emitida</span>',
                                                CANCELADA:'<span class="badge bg-danger">Cancelada</span>'
                                            }[p.status] || p.status}</td>
                                            <td class="text-center pe-3">
                                                <div class="btn-group btn-group-sm">
                                                    <button class="btn btn-outline-primary"
                                                        onclick="window.editarPrefactura(${p.id})"
                                                        title="Editar">
                                                        <i class="bi bi-pencil"></i>
                                                    </button>
                                                    <button class="btn btn-outline-info"
                                                        onclick="window.imprimirPrefactura(${p.id})"
                                                        title="Imprimir">
                                                        <i class="bi bi-printer"></i>
                                                    </button>
                                                    ${p.status !== 'EMITIDA' && p.status !== 'CANCELADA' ? `
                                                    <button class="btn btn-outline-danger"
                                                        onclick="window.cambiarEstadoPre(${p.id},'CANCELADA')"
                                                        title="Cancelar">
                                                        <i class="bi bi-x-circle"></i>
                                                    </button>` : ''}
                                                </div>
                                            </td>
                                        </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>`;
                } catch (err) {
                    res.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
                }
            },
            placeholder: 'Escribe nombre, RFC o teléfono...'
        });
    } catch (e) { console.error(e); }
}

window.editarPrefactura = async (id) => {
    try { abrirModal(await fetchAPI(`/prefacturas/${id}`)); }
    catch (e) { Swal.fire('Error', e.message, 'error'); }
};

window.cambiarEstadoPre = async (id, estado) => {
    const cfg = {
        LISTA:     { title: '¿Marcar como lista?',    btn: 'Sí, marcar lista', color: '#198754' },
        CANCELADA: { title: '¿Cancelar pre-factura?', btn: 'Sí, cancelar',     color: '#dc3545' },
        EMITIDA:   { title: '¿Marcar como emitida?',  btn: 'Sí, emitir',       color: '#0d6efd' }
    }[estado];
    const r = await Swal.fire({ title: cfg.title, icon: 'question',
        showCancelButton: true, confirmButtonText: cfg.btn,
        cancelButtonText: 'No', confirmButtonColor: cfg.color });
    if (!r.isConfirmed) return;
    try {
        await fetchAPI(`/prefacturas/${id}/status`, { method: 'PATCH', body: { status: estado } });
        Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Estado actualizado' });
        renderActivas(document.getElementById('prefacturas-container'));
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

window.imprimirPrefactura = async (id) => {
    try {
        const p = await fetchAPI(`/prefacturas/${id}`);
        const w = window.open('', '_blank', 'width=520,height=720');
        const itemsHTML = p.items.map(i => `
            <tr>
                <td style="padding:4px 8px">${i.productName}</td>
                <td style="padding:4px 8px;text-align:center">${i.quantity}</td>
                <td style="padding:4px 8px;text-align:right">$${Number(i.unitPrice).toFixed(2)}</td>
                <td style="padding:4px 8px;text-align:right;font-weight:bold">$${Number(i.subtotal).toFixed(2)}</td>
            </tr>`).join('');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>Pre-Factura ${p.folio}</title>
            <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#333}
            table{width:100%;border-collapse:collapse}
            th{background:#f0f0f0;padding:6px 8px;text-align:left;border-bottom:2px solid #ccc}
            td{border-bottom:1px solid #eee}
            @media print{button{display:none}}</style></head><body>
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <div><h1 style="font-size:16px;margin:0">⚙ FerrePOS — Pre-Factura</h1>
                    <div style="color:#666;margin-top:4px"><strong>Folio:</strong> ${p.folio}</div>
                </div>
                <div style="text-align:right;color:#666;font-size:11px">
                    <div><strong>Fecha:</strong> ${fmtFecha(p.createdAt)}</div>
                    <div><strong>Cliente:</strong> ${p.customerName}</div>
                    ${p.customerRfc ? `<div><strong>RFC:</strong> ${p.customerRfc}</div>` : ''}
                </div>
            </div>
            ${p.notes ? `<div style="background:#fffbea;padding:8px;border-radius:4px;margin-bottom:12px;font-size:11px">
                <strong>Nota:</strong> ${p.notes}</div>` : ''}
            <table><thead><tr>
                <th>Producto</th><th style="text-align:center">Cant.</th>
                <th style="text-align:right">P.U.</th><th style="text-align:right">Subtotal</th>
            </tr></thead><tbody>${itemsHTML}</tbody>
            <tfoot>
                <tr style="border-top:1px solid #ccc">
                    <td colspan="3" style="padding:6px 8px;text-align:right;color:#666">Subtotal sin IVA:</td>
                    <td style="padding:6px 8px;text-align:right;color:#666">$${Number(p.subtotal).toFixed(2)}</td>
                </tr>
                <tr>
                    <td colspan="3" style="padding:4px 8px;text-align:right;color:#666">IVA (16%):</td>
                    <td style="padding:4px 8px;text-align:right;color:#666">$${Number(p.taxAmount).toFixed(2)}</td>
                </tr>
                <tr style="border-top:2px solid #333;font-weight:bold;font-size:14px">
                    <td colspan="3" style="padding:8px;text-align:right">TOTAL:</td>
                    <td style="padding:8px;text-align:right;color:#059669">$${Number(p.total).toFixed(2)}</td>
                </tr>
            </tfoot></table>
            <div style="margin-top:20px;font-size:10px;color:#999;text-align:center">
                PRE-FACTURA — Documento interno. No válido como comprobante fiscal.</div>
            <script>window.onload=function(){window.print();setTimeout(()=>window.close(),600)}<\/script>
            </body></html>`);
        w.document.close();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};