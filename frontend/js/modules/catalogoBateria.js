
import { fetchAPI } from '../services/api.js';

export function initCatalogosBaterias(container) {
    container.innerHTML = `0
        <div class="text-white text-center py-4 mb-4 rounded-3"
             style="background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);">
            <h2 class="fw-bold mb-1" style="letter-spacing:2px">
                <i class="bi bi-battery-charging me-2" style="color:#f59e0b"></i>
                CATÁLOGO DE BATERÍAS
            </h2>
            <p class="mb-0 text-white-50 small">Consulta aplicaciones de acumuladores y baterías recomendadas</p>
        </div>

        <div class="row g-4">
            <div class="col-md-5">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-header text-white fw-bold py-3"
                         style="background:#1f2937;letter-spacing:1px">
                        <i class="bi bi-car-front me-2"></i> BÚSQUEDA POR VEHÍCULO
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Marca</label>
                            <select id="bat-sel-marca" class="form-select">
                                <option value="">— Selecciona marca —</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Modelo</label>
                            <select id="bat-sel-modelo" class="form-select" disabled>
                                <option value="">— Selecciona modelo —</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="form-label small fw-bold">Año (Rango del Catálogo)</label>
                            <select id="bat-sel-anio" class="form-select" disabled>
                                <option value="">— Selecciona período —</option>
                            </select>
                        </div>
                        <button class="btn w-100 text-white fw-bold py-2" id="bat-btn-buscar"
                                style="background:#f59e0b" disabled>
                            <i class="bi bi-search me-2"></i> BUSCAR BATERÍA
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-md-7">
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-header text-white fw-bold py-3"
                         style="background:#1f2937;letter-spacing:1px">
                        <i class="bi bi-lightning-charge me-2"></i> BÚSQUEDA DINÁMICA
                    </div>
                    <div class="card-body">
                        <div class="input-group">
                            <input type="text" id="bat-input-dinamico" class="form-control form-control-lg"
                                placeholder="Año, Marca o Modelo (Ej: 2015 Jetta o Aveo 47)">
                            <button class="btn text-white fw-bold px-4" id="bat-btn-buscar-dinamico"
                                    style="background:#f59e0b">
                                <i class="bi bi-search"></i>
                            </button>
                        </div>
                        <div class="form-text mt-2">
                            Puedes ingresar un año específico (Ej: 2015) y el servidor comprobará si se encuentra dentro de los rangos del catálogo.
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="resultados-baterias" class="mt-4"></div>
    `;

    inicializarEventosBaterias();
    cargarMarcasBaterias();
}


async function cargarMarcasBaterias() {
    try {
        const marcas = await fetchAPI('/catalogo-baterias/marcas');
        const sel = document.getElementById('bat-sel-marca');
        marcas.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            sel.appendChild(opt);
        });
    } catch (e) { 
        console.error('Error cargando marcas de baterías:', e); 
    }
}

function inicializarEventosBaterias() {
    const selMarca  = document.getElementById('bat-sel-marca');
    const selModelo = document.getElementById('bat-sel-modelo');
    const selAnio   = document.getElementById('bat-sel-anio');
    const btnBuscar = document.getElementById('bat-btn-buscar');

    selMarca.addEventListener('change', async () => {
        resetSelectBaterias(selModelo); 
        resetSelectBaterias(selAnio);
        btnBuscar.disabled = true;
        if (!selMarca.value) return;
        try {
            const modelos = await fetchAPI(`/catalogo-baterias/modelos?marca=${encodeURIComponent(selMarca.value)}`);
            poblarSelectBaterias(selModelo, modelos);
        } catch (e) { console.error(e); }
    });

    selModelo.addEventListener('change', async () => {
        resetSelectBaterias(selAnio);
        btnBuscar.disabled = true;
        if (!selModelo.value) return;
        try {
            const anios = await fetchAPI(
                `/catalogo-baterias/anios?marca=${encodeURIComponent(selMarca.value)}&modelo=${encodeURIComponent(selModelo.value)}`);
            poblarSelectBaterias(selAnio, anios);
        } catch (e) { console.error(e); }
    });

    selAnio.addEventListener('change', () => {
        btnBuscar.disabled = !selAnio.value;
    });

    btnBuscar.addEventListener('click', async () => {
        const params = new URLSearchParams({
            marca:     selMarca.value,
            modelo:    selModelo.value,
            anioRango: selAnio.value
        });
        try {
            const resultados = await fetchAPI(`/catalogo-baterias/buscar?${params}`);
            mostrarResultadosBaterias(resultados, `${selMarca.value} ${selModelo.value} (${selAnio.value})`);
        } catch (e) {
            mostrarErrorBaterias(e.message);
        }
    });

    const inputDinamico = document.getElementById('bat-input-dinamico');
    document.getElementById('bat-btn-buscar-dinamico').addEventListener('click', () => buscarBateriasDinamico());
    inputDinamico.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarBateriasDinamico(); });
}

async function buscarBateriasDinamico() {
    const q = document.getElementById('bat-input-dinamico').value.trim();
    if (!q || q.length < 2) {
        Swal.fire('Aviso', 'Escribe al menos 2 caracteres para buscar.', 'warning');
        return;
    }
    try {
        const resultados = await fetchAPI(`/catalogo-baterias/buscar/dinamico?q=${encodeURIComponent(q)}`);
        mostrarResultadosBaterias(resultados, `"${q}"`);
    } catch (e) { 
        mostrarErrorBaterias(e.message); 
    }
}


function mostrarResultadosBaterias(resultados, titulo) {
    const contenedor = document.getElementById('resultados-baterias');

    if (!resultados?.length) {
        contenedor.innerHTML = `
            <div class="alert border-0 shadow-sm d-flex align-items-center" style="background:#fff3cd">
                <i class="bi bi-exclamation-triangle-fill fs-4 me-3 text-warning"></i>
                <div>
                    <strong>Sin registros para ${titulo}</strong><br>
                    <small class="text-muted">Verifica los datos ingresados o consulta el catálogo impreso.</small>
                </div>
            </div>`;
        return;
    }

    const filas = resultados.map(r => {
        const badgeRecomendado = (val) => val
            ? `<span class="badge text-white fw-bold px-4 py-2 fs-5 shadow-sm" style="background:#1f2937">${val}</span>`
            : `<span class="badge bg-light text-muted border">No especificado</span>`;

        const badgeAlternativo = (val) => val
            ? `<span class="badge text-white fw-bold px-4 py-2 fs-5 shadow-sm" style="background:#4b5563">${val}</span>`
            : `<span class="badge bg-light text-muted border small">Ninguno</span>`;

        return `
        <div class="card border-0 shadow-sm mb-3">
            <div class="card-header d-flex justify-content-between align-items-center py-2"
                 style="background:#1f2937;color:#fff">
                <div>
                    <i class="bi bi-car-front-fill me-2" style="color:#f59e0b"></i>
                    <strong>${r.marca} — ${r.modelo}</strong>
                </div>
                <span class="badge bg-warning text-dark fw-bold px-3 py-1">AÑOS: ${r.anioRango}</span>
            </div>
            <div class="card-body py-4">
                <div class="row g-3 text-center">
                    <div class="col-md-6 border-end">
                        <div class="small text-uppercase text-muted fw-bold mb-2">
                            <i class="bi bi-lightning-fill text-warning me-1"></i> Batería Recomendada (BCI)
                        </div>
                        ${badgeRecomendado(r.bateriaRecomendada)}
                    </div>
                    <div class="col-md-6">
                        <div class="small text-uppercase text-muted fw-bold mb-2">
                            <i class="bi bi-gear-wide-connected text-secondary me-1"></i> También le queda
                        </div>
                        ${badgeAlternativo(r.bateriaAlternativa)}
                    </div>
                </div>
                ${r.notas ? `<div class="mt-3 pt-2 border-top text-muted small"><i class="bi bi-info-circle me-1"></i>${r.notas}</div>` : ''}
            </div>
        </div>`;
    }).join('');

    contenedor.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0 fw-bold">
                <i class="bi bi-check-circle-fill text-success me-2"></i>
                ${resultados.length} aplicación(es) encontrada(s) para ${titulo}
            </h5>
        </div>
        ${filas}`;

    contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarErrorBaterias(msg) {
    document.getElementById('resultados-baterias').innerHTML = `
        <div class="alert alert-danger border-0 shadow-sm">
            <i class="bi bi-exclamation-octagon me-2"></i>
            Error al consultar catálogo: ${msg}
        </div>`;
}


function poblarSelectBaterias(sel, valores) {
    sel.innerHTML = `<option value="">— Selecciona —</option>`;
    valores.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}

function resetSelectBaterias(sel) {
    sel.innerHTML = `<option value="">— Selecciona —</option>`;
    sel.disabled = true;
}


