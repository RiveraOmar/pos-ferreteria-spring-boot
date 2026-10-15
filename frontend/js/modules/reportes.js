import { fetchAPI } from '../services/api.js';

// ══════════════════════════════════════════════════════════════════════════════
// REPORTES
// Antes solo mostraba UN día. La pregunta que de verdad importa —"¿cómo me fue
// este mes?"— no se podía contestar. Ahora trabaja por RANGO de fechas y
// compara contra el periodo anterior equivalente, para saber si vas mejor o peor.
//
// Todo se calcula desde /sales/search (que ya existía): no hizo falta tocar el
// backend.
// ══════════════════════════════════════════════════════════════════════════════

let ventasCache = [];   // ventas del rango actual (para exportar sin re-pedir)
let rangoActual = { inicio: null, fin: null, etiqueta: '' };

const fmt  = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('es-MX');

// ─── FECHAS ───────────────────────────────────────────────────────────────────
const aISO = (d) => d.toISOString().split('T')[0];

function rangosRapidos() {
    const hoy = new Date();
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));  // lunes

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesPasado    = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

    return {
        hoy:        { inicio: aISO(hoy),  fin: aISO(hoy),  etiqueta: 'Hoy' },
        ayer:       { inicio: aISO(ayer), fin: aISO(ayer), etiqueta: 'Ayer' },
        semana:     { inicio: aISO(inicioSemana), fin: aISO(hoy), etiqueta: 'Esta semana' },
        mes:        { inicio: aISO(inicioMes),    fin: aISO(hoy), etiqueta: 'Este mes' },
        mesPasado:  { inicio: aISO(inicioMesPasado), fin: aISO(finMesPasado),
                      etiqueta: 'Mes pasado' }
    };
}

export function initReportes(container) {
    const r = rangosRapidos();

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>
                <h2 class="fw-bold mb-0"><i class="bi bi-bar-chart-line me-2"></i>Reportes</h2>
                <p class="text-muted mb-0 small">Cómo va el negocio en el periodo que elijas</p>
            </div>
            <button class="btn btn-outline-secondary btn-sm" id="btn-exportar-reporte" disabled>
                <i class="bi bi-download me-1"></i>Exportar CSV
            </button>
        </div>

        <div class="card shadow-sm border-0 mb-3">
            <div class="card-body">
                <div class="d-flex flex-wrap gap-1 mb-3" id="botones-rango">
                    <button class="btn btn-sm btn-outline-dark" data-rango="hoy">Hoy</button>
                    <button class="btn btn-sm btn-outline-dark" data-rango="ayer">Ayer</button>
                    <button class="btn btn-sm btn-outline-dark" data-rango="semana">Esta semana</button>
                    <button class="btn btn-sm btn-dark" data-rango="mes">Este mes</button>
                    <button class="btn btn-sm btn-outline-dark" data-rango="mesPasado">Mes pasado</button>
                </div>
                <div class="row g-2 align-items-end">
                    <div class="col-md-3">
                        <label class="form-label small fw-bold">Desde</label>
                        <input type="date" id="rep-inicio" class="form-control form-control-sm"
                            value="${r.mes.inicio}">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small fw-bold">Hasta</label>
                        <input type="date" id="rep-fin" class="form-control form-control-sm"
                            value="${r.mes.fin}">
                    </div>
                    <div class="col-md-3">
                        <button class="btn btn-primary btn-sm w-100" id="btn-generar-reporte">
                            <i class="bi bi-search me-1"></i>Generar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div id="resultado-reporte">
            <div class="text-center py-5 text-muted">
                <i class="bi bi-graph-up fs-1 d-block mb-2 opacity-25"></i>
                Elige un periodo y genera el reporte
            </div>
        </div>`;

    // Botones de rango rápido
    document.querySelectorAll('#botones-rango button').forEach(b => {
        b.addEventListener('click', () => {
            const sel = rangosRapidos()[b.dataset.rango];
            document.getElementById('rep-inicio').value = sel.inicio;
            document.getElementById('rep-fin').value    = sel.fin;
            document.querySelectorAll('#botones-rango button').forEach(x => {
                x.classList.remove('btn-dark');
                x.classList.add('btn-outline-dark');
            });
            b.classList.remove('btn-outline-dark');
            b.classList.add('btn-dark');
            generarReporte(sel.etiqueta);
        });
    });

    document.getElementById('btn-generar-reporte')
        .addEventListener('click', () => generarReporte());
    document.getElementById('btn-exportar-reporte')
        .addEventListener('click', exportarCSV);

    generarReporte('Este mes');   // arranca con el mes en curso
}

// ─── CÁLCULO ──────────────────────────────────────────────────────────────────
// Un solo recorrido de las ventas saca todos los números del reporte.
function analizar(ventas) {
    const r = {
        n: 0, ingresos: 0, costo: 0, iva: 0,
        productos: {},         // nombre → { cantidad, importe }
        porDia: {},            // 'YYYY-MM-DD' → importe
        porPago: {},           // método → { n, importe }
        canceladas: 0
    };

    ventas.forEach(v => {
        if (String(v.status || '').toUpperCase().includes('CANCEL')) {
            r.canceladas++;
            return;                       // las canceladas no cuentan como venta
        }
        r.n++;
        const total = Number(v.totalAmount) || 0;
        r.ingresos += total;
        r.iva      += Number(v.taxAmount) || 0;

        const dia = (v.createdAt || '').substring(0, 10);
        r.porDia[dia] = (r.porDia[dia] || 0) + total;

        const pago = v.paymentMethod || 'DESCONOCIDO';
        if (!r.porPago[pago]) r.porPago[pago] = { n: 0, importe: 0 };
        r.porPago[pago].n++;
        r.porPago[pago].importe += total;

        (v.items || []).forEach(i => {
            const cant = Number(i.quantity) || 0;
            r.costo += cant * (Number(i.costAtSale) || 0);
            const key = i.productName || ('#' + i.productId);
            if (!r.productos[key]) r.productos[key] = { cantidad: 0, importe: 0 };
            r.productos[key].cantidad += cant;
            r.productos[key].importe  += cant * (Number(i.unitPrice) || 0);
        });
    });

    r.ganancia = r.ingresos - r.costo;
    r.margen   = r.ingresos > 0 ? (r.ganancia / r.ingresos) * 100 : 0;
    r.ticket   = r.n > 0 ? r.ingresos / r.n : 0;
    return r;
}

// Periodo anterior del mismo tamaño, para comparar contra algo real
function periodoAnterior(inicio, fin) {
    const i = new Date(inicio + 'T00:00:00');
    const f = new Date(fin + 'T00:00:00');
    const dias = Math.round((f - i) / 86400000) + 1;
    const fAnt = new Date(i); fAnt.setDate(i.getDate() - 1);
    const iAnt = new Date(fAnt); iAnt.setDate(fAnt.getDate() - dias + 1);
    return { inicio: aISO(iAnt), fin: aISO(fAnt), dias };
}

async function pedirVentas(inicio, fin) {
    // El backend espera fecha-hora: se cubre el día completo
    return await fetchAPI(
        `/sales/search?inicio=${inicio}T00:00:00&fin=${fin}T23:59:59`);
}

async function generarReporte(etiqueta = '') {
    const inicio = document.getElementById('rep-inicio').value;
    const fin    = document.getElementById('rep-fin').value;
    const cont   = document.getElementById('resultado-reporte');

    if (!inicio || !fin) {
        Swal.fire('Aviso', 'Elige la fecha de inicio y de fin.', 'warning');
        return;
    }
    if (inicio > fin) {
        Swal.fire('Fechas al revés',
            'La fecha "Desde" no puede ser posterior a "Hasta".', 'warning');
        return;
    }

    cont.innerHTML = `<div class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-2 text-muted small">Analizando ventas...</p></div>`;

    try {
        const ant = periodoAnterior(inicio, fin);
        // El periodo anterior es informativo: si falla, el reporte igual sale
        const [ventas, ventasAnt] = await Promise.all([
            pedirVentas(inicio, fin),
            pedirVentas(ant.inicio, ant.fin).catch(() => [])
        ]);

        ventasCache = ventas;
        rangoActual = { inicio, fin, etiqueta: etiqueta || `${inicio} a ${fin}` };
        document.getElementById('btn-exportar-reporte').disabled = !ventas.length;

        renderReporte(analizar(ventas), analizar(ventasAnt), ant);
    } catch (e) {
        cont.innerHTML = `<div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No se pudo generar el reporte: ${e.message}</div>`;
    }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
// Flecha de comparación contra el periodo anterior
function delta(actual, anterior, invertir = false) {
    if (!anterior) return '';
    const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
    if (!isFinite(pct) || Math.abs(pct) < 0.5) return '';
    const sube  = pct > 0;
    const bueno = invertir ? !sube : sube;
    return `<span class="badge ${bueno ? 'bg-success' : 'bg-danger'}"
                  style="font-size:.6rem" title="vs el periodo anterior">
                <i class="bi bi-arrow-${sube ? 'up' : 'down'}"></i>
                ${Math.abs(pct).toFixed(0)}%</span>`;
}

function kpi(titulo, valor, color, icono, extra = '') {
    return `
    <div class="col-6 col-md-3">
        <div class="card kpi-card shadow-sm h-100" style="border-left-color:${color}">
            <div class="card-body py-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div style="min-width:0">
                        <div class="text-muted" style="font-size:.72rem">${titulo}</div>
                        <div class="fw-bold mt-1" style="color:${color};font-size:1.15rem">
                            ${valor}</div>
                        <div class="mt-1">${extra}</div>
                    </div>
                    <i class="bi ${icono}" style="color:${color};opacity:.35;font-size:1.4rem"></i>
                </div>
            </div>
        </div>
    </div>`;
}

function renderReporte(a, ant, rangoAnt) {
    const cont = document.getElementById('resultado-reporte');

    if (!a.n && !a.canceladas) {
        cont.innerHTML = `<div class="text-center py-5 text-muted">
            <i class="bi bi-inbox fs-1 d-block mb-2 opacity-25"></i>
            <h5>Sin ventas en este periodo</h5>
            <p class="small mb-0">${rangoActual.etiqueta}</p></div>`;
        return;
    }

    // ── Gráfica de ventas por día ──
    const dias = Object.keys(a.porDia).sort();
    const maxDia = Math.max(...Object.values(a.porDia), 1);
    const grafica = dias.length > 1
        ? `<div class="card shadow-sm border-0 mb-3">
             <div class="card-header bg-white fw-bold small py-2">
                <i class="bi bi-graph-up me-2"></i>Ventas por día</div>
             <div class="card-body">
               <div style="display:flex;align-items:flex-end;gap:3px;height:150px">
                 ${dias.map(d => {
                    const v = a.porDia[d];
                    const h = Math.max(3, (v / maxDia) * 100);
                    const esMax = v === maxDia;
                    return `<div style="flex:1;display:flex;flex-direction:column;
                                        justify-content:flex-end;height:100%"
                                 title="${d}: ${fmt(v)}">
                              <div style="height:${h}%;border-radius:4px 4px 0 0;
                                    background:${esMax ? 'var(--amber-500,#f59e0b)' : '#8fb4ee'}"></div>
                            </div>`;
                 }).join('')}
               </div>
               <div class="d-flex justify-content-between mt-1"
                    style="font-size:.65rem;color:#adb5bd">
                 <span>${dias[0]}</span><span>${dias[dias.length - 1]}</span>
               </div>
             </div>
           </div>`
        : '';

    // ── Top productos ──
    const top = Object.entries(a.productos)
        .sort((x, y) => y[1].importe - x[1].importe)
        .slice(0, 10);
    const maxImp = top.length ? top[0][1].importe : 1;

    // ── Métodos de pago ──
    const pagos = Object.entries(a.porPago).sort((x, y) => y[1].importe - x[1].importe);

    cont.innerHTML = `
        <div class="alert alert-light border d-flex justify-content-between
                    align-items-center py-2 mb-3 flex-wrap gap-2">
            <span class="small">
                <i class="bi bi-calendar3 me-1"></i>
                <strong>${rangoActual.etiqueta}</strong>
                <span class="text-muted">— comparado contra
                    ${rangoAnt.inicio} a ${rangoAnt.fin}</span>
            </span>
            ${a.canceladas
                ? `<span class="badge bg-danger-subtle text-danger border">
                       ${a.canceladas} cancelada(s), no contadas</span>` : ''}
        </div>

        <div class="row g-2 mb-3">
            ${kpi('VENTAS', fmtN(a.n), 'var(--blue-600,#2563eb)', 'bi-receipt',
                  delta(a.n, ant.n))}
            ${kpi('INGRESOS', fmt(a.ingresos), 'var(--green-600,#16a34a)', 'bi-cash-stack',
                  delta(a.ingresos, ant.ingresos))}
            ${kpi('COSTO', fmt(a.costo), 'var(--amber-600,#d97706)', 'bi-box-seam',
                  '<span class="text-muted" style="font-size:.65rem">de lo vendido</span>')}
            ${kpi('GANANCIA', fmt(a.ganancia),
                  a.ganancia >= 0 ? '#0891b2' : 'var(--red-600,#dc2626)',
                  'bi-graph-up-arrow', delta(a.ganancia, ant.ganancia))}
        </div>

        <div class="row g-2 mb-3">
            ${kpi('MARGEN', a.margen.toFixed(1) + '%', '#7c3aed', 'bi-percent',
                  `<span class="text-muted" style="font-size:.65rem">
                     ganancia sobre ingresos</span>`)}
            ${kpi('TICKET PROMEDIO', fmt(a.ticket), '#0891b2', 'bi-tag',
                  delta(a.ticket, ant.ticket))}
            ${kpi('IVA COBRADO', fmt(a.iva), '#64748b', 'bi-receipt-cutoff',
                  '<span class="text-muted" style="font-size:.65rem">incluido en ingresos</span>')}
            ${kpi('PRODUCTOS DISTINTOS', fmtN(Object.keys(a.productos).length),
                  '#475569', 'bi-boxes')}
        </div>

        ${grafica}

        <div class="row g-3">
            <div class="col-md-7">
                <div class="card shadow-sm border-0 h-100">
                    <div class="card-header bg-white fw-bold small py-2">
                        <i class="bi bi-trophy me-2" style="color:var(--amber-500,#f59e0b)"></i>
                        Productos que más dinero dejaron
                    </div>
                    <div class="card-body p-0">
                        <table class="table table-sm table-hover mb-0" style="font-size:.82rem">
                            <thead class="table-light"><tr>
                                <th class="ps-3">Producto</th>
                                <th class="text-center">Unidades</th>
                                <th class="text-end pe-3">Importe</th>
                            </tr></thead>
                            <tbody>
                                ${top.length ? top.map(([nombre, d], i) => `
                                <tr>
                                    <td class="ps-3">
                                        <div class="d-flex align-items-center gap-2">
                                            <span class="text-muted" style="font-size:.7rem;width:16px">
                                                ${i + 1}</span>
                                            <div style="flex:1;min-width:0">
                                                <div class="fw-bold text-truncate">${nombre}</div>
                                                <div style="height:3px;background:#eef1f5;
                                                            border-radius:2px;margin-top:3px">
                                                    <div style="width:${(d.importe / maxImp) * 100}%;
                                                        height:100%;border-radius:2px;
                                                        background:var(--blue-500,#3b82f6)"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-center">${fmtN(+d.cantidad.toFixed(2))}</td>
                                    <td class="text-end pe-3 fw-bold text-success">
                                        ${fmt(d.importe)}</td>
                                </tr>`).join('')
                                : `<tr><td colspan="3" class="text-center text-muted py-4">
                                       Sin productos vendidos</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="col-md-5">
                <div class="card shadow-sm border-0 h-100">
                    <div class="card-header bg-white fw-bold small py-2">
                        <i class="bi bi-wallet2 me-2"></i>Cómo te pagaron
                    </div>
                    <div class="card-body">
                        ${pagos.map(([metodo, d]) => {
                            const pct = a.ingresos > 0 ? (d.importe / a.ingresos) * 100 : 0;
                            return `
                            <div class="mb-3">
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="fw-bold small">${metodo}</span>
                                    <span class="small">
                                        <strong>${fmt(d.importe)}</strong>
                                        <span class="text-muted">(${pct.toFixed(0)}%)</span>
                                    </span>
                                </div>
                                <div style="height:6px;background:#eef1f5;border-radius:3px">
                                    <div style="width:${pct}%;height:100%;border-radius:3px;
                                        background:var(--green-600,#16a34a)"></div>
                                </div>
                                <small class="text-muted" style="font-size:.7rem">
                                    ${d.n} venta(s)</small>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>`;
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────────────
// CSV que abre directo en Excel: una fila por venta, con sus totales.
function exportarCSV() {
    if (!ventasCache.length) return;

    const filas = [['Folio', 'Fecha', 'Cliente', 'Método de pago', 'Estado',
                    'Subtotal', 'IVA', 'Total']];

    ventasCache.forEach(v => {
        const total = Number(v.totalAmount) || 0;
        const iva   = Number(v.taxAmount) || 0;
        filas.push([
            v.invoiceNumber || v.id,
            (v.createdAt || '').replace('T', ' ').substring(0, 16),
            v.customerName || 'Público General',
            v.paymentMethod || '',
            v.status || '',
            (total - iva).toFixed(2),
            iva.toFixed(2),
            total.toFixed(2)
        ]);
    });

    // Comillas y punto y coma: así Excel en español lo abre en columnas
    const csv = filas
        .map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

    // BOM para que Excel respete los acentos
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `ventas_${rangoActual.inicio}_a_${rangoActual.fin}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    window.mostrarToast?.(`${ventasCache.length} ventas exportadas`, 'success');
}