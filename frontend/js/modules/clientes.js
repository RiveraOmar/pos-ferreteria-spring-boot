import { fetchAPI } from '../services/api.js';

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
    validarTexto, validarNumero, validarRFC, validarEmail,
    validarTelefono, validarCodigoPostal, validarDescuento,
    validarCostoVsPrecio, sanitizar, aplicarFiltroInput,
    limpiarValidaciones
} from '../services/validaciones.js';

let regimenes = [];
let usosCfdi  = [];
let paises    = [];

// ─── FICHA E INDICADORES ──────────────────────────────────────────────────────

// Facturable REAL: mismos 4 requisitos que valida el timbrado
function faltantesFiscales(c) {
    const faltan = [];
    if (!c.rfc || c.rfc === 'XAXX010101000') faltan.push('RFC');
    if (!c.regimenFiscal) faltan.push('régimen fiscal');
    if (!c.codigoPostal)  faltan.push('C.P. fiscal');
    if (!c.usoCfdi)       faltan.push('uso CFDI');
    return faltan;
}

// Descripciones desde los catálogos SAT ya cargados del backend.
// Llegan como pares [clave, descripción] (ver poblarSelect más abajo).
const buscarEnCatalogo = (catalogo, clave) => {
    const r = (catalogo || []).find(x =>
        (Array.isArray(x) ? x[0] : (x.clave || x.id)) == clave);
    if (!r) return '';
    return Array.isArray(r) ? (r[1] || '') : (r.descripcion || r.nombre || '');
};
const descRegimen = (clave) => buscarEnCatalogo(regimenes, clave);
const descUsoCfdi = (clave) => buscarEnCatalogo(usosCfdi, clave);

const filaDato = (etiqueta, valor) => `
    <div class="d-flex justify-content-between border-bottom py-1">
        <span class="text-muted small">${etiqueta}</span>
        <span class="small fw-bold text-end" style="max-width:60%">${valor || '—'}</span>
    </div>`;

// Modal de INSPECCIÓN: todos los datos del cliente + su saldo en la Libreta
window.verFichaCliente = async (id) => {
    Swal.fire({ title: 'Cargando ficha...', showConfirmButton: false,
        allowOutsideClick: false,
        html: '<div class="spinner-border text-primary"></div>' });
    try {
        const c = await fetchAPI(`/customers/${id}`);

        // Saldo actual en la Libreta de Deudas
        let deudaHtml = '';
        try {
            const deudas = await fetchAPI(`/debts/customer/${id}`);
            const pend = deudas.filter(d => d.status !== 'PAID');
            const saldo = pend.reduce((s, d) => s + Number(d.remainingAmount), 0);
            deudaHtml = pend.length
                ? `<div class="alert alert-danger py-2 d-flex justify-content-between align-items-center mb-2">
                       <span><i class="bi bi-journal-text me-1"></i>
                           Debe <strong>$${saldo.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong>
                           en ${pend.length} nota(s)</span>
                       <button class="btn btn-sm btn-outline-danger"
                           onclick="Swal.close(); window.irALibretaCliente(${id})">
                           Abrir su hoja</button>
                   </div>`
                : `<div class="alert alert-success py-2 mb-2">
                       <i class="bi bi-check-circle me-1"></i>Sin deudas pendientes</div>`;
        } catch (e) { /* módulo de deudas no disponible */ }

        const faltan = faltantesFiscales(c);
        const badgeFiscal = !faltan.length
            ? '<span class="badge bg-success">🧾 Facturable</span>'
            : `<span class="badge bg-secondary" title="Falta: ${faltan.join(', ')}">⚠️ Sin datos fiscales</span>`;
        const tel = (c.phoneNumber || '').replace(/\D/g, '');

        Swal.fire({
            title: c.fullName,
            html: `<div class="text-start">
                <div class="mb-2">
                    <span class="badge bg-info-subtle text-info border">${c.customerType || ''}</span>
                    ${badgeFiscal}
                    ${c.active === false ? '<span class="badge bg-danger">Inactivo</span>' : ''}
                </div>
                ${deudaHtml}
                ${!faltan.length ? '' : `<div class="alert alert-warning py-1 px-2 small mb-2">
                    Para poder facturarle falta: <strong>${faltan.join(', ')}</strong></div>`}

                <p class="fw-bold small text-uppercase text-muted mb-1 mt-2">
                    <i class="bi bi-telephone me-1"></i>Contacto</p>
                ${filaDato('Teléfono', c.phoneNumber
                    ? c.phoneNumber + (tel.length >= 10
                        ? ` <a class="btn btn-sm btn-outline-success py-0 px-1 ms-1"
                              target="_blank" href="https://wa.me/52${tel.slice(-10)}">
                              <i class="bi bi-whatsapp"></i></a>` : '')
                    : '')}
                ${filaDato('Email', c.email)}

                <p class="fw-bold small text-uppercase text-muted mb-1 mt-3">
                    <i class="bi bi-geo-alt me-1"></i>Dirección</p>
                ${filaDato('Calle', c.address)}
                ${filaDato('Ciudad', c.city)}

                <p class="fw-bold small text-uppercase text-muted mb-1 mt-3">
                    <i class="bi bi-receipt me-1"></i>Datos fiscales (SAT)</p>
                ${filaDato('RFC', c.rfc)}
                ${filaDato('Razón social', c.razonSocial)}
                ${filaDato('Régimen', c.regimenFiscal
                    ? c.regimenFiscal + ' — ' + descRegimen(c.regimenFiscal) : '')}
                ${filaDato('Uso CFDI', c.usoCfdi
                    ? c.usoCfdi + ' — ' + descUsoCfdi(c.usoCfdi) : '')}
                ${filaDato('C.P. fiscal', c.codigoPostal)}
                ${filaDato('País', c.satPais)}

                <p class="fw-bold small text-uppercase text-muted mb-1 mt-3">
                    <i class="bi bi-person-badge me-1"></i>Cuenta</p>
                ${filaDato('Descuento', c.discountRate != null
                    ? Number(c.discountRate) + ' %' : '')}
                ${filaDato('Cliente desde', (c.createdAt || '').substring(0, 10))}
            </div>`,
            width: '520px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-pencil me-1"></i>Editar',
            cancelButtonText: 'Cerrar'
        }).then(r => {
            if (r.isConfirmed && !(id === 1 || id === '1')) window.prepararEdicion(id);
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// Deep-link a la Libreta de Deudas (mismo mecanismo que el Dashboard)
window.irALibretaCliente = (clienteId) => {
    sessionStorage.setItem('deudas_abrir_cliente', String(clienteId));
    document.querySelector('#main-menu .nav-link[data-module="deudas"]')?.click();
};

export async function initClientes(container) {
    [regimenes, usosCfdi, paises] = await Promise.all([
        fetchAPI('/sat/regimenes').catch(() => []),
        fetchAPI('/sat/usos-cfdi').catch(() => []),
        fetchAPI('/sat/paises').catch(() => [])
    ]);

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="mb-0 fw-bold"><i class="bi bi-people me-2"></i>Gestión de Clientes</h2>
                <p class="text-muted mb-0 small">Administra clientes activos e inactivos.</p>
            </div>
            <button class="btn btn-primary shadow-sm" id="btn-abrir-modal-nuevo">
                <i class="bi bi-person-plus"></i> Nuevo Cliente
            </button>
        </div>

        <div class="row mb-3">
            <div class="col-md-6">
                <div class="search-wrapper">
                    <i class="bi bi-search search-icon"></i>
                    <input type="text" id="input-busqueda-cliente"
                           class="search-input form-control"
                           placeholder="Buscar por nombre, RFC, teléfono, ciudad o email...">
                </div>
            </div>
        </div>

        <ul class="nav nav-pills mb-3 bg-light p-2 rounded">
            <li class="nav-item">
                <button class="nav-link active fw-bold" id="activos-tab"
                    onclick="cambiarVistaClientes(true)">
                    <i class="bi bi-person-check me-1"></i> Activos
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link text-danger fw-bold" id="inactivos-tab"
                    onclick="cambiarVistaClientes(false)">
                    <i class="bi bi-person-x me-1"></i> Inactivos / Bajas
                </button>
            </li>
        </ul>

        <div class="d-flex justify-content-between align-items-center mb-2"
            id="cli-barra-seleccion" style="display:none !important">
            <div class="small"><strong id="cli-cnt-seleccion">0</strong> cliente(s) seleccionados</div>
            <button class="btn btn-sm btn-outline-danger" id="btn-baja-cli-seleccionados">
                <i class="bi bi-slash-circle me-1"></i>Dar de baja seleccionados
            </button>
        </div>
        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-4" style="width:36px">
                                    <input type="checkbox" class="form-check-input" id="cli-check-todos">
                                </th>
                                <th>Nombre / Razón Social</th>
                                <th>RFC / Ciudad</th>
                                <th>Contacto</th>
                                <th>Tipo</th>
                                <th>Datos Fiscales</th>
                                <th class="text-center pe-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tabla-clientes-body">
                            <tr><td colspan="7" class="text-center py-5 text-muted">
                                <div class="spinner-border text-primary mb-2"></div>
                                <div>Cargando datos...</div>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- MODAL CLIENTE -->
        <div class="modal fade" id="modalCliente" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-primary text-white" id="modal-header-cliente">
                        <h5 class="modal-title" id="modal-titulo">Registrar Nuevo Cliente</h5>
                        <button type="button" class="btn-close btn-close-white"
                            data-bs-dismiss="modal"></button>
                    </div>
                    <form id="form-cliente" novalidate>
                        <input type="hidden" id="cliente-id">
                        <div class="modal-body p-4">

                            <ul class="nav nav-pills mb-4 bg-light p-2 rounded" id="tabs-cliente">
                                <li class="nav-item">
                                    <button class="nav-link active" type="button"
                                        data-tab="tab-general">
                                        <i class="bi bi-person"></i> General
                                    </button>
                                </li>
                                <li class="nav-item">
                                    <button class="nav-link" type="button"
                                        data-tab="tab-fiscal">
                                        <i class="bi bi-receipt"></i> Datos Fiscales
                                        <span class="badge bg-warning text-dark ms-1 small">SAT</span>
                                    </button>
                                </li>
                            </ul>

                            <!-- PESTAÑA GENERAL -->
                            <div id="tab-general" class="tab-cliente-pane">
                                <div class="row g-3">
                                    <div class="col-md-8">
                                        <label class="form-label fw-bold small">
                                            Nombre Completo <span class="text-danger">*</span>
                                        </label>
                                        <input type="text" id="f-fullName" class="form-control"
                                            placeholder="Ej. Juan Pérez López" maxlength="300"
                                            oninput="aplicarFiltroInput(this,'sinEspeciales')">
                                        <div class="form-text">Mínimo 2 caracteres. Sin símbolos especiales.</div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label fw-bold small">RFC</label>
                                        <input type="text" id="f-rfc" class="form-control text-uppercase"
                                            placeholder="XAXX010101000" maxlength="13"
                                            oninput="aplicarFiltroInput(this,'rfc')">
                                        <div class="form-text">12 o 13 caracteres. Solo letras y números.</div>
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label fw-bold small">Dirección</label>
                                        <input type="text" id="f-address" class="form-control"
                                            placeholder="Calle, número y colonia" maxlength="300"
                                            oninput="aplicarFiltroInput(this,'sinEspeciales')">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold small">Ciudad</label>
                                        <input type="text" id="f-city" class="form-control"
                                            placeholder="Ej. Culiacán" maxlength="100"
                                            oninput="aplicarFiltroInput(this,'soloLetras')">
                                        <div class="form-text">Solo letras y espacios.</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold small">
                                            Teléfono <span class="text-danger">*</span>
                                        </label>
                                        <input type="text" id="f-phoneNumber" class="form-control"
                                            placeholder="6671234567" maxlength="10"
                                            oninput="aplicarFiltroInput(this,'telefono')">
                                        <div class="form-text">Exactamente 10 dígitos. Sin espacios ni guiones.</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold small">Email</label>
                                        <input type="text" id="f-email" class="form-control"
                                            placeholder="correo@ejemplo.com" maxlength="200">
                                        <div class="form-text">Opcional. Formato: nombre@dominio.com</div>
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label fw-bold small">Tipo de Cliente</label>
                                        <select id="f-customerType" class="form-select">
                                            <option value="REGULAR">Regular</option>
                                            <option value="MAYOREO">Mayoreo</option>
                                            <option value="VIP">VIP</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label fw-bold small">Descuento (%)</label>
                                        <input type="number" id="f-discountRate" class="form-control"
                                            value="0" step="0.01" min="0" max="100" placeholder="0.00"
                                            oninput="aplicarFiltroInput(this,'decimal')">
                                        <div class="form-text">Entre 0 y 100. Ej: 10.5 = 10.5%</div>
                                    </div>
                                </div>
                            </div>

                            <!-- PESTAÑA FISCAL SAT -->
                            <div id="tab-fiscal" class="tab-cliente-pane" style="display:none">
                                <div class="alert alert-info border-0 small mb-3">
                                    <i class="bi bi-info-circle me-1"></i>
                                    Datos para timbrar facturas CFDI. Dejar vacío si no requiere factura.
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-8">
                                        <label class="form-label fw-bold small">Razón Social</label>
                                        <input type="text" id="f-razonSocial"
                                            class="form-control text-uppercase"
                                            placeholder="Nombre tal como aparece en la constancia fiscal"
                                            maxlength="300"
                                            oninput="this.value=this.value.toUpperCase();aplicarFiltroInput(this,'sinEspeciales')">
                                        <div class="form-text">Igual que en la constancia de situación fiscal.</div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label fw-bold small">
                                            Código Postal (fiscal)
                                        </label>
                                        <input type="text" id="f-codigoPostal" class="form-control"
                                            placeholder="Ej. 80000" maxlength="5"
                                            oninput="aplicarFiltroInput(this,'cp')">
                                        <div class="form-text">5 dígitos exactos.</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold small">Régimen Fiscal</label>
                                        <select id="f-regimenFiscal" class="form-select">
                                            <option value="">-- Seleccione --</option>
                                        </select>
                                        <div class="form-text">Según constancia de situación fiscal.</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold small">Uso del CFDI</label>
                                        <select id="f-usoCfdi" class="form-select">
                                            <option value="">-- Seleccione --</option>
                                        </select>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label fw-bold small">País</label>
                                        <select id="f-satPais" class="form-select">
                                            <option value="">-- Seleccione --</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                        </div>
                        <div class="modal-footer bg-light">
                            <button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-primary px-4"
                                id="btn-guardar-cliente">
                                <i class="bi bi-check-lg"></i> Guardar Cliente
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;

    // Poblar selects SAT
    poblarSelect('f-regimenFiscal', regimenes, r => ({ value: r[0], text: `${r[0]} — ${r[1]}` }));
    poblarSelect('f-usoCfdi',       usosCfdi,  r => ({ value: r[0], text: `${r[0]} — ${r[1]}` }));
    poblarSelect('f-satPais',       paises,    r => ({ value: r[0], text: `${r[0]} — ${r[1]}` }));

    // Tabs del modal
    document.querySelectorAll('#tabs-cliente .nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#tabs-cliente .nav-link')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-cliente-pane')
                .forEach(p => p.style.display = 'none');
            document.getElementById(btn.dataset.tab).style.display = 'block';
        });
    });

    const inputBusqueda = document.getElementById('input-busqueda-cliente');
    const form          = document.getElementById('form-cliente');
    const modalEl       = document.getElementById('modalCliente');
    const bsModal       = new bootstrap.Modal(modalEl);

    window.mostrandoActivos = true;

    // Exponer aplicarFiltroInput globalmente para oninput en HTML
    window.aplicarFiltroInput = aplicarFiltroInput;

    // Limpiar al cerrar modal
    modalEl.addEventListener('hidden.bs.modal', () => limpiarValidaciones('form-cliente'));

    // Búsqueda con debounce
    let timeoutBusqueda;
    inputBusqueda.addEventListener('input', (e) => {
        clearTimeout(timeoutBusqueda);
        const v = e.target.value.trim();
        timeoutBusqueda = setTimeout(() => {
            v.length >= 1 ? buscarClientes(v) : cargarClientes();
        }, 300);
    });

    document.getElementById('btn-abrir-modal-nuevo').addEventListener('click', () => {
        form.reset();
        document.getElementById('cliente-id').value = '';
        limpiarValidaciones('form-cliente');
        resetTabs();
        document.getElementById('modal-titulo').innerText = 'Registrar Nuevo Cliente';
        document.getElementById('modal-header-cliente').className =
            'modal-header bg-primary text-white';
        bsModal.show();
    });

    form.addEventListener('submit', (e) => guardarCliente(e, bsModal));

    window.cambiarVistaClientes = (esActivos) => {
        window.mostrandoActivos = esActivos;
        document.getElementById('activos-tab').classList.toggle('active',  esActivos);
        document.getElementById('inactivos-tab').classList.toggle('active', !esActivos);
        inputBusqueda.value = '';
        cargarClientes();
    };

    window.prepararEdicion   = (id) => cargarDatosCliente(id, bsModal);
    window.confirmarEliminar = (id, nombre) => eliminarCliente(id, nombre);
    window.restaurarCliente  = (id, nombre) => ejecutarRestauracion(id, nombre);

    configurarSeleccionMultipleClientes();
    cargarClientes();
}

// ─── SELECCIÓN MÚLTIPLE — dar de baja varios clientes de un jalón ────────────
// El cliente "Público General" (id 1) nunca aparece con checkbox — misma
// protección que ya tiene la tabla contra editarlo/eliminarlo uno por uno.
function configurarSeleccionMultipleClientes() {
    const tabla = document.getElementById('tabla-clientes-body');
    const barra = document.getElementById('cli-barra-seleccion');
    const cnt   = document.getElementById('cli-cnt-seleccion');
    const checkTodos = document.getElementById('cli-check-todos');

    const actualizar = () => {
        const marcados = tabla.querySelectorAll('.cli-check:checked');
        cnt.textContent = marcados.length;
        barra.style.setProperty('display', marcados.length ? 'flex' : 'none', 'important');
    };

    tabla.addEventListener('change', e => {
        if (e.target.classList.contains('cli-check')) actualizar();
    });
    checkTodos.addEventListener('change', () => {
        tabla.querySelectorAll('.cli-check').forEach(c => c.checked = checkTodos.checked);
        actualizar();
    });
    document.getElementById('btn-baja-cli-seleccionados').addEventListener('click', async () => {
        const marcados = [...tabla.querySelectorAll('.cli-check:checked')];
        if (!marcados.length) return;
        const r = await Swal.fire({
            title: `¿Dar de baja ${marcados.length} cliente(s)?`,
            html: `<p class="small mb-0">Pasarán a la pestaña de inactivos.</p>`,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Sí, dar de baja', cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
        });
        if (!r.isConfirmed) return;
        try {
            await Promise.all(marcados.map(c =>
                fetchAPI(`/customers/${c.value}`, { method: 'DELETE' })));
            checkTodos.checked = false;
            Swal.fire({ icon: 'success', title: `${marcados.length} cliente(s) dados de baja`,
                timer: 1600, showConfirmButton: false });
            cargarClientes();
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
function poblarSelect(id, datos, mapper) {
    const sel = document.getElementById(id);
    if (!sel) return;
    datos.forEach(r => {
        const opt = document.createElement('option');
        const m   = mapper(r);
        opt.value       = m.value;
        opt.textContent = m.text;
        sel.appendChild(opt);
    });
}

function resetTabs() {
    document.querySelectorAll('#tabs-cliente .nav-link').forEach((b, i) =>
        b.classList.toggle('active', i === 0));
    document.querySelectorAll('.tab-cliente-pane').forEach((p, i) =>
        p.style.display = i === 0 ? 'block' : 'none');
}

// ─── CARGAR Y RENDERIZAR ──────────────────────────────────────────────────────
async function cargarClientes() {
    try {
        const clientes = await fetchAPI(`/customers?active=${window.mostrandoActivos}`);
        renderizarTabla(clientes);
    } catch (e) {
        document.getElementById('tabla-clientes-body').innerHTML =
            `<tr><td colspan="7" class="text-danger text-center p-4">
                <i class="bi bi-exclamation-triangle me-2"></i>Error al cargar datos.
             </td></tr>`;
    }
}

async function buscarClientes(termino) {
    try {
        const clientes = await fetchAPI(
            `/customers/search?term=${encodeURIComponent(termino)}&active=${window.mostrandoActivos}`);
        renderizarTabla(clientes);
    } catch (e) { console.error(e); }
}

function renderizarTabla(clientes) {
    const tbody   = document.getElementById('tabla-clientes-body');
    const activos = window.mostrandoActivos;

    if (!clientes?.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="bi bi-search fs-2 d-block mb-2 opacity-25"></i>
            No hay resultados.</td></tr>`;
        return;
    }

    tbody.innerHTML = clientes.map(c => {
        const esPublico = (c.id === 1 || c.id === '1');

        // Facturable REAL (los 4 requisitos del timbrado), con tooltip de lo que falta
        const faltan = faltantesFiscales(c);
        const fiscalBadge = !faltan.length
            ? `<span class="badge bg-success-subtle text-success border small"
                   title="Datos fiscales completos: se le puede facturar">
                   🧾 Facturable</span>`
            : `<span class="badge bg-light text-muted border small"
                   title="Falta: ${faltan.join(', ')}">⚠️ Sin datos fiscales</span>`;

        const btnVer = `<button class="btn btn-sm btn-light border me-1"
                onclick="window.verFichaCliente(${c.id})" title="Inspeccionar cliente">
                <i class="bi bi-eye text-primary"></i>
            </button>`;

        const acciones = btnVer + (activos
            ? (esPublico
                ? `<span class="badge bg-secondary-subtle text-secondary border">
                       <i class="bi bi-lock-fill"></i> Protegido</span>`
                : `<button class="btn btn-sm btn-light border me-1"
                       onclick="prepararEdicion(${c.id})" title="Editar">
                       <i class="bi bi-pencil text-warning"></i>
                   </button>
                   <button class="btn btn-sm btn-light border"
                       onclick="confirmarEliminar(${c.id}, '${escAttr(c.fullName)}')">
                       <i class="bi bi-trash3 text-danger"></i>
                   </button>`)
            : `<button class="btn btn-sm btn-success"
                   onclick="restaurarCliente(${c.id}, '${escAttr(c.fullName)}')">
                   Reactivar</button>`);

        return `
        <tr>
            <td class="ps-4">
                ${(activos && !esPublico)
                    ? `<input type="checkbox" class="form-check-input cli-check" value="${c.id}">`
                    : ''}
            </td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold
                                d-flex align-items-center justify-content-center flex-shrink-0"
                         style="width:36px;height:36px">${(c.fullName || '?').trim().charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="fw-bold">${c.fullName}</div>
                        ${c.razonSocial
                            ? `<small class="text-muted">${c.razonSocial}</small>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="fw-bold text-uppercase small">${c.rfc || '---'}</div>
                <div class="text-muted small">${c.city || '---'}</div>
            </td>
            <td>
                <div class="small">
                    <div><i class="bi bi-envelope me-1"></i>${c.email || '---'}</div>
                    <div class="text-muted">
                        <i class="bi bi-phone me-1"></i>${c.phoneNumber || '---'}
                    </div>
                </div>
            </td>
            <td>
                <span class="badge bg-info-subtle text-info border">${c.customerType}</span>
            </td>
            <td>${fiscalBadge}</td>
            <td class="text-center pe-4">${acciones}</td>
        </tr>`;
    }).join('');
}

// ─── CARGAR PARA EDITAR ───────────────────────────────────────────────────────
async function cargarDatosCliente(id, modal) {
    if (id === 1 || id === '1') {
        Swal.fire('Protegido', 'Este cliente no puede ser editado.', 'info'); return;
    }
    try {
        const c = await fetchAPI(`/customers/${id}`);
        document.getElementById('cliente-id').value      = c.id;
        document.getElementById('f-fullName').value      = c.fullName     || '';
        document.getElementById('f-rfc').value           = c.rfc          || '';
        document.getElementById('f-email').value         = c.email        || '';
        document.getElementById('f-address').value       = c.address      || '';
        document.getElementById('f-city').value          = c.city         || '';
        document.getElementById('f-phoneNumber').value   = c.phoneNumber  || '';
        document.getElementById('f-customerType').value  = c.customerType || 'REGULAR';
        document.getElementById('f-discountRate').value  = c.discountRate || 0;
        document.getElementById('f-razonSocial').value   = c.razonSocial  || '';
        document.getElementById('f-codigoPostal').value  = c.codigoPostal || '';
        document.getElementById('f-regimenFiscal').value = c.regimenFiscal || '';
        document.getElementById('f-usoCfdi').value       = c.usoCfdi      || '';
        document.getElementById('f-satPais').value       = c.satPais      || '';
        limpiarValidaciones('form-cliente');
        resetTabs();
        document.getElementById('modal-titulo').innerText = 'Editar Cliente';
        document.getElementById('modal-header-cliente').className =
            'modal-header bg-warning text-dark';
        modal.show();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// ─── GUARDAR CON VALIDACIONES COMPLETAS ──────────────────────────────────────
async function guardarCliente(e, modal) {
    e.preventDefault();
    limpiarValidaciones('form-cliente');

    // ── Pestaña General ──────────────────────────────────────────────────────
    const nombreOk  = validarTexto('f-fullName', {
        label: 'Nombre completo', minLen: 2, maxLen: 300,
        requerido: true, noEspeciales: true
    });
    const rfcOk     = validarRFC('f-rfc', false);
    const telOk     = validarTelefono('f-phoneNumber', true);
    const emailVal  = document.getElementById('f-email').value.trim();
    const emailOk   = emailVal ? validarEmail('f-email', false) : true;
    const descOk    = validarDescuento('f-discountRate', false);

    // Ciudad solo letras (opcional)
    const ciudadVal = document.getElementById('f-city').value.trim();
    const ciudadOk  = ciudadVal
        ? validarTexto('f-city', {
            label: 'Ciudad', minLen: 2, maxLen: 100,
            requerido: false, soloLetras: true
          })
        : true;

    const erroresGeneral = [nombreOk, rfcOk, telOk, emailOk, descOk, ciudadOk];

    // ── Pestaña SAT ───────────────────────────────────────────────────────────
    const cpVal = document.getElementById('f-codigoPostal').value.trim();
    const cpOk  = cpVal ? validarCodigoPostal('f-codigoPostal', false) : true;

    const razonVal = document.getElementById('f-razonSocial').value.trim();
    const razonOk  = razonVal
        ? validarTexto('f-razonSocial', {
            label: 'Razón social', minLen: 2, maxLen: 300, noEspeciales: true
          })
        : true;

    const erroresFiscal = [cpOk, razonOk];

    // Si hay error en fiscal → mostrar esa pestaña
    if (!erroresFiscal.every(Boolean)) {
        document.querySelectorAll('#tabs-cliente .nav-link')
            .forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-cliente-pane')
            .forEach(p => p.style.display = 'none');
        document.querySelector('[data-tab="tab-fiscal"]').classList.add('active');
        document.getElementById('tab-fiscal').style.display = 'block';
    }

    if (![...erroresGeneral, ...erroresFiscal].every(Boolean)) {
        Swal.fire({ icon: 'warning', title: 'Revisa los campos',
            text: 'Hay errores marcados en rojo.', timer: 2500, showConfirmButton: false });
        return;
    }

    const id = document.getElementById('cliente-id').value;
    const payload = {
        fullName:      sanitizar(document.getElementById('f-fullName').value),
        rfc:           document.getElementById('f-rfc').value.toUpperCase().trim() || null,
        email:         emailVal || null,
        phoneNumber:   document.getElementById('f-phoneNumber').value.replace(/\D/g, ''),
        address:       sanitizar(document.getElementById('f-address').value) || null,
        city:          sanitizar(document.getElementById('f-city').value)    || null,
        customerType:  document.getElementById('f-customerType').value,
        discountRate:  parseFloat(document.getElementById('f-discountRate').value) || 0,
        razonSocial:   sanitizar(document.getElementById('f-razonSocial').value).toUpperCase() || null,
        codigoPostal:  cpVal || null,
        regimenFiscal: document.getElementById('f-regimenFiscal').value || null,
        usoCfdi:       document.getElementById('f-usoCfdi').value       || null,
        satPais:       document.getElementById('f-satPais').value        || null,
    };

    const btn = document.getElementById('btn-guardar-cliente');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    try {
        await fetchAPI(id ? `/customers/${id}` : '/customers',
            { method: id ? 'PUT' : 'POST', body: payload });
        modal.hide();
        Swal.fire({
            icon: 'success',
            title: id ? '¡Cliente actualizado!' : '¡Cliente registrado!',
            timer: 2000, showConfirmButton: false
        });
        cargarClientes();
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar Cliente';
    }
}

// ─── ELIMINAR / RESTAURAR ─────────────────────────────────────────────────────
async function eliminarCliente(id, nombre) {
    if (id === 1 || id === '1') return;
    const r = await Swal.fire({
        title: '¿Dar de baja?',
        text: `"${nombre}" dejará de estar activo.`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, dar de baja',
        cancelButtonText: 'Cancelar'
    });
    if (!r.isConfirmed) return;
    try {
        await fetchAPI(`/customers/${id}`, { method: 'DELETE' });
        Swal.fire({ icon: 'success', title: 'Baja exitosa', timer: 1500, showConfirmButton: false });
        cargarClientes();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function ejecutarRestauracion(id, nombre) {
    const r = await Swal.fire({
        title: '¿Reactivar?',
        text: `"${nombre}" volverá a la lista de activos.`,
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'Sí, reactivar',
        cancelButtonText: 'Cancelar'
    });
    if (!r.isConfirmed) return;
    try {
        await fetchAPI(`/customers/${id}/active?status=true`, { method: 'PUT' });
        Swal.fire({ icon: 'success', title: 'Reactivado', timer: 1500, showConfirmButton: false });
        cargarClientes();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}