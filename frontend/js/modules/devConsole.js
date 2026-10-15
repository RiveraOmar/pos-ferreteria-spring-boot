// ═════════════════════════════════════════════════════════════════════════════
//  CONSOLA DE DESARROLLO — SQL directo contra PostgreSQL (estilo pgAdmin)
//  Solo visible/accesible para el rol ADMIN (dueño). Control total: SELECT,
//  INSERT, UPDATE, DELETE, DDL... la misma potencia que pgAdmin.
//
//  ⚠️ Sin las validaciones de negocio del resto del sistema. Cada ejecución
//  de cambio pide confirmación explícita y queda registrada en el historial.
// ═════════════════════════════════════════════════════════════════════════════
import { fetchAPI } from '../services/api.js';

let _tablasEsquema = [];

export function initDevConsole(container) {
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="fw-bold mb-0">
                <i class="bi bi-terminal-fill me-2"></i>Consola de Desarrollo
            </h2>
            <span class="badge bg-dark">
                <i class="bi bi-shield-lock me-1"></i>Acceso de administrador</span>
        </div>

        <div class="alert alert-warning py-2 px-3 small mb-3">
            <i class="bi bi-exclamation-triangle-fill me-1"></i>
            Esta consola ejecuta SQL directo contra la base de datos, igual que pgAdmin.
            No tiene las validaciones del resto del sistema. Los cambios
            (INSERT/UPDATE/DELETE/DDL) piden confirmación y quedan en el historial.
        </div>

        <!-- Interruptor de ambiente FEL: producción ↔ pruebas, sin reiniciar -->
        <div class="border rounded p-3 mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2"
            id="dev-ambiente-fel-wrap">
            <div>
                <div class="fw-bold small mb-1">
                    <i class="bi bi-broadcast me-1"></i>Ambiente de facturación (FEL)
                </div>
                <div id="dev-ambiente-fel-actual" class="small text-muted">Consultando...</div>
            </div>
            <div class="btn-group" role="group">
                <button type="button" class="btn btn-sm btn-outline-success" id="dev-btn-fel-produccion">
                    <i class="bi bi-check-circle me-1"></i>Producción
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="dev-btn-fel-pruebas">
                    <i class="bi bi-flask me-1"></i>Pruebas
                </button>
            </div>
        </div>

        <div class="row g-3">
            <!-- Panel del editor -->
            <div class="col-lg-8">
                <div class="border rounded p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <label class="form-label fw-bold small mb-0">Consulta SQL</label>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-secondary" id="dev-limpiar">
                                <i class="bi bi-eraser"></i> Limpiar</button>
                            <button class="btn btn-sm btn-outline-secondary" id="dev-formato">
                                <i class="bi bi-list-columns"></i> Ver tablas</button>
                        </div>
                    </div>
                    <textarea id="dev-sql" class="form-control" rows="8"
                        style="font-family:'Courier New',monospace;font-size:.9rem"
                        placeholder="SELECT * FROM products LIMIT 20;

Ctrl+Enter para ejecutar"></textarea>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <small class="text-muted">Ctrl+Enter para ejecutar</small>
                        <button class="btn btn-dark" id="dev-ejecutar">
                            <i class="bi bi-play-fill me-1"></i>Ejecutar</button>
                    </div>
                </div>

                <!-- Resultados -->
                <div class="border rounded mt-3" id="dev-resultado-wrap" style="display:none">
                    <div class="d-flex justify-content-between align-items-center px-3 py-2"
                        style="background:#26292F;color:#fff;border-radius:8px 8px 0 0">
                        <span id="dev-resultado-titulo" class="small fw-bold"></span>
                        <span id="dev-resultado-tiempo" class="small opacity-75"></span>
                    </div>
                    <div class="table-responsive" style="max-height:420px;overflow-y:auto">
                        <table class="table table-sm table-hover mb-0" id="dev-tabla-resultado"
                            style="font-size:.8rem"></table>
                    </div>
                </div>
                <div id="dev-error-wrap" style="display:none" class="alert alert-danger mt-3"></div>
            </div>

            <!-- Panel lateral: esquema + historial -->
            <div class="col-lg-4">
                <div class="border rounded mb-3">
                    <div class="px-3 py-2 fw-bold small" style="background:#EDEFF2">
                        <i class="bi bi-diagram-3 me-1"></i>Tablas de la base</div>
                    <div style="max-height:220px;overflow-y:auto" id="dev-lista-tablas">
                        <div class="text-center text-muted py-3 small">Cargando...</div>
                    </div>
                </div>
                <div class="border rounded">
                    <div class="d-flex justify-content-between align-items-center px-3 py-2"
                        style="background:#EDEFF2">
                        <span class="fw-bold small"><i class="bi bi-clock-history me-1"></i>Historial</span>
                        <button class="btn btn-sm btn-link p-0" id="dev-refrescar-historial">
                            <i class="bi bi-arrow-clockwise"></i></button>
                    </div>
                    <div style="max-height:340px;overflow-y:auto" id="dev-historial">
                        <div class="text-center text-muted py-3 small">Cargando...</div>
                    </div>
                </div>
            </div>
        </div>`;

    document.getElementById('dev-ejecutar').addEventListener('click', ejecutarConsulta);
    document.getElementById('dev-limpiar').addEventListener('click', () => {
        document.getElementById('dev-sql').value = '';
        document.getElementById('dev-sql').focus();
    });
    document.getElementById('dev-formato').addEventListener('click', cargarEsquema);
    document.getElementById('dev-refrescar-historial').addEventListener('click', cargarHistorial);
    document.getElementById('dev-sql').addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); ejecutarConsulta(); }
    });

    cargarEsquema();
    cargarHistorial();
    cargarAmbienteFel();
    document.getElementById('dev-sql').focus();
}

// ─── AMBIENTE FEL: producción ↔ pruebas, en caliente ─────────────────────────
async function cargarAmbienteFel() {
    const info = document.getElementById('dev-ambiente-fel-actual');
    try {
        const { ambiente } = await fetchAPI('/dev/ambiente-fel');
        pintarAmbienteFel(ambiente);
    } catch (e) {
        info.innerHTML = `<span class="text-danger">No se pudo consultar: ${e.message}</span>`;
    }
    document.getElementById('dev-btn-fel-produccion')
        .addEventListener('click', () => cambiarAmbienteFel('PRODUCCION'));
    document.getElementById('dev-btn-fel-pruebas')
        .addEventListener('click', () => cambiarAmbienteFel('PRUEBAS'));
}

function pintarAmbienteFel(ambiente) {
    const info = document.getElementById('dev-ambiente-fel-actual');
    const esProduccion = ambiente === 'PRODUCCION';
    info.innerHTML = esProduccion
        ? '<span class="badge bg-success">PRODUCCIÓN</span> — timbra facturas REALES ante el SAT'
        : '<span class="badge bg-secondary">PRUEBAS</span> — timbra en el sandbox de FEL, no cuenta ante el SAT';
    document.getElementById('dev-btn-fel-produccion')
        .classList.toggle('btn-success', esProduccion);
    document.getElementById('dev-btn-fel-produccion')
        .classList.toggle('btn-outline-success', !esProduccion);
    document.getElementById('dev-btn-fel-pruebas')
        .classList.toggle('btn-secondary', !esProduccion);
    document.getElementById('dev-btn-fel-pruebas')
        .classList.toggle('btn-outline-secondary', esProduccion);
}

async function cambiarAmbienteFel(destino) {
    const r = await Swal.fire({
        title: destino === 'PRODUCCION' ? '¿Pasar a PRODUCCIÓN?' : '¿Pasar a PRUEBAS?',
        html: destino === 'PRODUCCION'
            ? '<p class="small">Las facturas que timbres a partir de ahora serán ' +
              '<strong>reales ante el SAT</strong> y consumirán tus timbres de verdad.</p>'
            : '<p class="small">Las facturas que timbres a partir de ahora irán al ' +
              '<strong>sandbox de FEL</strong> (no válidas ante el SAT, no consumen timbres).</p>',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Sí, cambiar', cancelButtonText: 'Cancelar',
        confirmButtonColor: destino === 'PRODUCCION' ? '#198754' : '#6c757d'
    });
    if (!r.isConfirmed) return;
    try {
        const { ambiente } = await fetchAPI('/dev/ambiente-fel',
            { method: 'POST', body: { ambiente: destino } });
        pintarAmbienteFel(ambiente);
        Swal.fire({ icon: 'success', title: 'Ambiente actualizado',
            text: 'Ya está activo — no hace falta reiniciar el servidor.',
            timer: 2200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// ─── EJECUTAR ─────────────────────────────────────────────────────────────────
async function ejecutarConsulta() {
    const sql = document.getElementById('dev-sql').value.trim();
    if (!sql) return;

    const primeraPalabra = sql.split(/\s+/)[0].toUpperCase();
    const esLectura = ['SELECT', 'SHOW', 'EXPLAIN', 'WITH'].includes(primeraPalabra);

    // Confirmación explícita para cualquier cosa que NO sea solo lectura
    if (!esLectura) {
        const r = await Swal.fire({
            title: '¿Ejecutar este cambio?',
            html: `<div class="text-start">
                <p class="small text-muted mb-1">Esto modificará datos directamente en la base:</p>
                <pre class="bg-light p-2 rounded small" style="max-height:150px;overflow:auto">${
                    escaparHtml(sql)}</pre>
                <p class="small text-danger mb-0">
                    <i class="bi bi-exclamation-triangle me-1"></i>
                    No hay deshacer. Revisa bien antes de confirmar.</p>
            </div>`,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Sí, ejecutar', cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
        });
        if (!r.isConfirmed) return;
    }

    const btn = document.getElementById('dev-ejecutar');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Ejecutando...';
    document.getElementById('dev-error-wrap').style.display = 'none';

    try {
        const res = await fetchAPI('/dev/query', { method: 'POST', body: { sql } });
        pintarResultado(res);
        cargarHistorial();
    } catch (e) {
        document.getElementById('dev-resultado-wrap').style.display = 'none';
        const errDiv = document.getElementById('dev-error-wrap');
        errDiv.style.display = 'block';
        errDiv.innerHTML = `<i class="bi bi-x-circle me-1"></i>${escaparHtml(e.message)}`;
        cargarHistorial();
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-play-fill me-1"></i>Ejecutar';
    }
}

function pintarResultado(res) {
    const wrap = document.getElementById('dev-resultado-wrap');
    const titulo = document.getElementById('dev-resultado-titulo');
    const tiempo = document.getElementById('dev-resultado-tiempo');
    const tabla = document.getElementById('dev-tabla-resultado');
    wrap.style.display = 'block';
    tiempo.textContent = res.ms + ' ms';

    if (res.tipo === 'consulta') {
        titulo.textContent = res.totalFilas + ' fila(s)';
        if (!res.totalFilas) {
            tabla.innerHTML = `<tr><td class="text-center text-muted py-4">
                Sin resultados</td></tr>`;
            return;
        }
        const encabezado = res.columnas.map(c => `<th>${escaparHtml(c)}</th>`).join('');
        const filas = res.filas.map(f => '<tr>' +
            res.columnas.map(c => `<td>${formatearValor(f[c])}</td>`).join('') +
            '</tr>').join('');
        tabla.innerHTML = `<thead class="table-light"><tr>${encabezado}</tr></thead>
            <tbody>${filas}</tbody>`;
    } else {
        titulo.textContent = '✓ Cambio aplicado';
        tabla.innerHTML = `<tbody><tr><td class="p-3">
            <i class="bi bi-check-circle text-success me-1"></i>
            <strong>${res.filasAfectadas}</strong> fila(s) afectada(s)</td></tr></tbody>`;
    }
}

function formatearValor(v) {
    if (v === null || v === undefined) return '<span class="text-muted fst-italic">null</span>';
    return escaparHtml(String(v));
}

// ─── ESQUEMA (tablas y columnas) ──────────────────────────────────────────────
async function cargarEsquema() {
    const cont = document.getElementById('dev-lista-tablas');
    try {
        const filas = await fetchAPI('/dev/esquema');
        const porTabla = {};
        filas.forEach(f => {
            (porTabla[f.table_name] = porTabla[f.table_name] || []).push(f);
        });
        _tablasEsquema = Object.keys(porTabla).sort();
        cont.innerHTML = _tablasEsquema.map(t => `
            <details class="border-bottom">
                <summary class="px-3 py-2 small fw-bold" style="cursor:pointer">
                    <i class="bi bi-table me-1 text-muted"></i>${t}
                    <span class="text-muted fw-normal">(${porTabla[t].length})</span>
                </summary>
                <div class="px-3 pb-2">
                    ${porTabla[t].map(c => `<div class="small text-muted font-monospace">
                        ${c.column_name} <span class="text-secondary">· ${c.data_type}</span>
                    </div>`).join('')}
                    <button class="btn btn-sm btn-outline-secondary mt-1 py-0 px-2 dev-select-tabla"
                        data-tabla="${t}" style="font-size:.7rem">
                        SELECT * LIMIT 20</button>
                </div>
            </details>`).join('');
        document.querySelectorAll('.dev-select-tabla').forEach(b =>
            b.addEventListener('click', () => {
                document.getElementById('dev-sql').value =
                    `SELECT * FROM ${b.dataset.tabla} LIMIT 20;`;
                ejecutarConsulta();
            }));
    } catch (e) {
        cont.innerHTML = `<div class="text-danger small p-2">${escaparHtml(e.message)}</div>`;
    }
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
async function cargarHistorial() {
    const cont = document.getElementById('dev-historial');
    try {
        const filas = await fetchAPI('/dev/historial');
        if (!filas.length) {
            cont.innerHTML = `<div class="text-center text-muted py-3 small">Sin historial aún</div>`;
            return;
        }
        cont.innerHTML = filas.map(f => {
            const fecha = (f.ejecutado_en || '').replace('T', ' ').substring(0, 16);
            const esError = !!f.error;
            return `<div class="border-bottom px-3 py-2 small dev-hist-item"
                        style="cursor:pointer" data-sql="${escaparHtml(f.sql_texto)}">
                <div class="d-flex justify-content-between">
                    <span class="text-muted" style="font-size:.7rem">${fecha}</span>
                    ${esError
                        ? '<span class="badge bg-danger" style="font-size:.6rem">ERROR</span>'
                        : '<span class="badge bg-success" style="font-size:.6rem">OK</span>'}
                </div>
                <div class="font-monospace text-truncate" style="font-size:.75rem" title="${escaparHtml(f.sql_texto)}">
                    ${escaparHtml(f.sql_texto)}</div>
                ${esError ? `<div class="text-danger" style="font-size:.7rem">${escaparHtml(f.error)}</div>` : ''}
            </div>`;
        }).join('');
        document.querySelectorAll('.dev-hist-item').forEach(el =>
            el.addEventListener('click', () => {
                document.getElementById('dev-sql').value = el.dataset.sql;
                document.getElementById('dev-sql').focus();
            }));
    } catch (e) {
        cont.innerHTML = `<div class="text-danger small p-2">${escaparHtml(e.message)}</div>`;
    }
}

function escaparHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}