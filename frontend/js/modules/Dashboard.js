import { fetchAPI } from '../services/api.js';
import { urlImagenCompleta } from '../services/camara.js';
import { fmtFecha, hoyISO } from '../services/fechas.js';
import { mostrarFichaProducto } from '../services/productDetailCard.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));


window.dashVerProducto = (productId) => mostrarFichaProducto(productId);

window.dashIrADeuda = (clienteId) => {
    sessionStorage.setItem('deudas_abrir_cliente', String(clienteId));
    document.querySelector('#main-menu .nav-link[data-module="deudas"]')?.click();
};


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

let dashTimer = null;

export async function initDashboard(container) {
   clearInterval(dashTimer);
    dashTimer = setInterval(() => {
        if (!document.getElementById('dash-kpis')) {  
            clearInterval(dashTimer);
            return;
        }
        if (document.hidden) return;
        cargarDashboard();
    }, 60000);

    container.innerHTML = renderEsqueleto();

   container.addEventListener('click', async (e) => {
        const btnAbastecer = e.target.closest('button[data-dash-abastecer]');
        if (btnAbastecer) {
            e.stopPropagation();         
            const ok = await asegurarRestock();
            if (!ok) return;
             window.onRestockSuccess = () => cargarDashboard();
            window.abrirRestock(
                Number(btnAbastecer.dataset.id),
                btnAbastecer.dataset.nombre,
                Number(btnAbastecer.dataset.stock),
                Number(btnAbastecer.dataset.precio),
                btnAbastecer.dataset.unidad
            );
            return;
        }

        const filaProd = e.target.closest('li[data-dash-producto]');
        if (filaProd) {
            window.dashVerProducto(Number(filaProd.dataset.dashProducto));
            return;
        }

        const filaDeuda = e.target.closest('li[data-dash-cliente]');
        if (filaDeuda) {
            window.dashIrADeuda(Number(filaDeuda.dataset.dashCliente));
        }
    });

    cargarDashboard();
}

function renderEsqueleto() {
    return `
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="mb-0 fw-bold"><i class="bi bi-speedometer2 me-2 text-primary"></i>Dashboard</h2>
            <p class="text-muted mb-0 small" id="dash-fecha"></p>
        </div>
        <button class="btn btn-outline-secondary btn-sm" id="btn-refrescar-dash">
            <i class="bi bi-arrow-clockwise"></i> Actualizar
        </button>
    </div>

    <!-- KPIs -->
    <div class="row g-3 mb-4" id="dash-kpis">
        ${['','','',''].map(() => `
        <div class="col-md-3">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <div class="placeholder-glow">
                        <span class="placeholder col-6 mb-2 d-block rounded"></span>
                        <span class="placeholder col-4 d-block rounded" style="height:2rem"></span>
                    </div>
                </div>
            </div>
        </div>`).join('')}
    </div>

    <!-- Gráfica + Top productos -->
    <div class="row g-3 mb-4">
        <div class="col-md-8">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white fw-bold py-3">
                    <i class="bi bi-bar-chart me-2 text-primary"></i>Ventas por hora — hoy
                </div>
                <div class="card-body" id="dash-chart-container">
                    <div class="d-flex justify-content-center align-items-center" style="height:200px">
                        <div class="spinner-border text-primary"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white fw-bold py-3">
                    <i class="bi bi-trophy me-2 text-warning"></i>Top productos hoy
                </div>
                <div class="card-body p-0" id="dash-top-productos">
                    <div class="d-flex justify-content-center align-items-center py-5">
                        <div class="spinner-border text-warning spinner-border-sm"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Stock bajo + Deudas recientes -->
    <div class="row g-3">
        <div class="col-md-6">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white py-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold"><i class="bi bi-exclamation-triangle me-2 text-danger"></i>Stock bajo</span>
                        <span class="badge bg-danger" id="dash-badge-stock">...</span>
                    </div>
                    <input type="text" class="form-control form-control-sm" id="dash-buscar-faltante"
                        placeholder="Buscar en faltantes...">
                </div>
                <div class="card-body p-0" style="max-height:280px;overflow-y:auto" id="dash-stock-bajo">
                    <div class="d-flex justify-content-center align-items-center py-5">
                        <div class="spinner-border text-danger spinner-border-sm"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <span class="fw-bold"><i class="bi bi-clock-history me-2 text-warning"></i>Deudas pendientes</span>
                    <span class="badge bg-warning text-dark" id="dash-badge-deudas">...</span>
                </div>
                <div class="card-body p-0" style="max-height:280px;overflow-y:auto" id="dash-deudas">
                    <div class="d-flex justify-content-center align-items-center py-5">
                        <div class="spinner-border text-warning spinner-border-sm"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

async function cargarDashboard() {
    const fechaHoy = hoyISO();

    const [anio, mes, dia] = fechaHoy.split('-').map(Number);
    const fechaDisplay = new Date(anio, mes - 1, dia);
    const elFecha = document.getElementById('dash-fecha');
    if (elFecha) {
        elFecha.textContent = fechaDisplay.toLocaleDateString('es-MX', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    const btnRef = document.getElementById('btn-refrescar-dash');
    if (btnRef) btnRef.onclick = () => {
        document.getElementById('dash-kpis').innerHTML = ['','','',''].map(() => `
            <div class="col-md-3">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body"><div class="placeholder-glow">
                        <span class="placeholder col-6 mb-2 d-block rounded"></span>
                        <span class="placeholder col-4 d-block rounded" style="height:2rem"></span>
                    </div></div>
                </div>
            </div>`).join('');
        cargarDashboard();
    };

    try {
        const [reporte, productos, deudas, ventasHoy] = await Promise.all([
            fetchAPI(`/reports?date=${fechaHoy}`),
            fetchAPI('/products'),
            fetchAPI('/debts'),
            fetchAPI(`/sales/search?inicio=${fechaHoy}T00:00:00&fin=${fechaHoy}T23:59:59`)
                .catch(() => [])
        ]);

        renderKPIs(reporte);
        renderGraficaHoras(ventasHoy);
        renderTopProductos(reporte);
        renderStockBajo(productos);
        renderDeudas(deudas);
    } catch (e) {
        console.error('Error cargando dashboard:', e);
    }
}

function fmt(n) {
    return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderKPIs(r) {
    const ganancia = Number(r.netProfit || 0);
    const kpis = [
        {
            icon: 'bi-receipt',
            color: 'primary',
            bg: '#e7f1ff',
            label: 'Ventas hoy',
            value: r.totalSalesCount,
            sub: 'transacciones completadas'
        },
        {
            icon: 'bi-cash-stack',
            color: 'success',
            bg: '#e6f4ea',
            label: 'Ingresos totales',
            value: fmt(r.grossRevenue),
            sub: 'con IVA incluido'
        },
        {
            icon: 'bi-box-seam',
            color: 'warning',
            bg: '#fff8e1',
            label: 'Costo de mercancía',
            value: fmt(r.totalCost),
            sub: 'costo de lo vendido'
        },
        {
            icon: ganancia >= 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow',
            color: ganancia >= 0 ? 'info' : 'danger',
            bg: ganancia >= 0 ? '#e3f6fc' : '#fdecea',
            label: 'Ganancia neta',
            value: fmt(ganancia),
            sub: ganancia >= 0 ? 'margen positivo ✓' : 'revisar costos ⚠'
        }
    ];

    document.getElementById('dash-kpis').innerHTML = kpis.map(k => `
        <div class="col-md-3">
            <div class="card border-0 shadow-sm h-100" style="border-left: 4px solid var(--bs-${k.color}) !important;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <p class="text-muted small mb-1">${k.label}</p>
                            <h3 class="fw-bold mb-0 text-${k.color}">${k.value}</h3>
                        </div>
                        <div style="width:44px;height:44px;border-radius:12px;background:${k.bg};
                                    display:flex;align-items:center;justify-content:center">
                            <i class="bi ${k.icon} fs-5 text-${k.color}"></i>
                        </div>
                    </div>
                    <small class="text-muted">${k.sub}</small>
                </div>
            </div>
        </div>`).join('');
}

function renderGraficaHoras(ventasHoy) {
    const container = document.getElementById('dash-chart-container');
    if (!container) return;

    const ventas = (ventasHoy || []).filter(v =>
        !String(v.status || '').toUpperCase().includes('CANCEL'));

    if (!ventas.length) {
        container.innerHTML = `<div class="text-center text-muted py-5">
            <i class="bi bi-bar-chart fs-1 d-block mb-2 opacity-25"></i>
            Sin ventas registradas hoy</div>`;
        return;
    }

    const horaDe = (v) => {
        const f = String(v.createdAt || '');
        if (f.includes('T')) return parseInt(f.substring(11, 13), 10);   
        const m = f.match(/\b(\d{2}):\d{2}/);                            
        return m ? parseInt(m[1], 10) : null;
    };

   const porHora = {};
    let minH = 8, maxH = Math.max(new Date().getHours(), 14);
    ventas.forEach(v => {
        const h = horaDe(v);
        if (h == null || isNaN(h)) return;
        if (!porHora[h]) porHora[h] = { monto: 0, ventas: 0 };
        porHora[h].monto  += Number(v.totalAmount || 0);
        porHora[h].ventas += 1;
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
    });

    const horaActual = new Date().getHours();
    const barras = [];
    for (let h = minH; h <= maxH; h++) {
        barras.push({
            hora: `${h}:00`,
            monto:  porHora[h]?.monto  || 0,
            ventas: porHora[h]?.ventas || 0,
            esActual: h === horaActual
        });
    }
    const maxMonto = Math.max(...barras.map(b => b.monto), 1);

    const ALTO = 150;
    container.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:6px;height:${ALTO + 40}px;padding:0 4px">
            ${barras.map(b => {
                const px = b.monto > 0
                    ? Math.max(8, Math.round((b.monto / maxMonto) * ALTO))
                    : 2;
                return `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;
                            justify-content:flex-end;gap:4px;height:100%">
                    ${b.ventas > 0 ? `<span style="font-size:9.5px;color:#6c757d">${b.ventas}</span>` : ''}
                    <div style="width:100%;height:${px}px;
                                background:${b.monto === 0 ? '#eef1f5'
                                    : b.esActual ? '#0d6efd' : '#8fb4ee'};
                                border-radius:6px 6px 0 0;transition:height .3s"
                         title="${b.hora} — ${b.ventas} venta(s), ${fmt(b.monto)}"></div>
                    <span style="font-size:10px;color:#6c757d;writing-mode:vertical-lr;
                                 transform:rotate(180deg);height:28px">${b.hora}</span>
                </div>`;
            }).join('')}
        </div>
        <p class="text-muted small text-center mt-2 mb-0">
            <i class="bi bi-clock-history me-1"></i>Ventas reales por hora —
            ${ventas.length} venta(s) hoy · se actualiza cada minuto
        </p>`;
}

function renderTopProductos(r) {
    const container = document.getElementById('dash-top-productos');
    if (!container) return;
    const entries = Object.entries(r.topProducts || {}).sort(([,a],[,b]) => b - a).slice(0, 7);

    if (!entries.length) {
        container.innerHTML = `<div class="text-center text-muted py-5 px-3">
            <i class="bi bi-inbox fs-2 d-block mb-2 opacity-25"></i>Sin ventas hoy</div>`;
        return;
    }

    const max = entries[0][1];
    const medallas = ['🥇','🥈','🥉'];

    container.innerHTML = `<ul class="list-group list-group-flush">
        ${entries.map(([nombre, qty], i) => `
        <li class="list-group-item px-3 py-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small fw-bold text-truncate" style="max-width:160px" title="${esc(nombre)}">
                    ${medallas[i] || ''} ${esc(nombre)}
                </span>
                <span class="badge bg-primary rounded-pill">${qty}</span>
            </div>
            <div class="progress" style="height:4px">
                <div class="progress-bar" style="width:${(qty/max*100).toFixed(0)}%"></div>
            </div>
        </li>`).join('')}
    </ul>`;
}

let _dashFaltantes = [];   

function renderStockBajo(productos) {
    _dashFaltantes = productos.filter(p => p.active && p.currentStock <= (p.minStockLevel || 0));
    const badge = document.getElementById('dash-badge-stock');
    if (badge) badge.textContent = _dashFaltantes.length;

    const inp = document.getElementById('dash-buscar-faltante');
    if (inp && !inp.dataset.wired) {
        inp.dataset.wired = '1';
        inp.addEventListener('input', () => pintarFaltantes(inp.value));
    }
    pintarFaltantes(inp ? inp.value : '');
}

function pintarFaltantes(filtro) {
    const q = (filtro || '').trim().toLowerCase();
    const bajos = q
        ? _dashFaltantes.filter(p =>
            `${p.name} ${p.sku || ''} ${p.category?.name || ''}`.toLowerCase().includes(q))
        : _dashFaltantes;

    const container = document.getElementById('dash-stock-bajo');
    if (!container) return;

    if (!_dashFaltantes.length) {
        container.innerHTML = `<div class="text-center text-muted py-5 px-3">
            <i class="bi bi-check-circle fs-2 d-block mb-2 text-success opacity-75"></i>
            Todo el inventario está sano</div>`;
        return;
    }
    if (!bajos.length) {
        container.innerHTML = `<div class="text-center text-muted py-4 px-3">
            <i class="bi bi-search fs-4 d-block mb-2 opacity-50"></i>
            Ningún faltante coincide con "${esc(q)}"</div>`;
        return;
    }

    const MAX = 50;
    const visibles = bajos.slice(0, MAX);

    container.innerHTML = `<ul class="list-group list-group-flush">
        ${visibles.map(p => `
        <li class="list-group-item list-group-item-action px-3 py-2"
            style="cursor:pointer" title="Ver ficha del producto"
            data-dash-producto="${p.id}">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    ${p.imagenUrl
                        ? `<img src="${urlImagenCompleta(p.imagenUrl)}" style="width:32px;height:32px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'">`
                        : `<div style="width:32px;height:32px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center"><i class="bi bi-box text-muted small"></i></div>`
                    }
                    <div>
                        <div class="small fw-bold text-truncate" style="max-width:160px">${esc(p.name)}</div>
                        <small class="text-muted">${esc(p.category?.name || 'Sin categoría')}</small>
                    </div>
                </div>
                <div class="text-end">
                    <span class="badge ${p.currentStock === 0 ? 'bg-danger' : 'bg-warning text-dark'}">
                        ${p.currentStock} uds
                    </span>
                    <div class="small text-muted">mín: ${p.minStockLevel || 0}</div>
                </div>
                <button type="button" class="btn btn-sm btn-success ms-1" title="Agregar stock"
                    data-dash-abastecer="1"
                    data-id="${p.id}"
                    data-nombre="${esc(p.name)}"
                    data-stock="${p.currentStock}"
                    data-precio="${p.price || 0}"
                    data-unidad="${esc(p.satClaveUnidad || '')}">
                    <i class="bi bi-plus-circle"></i>
                </button>
                <i class="bi bi-chevron-right text-muted small ms-1"></i>
            </div>
        </li>`).join('')}
        ${bajos.length > MAX ? `
        <li class="list-group-item text-center small text-muted py-2">
            y ${bajos.length - MAX} más — véelos todos en
            <strong>Faltantes</strong>
        </li>` : ''}
    </ul>`;
}

function renderDeudas(deudas) {
    const badge = document.getElementById('dash-badge-deudas');
    if (badge) badge.textContent = deudas.length;

    const container = document.getElementById('dash-deudas');
    if (!container) return;

    if (!deudas.length) {
        container.innerHTML = `<div class="text-center text-muted py-5 px-3">
            <i class="bi bi-check-circle fs-2 d-block mb-2 text-success opacity-75"></i>
            Sin deudas pendientes</div>`;
        return;
    }

    const porCliente = {};
    deudas.forEach(d => {
        if (!porCliente[d.customerId]) {
            porCliente[d.customerId] = { id: d.customerId, nombre: d.customerName, total: 0, count: 0 };
        }
        porCliente[d.customerId].total += parseFloat(d.remainingAmount);
        porCliente[d.customerId].count++;
    });

    const entries = Object.values(porCliente).sort((a,b) => b.total - a.total);

    container.innerHTML = `<ul class="list-group list-group-flush">
        ${entries.map(c => `
        <li class="list-group-item list-group-item-action px-3 py-2"
            style="cursor:pointer" title="Abrir la hoja de ${esc(c.nombre)} en la Libreta"
            data-dash-cliente="${c.id}">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="small fw-bold">${esc(c.nombre)}</div>
                    <small class="text-muted">${c.count} deuda(s) activa(s)</small>
                </div>
                <div class="d-flex align-items-center gap-1">
                    <span class="badge bg-danger fs-6 fw-bold">${fmt(c.total)}</span>
                    <i class="bi bi-chevron-right text-muted small"></i>
                </div>
            </div>
        </li>`).join('')}
    </ul>`;
}