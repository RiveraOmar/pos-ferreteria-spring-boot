import { fetchAPI } from '../services/api.js';

export function initCatalogos(container) {
    container.innerHTML = `
        <!-- Encabezado estilo Gonher -->
        <div class="text-white text-center py-4 mb-4 rounded-3"
             style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);">
            <h2 class="fw-bold mb-1" style="letter-spacing:2px">
                <i class="bi bi-funnel-fill me-2" style="color:#e94560"></i>
                CATÁLOGO DE FILTROS
            </h2>
            <p class="mb-0 text-white-50 small">Consulta compatibilidades, equivalencias y especificaciones</p>
        </div>

        <div class="row g-4">
            <!-- COLUMNA IZQUIERDA: Búsqueda por vehículo -->
            <div class="col-md-5">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-header text-white fw-bold py-3"
                         style="background:#0f3460;letter-spacing:1px">
                        <i class="bi bi-car-front me-2"></i> BÚSQUEDA POR VEHÍCULO
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Tipo</label>
                            <select id="sel-tipo" class="form-select">
                                <option value="">— Selecciona tipo —</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Marca</label>
                            <select id="sel-marca" class="form-select" disabled>
                                <option value="">— Selecciona marca —</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Año</label>
                            <select id="sel-anio" class="form-select" disabled>
                                <option value="">— Selecciona año —</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Modelo</label>
                            <select id="sel-modelo" class="form-select" disabled>
                                <option value="">— Selecciona modelo —</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="form-label small fw-bold">Motor</label>
                            <select id="sel-motor" class="form-select" disabled>
                                <option value="">— Selecciona motor —</option>
                            </select>
                        </div>
                        <button class="btn w-100 text-white fw-bold py-2" id="btn-buscar-vehiculo"
                                style="background:#e94560" disabled>
                            <i class="bi bi-search me-2"></i> BUSCAR
                        </button>
                    </div>
                </div>
            </div>

            <!-- COLUMNA DERECHA: Búsqueda dinámica + equivalente -->
            <div class="col-md-7">
                <!-- Búsqueda dinámica -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-header text-white fw-bold py-3"
                         style="background:#0f3460;letter-spacing:1px">
                        <i class="bi bi-lightning-charge me-2"></i> BÚSQUEDA DINÁMICA
                    </div>
                    <div class="card-body">
                        <div class="input-group">
                            <input type="text" id="input-dinamico" class="form-control form-control-lg"
                                placeholder="Año, Marca, Modelo, Motor. (Ej: 2018 Nissan Versa)">
                            <button class="btn text-white fw-bold px-4" id="btn-buscar-dinamico"
                                    style="background:#e94560">
                                <i class="bi bi-search"></i>
                            </button>
                        </div>
                        <div class="form-text mt-1">
                            Escribe cualquier dato y presiona Enter o el botón buscar
                        </div>
                    </div>
                </div>

                <!-- Búsqueda por equivalente -->
                <div class="card border-0 shadow-sm">
                    <div class="card-header text-white fw-bold py-3"
                         style="background:#0f3460;letter-spacing:1px">
                        <i class="bi bi-arrow-left-right me-2"></i> BÚSQUEDA POR EQUIVALENTE
                    </div>
                    <div class="card-body">
                        <div class="input-group">
                            <input type="text" id="input-equivalente" class="form-control form-control-lg"
                                placeholder="Parte del competidor (Ej: PH3614, W7016)">
                            <button class="btn text-white fw-bold px-4" id="btn-buscar-equiv"
                                    style="background:#e94560">
                                <i class="bi bi-search"></i> BUSCAR
                            </button>
                        </div>
                        <div class="form-text mt-1">
                            Busca el equivalente Gonher de otras marcas (FRAM, MANN, WIX, etc.)
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Resultados -->
        <div id="resultados-catalogo" class="mt-4"></div>
    `;

    inicializarEventos();
    cargarTipos();
}


async function cargarTipos() {
    try {
        const tipos = await fetchAPI('/catalogo-filtros/tipos');
        const sel = document.getElementById('sel-tipo');
        tipos.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.textContent = t;
            sel.appendChild(opt);
        });
    } catch (e) { console.error('Error cargando tipos:', e); }
}

function inicializarEventos() {
    const selTipo   = document.getElementById('sel-tipo');
    const selMarca  = document.getElementById('sel-marca');
    const selAnio   = document.getElementById('sel-anio');
    const selModelo = document.getElementById('sel-modelo');
    const selMotor  = document.getElementById('sel-motor');
    const btnBuscar = document.getElementById('btn-buscar-vehiculo');

    selTipo.addEventListener('change', async () => {
        resetSelect(selMarca);  resetSelect(selAnio);
        resetSelect(selModelo); resetSelect(selMotor);
        btnBuscar.disabled = true;
        if (!selTipo.value) return;
        try {
            const marcas = await fetchAPI(`/catalogo-filtros/marcas?tipo=${encodeURIComponent(selTipo.value)}`);
            poblarSelect(selMarca, marcas);
            selMarca.disabled = false;
        } catch (e) { console.error(e); }
    });

    selMarca.addEventListener('change', async () => {
        resetSelect(selAnio); resetSelect(selModelo); resetSelect(selMotor);
        btnBuscar.disabled = true;
        if (!selMarca.value) return;
        try {
            const anios = await fetchAPI(
                `/catalogo-filtros/anios?tipo=${encodeURIComponent(selTipo.value)}&marca=${encodeURIComponent(selMarca.value)}`);
            poblarSelect(selAnio, anios);
            selAnio.disabled = false;
        } catch (e) { console.error(e); }
    });

    selAnio.addEventListener('change', async () => {
        resetSelect(selModelo); resetSelect(selMotor);
        btnBuscar.disabled = true;
        if (!selAnio.value) return;
        try {
            const modelos = await fetchAPI(
                `/catalogo-filtros/modelos?tipo=${encodeURIComponent(selTipo.value)}&marca=${encodeURIComponent(selMarca.value)}&anio=${selAnio.value}`);
            poblarSelect(selModelo, modelos);
            selModelo.disabled = false;
        } catch (e) { console.error(e); }
    });

    selModelo.addEventListener('change', async () => {
        resetSelect(selMotor);
        btnBuscar.disabled = true;
        if (!selModelo.value) return;
        try {
            const motores = await fetchAPI(
                `/catalogo-filtros/motores?tipo=${encodeURIComponent(selTipo.value)}&marca=${encodeURIComponent(selMarca.value)}&modelo=${encodeURIComponent(selModelo.value)}&anio=${selAnio.value}`);
            poblarSelect(selMotor, motores);
            selMotor.disabled = false;
        } catch (e) { console.error(e); }
    });

    selMotor.addEventListener('change', () => {
        btnBuscar.disabled = !selMotor.value;
    });

    btnBuscar.addEventListener('click', async () => {
        const params = new URLSearchParams({
            tipo:   selTipo.value,
            marca:  selMarca.value,
            modelo: selModelo.value,
            anio:   selAnio.value,
            motor:  selMotor.value
        });
        try {
            const resultados = await fetchAPI(`/catalogo-filtros/buscar?${params}`);
            mostrarResultados(resultados,
                `${selMarca.value} ${selModelo.value} ${selAnio.value} — ${selMotor.value}`);
        } catch (e) {
            mostrarError(e.message);
        }
    });

    const inputDinamico = document.getElementById('input-dinamico');
    document.getElementById('btn-buscar-dinamico').addEventListener('click', () => buscarDinamico());
    inputDinamico.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarDinamico(); });

    const inputEquiv = document.getElementById('input-equivalente');
    document.getElementById('btn-buscar-equiv').addEventListener('click', () => buscarEquivalente());
    inputEquiv.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarEquivalente(); });
}

async function buscarDinamico() {
    const q = document.getElementById('input-dinamico').value.trim();
    if (!q || q.length < 2) {
        Swal.fire('Aviso', 'Escribe al menos 2 caracteres.', 'warning');
        return;
    }
    try {
        const resultados = await fetchAPI(`/catalogo-filtros/buscar/dinamico?q=${encodeURIComponent(q)}`);
        mostrarResultados(resultados, `"${q}"`);
    } catch (e) { mostrarError(e.message); }
}

async function buscarEquivalente() {
    const parte = document.getElementById('input-equivalente').value.trim();
    if (!parte || parte.length < 2) {
        Swal.fire('Aviso', 'Ingresa al menos 2 caracteres.', 'warning');
        return;
    }
    try {
        const resultados = await fetchAPI(`/catalogo-filtros/buscar/equivalente?parte=${encodeURIComponent(parte)}`);
        mostrarResultados(resultados, `Equivalente a "${parte}"`);
    } catch (e) { mostrarError(e.message); }
}


function mostrarResultados(resultados, titulo) {
    const contenedor = document.getElementById('resultados-catalogo');

    if (!resultados?.length) {
        contenedor.innerHTML = `
            <div class="alert border-0 shadow-sm d-flex align-items-center" style="background:#fff3cd">
                <i class="bi bi-exclamation-triangle-fill fs-4 me-3 text-warning"></i>
                <div>
                    <strong>Sin resultados para ${titulo}</strong><br>
                    <small class="text-muted">Intenta con otros parámetros o consulta el catálogo web de Gonher.</small>
                </div>
            </div>`;
        return;
    }

    const filas = resultados.map(r => {
        const badge = (val) => val
            ? `<span class="badge text-dark fw-bold px-3 py-2" style="background:#e94560;color:#fff!important;font-size:13px">${val}</span>`
            : `<span class="badge bg-light text-muted border">NR</span>`;

        return `
        <div class="card border-0 shadow-sm mb-3">
            <div class="card-header d-flex justify-content-between align-items-center py-2"
                 style="background:#0f3460;color:#fff">
                <div>
                    <strong>${r.marca} ${r.modelo}</strong>
                    <span class="badge bg-light text-dark ms-2">${r.anioInicio} - ${r.anioFin}</span>
                    <span class="text-white-50 ms-2 small">${r.motor || ''}</span>
                </div>
                <span class="badge" style="background:#e94560">${r.tipo}</span>
            </div>
            <div class="card-body py-3">
                <div class="row g-3 text-center">
                    <div class="col">
                        <div class="small text-muted fw-bold mb-2">
                            <i class="bi bi-droplet-fill text-warning me-1"></i>FILTRO ACEITE
                        </div>
                        ${badge(r.filtroAceite)}
                    </div>
                    <div class="col">
                        <div class="small text-muted fw-bold mb-2">
                            <i class="bi bi-droplet-fill text-info me-1"></i>ACEITE SINTÉTICO
                        </div>
                        ${badge(r.filtroAceiteSin)}
                    </div>
                    <div class="col">
                        <div class="small text-muted fw-bold mb-2">
                            <i class="bi bi-wind me-1 text-primary"></i>FILTRO AIRE
                        </div>
                        ${badge(r.filtroAire)}
                    </div>
                    <div class="col">
                        <div class="small text-muted fw-bold mb-2">
                            <i class="bi bi-fuel-pump me-1 text-danger"></i>COMBUSTIBLE
                        </div>
                        ${badge(r.filtroCombustible)}
                    </div>
                    <div class="col">
                        <div class="small text-muted fw-bold mb-2">
                            <i class="bi bi-house me-1 text-success"></i>CABINA
                        </div>
                        ${badge(r.filtroCabina)}
                    </div>
                </div>
                ${r.notas ? `<div class="mt-2 text-muted small"><i class="bi bi-info-circle me-1"></i>${r.notas}</div>` : ''}
            </div>
        </div>`;
    }).join('');

    contenedor.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0 fw-bold">
                <i class="bi bi-check-circle-fill text-success me-2"></i>
                ${resultados.length} resultado(s) para ${titulo}
            </h5>
            <small class="text-muted">NR = No Recomendado por el fabricante</small>
        </div>
        ${filas}`;

    contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarError(msg) {
    document.getElementById('resultados-catalogo').innerHTML = `
        <div class="alert alert-danger border-0 shadow-sm">
            <i class="bi bi-exclamation-octagon me-2"></i>
            Error al buscar: ${msg}
        </div>`;
}


function poblarSelect(sel, valores) {
    sel.innerHTML = `<option value="">— Selecciona —</option>`;
    valores.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}

function resetSelect(sel) {
    sel.innerHTML = `<option value="">— Selecciona —</option>`;
    sel.disabled = true;
}










