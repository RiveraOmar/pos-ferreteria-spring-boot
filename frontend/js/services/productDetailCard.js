import { fetchAPI } from './api.js';
import { fmtFecha } from './fechas.js';
import { urlImagenCompleta } from './camara.js';

// Fotos del producto que se está viendo (para la galería y el zoom)
let fotosFicha = [];

/**
 * Ficha completa de solo lectura para un producto. Reutilizable desde
 * Productos y Ventas — un solo lugar, un solo comportamiento.
 *
 * Uso: import { mostrarFichaProducto } from '../services/productDetailCard.js';
 *      mostrarFichaProducto(productId);
 */
export async function mostrarFichaProducto(productId) {
    fotosFicha = [];   // limpiar las del producto anterior
    Swal.fire({
        title: '<i class="bi bi-card-list me-2"></i>Ficha del Producto',
        html: `<div class="text-center py-4">
            <div class="spinner-border text-primary"></div>
        </div>`,
        showConfirmButton: true,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#6c757d',
        width: '700px',
        didOpen: async () => {
            try {
                // Datos y galería en paralelo (más rápido que uno tras otro)
                const [p, fotos] = await Promise.all([
                    fetchAPI(`/products/${productId}/full-details`),
                    fetchAPI(`/products/${productId}/imagenes`).catch(() => [])
                ]);

                // Si el producto aún no tiene galería, se usa su foto clásica
                fotosFicha = (fotos && fotos.length)
                    ? fotos
                    : (p.imagenUrl ? [{ url: p.imagenUrl, titulo: null }] : []);

                Swal.update({ html: construirHTML(p) });
                activarPestañas();
            } catch (e) {
                Swal.update({
                    html: `<div class="alert alert-danger">
                        No se pudo cargar la ficha: ${e.message}</div>`
                });
            }
        }
    });
}

// SweetAlert2 no ejecuta <script> dentro de html — los listeners se enganchan
// aquí, justo después de Swal.update(), igual que el resto del proyecto.
function activarPestañas() {
    document.querySelectorAll('[data-ficha-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-ficha-tab]')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.ficha-pane')
                .forEach(p => p.style.display = 'none');
            document.getElementById('ficha-pane-' + btn.dataset.fichaTab)
                .style.display = 'block';
        });
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// GALERÍA DE LA FICHA
// Foto grande + tira de miniaturas. Un clic en la grande la abre a pantalla
// completa (para ver especificaciones, letras chiquitas de la etiqueta, etc.).
// ══════════════════════════════════════════════════════════════════════════════

function galeriaFichaHTML() {
    if (!fotosFicha.length) {
        return `<div style="width:150px;height:150px;background:#f0f0f0;
                            border-radius:10px;display:flex;align-items:center;
                            justify-content:center;flex-shrink:0">
                    <i class="bi bi-image text-muted fs-1 opacity-50"></i>
                </div>`;
    }

    const principal = fotosFicha[0];

    return `
    <div style="flex-shrink:0;width:150px">
        <div style="position:relative">
            <img id="ficha-img-grande"
                 src="${urlImagenCompleta(principal.url)}"
                 title="Clic para ver en grande"
                 onclick="window.fichaZoom()"
                 style="width:150px;height:150px;object-fit:contain;
                        background:#fff;border-radius:10px;border:1px solid #dee2e6;
                        cursor:zoom-in;display:block"
                 onerror="this.style.opacity=.3">
            <span style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.6);
                         color:#fff;border-radius:6px;padding:1px 6px;font-size:.65rem;
                         pointer-events:none">
                <i class="bi bi-zoom-in"></i>
            </span>
        </div>

        <div id="ficha-img-titulo" class="text-center text-truncate mt-1"
             style="font-size:.7rem;color:#6c757d;min-height:1em">
            ${principal.titulo || ''}
        </div>

        ${fotosFicha.length > 1 ? `
            <div class="d-flex gap-1 flex-wrap mt-1">
                ${fotosFicha.map((f, i) => `
                    <img src="${urlImagenCompleta(f.url)}"
                         class="ficha-thumb"
                         data-idx="${i}"
                         title="${f.titulo || 'Foto ' + (i + 1)}"
                         onclick="window.fichaVerFoto(${i})"
                         style="width:33px;height:33px;object-fit:cover;border-radius:5px;
                                cursor:pointer;border:2px solid ${i === 0 ? '#d97706' : '#dee2e6'}">
                `).join('')}
            </div>
            <div class="text-center mt-1" style="font-size:.65rem;color:#adb5bd">
                ${fotosFicha.length} fotos
            </div>` : ''}
    </div>`;
}

// Cambiar la foto grande al tocar una miniatura
window.fichaVerFoto = (i) => {
    const f = fotosFicha[i];
    if (!f) return;
    const grande = document.getElementById('ficha-img-grande');
    if (grande) {
        grande.src = urlImagenCompleta(f.url);
        grande.dataset.idx = i;
    }
    const titulo = document.getElementById('ficha-img-titulo');
    if (titulo) titulo.textContent = f.titulo || '';
    document.querySelectorAll('.ficha-thumb').forEach(t => {
        t.style.borderColor = (Number(t.dataset.idx) === i) ? '#d97706' : '#dee2e6';
    });
};

// Ver la foto a pantalla completa, con flechas si hay varias
window.fichaZoom = () => {
    const grande = document.getElementById('ficha-img-grande');
    let idx = Number(grande?.dataset.idx || 0);
    if (!fotosFicha[idx]) idx = 0;

    const overlay = document.createElement('div');
    overlay.style.cssText =
        'position:fixed;inset:0;z-index:30000;background:rgba(0,0,0,.94);' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem';

    const pintar = () => {
        const f = fotosFicha[idx];
        overlay.innerHTML = `
            <img src="${urlImagenCompleta(f.url)}"
                 style="max-width:96vw;max-height:80vh;object-fit:contain;
                        border-radius:8px;background:#fff">
            <div style="color:#fff;margin-top:.75rem;text-align:center">
                <div style="font-weight:600">${f.titulo || ''}</div>
                <small style="opacity:.7">${idx + 1} de ${fotosFicha.length}</small>
            </div>
            ${fotosFicha.length > 1 ? `
                <button id="zoom-prev" class="btn btn-light"
                    style="position:absolute;left:1rem;top:50%;transform:translateY(-50%)">
                    <i class="bi bi-chevron-left"></i></button>
                <button id="zoom-next" class="btn btn-light"
                    style="position:absolute;right:1rem;top:50%;transform:translateY(-50%)">
                    <i class="bi bi-chevron-right"></i></button>` : ''}
            <button id="zoom-cerrar" class="btn btn-light"
                style="position:absolute;top:1rem;right:1rem">
                <i class="bi bi-x-lg"></i></button>`;

        overlay.querySelector('#zoom-cerrar').onclick = cerrar;
        const prev = overlay.querySelector('#zoom-prev');
        const next = overlay.querySelector('#zoom-next');
        if (prev) prev.onclick = (e) => {
            e.stopPropagation();
            idx = (idx - 1 + fotosFicha.length) % fotosFicha.length;
            pintar();
        };
        if (next) next.onclick = (e) => {
            e.stopPropagation();
            idx = (idx + 1) % fotosFicha.length;
            pintar();
        };
    };

    const cerrar = () => {
        overlay.remove();
        document.removeEventListener('keydown', teclas);
    };
    const teclas = (e) => {
        if (e.key === 'Escape') cerrar();
        if (e.key === 'ArrowLeft')  { idx = (idx - 1 + fotosFicha.length) % fotosFicha.length; pintar(); }
        if (e.key === 'ArrowRight') { idx = (idx + 1) % fotosFicha.length; pintar(); }
    };

    overlay.onclick = (e) => { if (e.target === overlay) cerrar(); };
    document.addEventListener('keydown', teclas);
    document.body.appendChild(overlay);
    pintar();
};

function construirHTML(p) {
    const stockClass = p.currentStock <= 0 ? 'stock-none'
        : p.currentStock <= (p.minStockLevel || 0) ? 'stock-low' : 'stock-ok';

    const atributosHTML = p.attributes && Object.keys(p.attributes).length
        ? `<table class="table table-sm table-borderless mb-0">
               ${Object.entries(p.attributes).map(([k, v]) => `
                   <tr>
                       <td class="text-muted small" style="width:40%">${k}</td>
                       <td class="fw-bold small">${v}</td>
                   </tr>`).join('')}
           </table>`
        : `<p class="text-muted small mb-0">Sin atributos registrados.</p>`;

    const satCompleto = p.satClaveProdServ && p.satClaveUnidad && p.satObjetoImp;

    const historialHTML = p.priceHistory && p.priceHistory.length
        ? p.priceHistory.slice(0, 8).map(h => {
            const icono = h.direction === 'SUBIO'
                ? '<i class="bi bi-arrow-up-circle text-danger"></i> Subió'
                : h.direction === 'BAJO'
                    ? '<i class="bi bi-arrow-down-circle text-success"></i> Bajó'
                    : '<i class="bi bi-dash-circle text-muted"></i> Ajuste';
            return `<div class="d-flex justify-content-between align-items-center
                        py-2 border-bottom small">
                        <span>${icono}</span>
                        <span class="text-muted">${fmtFecha(h.changeDate)}</span>
                    </div>`;
        }).join('')
        : `<p class="text-muted small mb-0">Sin cambios de precio registrados.</p>`;

    const proveedoresHTML = p.suppliers && p.suppliers.length
        ? p.suppliers.map(s => `
            <div class="d-flex justify-content-between align-items-center
                py-2 border-bottom small">
                <div>
                    <div class="fw-bold">${s.companyName}</div>
                    ${s.phoneNumber
                        ? `<div class="text-muted"><i class="bi bi-telephone"></i> ${s.phoneNumber}</div>`
                        : ''}
                    ${s.supplierSku
                        ? `<div class="text-muted">Código proveedor: ${s.supplierSku}</div>`
                        : ''}
                </div>
                <span class="text-muted small">
                    ${s.lastPurchaseAt ? fmtFecha(s.lastPurchaseAt) : '---'}
                </span>
            </div>`).join('')
        : `<p class="text-muted small mb-0">
               Ningún proveedor registrado para este producto todavía.
               Se registran automáticamente al comprarle en "Registrar Compra".
           </p>`;

    return `
        <div style="text-align:left;font-size:14px">

            <!-- Encabezado: imagen + datos principales -->
            <div class="d-flex gap-3 mb-3">
                ${galeriaFichaHTML()}
                <div style="flex:1;min-width:0">
                    <h5 class="mb-1">${p.name}</h5>
                    <div class="d-flex flex-wrap gap-2 mb-1">
                        <span class="badge bg-light text-dark border font-monospace">
                            ${p.sku}
                        </span>
                        ${p.category
                            ? `<span class="badge bg-light text-dark border">
                                   <i class="bi bi-tag"></i> ${p.category.name}
                               </span>` : ''}
                        ${p.active
                            ? `<span class="badge bg-success-subtle text-success border">Activo</span>`
                            : `<span class="badge bg-danger-subtle text-danger border">Inactivo</span>`}
                    </div>
                    <div class="d-flex align-items-center gap-3 mt-2">
                        <span class="fs-5 fw-bold text-success">$${Number(p.price).toFixed(2)}</span>
                        <span class="badge ${stockClass}">
                            ${p.currentStock} ${p.unitLabel}
                        </span>
                        ${p.allowDecimal
                            ? `<span class="badge bg-light text-muted border small">fraccionable</span>`
                            : ''}
                    </div>
                    <div class="d-flex flex-wrap gap-3 mt-2 small text-muted">
                        ${p.locationRack
                            ? `<span><i class="bi bi-geo-alt me-1"></i>${p.locationRack}</span>`
                            : ''}
                        ${p.barcode
                            ? `<span><i class="bi bi-upc-scan me-1"></i>${p.barcode}</span>`
                            : ''}
                    </div>
                </div>
            </div>

            ${(p.createdAt || p.updatedAt) ? `
            <div class="d-flex justify-content-between text-muted mb-3"
                style="font-size:11px">
                ${p.createdAt
                    ? `<span>Alta: ${fmtFecha(p.createdAt)}</span>` : '<span></span>'}
                ${p.updatedAt
                    ? `<span>Última edición: ${fmtFecha(p.updatedAt)}</span>` : ''}
            </div>` : ''}

            ${p.description ? `
            <div class="alert alert-light border small py-2 mb-3">
                ${p.description}
            </div>` : ''}

            <!-- Pestañas internas -->
            <ul class="nav nav-pills nav-fill mb-3 bg-light p-1 rounded" id="ficha-tabs">
                <li class="nav-item">
                    <button class="nav-link active small py-1" type="button" data-ficha-tab="atributos">
                        <i class="bi bi-list-ul"></i> Atributos
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link small py-1" type="button" data-ficha-tab="sat">
                        <i class="bi bi-receipt"></i> SAT
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link small py-1" type="button" data-ficha-tab="historial">
                        <i class="bi bi-clock-history"></i> Historial
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link small py-1" type="button" data-ficha-tab="proveedores">
                        <i class="bi bi-truck"></i> Proveedores
                    </button>
                </li>
            </ul>

            <div id="ficha-pane-atributos" class="ficha-pane" style="max-height:240px;overflow-y:auto">
                ${atributosHTML}
            </div>

            <div id="ficha-pane-sat" class="ficha-pane" style="display:none">
                ${satCompleto ? `
                <table class="table table-sm table-borderless mb-0">
                    <tr>
                        <td class="text-muted small" style="width:45%">Clave Producto/Servicio</td>
                        <td class="fw-bold small font-monospace">${p.satClaveProdServ}</td>
                    </tr>
                    <tr>
                        <td class="text-muted small">Unidad de Medida</td>
                        <td class="fw-bold small font-monospace">${p.satClaveUnidad} (${p.unitLabel})</td>
                    </tr>
                    <tr>
                        <td class="text-muted small">Objeto de Impuesto</td>
                        <td class="fw-bold small font-monospace">${p.satObjetoImp}</td>
                    </tr>
                </table>` : `
                <div class="alert alert-warning border-0 small mb-0">
                    <i class="bi bi-exclamation-triangle me-1"></i>
                    Este producto no tiene datos SAT completos. No podrá facturarse hasta completarlos
                    en el modal de edición.
                </div>`}
            </div>

            <div id="ficha-pane-historial" class="ficha-pane"
                style="display:none;max-height:240px;overflow-y:auto">
                ${historialHTML}
            </div>

            <div id="ficha-pane-proveedores" class="ficha-pane"
                style="display:none;max-height:240px;overflow-y:auto">
                ${proveedoresHTML}
            </div>
        </div>
    `;
}