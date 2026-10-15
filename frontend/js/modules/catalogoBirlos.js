// ═════════════════════════════════════════════════════════════════════════════
//  CATÁLOGO DE BIRLOS — Internacionales León
//  543 especificaciones · 1,169 aplicaciones · 10 marcas
//
//  Tres búsquedas, como en el mostrador:
//   1) Por VEHÍCULO: "¿qué birlo lleva un Tsuru?" → marca + modelo
//   2) Por MEDIDA:   "mide 14.3 de estría"        → Ø en mm O pulgadas
//   3) Por CÓDIGO:   clic en cualquier código      → ficha + aplicaciones
// ═════════════════════════════════════════════════════════════════════════════
import { fetchAPI } from '../services/api.js';
import { parseMedida } from '../services/plantillasmedidas.js';


// Escapa un texto que va DENTRO de un onclick="...('AQUI')".
// Ahi conviven dos lenguajes: el atributo HTML lo delimita " y la cadena de
// JavaScript la delimita '. Hay que escapar para los DOS, en este orden:
//   1. la barra invertida, o los escapes de abajo se rompen entre si
//   2. la comilla simple con \' — escape de JAVASCRIPT
//   3. y hasta el final el HTML: & " < >
// La comilla simple NO se pasa a &#39; a proposito: el navegador la
// decodificaria de vuelta y cerraria la cadena de JS a media instruccion.
function escAttr(s) {
    return String(s ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Lámina del catálogo impreso (con el dibujo y TODAS las medidas del birlo).
// Las imágenes van en: PuntoDeVentaFront/img/catalogo-birlos/pag-N.jpg
function verLamina(pagina, codigo) {
    if (!pagina) return;
    const url = 'img/catalogo-birlos/pag-' + pagina + '.jpg';
    Swal.fire({
        title: (codigo ? codigo + ' — ' : '') + 'Catálogo pág. ' + pagina,
        imageUrl: url,
        imageAlt: 'Lámina del catálogo',
        width: '80%',
        confirmButtonText: 'Cerrar',
        didOpen: () => {
            const img = Swal.getImage();
            img.onerror = () => Swal.update({
                imageUrl: undefined,
                html: '<p class="text-muted">Lámina no disponible. ' +
                      'Copia las imágenes a <code>img/catalogo-birlos/</code>.</p>'
            });
        }
    });
}

window._verLaminaBirlo = verLamina;

export function initCatalogoBirlos(container) {
    container.innerHTML = `
        <div class="row g-3">
            <!-- Búsqueda por vehículo -->
            <div class="col-lg-6">
                <div class="border rounded p-3 h-100">
                    <h6 class="fw-bold mb-2">
                        <i class="bi bi-car-front me-1 text-primary"></i>
                        Por vehículo
                    </h6>
                    <div class="row g-2">
                        <div class="col-5">
                            <select class="form-select form-select-sm" id="bir-marca">
                                <option value="">Todas las marcas</option>
                            </select>
                        </div>
                        <div class="col-7">
                            <input type="text" class="form-control form-control-sm"
                                id="bir-modelo" placeholder="Modelo: tsuru, f-150, rockwell...">
                        </div>
                    </div>
                </div>
            </div>
            <!-- Búsqueda por medida -->
            <div class="col-lg-6">
                <div class="border rounded p-3 h-100">
                    <h6 class="fw-bold mb-2">
                        <i class="bi bi-rulers me-1 text-primary"></i>
                        Por medida de estría / rosca
                    </h6>
                    <div class="row g-2">
                        <div class="col-6">
                            <input type="text" class="form-control form-control-sm"
                                id="bir-estria"
                                placeholder='Ø estría: 14.3, 9/16" o 0.563'>
                        </div>
                        <div class="col-6">
                            <input type="text" class="form-control form-control-sm"
                                id="bir-rosca" placeholder="Rosca: M12, 1/2, 7/16...">
                        </div>
                    </div>
                    <small class="text-muted" style="font-size:.7rem">
                        Acepta mm o pulgadas (con fracciones) — tolerancia ±0.4 mm
                    </small>
                </div>
            </div>
        </div>

        <div class="small text-muted mt-2 mb-1" id="bir-resumen"></div>
        <div class="table-responsive border rounded" id="bir-resultados">
            <div class="text-center py-5 text-muted">
                <i class="bi bi-nut fs-1 d-block mb-2 opacity-25"></i>
                Busca por vehículo o por medida
            </div>
        </div>`;

    // Marcas
    fetchAPI('/catalogo-birlos/marcas').then(marcas => {
        const sel = document.getElementById('bir-marca');
        marcas.forEach(m => {
            const o = document.createElement('option');
            o.value = m; o.textContent = m;
            sel.appendChild(o);
        });
    }).catch(() => {});

    // Eventos (con pausa breve al teclear)
    let t = null;
    const alTeclear = fn => () => { clearTimeout(t); t = setTimeout(fn, 350); };
    document.getElementById('bir-marca').addEventListener('change', buscarPorVehiculo);
    document.getElementById('bir-modelo').addEventListener('input', alTeclear(buscarPorVehiculo));
    document.getElementById('bir-estria').addEventListener('input', alTeclear(buscarPorMedida));
    document.getElementById('bir-rosca').addEventListener('input', alTeclear(buscarPorMedida));
}

// ─── 1) POR VEHÍCULO ─────────────────────────────────────────────────────────
async function buscarPorVehiculo() {
    const marca  = document.getElementById('bir-marca').value;
    const modelo = document.getElementById('bir-modelo').value.trim();
    if (!marca && modelo.length < 2) return;

    const cont = document.getElementById('bir-resultados');
    cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    try {
        const filas = await fetchAPI('/catalogo-birlos/aplicaciones?marca=' +
            encodeURIComponent(marca) + '&q=' + encodeURIComponent(modelo));
        document.getElementById('bir-resumen').textContent =
            `${filas.length} aplicación(es) encontradas`;
        if (!filas.length) {
            cont.innerHTML = '<div class="text-center py-4 text-muted">Sin resultados</div>';
            return;
        }
        cont.innerHTML = `
        <table class="table table-hover table-sm align-middle mb-0" style="font-size:.82rem">
            <thead class="table-light" style="font-size:.72rem">
                <tr><th class="ps-2">Marca</th><th>Aplicación</th>
                    <th class="text-center">Pos.</th><th>Años</th>
                    <th>Código</th><th>Medida</th>
                    <th>Ø Estría</th><th>Tuercas</th><th></th></tr>
            </thead>
            <tbody>` + filas.map(f => `
                <tr>
                    <td class="ps-2 small text-muted">${f.marca}</td>
                    <td class="fw-bold">${f.aplicacion}</td>
                    <td class="text-center">
                        ${f.delantero ? '<span class="badge bg-primary" title="Delantero" style="font-size:.6rem">D</span> ' : ''}
                        ${f.trasero ? '<span class="badge bg-secondary" title="Trasero" style="font-size:.6rem">T</span>' : ''}
                    </td>
                    <td class="small">${f.anio || '—'}</td>
                    <td><a href="#" class="font-monospace fw-bold bir-cod"
                        data-cod="${f.codigo}">${f.codigo}</a></td>
                    <td class="small font-monospace">${f.medida || '<span class="text-muted">s/espec.</span>'}</td>
                    <td class="small">${f.estriaMm != null
                        ? `${f.estriaMm} mm <span class="text-muted">(${f.estriaPulg}")</span>` : '—'}</td>
                    <td class="small text-muted" style="max-width:180px">${f.tuercas || ''}</td>
                    <td class="text-center">${f.pagina
                        ? `<img src="img/catalogo-birlos/pag-${f.pagina}.jpg"
                               class="bir-foto border rounded"
                               data-pag="${f.pagina}" data-cod="${f.codigo}"
                               style="height:38px;width:30px;object-fit:cover;
                                      object-position:top;cursor:zoom-in"
                               title="Clic para ampliar la lámina (pág. ${f.pagina})"
                               loading="lazy"
                               onerror="this.style.display='none'">` : ''}</td>
                </tr>`).join('') + `
            </tbody>
        </table>`;
        activarLinksCodigo();
    } catch (e) {
        cont.innerHTML = `<div class="alert alert-danger m-3">${e.message}</div>`;
    }
}

// ─── 2) POR MEDIDA (mm O pulgadas, con fracciones) ───────────────────────────
async function buscarPorMedida() {
    const estriaTxt = document.getElementById('bir-estria').value.trim();
    const rosca     = document.getElementById('bir-rosca').value.trim();
    if (!estriaTxt && rosca.length < 2) return;

    // El campo acepta "14.3", "14.3 mm", '9/16"', "0.563" —
    // parseMedida (el mismo del buscador de productos) resuelve la unidad.
    let mm = '';
    if (estriaTxt) {
        const m = parseMedida(estriaTxt);
        if (!m) return;
        // sin unidad: los valores chicos (<2) casi seguro son pulgadas
        const esPulg = m.unidad === 'in' || (m.unidad === null && m.valor < 2);
        mm = (esPulg ? m.valor * 25.4 : m.valor).toFixed(2);
    }

    const cont = document.getElementById('bir-resultados');
    cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    try {
        const filas = await fetchAPI('/catalogo-birlos/por-medida?' +
            (mm ? 'estriaMm=' + mm + '&' : '') +
            'rosca=' + encodeURIComponent(rosca));
        document.getElementById('bir-resumen').textContent =
            (mm ? `Ø ${mm} mm ±0.4 — ` : '') + `${filas.length} código(s)`;
        if (!filas.length) {
            cont.innerHTML = '<div class="text-center py-4 text-muted">Sin códigos con esa medida</div>';
            return;
        }
        cont.innerHTML = `
        <table class="table table-hover table-sm align-middle mb-0" style="font-size:.82rem">
            <thead class="table-light" style="font-size:.72rem">
                <tr><th class="ps-2">Código</th><th>Ø Estría</th>
                    <th>Rosca</th><th>Largo</th><th>Tipo</th>
                    <th>Lado</th><th>Desv.</th><th>Pág.</th></tr>
            </thead>
            <tbody>` + filas.map(f => `
                <tr>
                    <td class="ps-2"><a href="#" class="font-monospace fw-bold bir-cod"
                        data-cod="${f.codigo}">${f.codigo}</a></td>
                    <td class="fw-bold">${f.estriaMm} mm
                        <span class="text-muted small">(${f.estriaPulg}")</span></td>
                    <td class="font-monospace small">${f.rosca}</td>
                    <td class="small">${f.largo}</td>
                    <td class="small">${f.tipo === 'H' ? 'Hombro' : 'Estría'}</td>
                    <td class="small">${f.lado === 'L' ? 'Izq.' : 'Der.'}</td>
                    <td class="small text-muted">${f.desviacionMm != null
                        ? '±' + Number(f.desviacionMm).toFixed(2) : ''}</td>
                    <td class="small text-muted">
                        ${f.pagina
                        ? `<img src="img/catalogo-birlos/pag-${f.pagina}.jpg"
                               class="bir-foto border rounded me-1"
                               data-pag="${f.pagina}" data-cod="${f.codigo}"
                               style="height:38px;width:30px;object-fit:cover;
                                      object-position:top;cursor:zoom-in;
                                      vertical-align:middle"
                               title="Clic para ampliar la lámina (pág. ${f.pagina})"
                               loading="lazy"
                               onerror="this.style.display='none'">` : ''}
                        ${f.pagina || ''}</td>
                </tr>`).join('') + `
            </tbody>
        </table>`;
        activarLinksCodigo();
    } catch (e) {
        cont.innerHTML = `<div class="alert alert-danger m-3">${e.message}</div>`;
    }
}

// ─── 3) FICHA DE CÓDIGO (modal: especificación + aplicaciones) ───────────────
function activarLinksCodigo() {
    document.querySelectorAll('.bir-foto').forEach(b =>
        b.addEventListener('click', e => {
            e.preventDefault();
            verLamina(parseInt(b.dataset.pag), b.dataset.cod);
        }));
    document.querySelectorAll('.bir-cod').forEach(a =>
        a.addEventListener('click', async e => {
            e.preventDefault();
            const cod = a.dataset.cod;
            try {
                const d = await fetchAPI('/catalogo-birlos/codigo/' + cod);
                const s = d.especificacion;
                const apps = d.aplicaciones || [];
                Swal.fire({
                    title: cod,
                    width: 640,
                    html: `
                    ${s ? `<div class="text-start small border rounded p-2 mb-2 bg-light d-flex gap-2 align-items-start">
                        ${s.paginaCatalogo ? `<img src="img/catalogo-birlos/pag-${s.paginaCatalogo}.jpg"
                            class="border rounded" style="height:84px;cursor:zoom-in"
                            title="Clic para ampliar"
                            onclick="window._verLaminaBirlo(${s.paginaCatalogo}, '${escAttr(cod)}')"
                            onerror="this.style.display='none'">` : ''}
                        <div>
                        <strong>Ø Estría:</strong> ${s.estriaMm} mm (${s.estriaPulg}") ·
                        <strong>Rosca:</strong> ${s.rosca} ·
                        <strong>Largo:</strong> ${s.largo}<br>
                        <strong>Tipo:</strong> ${s.tipo === 'H' ? 'Hombro' : 'Estría'} ·
                        <strong>Lado:</strong> ${s.lado === 'L' ? 'Izquierdo' : 'Derecho'} ·
                        <strong>Pág. catálogo:</strong> ${s.paginaCatalogo}
                        <button class="btn btn-sm btn-outline-primary py-0 px-2 ms-2"
                            onclick="document.querySelector('.swal2-confirm').click();
                                     setTimeout(() => window._verLaminaBirlo(${s.paginaCatalogo}, '${escAttr(cod)}'), 200)">
                            <i class="bi bi-camera me-1"></i>Ver lámina
                        </button>
                        </div>
                    </div>` : '<p class="small text-muted">Sin especificación registrada.</p>'}
                    <div class="text-start" style="max-height:300px;overflow-y:auto">
                        <table class="table table-sm" style="font-size:.75rem">
                            <thead><tr class="text-muted">
                                <th>Marca</th><th>Aplicación</th><th>Años</th><th>Tuercas</th>
                            </tr></thead>
                            <tbody>${apps.map(x => `
                                <tr><td>${x.marca}</td>
                                    <td class="fw-bold">${x.aplicacion}</td>
                                    <td>${x.anio || '—'}</td>
                                    <td class="text-muted">${x.tuercas || ''}</td></tr>`).join('')
                                || '<tr><td colspan="4" class="text-muted">Sin aplicaciones registradas</td></tr>'}
                            </tbody>
                        </table>
                    </div>`,
                    confirmButtonText: 'Cerrar'
                });
            } catch (err) { /* silencioso */ }
        }));
}