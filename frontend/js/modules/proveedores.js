import { fetchAPI } from '../services/api.js';
import { fmtFecha } from '../services/fechas.js';
import { SearchSelect } from '../services/searchSelect.js';

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

import {
    validarTexto, validarTelefono, validarEmail, validarRFC,
    sanitizar, aplicarFiltroInput, limpiarValidaciones
} from '../services/validaciones.js';

let proveedorModalBS = null;
let editandoId        = null;
let mostrandoActivos  = true;

export async function initProveedores(container) {
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="mb-0 fw-bold">
                    <i class="bi bi-truck me-2"></i>Proveedores
                </h2>
                <p class="text-muted mb-0 small">
                    Empresas a las que les compras mercancía.
                </p>
            </div>
            <button class="btn btn-primary shadow-sm" id="btn-nuevo-proveedor">
                <i class="bi bi-plus-lg"></i> Nuevo Proveedor
            </button>
        </div>

        <div class="row mb-3">
            <div class="col-md-6">
                <div class="search-wrapper">
                    <i class="bi bi-search search-icon"></i>
                    <input type="text" id="input-busqueda-proveedor"
                        class="search-input form-control"
                        placeholder="Buscar por nombre, contacto, teléfono o RFC...">
                </div>
            </div>
        </div>

        <ul class="nav nav-pills mb-3 bg-light p-2 rounded">
            <li class="nav-item">
                <button class="nav-link active" id="tab-prov-activos">
                    <i class="bi bi-check-circle me-1"></i> Activos
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link text-danger" id="tab-prov-inactivos">
                    <i class="bi bi-x-circle me-1"></i> Inactivos
                </button>
            </li>
        </ul>

        <div class="d-flex justify-content-between align-items-center mb-2"
            id="prov-barra-seleccion" style="display:none !important">
            <div class="small"><strong id="prov-cnt-seleccion">0</strong> proveedor(es) seleccionados</div>
            <button class="btn btn-sm btn-outline-danger" id="btn-desactivar-prov-seleccionados">
                <i class="bi bi-slash-circle me-1"></i>Desactivar seleccionados
            </button>
        </div>
        <div class="card shadow-sm border-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-3" style="width:36px">
                                <input type="checkbox" class="form-check-input" id="prov-check-todos">
                            </th>
                            <th>Empresa</th>
                            <th>Contacto</th>
                            <th>Ubicación</th>
                            <th class="text-center">Compras</th>
                            <th class="text-end">Total gastado</th>
                            <th class="text-center pe-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-proveedores-body">
                        <tr><td colspan="7" class="text-center py-5">
                            <div class="spinner-border text-primary"></div>
                        </td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- MODAL PROVEEDOR -->
        <div class="modal fade" id="modalProveedor" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <form id="form-proveedor" class="modal-content border-0 shadow" novalidate>
                    <div class="modal-header bg-light">
                        <h5 class="modal-title" id="titulo-modal-proveedor">
                            Nuevo Proveedor
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row g-3">
                            <div class="col-md-8">
                                <label class="form-label fw-bold small">
                                    Nombre de la Empresa <span class="text-danger">*</span>
                                </label>
                                <input type="text" id="prov-companyName" class="form-control"
                                    placeholder="Ej: Ferretera del Norte SA de CV" maxlength="200"
                                    oninput="window._filtroProv(this,'sinEspeciales')">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-bold small">RFC</label>
                                <input type="text" id="prov-rfc" class="form-control text-uppercase"
                                    placeholder="Opcional" maxlength="13"
                                    oninput="window._filtroProv(this,'rfc')">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-bold small">Persona de Contacto</label>
                                <input type="text" id="prov-contactName" class="form-control"
                                    placeholder="Ej: Juan Pérez" maxlength="150"
                                    oninput="window._filtroProv(this,'sinEspeciales')">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label fw-bold small">Teléfono</label>
                                <input type="text" id="prov-phoneNumber" class="form-control"
                                    placeholder="6671234567" maxlength="10"
                                    oninput="window._filtroProv(this,'telefono')">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label small">Email</label>
                                <input type="text" id="prov-email" class="form-control"
                                    placeholder="opcional@correo.com" maxlength="200">
                            </div>
                            <div class="col-md-8">
                                <label class="form-label small">Dirección</label>
                                <input type="text" id="prov-address" class="form-control"
                                    placeholder="Calle, número, colonia" maxlength="300"
                                    oninput="window._filtroProv(this,'sinEspeciales')">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small">Ciudad</label>
                                <input type="text" id="prov-city" class="form-control"
                                    placeholder="Ej: Guamúchil" maxlength="100"
                                    oninput="window._filtroProv(this,'soloLetras')">
                            </div>
                            <div class="col-12">
                                <label class="form-label small">Notas</label>
                                <textarea id="prov-notes" class="form-control" rows="2"
                                    maxlength="500" placeholder="Ej: entrega los martes y viernes"
                                    oninput="window._filtroProv(this,'sinEspeciales')"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary"
                            data-bs-dismiss="modal">Cancelar</button>
                        <button type="submit" class="btn btn-primary px-4"
                            id="btn-guardar-proveedor">Guardar</button>
                    </div>
                </form>
            </div>
        </div>`;

    window._filtroProv = aplicarFiltroInput;

    proveedorModalBS = new bootstrap.Modal(document.getElementById('modalProveedor'));
    document.getElementById('modalProveedor')
        .addEventListener('hidden.bs.modal', () => limpiarValidaciones('form-proveedor'));

    document.getElementById('btn-nuevo-proveedor').onclick = () => abrirModal();
    document.getElementById('form-proveedor').onsubmit = guardarProveedor;

    document.getElementById('tab-prov-activos').onclick = () => {
        mostrandoActivos = true;
        document.getElementById('tab-prov-activos').classList.add('active');
        document.getElementById('tab-prov-inactivos').classList.remove('active');
        cargarProveedores();
    };
    document.getElementById('tab-prov-inactivos').onclick = () => {
        mostrandoActivos = false;
        document.getElementById('tab-prov-inactivos').classList.add('active');
        document.getElementById('tab-prov-activos').classList.remove('active');
        cargarProveedores();
    };

    let timeout;
    document.getElementById('input-busqueda-proveedor').addEventListener('input', e => {
        clearTimeout(timeout);
        const v = e.target.value.trim();
        timeout = setTimeout(() => v ? buscarProveedores(v) : cargarProveedores(), 300);
    });

    configurarSeleccionMultipleProveedores();
    cargarProveedores();
}

// ─── SELECCIÓN MÚLTIPLE — desactivar varios proveedores de un jalón ──────────
function configurarSeleccionMultipleProveedores() {
    const tabla = document.getElementById('tabla-proveedores-body');
    const barra = document.getElementById('prov-barra-seleccion');
    const cnt   = document.getElementById('prov-cnt-seleccion');
    const checkTodos = document.getElementById('prov-check-todos');

    const actualizar = () => {
        const marcados = tabla.querySelectorAll('.prov-check:checked');
        cnt.textContent = marcados.length;
        barra.style.setProperty('display', marcados.length ? 'flex' : 'none', 'important');
    };

    tabla.addEventListener('change', e => {
        if (e.target.classList.contains('prov-check')) actualizar();
    });
    checkTodos.addEventListener('change', () => {
        tabla.querySelectorAll('.prov-check').forEach(c => c.checked = checkTodos.checked);
        actualizar();
    });
    document.getElementById('btn-desactivar-prov-seleccionados').addEventListener('click', async () => {
        const marcados = [...tabla.querySelectorAll('.prov-check:checked')];
        if (!marcados.length) return;
        const r = await Swal.fire({
            title: `¿Desactivar ${marcados.length} proveedor(es)?`,
            html: `<p class="small mb-0">No aparecerán al registrar nuevas compras.</p>`,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Sí, desactivar', cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
        });
        if (!r.isConfirmed) return;
        try {
            await Promise.all(marcados.map(c =>
                fetchAPI(`/suppliers/${c.value}/active`, { method: 'PATCH', body: { active: false } })));
            checkTodos.checked = false;
            Swal.fire({ icon: 'success', title: `${marcados.length} proveedor(es) desactivados`,
                timer: 1600, showConfirmButton: false });
            cargarProveedores();
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });
}

// ─── CARGAR / BUSCAR ──────────────────────────────────────────────────────────
async function cargarProveedores() {
    const tbody = document.getElementById('tabla-proveedores-body');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5">
        <div class="spinner-border text-primary"></div></td></tr>`;
    try {
        const proveedores = await fetchAPI(`/suppliers?active=${mostrandoActivos}`);
        renderTabla(proveedores);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">
            Error al cargar proveedores.</td></tr>`;
    }
}

async function buscarProveedores(term) {
    try {
        const proveedores = await fetchAPI(
            `/suppliers/search?term=${encodeURIComponent(term)}&active=${mostrandoActivos}`);
        renderTabla(proveedores);
    } catch (e) { console.error(e); }
}

function renderTabla(proveedores) {
    const tbody = document.getElementById('tabla-proveedores-body');
    if (!proveedores.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-5">
            <i class="bi bi-truck fs-1 d-block mb-3 opacity-25"></i>
            ${mostrandoActivos ? 'Sin proveedores activos.' : 'Sin proveedores inactivos.'}
        </td></tr>`;
        return;
    }
    tbody.innerHTML = proveedores.map(p => `
        <tr>
            <td class="ps-3">
                ${mostrandoActivos
                    ? `<input type="checkbox" class="form-check-input prov-check" value="${p.id}">`
                    : ''}
            </td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle bg-warning bg-opacity-10 text-warning fw-bold
                                d-flex align-items-center justify-content-center flex-shrink-0"
                         style="width:36px;height:36px">
                        ${(p.companyName || '?').trim().charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="fw-bold">${p.companyName}</div>
                        ${p.rfc ? `<small class="text-muted font-monospace">${p.rfc}</small>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="small">${p.contactName || '---'}</div>
                <div class="text-muted small">
                    ${p.phoneNumber ? `<i class="bi bi-telephone"></i> ${p.phoneNumber}` : ''}
                </div>
            </td>
            <td class="small text-muted">${p.city || '---'}</td>
            <td class="text-center">
                <span class="badge bg-light text-dark border">${p.totalCompras || 0}</span>
            </td>
            <td class="text-end fw-bold text-success">
                $${Number(p.totalGastado || 0).toFixed(2)}
            </td>
            <td class="text-center pe-3">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-light border"
                        onclick="window.verFichaProveedor(${p.id})"
                        title="Inspeccionar proveedor">
                        <i class="bi bi-eye text-primary"></i>
                    </button>
                    <button class="btn btn-outline-info"
                        onclick="window.verHistorialProveedor(${p.id}, '${escAttr(p.companyName)}')"
                        title="Ver historial de compras">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    <button class="btn btn-outline-primary"
                        onclick="window.editarProveedor(${p.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-${mostrandoActivos ? 'danger' : 'success'}"
                        onclick="window.cambiarEstadoProveedor(${p.id}, ${!mostrandoActivos}, '${escAttr(p.companyName)}')"
                        title="${mostrandoActivos ? 'Desactivar' : 'Reactivar'}">
                        <i class="bi bi-${mostrandoActivos ? 'x-circle' : 'check-circle'}"></i>
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

// ─── ABRIR MODAL ──────────────────────────────────────────────────────────────
async function abrirModal(id = null) {
    document.getElementById('form-proveedor').reset();
    limpiarValidaciones('form-proveedor');
    editandoId = id;

    if (id) {
        document.getElementById('titulo-modal-proveedor').textContent = 'Editar Proveedor';
        try {
            const p = await fetchAPI(`/suppliers/${id}`);
            document.getElementById('prov-companyName').value = p.companyName || '';
            document.getElementById('prov-rfc').value         = p.rfc || '';
            document.getElementById('prov-contactName').value = p.contactName || '';
            document.getElementById('prov-phoneNumber').value = p.phoneNumber || '';
            document.getElementById('prov-email').value       = p.email || '';
            document.getElementById('prov-address').value     = p.address || '';
            document.getElementById('prov-city').value        = p.city || '';
            document.getElementById('prov-notes').value       = p.notes || '';
        } catch (e) {
            Swal.fire('Error', 'No se pudo cargar el proveedor.', 'error'); return;
        }
    } else {
        document.getElementById('titulo-modal-proveedor').textContent = 'Nuevo Proveedor';
    }
    proveedorModalBS.show();
}

// ─── GUARDAR ──────────────────────────────────────────────────────────────────
async function guardarProveedor(e) {
    e.preventDefault();
    limpiarValidaciones('form-proveedor');

    const nombreOk = validarTexto('prov-companyName', {
        label:'Nombre de empresa', minLen:2, maxLen:200, requerido:true, noEspeciales:true
    });

    const contactoVal = document.getElementById('prov-contactName').value.trim();
    const contactoOk  = contactoVal
        ? validarTexto('prov-contactName', {
            label:'Persona de contacto', minLen:2, maxLen:150,
            requerido:false, soloLetras:true
          })
        : true;

    const telVal = document.getElementById('prov-phoneNumber').value.trim();
    const telOk  = telVal ? validarTelefono('prov-phoneNumber', false) : true;

    const emailVal = document.getElementById('prov-email').value.trim();
    const emailOk  = emailVal ? validarEmail('prov-email', false) : true;

    const direccionVal = document.getElementById('prov-address').value.trim();
    const direccionOk  = direccionVal
        ? validarTexto('prov-address', {
            label:'Dirección', minLen:5, maxLen:300,
            requerido:false, noEspeciales:true
          })
        : true;

    const ciudadVal = document.getElementById('prov-city').value.trim();
    const ciudadOk  = ciudadVal
        ? validarTexto('prov-city', {
            label:'Ciudad', minLen:2, maxLen:100,
            requerido:false, soloLetras:true
          })
        : true;

    // RFC: igual que en clientes, valida formato de persona física o moral del SAT
    const rfcVal = document.getElementById('prov-rfc').value.trim();
    const rfcOk  = rfcVal ? validarRFC('prov-rfc', false) : true;

    const notasVal = document.getElementById('prov-notes').value.trim();
    const notasOk  = notasVal
        ? validarTexto('prov-notes', {
            label:'Notas', minLen:0, maxLen:500,
            requerido:false, noEspeciales:true
          })
        : true;

    if (![nombreOk, contactoOk, telOk, emailOk, direccionOk,
          ciudadOk, rfcOk, notasOk].every(Boolean)) {
        Swal.fire({ icon:'warning', title:'Revisa los campos',
            text:'Hay errores marcados en rojo.',
            timer:2500, showConfirmButton:false });
        return;
    }

    const payload = {
        companyName: sanitizar(document.getElementById('prov-companyName').value),
        contactName: sanitizar(contactoVal) || null,
        phoneNumber: telVal || null,
        email:       emailVal || null,
        address:     sanitizar(direccionVal) || null,
        city:        sanitizar(ciudadVal) || null,
        rfc:         rfcVal.toUpperCase() || null,
        notes:       sanitizar(notasVal) || null
    };

    const btn = document.getElementById('btn-guardar-proveedor');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    try {
        await fetchAPI(editandoId ? `/suppliers/${editandoId}` : '/suppliers',
            { method: editandoId ? 'PUT' : 'POST', body: payload });
        Swal.fire({ icon:'success', title:'Guardado',
            timer:1500, showConfirmButton:false });
        proveedorModalBS.hide();
        cargarProveedores();
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar';
    }
}

// ─── ACCIONES GLOBALES ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// FICHA DE INSPECCIÓN DEL PROVEEDOR
// Todo lo que necesitas saber antes de llamarle: sus datos, cuánto le compras,
// qué te surte y a qué costo. Una sola llamada a cada endpoint, en paralelo.
// ══════════════════════════════════════════════════════════════════════════════

const filaDatoProv = (etiqueta, valor) => `
    <div class="d-flex justify-content-between border-bottom py-1">
        <span class="text-muted small">${etiqueta}</span>
        <span class="small fw-bold text-end" style="max-width:60%">${valor || '—'}</span>
    </div>`;

window.verFichaProveedor = async (id) => {
    Swal.fire({
        title: 'Cargando ficha...', showConfirmButton: false, allowOutsideClick: false,
        html: '<div class="spinner-border text-primary"></div>'
    });
    try {
        const [p, ordenes, productos] = await Promise.all([
            fetchAPI(`/suppliers/${id}`),
            fetchAPI(`/purchase-orders/supplier/${id}`).catch(() => []),
            fetchAPI(`/suppliers/${id}/products`).catch(() => [])
        ]);

        const recibidas   = ordenes.filter(o => o.status === 'RECIBIDA');
        const totalGastado = recibidas.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const ultima = recibidas.length
            ? recibidas.reduce((a, b) =>
                new Date(a.createdAt) > new Date(b.createdAt) ? a : b)
            : null;

        // Días desde la última compra: ayuda a ver a quién hace mucho no le compras
        let diasSinComprar = null;
        if (ultima) {
            diasSinComprar = Math.floor(
                (Date.now() - new Date(ultima.createdAt)) / 86400000);
        }

        const tel = (p.phoneNumber || '').replace(/\D/g, '');

        const kpis = `
            <div class="row g-2 mb-3">
                <div class="col-4">
                    <div class="border rounded p-2 text-center">
                        <div class="text-muted" style="font-size:.7rem">COMPRAS</div>
                        <div class="fw-bold">${recibidas.length}</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="border rounded p-2 text-center">
                        <div class="text-muted" style="font-size:.7rem">TOTAL</div>
                        <div class="fw-bold text-success">
                            $${totalGastado.toLocaleString('es-MX', {minimumFractionDigits:2})}</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="border rounded p-2 text-center">
                        <div class="text-muted" style="font-size:.7rem">ÚLTIMA</div>
                        <div class="fw-bold" style="font-size:.85rem">
                            ${ultima ? fmtFecha(ultima.createdAt).split(' ')[0] : '—'}</div>
                    </div>
                </div>
            </div>
            ${diasSinComprar !== null && diasSinComprar > 90
                ? `<div class="alert alert-warning py-2 small mb-3">
                       <i class="bi bi-exclamation-triangle me-1"></i>
                       Hace <strong>${diasSinComprar} días</strong> que no le compras.
                   </div>` : ''}
            ${!ordenes.length
                ? `<div class="alert alert-secondary py-2 small mb-3">
                       Todavía no le has registrado ninguna compra.</div>` : ''}`;

        const listaProductos = productos.length
            ? `<div style="max-height:170px;overflow-y:auto">
                 <table class="table table-sm table-hover mb-0" style="font-size:.8rem">
                   <thead class="table-light"><tr>
                     <th>Producto</th><th class="text-end">Último costo</th><th>Fecha</th>
                   </tr></thead>
                   <tbody>
                     ${productos.map(sp => `
                       <tr>
                         <td>
                            <div class="fw-bold">${sp.productName}</div>
                            <small class="text-muted font-monospace">${sp.productSku}</small>
                            ${sp.supplierSku
                                ? `<small class="text-muted"> · su clave: ${sp.supplierSku}</small>`
                                : ''}
                         </td>
                         <td class="text-end fw-bold">
                            $${Number(sp.lastCost || 0).toFixed(2)}</td>
                         <td><small class="text-muted">
                            ${sp.lastPurchaseAt ? fmtFecha(sp.lastPurchaseAt).split(' ')[0] : '—'}
                         </small></td>
                       </tr>`).join('')}
                   </tbody>
                 </table>
               </div>`
            : `<p class="text-muted small mb-0">
                   Aún no le has comprado ningún producto. Se registran solos
                   al usar "Registrar compra".</p>`;

        const ultimasOrdenes = ordenes.length
            ? `<div style="max-height:150px;overflow-y:auto">
                 <table class="table table-sm mb-0" style="font-size:.8rem">
                   <tbody>
                     ${ordenes.slice(0, 8).map(o => `
                       <tr class="${o.status === 'CANCELADA' ? 'opacity-50' : ''}">
                         <td><span class="badge bg-light text-dark border font-monospace">
                             ${o.folio}</span></td>
                         <td><small>${fmtFecha(o.createdAt)}</small></td>
                         <td><span class="badge ${o.status === 'RECIBIDA' ? 'bg-success' : 'bg-danger'}"
                             style="font-size:.6rem">${o.status}</span></td>
                         <td class="text-end fw-bold">$${Number(o.total).toFixed(2)}</td>
                       </tr>`).join('')}
                   </tbody>
                 </table>
               </div>`
            : '';

        Swal.fire({
            title: p.companyName,
            html: `<div class="text-start">
                <div class="mb-2">
                    ${p.active === false
                        ? '<span class="badge bg-danger">Inactivo</span>'
                        : '<span class="badge bg-success">Activo</span>'}
                    ${p.rfc
                        ? `<span class="badge bg-light text-dark border font-monospace">${p.rfc}</span>`
                        : '<span class="badge bg-light text-muted border">Sin RFC</span>'}
                </div>

                ${kpis}

                <p class="fw-bold small text-uppercase text-muted mb-1">
                    <i class="bi bi-person-lines-fill me-1"></i>Contacto</p>
                ${filaDatoProv('Persona', p.contactName)}
                ${filaDatoProv('Teléfono', p.phoneNumber
                    ? p.phoneNumber + (tel.length >= 10
                        ? ` <a class="btn btn-sm btn-outline-success py-0 px-1 ms-1"
                              target="_blank" href="https://wa.me/52${tel.slice(-10)}">
                              <i class="bi bi-whatsapp"></i></a>` : '')
                    : '')}
                ${filaDatoProv('Email', p.email)}
                ${filaDatoProv('Dirección', p.address)}
                ${filaDatoProv('Ciudad', p.city)}
                ${p.notes
                    ? `<div class="alert alert-light border py-2 mt-2 small mb-0">
                           <i class="bi bi-sticky me-1"></i>${p.notes}</div>` : ''}

                <p class="fw-bold small text-uppercase text-muted mb-1 mt-3">
                    <i class="bi bi-box-seam me-1"></i>Productos que te surte
                    <span class="badge bg-secondary ms-1">${productos.length}</span></p>
                ${listaProductos}

                ${ultimasOrdenes ? `
                    <p class="fw-bold small text-uppercase text-muted mb-1 mt-3">
                        <i class="bi bi-receipt me-1"></i>Últimas compras</p>
                    ${ultimasOrdenes}` : ''}
            </div>`,
            width: '620px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-pencil me-1"></i>Editar',
            cancelButtonText: 'Cerrar'
        }).then(r => { if (r.isConfirmed) window.editarProveedor(id); });

    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.editarProveedor = (id) => abrirModal(id);

window.cambiarEstadoProveedor = async (id, nuevoEstado, nombre) => {
    const r = await Swal.fire({
        title: nuevoEstado ? '¿Reactivar proveedor?' : '¿Desactivar proveedor?',
        text: `"${nombre}" ${nuevoEstado ? 'volverá a estar disponible' : 'no aparecerá en nuevas compras'}.`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: nuevoEstado ? '#198754' : '#dc3545',
        confirmButtonText: nuevoEstado ? 'Sí, reactivar' : 'Sí, desactivar',
        cancelButtonText: 'Cancelar'
    });
    if (!r.isConfirmed) return;
    try {
        await fetchAPI(`/suppliers/${id}/active`,
            { method:'PATCH', body:{ active: nuevoEstado } });
        cargarProveedores();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

window.verHistorialProveedor = async (id, nombre) => {
    Swal.fire({
        title: `<i class="bi bi-clock-history me-2"></i>${nombre}`,
        html: `<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>`,
        showConfirmButton: true, confirmButtonText: 'Cerrar',
        confirmButtonColor: '#6c757d', width: '700px',
        didOpen: async () => {
            try {
                const ordenes = await fetchAPI(`/purchase-orders/supplier/${id}`);
                if (!ordenes.length) {
                    Swal.update({ html: `<div class="text-center py-4 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2 opacity-25"></i>
                        Sin compras registradas a este proveedor.</div>` });
                    return;
                }
                const totalGastado = ordenes
                    .filter(o => o.status === 'RECIBIDA')
                    .reduce((s,o) => s + Number(o.total), 0);

                Swal.update({ html: `
                    <div style="text-align:left">
                        <div class="alert alert-info py-2 mb-3 d-flex justify-content-between">
                            <span>${ordenes.length} orden(es) de compra</span>
                            <strong>Total: $${totalGastado.toFixed(2)}</strong>
                        </div>
                        <table class="table table-sm table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>Folio</th><th>Fecha</th>
                                    <th class="text-center">Estado</th>
                                    <th class="text-end">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ordenes.map(o => `
                                <tr class="${o.status==='CANCELADA'?'opacity-50':''}">
                                    <td><span class="badge bg-light text-dark border font-monospace">
                                        ${o.folio}</span></td>
                                    <td><small>${fmtFecha(o.createdAt)}</small></td>
                                    <td class="text-center">
                                        <span class="badge ${o.status==='RECIBIDA'?'bg-success':'bg-danger'}">
                                            ${o.status}</span>
                                    </td>
                                    <td class="text-end fw-bold">$${Number(o.total).toFixed(2)}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` });
            } catch (e) {
                Swal.update({ html: `<div class="alert alert-danger">${e.message}</div>` });
            }
        }
    });
};