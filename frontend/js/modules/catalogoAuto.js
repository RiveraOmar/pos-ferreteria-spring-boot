// ═════════════════════════════════════════════════════════════════════════════
//  CATÁLOGO AUTOMOTRIZ — bandas, bombas de agua, tensores, tapones,
//  termostatos, mangueras... · 62 marcas · ~27,000 aplicaciones
//
//  Dos búsquedas:
//   1) Por VEHÍCULO: marca → modelo → todas sus partes
//   2) Por NÚMERO DE PARTE: "K060824" → en qué vehículos se usa
// ═════════════════════════════════════════════════════════════════════════════
import { fetchAPI } from '../services/api.js';

export function initCatalogoAuto(container) {
    container.innerHTML = `
        <div class="row g-3 mb-2">
            <div class="col-lg-7">
                <div class="border rounded p-3 h-100">
                    <h6 class="fw-bold mb-2">
                        <i class="bi bi-car-front-fill me-1 text-primary"></i>Por vehículo</h6>
                    <div class="row g-2">
                        <div class="col-5">
                            <select class="form-select form-select-sm" id="auto-marca">
                                <option value="">Marca...</option>
                            </select>
                        </div>
                        <div class="col-7">
                            <input list="auto-modelos" class="form-control form-control-sm"
                                id="auto-modelo" placeholder="Modelo: corolla, civic...">
                            <datalist id="auto-modelos"></datalist>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-5">
                <div class="border rounded p-3 h-100">
                    <h6 class="fw-bold mb-2">
                        <i class="bi bi-upc-scan me-1 text-primary"></i>Por número de parte</h6>
                    <input type="text" class="form-control form-control-sm" id="auto-parte"
                        placeholder='Ej: K060824, 41208, 33568...'>
                </div>
            </div>
        </div>
        <div class="small text-muted mb-1" id="auto-resumen"></div>
        <div class="table-responsive border rounded" id="auto-resultados">
            <div class="text-center py-5 text-muted">
                <i class="bi bi-car-front fs-1 d-block mb-2 opacity-25"></i>
                Elige una marca o escribe un número de parte
            </div>
        </div>`;

    fetchAPI('/catalogo-auto/marcas').then(function(marcas) {
        var sel = document.getElementById('auto-marca');
        marcas.forEach(function(m) {
            var o = document.createElement('option'); o.value = m; o.textContent = m;
            sel.appendChild(o);
        });
    }).catch(function(){});

    var t = null;
    var teclear = function(fn) { return function() { clearTimeout(t); t = setTimeout(fn, 350); }; };

    document.getElementById('auto-marca').addEventListener('change', function() {
        var marca = this.value;
        document.getElementById('auto-modelo').value = '';
        if (marca) {
            fetchAPI('/catalogo-auto/modelos?marca=' + encodeURIComponent(marca))
                .then(function(mods) {
                    document.getElementById('auto-modelos').innerHTML =
                        mods.map(function(m){ return '<option value="'+m+'">'; }).join('');
                });
        }
        buscarVehiculo();
    });
    document.getElementById('auto-modelo').addEventListener('input', teclear(buscarVehiculo));
    document.getElementById('auto-parte').addEventListener('input', teclear(buscarParte));
}

function pintar(filas, resumen) {
    document.getElementById('auto-resumen').textContent = resumen;
    var cont = document.getElementById('auto-resultados');
    if (!filas.length) {
        cont.innerHTML = '<div class="text-center py-4 text-muted">Sin resultados</div>';
        return;
    }
    cont.innerHTML =
        '<table class="table table-hover table-sm align-middle mb-0" style="font-size:.85rem">' +
        '<thead class="table-light" style="font-size:.75rem"><tr>' +
            '<th class="ps-2">Marca / Modelo</th><th>Versión</th><th>Motor</th>' +
            '<th>Años</th><th>Artículo</th><th class="text-end pe-2">No. Parte</th>' +
        '</tr></thead><tbody>' +
        filas.map(function(f) {
            return '<tr>' +
                '<td class="ps-2"><span class="fw-bold">'+f.marca+'</span> '+f.modelo+'</td>' +
                '<td class="small">'+(f.version||'')+'</td>' +
                '<td class="small font-monospace">'+(f.motor||'')+' '+(f.cilindrada||'')+'</td>' +
                '<td class="small">'+(f.anioDesde||'')+(f.anioHasta?'–'+f.anioHasta:'')+'</td>' +
                '<td class="small">'+f.articulo+'</td>' +
                '<td class="text-end pe-2"><span class="badge bg-dark font-monospace">'+f.parte+'</span></td>' +
            '</tr>';
        }).join('') + '</tbody></table>';
}

async function buscarVehiculo() {
    var marca = document.getElementById('auto-marca').value;
    var modelo = document.getElementById('auto-modelo').value.trim();
    if (!marca && modelo.length < 2) return;
    document.getElementById('auto-parte').value = '';
    var cont = document.getElementById('auto-resultados');
    cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    try {
        var filas = await fetchAPI('/catalogo-auto/buscar?marca=' +
            encodeURIComponent(marca) + '&modelo=' + encodeURIComponent(modelo));
        pintar(filas, filas.length + ' aplicación(es)');
    } catch (e) { cont.innerHTML = '<div class="alert alert-danger m-3">'+e.message+'</div>'; }
}

async function buscarParte() {
    var parte = document.getElementById('auto-parte').value.trim();
    if (parte.length < 3) return;
    document.getElementById('auto-marca').value = '';
    document.getElementById('auto-modelo').value = '';
    var cont = document.getElementById('auto-resultados');
    cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    try {
        var filas = await fetchAPI('/catalogo-auto/buscar?parte=' + encodeURIComponent(parte));
        pintar(filas, 'Parte ' + parte + ': ' + filas.length + ' vehículo(s)');
    } catch (e) { cont.innerHTML = '<div class="alert alert-danger m-3">'+e.message+'</div>'; }
}