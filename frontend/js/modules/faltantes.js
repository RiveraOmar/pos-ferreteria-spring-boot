// ═════════════════════════════════════════════════════════════════════════════
//  FALTANTES — módulo propio (separado de Productos)
//  Todo lo que necesitas para decidir qué reabastecer, en una sola vista:
//  foto, costo, precio de venta, cuánto hay y cuánto falta.
// ═════════════════════════════════════════════════════════════════════════════
import { fetchAPI }        from '../services/api.js';
import { urlImagenCompleta } from '../services/camara.js';

// Mismo mapa de unidades que usa Productos/Ventas (para mostrar "12 pza",
// "3.5 kg", etc. en vez del número solo)
const UNIDADES_DECIMALES = new Set([
    'MTR','KGM','GRM','LTR','MLT','CMT','MTK','DMT','DMQ','HLT','TNE','MGM','H87P'
]);
const ETIQUETA_UNIDAD = {
    H87:'pza', SET:'juego', KT:'kit', PR:'par', BX:'caja',
    MTR:'m', CMT:'cm', MMT:'mm', MTK:'m²',
    KGM:'kg', GRM:'g', MGM:'mg', TNE:'ton',
    LTR:'L', MLT:'mL', HLT:'hL',
};
function etiquetaUnidad(clave) { return ETIQUETA_UNIDAD[(clave||'').toUpperCase()] || 'pza'; }

export async function initFaltantes(container) {
    inyectarEstiloLibretaFaltantes();
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
                <h2 class="mb-0 fw-bold text-danger">
                    <i class="bi bi-cart-dash me-2"></i>Faltantes
                </h2>
                <p class="text-muted mb-0 small">Qué reabastecer del catálogo, y lo que apuntes a mano.</p>
            </div>
            <button class="btn btn-outline-secondary btn-sm" id="btn-refrescar-faltantes">
                <i class="bi bi-arrow-clockwise me-1"></i>Actualizar
            </button>
        </div>

        <ul class="nav nav-pills mb-3" id="falt-tabs" style="gap:6px">
            <li class="nav-item">
                <button type="button" class="nav-link active" data-falt-tab="catalogo">
                    <i class="bi bi-boxes me-1"></i>Faltantes del catálogo
                </button>
            </li>
            <li class="nav-item">
                <button type="button" class="nav-link" data-falt-tab="libreta">
                    <i class="bi bi-journal-text me-1"></i>Libreta de apuntes
                </button>
            </li>
        </ul>

        <!-- PANEL 1: faltantes reales del catálogo -->
        <div id="falt-panel-catalogo">
            <div class="mb-3">
                <input type="text" id="filtro-faltantes" class="form-control"
                    placeholder="Buscar dentro de los faltantes (nombre, SKU, código Truper)...">
            </div>
            <div class="card border-0 shadow-sm">
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-3" style="width:64px">Foto</th>
                                <th>Producto</th>
                                <th class="text-end">Costo</th>
                                <th class="text-end">Precio de venta</th>
                                <th class="text-center">Cantidad en almacén</th>
                                <th class="text-center">Mínimo requerido</th>
                                <th class="text-center">Te faltan</th>
                                <th class="text-center" style="width:105px">¿Ya se pidió?</th>
                                <th class="text-center pe-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tabla-faltantes-body">
                            <tr><td colspan="9" class="text-center py-5">
                                <div class="spinner-border text-danger"></div>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- PANEL 2: libreta de apuntes — cosas que faltan pero NO están
             dadas de alta como producto. Para encargar, preguntar, o
             simplemente no olvidar. -->
        <div id="falt-panel-libreta" style="display:none">
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body">
                    <label class="form-label fw-bold small mb-1">
                        <i class="bi bi-pencil-fill me-1"></i>Nueva nota
                    </label>
                    <div class="d-flex gap-2">
                        <input type="text" id="nueva-nota-falt" class="form-control"
                            maxlength="300"
                            placeholder="Ej: Encargarle a Beto tornillos hexagonales 1/4 — no los tenemos dados de alta">
                        <button class="btn btn-dark px-3" id="btn-agregar-nota-falt">
                            <i class="bi bi-plus-lg"></i>
                        </button>
                    </div>
                    <div class="form-text">Presiona Enter o el botón para anotarla.</div>
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center mb-2">
                <small class="text-muted"><i class="bi bi-clock-history me-1"></i>Más nueva arriba</small>
                <button class="btn btn-sm btn-outline-secondary" id="btn-ver-resueltas-falt">
                    <i class="bi bi-eye me-1"></i>Ver resueltas
                </button>
            </div>
            <div class="nb-papel-falt" id="lista-notas-faltantes">
                <div class="text-center text-muted py-4">
                    <div class="spinner-border spinner-border-sm text-danger"></div>
                </div>
            </div>
        </div>`;

    document.getElementById('btn-refrescar-faltantes').onclick = () =>
        pestanaFaltActiva === 'catalogo' ? cargarFaltantes() : cargarNotasFaltantes();
    document.getElementById('filtro-faltantes').addEventListener('input', e => {
        const normalizar = texto => String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const q = normalizar(e.target.value);

document.querySelectorAll('#tabla-faltantes-body tr[data-nombre]').forEach(tr => {
    tr.style.display =
        normalizar(tr.dataset.nombre).includes(q) ? '' : 'none';
});
    });

    document.querySelectorAll('#falt-tabs [data-falt-tab]').forEach(btn => {
        btn.addEventListener('click', () => activarPestanaFaltantes(btn.dataset.faltTab));
    });

    document.getElementById('btn-agregar-nota-falt').addEventListener('click', agregarNotaFaltante);
    document.getElementById('nueva-nota-falt').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); agregarNotaFaltante(); }
    });
    document.getElementById('btn-ver-resueltas-falt').addEventListener('click', () => {
        mostrarResueltasFalt = !mostrarResueltasFalt;
        document.getElementById('btn-ver-resueltas-falt').innerHTML = mostrarResueltasFalt
            ? '<i class="bi bi-eye-slash me-1"></i>Ocultar resueltas'
            : '<i class="bi bi-eye me-1"></i>Ver resueltas';
        renderNotasFaltantes();
    });

    // ── Botón "Abastecer" de cada renglón, por DELEGACIÓN ──────────────────
    // Antes iba con onclick= en el HTML, metiendo el nombre del producto
    // dentro del atributo. Con la tornillería eso truena: un nombre como
    //     Tornillo hexagonal G5 1/4" x 1/2"
    // trae comillas DOBLES, que cierran el atributo a media instrucción y
    // dejan el botón muerto — sin error visible, simplemente no hace nada.
    // Con data- attributes el nombre viaja escapado y no puede romper nada.
    document.getElementById('tabla-faltantes-body')
        .addEventListener('click', async e => {
            const btn = e.target.closest('button[data-abastecer]');
            if (!btn) return;
            const ok = await asegurarRestock();
            if (!ok) return;
            window.abrirRestock(
                Number(btn.dataset.id),
                btn.dataset.nombre,
                Number(btn.dataset.stock),
                Number(btn.dataset.precio),
                btn.dataset.unidad
            );
        });

    // Switch "Ya se pidió" — guarda en localStorage
    document.getElementById('tabla-faltantes-body')
        ?.addEventListener('change', e => {
            const sw = e.target.closest('.falt-sw-pedido');
            if (!sw) return;
            const id    = Number(sw.dataset.prodId);
            const fila  = sw.closest('tr');
            const label = fila.querySelector(`label[for="fsw-${id}"]`);
            const tipo  = fila.dataset.tipo || 'bajo';
            const set   = pedidosGuardados();

            if (sw.checked) {
                set.add(id);
                fila.className = 'falt-row-pedido';
                // Quitar rojo del botón si era urgente
                const btnR = fila.querySelector('.btn-danger');
                if (btnR) btnR.classList.replace('btn-danger', 'btn-outline-success');
                if (label) { label.textContent = 'Pedido ✓'; label.style.color = '#15803D'; }
            } else {
                set.delete(id);
                fila.className = tipo === 'agotado' ? 'falt-row-agotado' : 'falt-row-bajo';
                const btnG = fila.querySelector('.btn-outline-success');
                if (btnG && tipo === 'agotado')
                    btnG.classList.replace('btn-outline-success', 'btn-danger');
                if (label) { label.textContent = 'No pedido'; label.style.color = '#9CA3AF'; }
            }
            guardarPedidos(set);
        });

    // Al surtir, limpiar la marca y recargar
    window.onRestockSuccess = (productId) => {
        if (productId) limpiarPedido(productId);
        if (pestanaFaltActiva === 'catalogo') cargarFaltantes();
    };

    cargarFaltantes();
}

// ─── El modal de reabastecer vive en productos.js ───────────────────────────
// Ese módulo define window.abrirRestock al cargarse. Si el usuario entró
// DIRECTO a Faltantes sin pasar por Productos, la función podría no existir
// todavía. En vez de fallar en silencio, se carga el módulo al vuelo.
async function asegurarRestock() {
    if (typeof window.abrirRestock === 'function') return true;
    try {
        await import('./productos.js');
    } catch (e) {
        console.error('No se pudo cargar el módulo de productos:', e);
    }
    if (typeof window.abrirRestock === 'function') return true;
    Swal.fire({
        icon: 'error',
        title: 'No se pudo abrir',
        html: '<p class="small mb-0">La ventana de reabastecer no está disponible. ' +
              'Entra a <strong>Productos</strong> y vuelve a intentarlo.</p>'
    });
    return false;
}

// ─── ESTADO "YA PEDIDO" — localStorage ──────────────────────────────────────
// Sin tocar la base de datos ni el backend.
// localStorage persiste entre recargas y entre días en la misma PC/navegador.
const FALT_STORAGE_KEY = 'ferrepos_falt_pedidos';

function pedidosGuardados() {
    try { return new Set(JSON.parse(localStorage.getItem(FALT_STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
}
function guardarPedidos(set) {
    localStorage.setItem(FALT_STORAGE_KEY, JSON.stringify([...set]));
}
function limpiarPedido(productId) {
    const s = pedidosGuardados();
    s.delete(Number(productId));
    guardarPedidos(s);
}

// ─── PESTAÑAS (Faltantes del catálogo / Libreta de apuntes) ─────────────────
let pestanaFaltActiva = 'catalogo';
function activarPestanaFaltantes(tab) {
    pestanaFaltActiva = tab;
    document.querySelectorAll('#falt-tabs [data-falt-tab]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.faltTab === tab));
    document.getElementById('falt-panel-catalogo').style.display = tab === 'catalogo' ? '' : 'none';
    document.getElementById('falt-panel-libreta').style.display  = tab === 'libreta'  ? '' : 'none';
    if (tab === 'libreta') cargarNotasFaltantes();
}

async function cargarFaltantes() {
    const tbody = document.getElementById('tabla-faltantes-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5">
        <div class="spinner-border text-danger"></div></td></tr>`;

    try {
        const productos = await fetchAPI('/products');
        const faltantes = productos.filter(p => {
            const stock = parseFloat(p.currentStock) || 0;
            const min   = parseFloat(p.minStockLevel) || 0;
            return p.active && stock <= min;
        });

        if (!faltantes.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">
                <i class="bi bi-check-circle fs-2 d-block mb-2 text-success"></i>
                No hay faltantes — todo tu inventario está por encima del mínimo.</td></tr>`;
            return;
        }

        const yaPedidos = pedidosGuardados();
        const agotados  = faltantes.filter(p => (parseFloat(p.currentStock) || 0) === 0);
        const bajos     = faltantes.filter(p => (parseFloat(p.currentStock) || 0) >  0);

        function filaFaltante(p, tipo) {
            const etq    = etiquetaUnidad(p.satClaveUnidad);
            const stock  = parseFloat(p.currentStock) || 0;
            const min    = parseFloat(p.minStockLevel) || 0;
            const pedido = yaPedidos.has(p.id);
            const nombre = `${p.name} ${p.sku} ${p.attributes?.codigo_truper || ''}`.toLowerCase();
            const rowCls = pedido ? 'falt-row-pedido'
                         : tipo === 'agotado' ? 'falt-row-agotado' : 'falt-row-bajo';
            return `
            <tr class="${rowCls}" data-nombre="${escaparHtmlFalt(nombre)}" data-tipo="${tipo}">
                <td class="ps-3">
                    ${p.imagenUrl
                        ? `<img src="${urlImagenCompleta(p.imagenUrl)}"
                               style="width:48px;height:48px;object-fit:cover;border-radius:8px;
                                      border:1px solid #DCE0E5"
                               onerror="this.style.display='none'">`
                        : `<div class="d-flex align-items-center justify-content-center"
                               style="width:48px;height:48px;background:#EDEFF2;border-radius:8px">
                               <i class="bi bi-image text-muted"></i></div>`}
                </td>
                <td>
                    <div class="fw-bold">${escaparHtmlFalt(p.name)}</div>
                    <div class="text-muted small">
                        <span class="badge bg-light text-dark border font-monospace">${escaparHtmlFalt(p.sku)}</span>
                        ${p.attributes?.codigo_truper
                            ? `<span class="ms-1" title="Código del catálogo Truper">
                                   <i class="bi bi-upc"></i> ${escaparHtmlFalt(p.attributes.codigo_truper)}</span>`
                            : ''}
                        · ${escaparHtmlFalt(p.category?.name || 'Sin Categoría')}
                    </div>
                </td>
                <td class="text-end font-monospace small text-muted"
                    title="Costo en clave de mostrador (cifrado por seguridad)">
                    ${p.costCode && p.costCode !== '0000' ? escaparHtmlFalt(p.costCode) : '—'}
                </td>
                <td class="text-end fw-bold text-success">
                    $${(p.price || 0).toFixed(2)}
                </td>
                <td class="text-center">
                    <span class="badge ${stock === 0 ? 'stock-none' : 'stock-low'}">
                        ${stock} ${etq}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge bg-secondary">${min} ${etq}</span>
                </td>
                <td class="text-center fw-bold ${tipo === 'agotado' && !pedido ? 'text-danger' : 'text-warning'}">
                    ${(min - stock).toFixed(3).replace(/\.?0+$/, '')} ${etq}
                </td>
                <td class="text-center">
                    <div class="form-check form-switch d-flex justify-content-center mb-0">
                        <input type="checkbox" role="switch"
                            class="form-check-input falt-sw-pedido"
                            id="fsw-${p.id}"
                            data-prod-id="${p.id}"
                            ${pedido ? 'checked' : ''}
                            style="cursor:pointer;width:2.5em;height:1.3em">
                    </div>
                    <label for="fsw-${p.id}"
                        class="form-check-label small d-block mt-1"
                        style="cursor:pointer;font-size:.68rem;
                               color:${pedido ? '#15803D' : '#9CA3AF'}">
                        ${pedido ? 'Pedido ✓' : 'No pedido'}
                    </label>
                </td>
                <td class="text-center pe-3">
                    <button type="button"
                        class="btn btn-sm ${tipo === 'agotado' && !pedido ? 'btn-danger' : 'btn-outline-success'}"
                        title="Reabastecer"
                        data-abastecer="1"
                        data-id="${p.id}"
                        data-nombre="${escaparHtmlFalt(p.name)}"
                        data-stock="${stock}"
                        data-precio="${p.price || 0}"
                        data-unidad="${escaparHtmlFalt(p.satClaveUnidad || '')}">
                        <i class="bi bi-plus-circle"></i> Abastecer
                    </button>
                </td>
            </tr>`;
        }

        function seccion(titulo, icono, color, bg, n) {
            return `<tr class="falt-sec-hdr">
                <td colspan="9" class="px-3 py-2"
                    style="background:${bg};border-left:4px solid ${color}">
                    <span style="color:${color};font-weight:700;font-size:.82rem;
                                 text-transform:uppercase;letter-spacing:.06em">
                        <i class="bi ${icono} me-2"></i>${titulo}
                        <span class="badge ms-2"
                            style="background:${color};font-size:.68rem">${n}</span>
                    </span>
                </td>
            </tr>`;
        }

        let html = '';
        if (agotados.length) {
            html += seccion('Sin existencia — pedir urgente',
                'bi-exclamation-circle-fill', '#B91C1C', '#FEF2F2', agotados.length);
            html += agotados.map(p => filaFaltante(p, 'agotado')).join('');
        }
        if (bajos.length) {
            if (agotados.length)
                html += `<tr><td colspan="9"
                    style="height:8px;background:#F8F9FA;border:none"></td></tr>`;
            html += seccion('Stock bajo — pedir pronto',
                'bi-exclamation-triangle-fill', '#B45309', '#FFFBEB', bajos.length);
            html += bajos.map(p => filaFaltante(p, 'bajo')).join('');
        }
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-5">
            Error al cargar: ${escaparHtmlFalt(e.message)}</td></tr>`;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  LIBRETA DE APUNTES — cosas que faltan pero no están en el catálogo
// ═════════════════════════════════════════════════════════════════════════════
let mostrarResueltasFalt = false;

function inyectarEstiloLibretaFaltantes() {
    if (document.getElementById('estilo-libreta-faltantes')) return;
    const s = document.createElement('style');
    s.id = 'estilo-libreta-faltantes';
    s.textContent = `
        .nb-papel-falt{background:repeating-linear-gradient(#fff,#fff 46px,#F3F6F8 47px);
            border:1px solid #DCE0E5;border-radius:12px;padding:.25rem 0;
            box-shadow:0 2px 10px rgba(20,30,40,.05)}
        .nb-nota-falt{display:flex;align-items:flex-start;gap:.75rem;
            padding:.6rem 1.1rem;border-bottom:1px dashed #E3E8ED}
        .nb-nota-falt:last-child{border-bottom:none}
        .nb-nota-falt.resuelta{opacity:.5}
        .nb-nota-falt.resuelta .nb-texto-falt{text-decoration:line-through}
        .nb-check-falt{width:22px;height:22px;flex-shrink:0;margin-top:.1rem;cursor:pointer}
        .nb-cuerpo-falt{flex:1;min-width:0}
        .nb-texto-falt{font-weight:600;font-size:.95rem;color:#22252A;line-height:1.3}
        .nb-meta-falt{color:#8A93A0;font-size:.72rem;margin-top:.15rem}
        #falt-tabs .nav-link{color:#1B1D21;background:#EDEFF2;border:1px solid #DCE0E5;
            border-radius:8px;font-weight:700;padding:.45rem .9rem}
        #falt-tabs .nav-link.active{background:#1B1D21;color:#fff;border-color:#1B1D21}
        #falt-tabs .nav-link:hover:not(.active){border-color:#2B6CA3}
    `;
    document.head.appendChild(s);
}

async function cargarNotasFaltantes() {
    const cont = document.getElementById('lista-notas-faltantes');
    if (!cont) return;
    cont.innerHTML = `<div class="text-center text-muted py-4">
        <div class="spinner-border spinner-border-sm text-danger"></div></div>`;
    try {
        window._notasFaltantesCache = await fetchAPI('/notas-faltantes');
        renderNotasFaltantes();
    } catch (e) {
        cont.innerHTML = `<div class="alert alert-danger m-3">${escaparHtmlFalt(e.message)}</div>`;
    }
}

function renderNotasFaltantes() {
    const cont = document.getElementById('lista-notas-faltantes');
    if (!cont) return;
    const todas = window._notasFaltantesCache || [];
    const visibles = mostrarResueltasFalt ? todas : todas.filter(n => !n.resuelta);

    if (!visibles.length) {
        cont.innerHTML = `<div class="text-center text-muted py-4">
            <i class="bi bi-journal-check fs-2 d-block mb-2 text-success opacity-75"></i>
            ${todas.length ? 'Sin notas pendientes.' : 'La libreta está vacía — anota algo arriba.'}
        </div>`;
        return;
    }

    cont.innerHTML = visibles.map(n => {
        const fecha = new Date(n.createdAt).toLocaleString('es-MX', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        return `
        <div class="nb-nota-falt ${n.resuelta ? 'resuelta' : ''}">
            <input type="checkbox" class="form-check-input nb-check-falt"
                ${n.resuelta ? 'checked' : ''}
                title="${n.resuelta ? 'Marcar como pendiente' : 'Marcar como resuelta'}"
                onchange="window._toggleNotaFalt(${n.id}, this.checked)">
            <div class="nb-cuerpo-falt">
                <div class="nb-texto-falt">${escaparHtmlFalt(n.texto)}</div>
                <div class="nb-meta-falt">${fecha}${n.autor ? ' · ' + escaparHtmlFalt(n.autor) : ''}</div>
            </div>
            <button class="btn btn-sm btn-outline-danger border-0" title="Borrar nota"
                onclick="window._borrarNotaFalt(${n.id})">
                <i class="bi bi-trash3"></i>
            </button>
        </div>`;
    }).join('');
}

async function agregarNotaFaltante() {
    const inp = document.getElementById('nueva-nota-falt');
    const texto = inp.value.trim();
    if (!texto) { inp.focus(); return; }
    const btn = document.getElementById('btn-agregar-nota-falt');
    btn.disabled = true;
    try {
        await fetchAPI('/notas-faltantes', { method: 'POST', body: { texto } });
        inp.value = '';
        await cargarNotasFaltantes();
        inp.focus();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

window._toggleNotaFalt = async (id, marcarResuelta) => {
    try {
        await fetchAPI(`/notas-faltantes/${id}/resuelta`,
            { method: 'PATCH', body: { resuelta: marcarResuelta } });
        await cargarNotasFaltantes();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
        cargarNotasFaltantes();   // re-sincronizar el checkbox si algo falló
    }
};

window._borrarNotaFalt = async (id) => {
    const r = await Swal.fire({
        title: '¿Borrar esta nota?',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545'
    });
    if (!r.isConfirmed) return;
    try {
        await fetchAPI(`/notas-faltantes/${id}`, { method: 'DELETE' });
        await cargarNotasFaltantes();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

function escaparHtmlFalt(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}