import { fetchAPI } from '../services/api.js';
import {
    validarNumero, validarTexto, validarPrecio, validarSKU,
    validarCantidad, validarURL, validarCostoVsPrecio,
    sanitizar, aplicarFiltroInput, limpiarValidaciones
} from '../services/validaciones.js';
import { SearchSelect } from '../services/searchSelect.js';
import { mostrarFichaProducto } from '../services/productDetailCard.js';
import { initCategorias } from './categorias.js';
import { escanearCodigoBarras, tomarYSubirFoto, urlImagenCompleta } from '../services/camara.js';
import { tieneRol } from '../config.js';

import {
    PLANTILLAS_MEDIDAS, textoDual
} from '../services/plantillasmedidas.js';

const UNIDADES_DECIMALES = new Set([
    'MTR','KGM','GRM','LTR','MLT','CMT','MTK','DMT',
    'DMQ','HLT','TNE','MGM','H87P' // H87P = por peso
]);

const ETIQUETA_UNIDAD = {
    H87:'pza', SET:'juego', KT:'kit', PR:'par', BX:'caja',
    MTR:'m',   CMT:'cm',   MMT:'mm', MTK:'m²',
    KGM:'kg',  GRM:'g',    MGM:'mg', TNE:'ton',
    LTR:'L',   MLT:'mL',   HLT:'hL',
};

function esDecimal(satClaveUnidad) {
    return UNIDADES_DECIMALES.has((satClaveUnidad || '').toUpperCase());
}

function etiquetaUnidad(satClaveUnidad) {
    return ETIQUETA_UNIDAD[(satClaveUnidad || '').toUpperCase()] || 'pza';
}

let productoModalBS;
let editandoId            = null;

let galeriaFotos          = [];
let categoriaFiltroActual = '';
let flatCategories        = [];
let satUnidades           = [];
let ssUnidad              = null;
let ssCategoria            = null;

async function abrirStockMasivo() {
    const r = await Swal.fire({
        title: 'Cargar existencias al catálogo',
        width: 560,
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label fw-bold small">Piezas por producto</label>
                    <input type="number" id="sm-cantidad" class="form-control"
                        value="100" min="0" step="1">
                </div>
                <div class="form-check mb-2">
                    <input class="form-check-input" type="radio" name="sm-modo"
                        id="sm-modo-seguro" value="seguro" checked>
                    <label class="form-check-label small" for="sm-modo-seguro">
                        <strong>Solo los que están en cero</strong> (recomendado)<br>
                        <span class="text-muted">Respeta los productos que ya tienen
                        piezas contadas y da de alta a los que no tienen inventario.</span>
                    </label>
                </div>
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" name="sm-modo"
                        id="sm-modo-todos" value="todos">
                    <label class="form-check-label small" for="sm-modo-todos">
                        <strong>Todo el catálogo</strong><br>
                        <span class="text-danger">Pisa el conteo real de los productos
                        que sí tenían existencias.</span>
                    </label>
                </div>
                <div class="alert alert-warning py-2 small mb-0">
                    <i class="bi bi-exclamation-triangle me-1"></i>
                    Cada cambio queda en la bitácora de ajustes de inventario.
                    Después de facturar, haz un conteo físico y ajusta, o el
                    sistema dejará de reflejar lo que hay en el anaquel.
                </div>
            </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-box-seam me-1"></i>Cargar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#198754',
        preConfirm: () => {
            const cantidad = Number(document.getElementById('sm-cantidad').value);
            if (!Number.isFinite(cantidad) || cantidad < 0) {
                Swal.showValidationMessage('Pon una cantidad válida (0 o más).');
                return false;
            }
            return {
                cantidad,
                soloEnCero: document.getElementById('sm-modo-seguro').checked
            };
        }
    });
    if (!r.isConfirmed) return;

    Swal.fire({
        title: 'Cargando existencias...',
        html: '<div class="spinner-border text-success"></div>',
        allowOutsideClick: false, showConfirmButton: false
    });
    try {
        const res = await fetchAPI('/inventory/stock-masivo', {
            method: 'POST',
            body: {
                cantidad:   r.value.cantidad,
                soloEnCero: r.value.soloEnCero,
                motivo:     'Carga masiva de existencias para facturación'
            }
        });
        await Swal.fire({
            icon: 'success',
            title: 'Existencias actualizadas',
            html: `<div class="text-start small">
                <div><strong>Productos revisados:</strong> ${res.productos}</div>
                <div><strong>Dados de alta en inventario:</strong> ${res.creados}</div>
                <div><strong>Actualizados:</strong> ${res.actualizados}</div>
                <div><strong>Respetados (ya tenían stock):</strong> ${res.respetados}</div>
                <div class="text-muted">Sin cambio: ${res.sinCambio}</div>
            </div>`,
            confirmButtonText: 'Aceptar'
        });
        cargarProductos();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

export async function initProductos(container) {
    satUnidades = await fetchAPI('/sat/unidades').catch(() => []);

    container.innerHTML = `
    <!-- Encabezado -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="mb-0 fw-bold">
                <i class="bi bi-tags me-2"></i>Gestión de Productos
            </h2>
            <p class="text-muted mb-0 small">
                Control de productos, precios y niveles de stock.
            </p>
        </div>
        <div class="d-flex gap-2">
            <button class="btn btn-outline-success shadow-sm" id="btn-stock-masivo"
                title="Dejar todo el catálogo con la misma cantidad de piezas">
                <i class="bi bi-box-seam me-1"></i>Cargar existencias
            </button>
            <button class="btn btn-outline-dark shadow-sm" id="btn-etiquetas"
                title="Imprimir etiquetas de anaquel con precio, código de barras y costo cifrado">
                <i class="bi bi-tags-fill me-1"></i>Etiquetas
            </button>
            <button class="btn btn-primary shadow-sm" id="btn-nuevo-producto">
                <i class="bi bi-plus-lg"></i> Nuevo Producto
            </button>
        </div>
    </div>

    <!-- Pestañas principales -->
    <ul class="nav nav-pills mb-4 bg-light p-2 rounded" id="productTabs">
        <li class="nav-item">
            <button class="nav-link active" id="tab-todos" type="button">
                <i class="bi bi-list-ul"></i> Todos los Productos
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="tab-categorias" type="button">
                <i class="bi bi-tags"></i> Categorías
            </button>
        </li>
    </ul>

    <div id="sub-modulo-container"></div>

    <!-- ═══ MODAL CREAR / EDITAR — TODO EN UN SOLO SCROLL ═══════════════════ -->
    <div class="modal fade" id="productoModal" data-bs-backdrop="static" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <form id="form-producto" class="modal-content" novalidate>
                <div class="modal-header bg-light">
                    <h5 class="modal-title" id="titulo-modal-producto">
                        Datos del Producto
                    </h5>
                    <button type="button" class="btn-close"
                        data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">

                    <!-- ── SECCIÓN PRINCIPAL ─────────────────────────────── -->
                    <div class="row g-3 mb-4">

                        <!-- Nombre -->
                        <div class="col-md-8">
                            <label class="form-label fw-bold small">
                                Nombre del Producto
                                <span class="text-danger">*</span>
                            </label>
                            <input type="text" name="name" id="prod-name"
                                class="form-control"
                                placeholder="Ej: Tornillo hexagonal 1/2&quot; x 3&quot;"
                                maxlength="200"
                                oninput="window._filtro(this,'conMedidas')">
                        </div>

                        <!-- SKU -->
                        <div class="col-md-4">
                            <label class="form-label fw-bold small">
                                Código / SKU <span class="text-danger">*</span>
                            </label>
                            <input type="text" name="sku" id="prod-sku"
                                class="form-control"
                                placeholder="Ej: TORN-001" maxlength="50"
                                oninput="window._filtro(this,'sku')">
                        </div>

                        <!-- Código de barras (opcional) -->
                        <div class="col-md-4">
                            <label class="form-label small">
                                Código de Barras
                                <span class="text-muted">(opcional)</span>
                            </label>
                            <div class="input-group">
                                <input type="text" name="barcode" id="prod-barcode"
                                    class="form-control"
                                    placeholder="Escanea o escribe" maxlength="50"
                                    oninput="window._filtro(this,'sinEspeciales')">
                                <button type="button" class="btn btn-outline-dark"
                                    id="btn-escanear-barcode" title="Escanear con la cámara">
                                    <i class="bi bi-upc-scan"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Código Truper (el del catálogo impreso) -->
<div class="col-md-4">
    <label class="form-label small">
        Código Truper <span class="text-muted">(opcional)</span>
    </label>
    <input type="text" id="prod-codigo-truper"
        class="form-control" inputmode="numeric"
        placeholder="Ej: 100048" maxlength="20"
        oninput="window._filtro(this,'sinEspeciales')">
    <div class="form-text" style="font-size:.72rem">
        El número del catálogo impreso de Truper.
    </div>
</div>

                        <!-- Costo -->
                        <div class="col-md-4">
                            <label class="form-label text-danger fw-bold small">
                                Costo ($)
                            </label>
                            <input type="number" name="costPrice" id="prod-cost"
                                step="0.01" min="0.01" class="form-control"
                                placeholder="0.00"
                                oninput="window._filtro(this,'decimal')">
                            <div class="form-text" id="hint-costo">
                                Dejar vacío al editar para no cambiar.
                            </div>
                        </div>

                        <!-- COMPRA POR BOLSA / VENTA POR PIEZA -->
                        <div class="col-12">
                            <div class="border rounded p-3" style="background:#FAFBFC">
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox"
                                        id="prod-es-bolsa">
                                    <label class="form-check-label small fw-bold"
                                        for="prod-es-bolsa">
                                        <i class="bi bi-box-seam me-1"></i>
                                        Este producto se compra en bolsa/caja pero se vende por pieza
                                    </label>
                                </div>
                                <div id="prod-bolsa-campos" style="display:none">

                                    <!-- COMPRA: lo que te cuesta a ti -->
                                    <div class="mb-2">
                                        <div class="small fw-bold text-danger mb-1">
                                            <i class="bi bi-cart-down me-1"></i>LO QUE TE CUESTA (compra)</div>
                                        <div class="row g-2">
                                            <div class="col-md-4">
                                                <label class="form-label small mb-0">¿Cuántas piezas trae la bolsa?</label>
                                                <input type="number" id="prod-piezas-bolsa"
                                                    class="form-control form-control-sm" min="1" step="1"
                                                    placeholder="Ej: 100 tornillos">
                                            </div>
                                            <div class="col-md-4">
                                                <label class="form-label small mb-0">¿Cuánto te cuesta la bolsa?</label>
                                                <input type="number" id="prod-costo-bolsa"
                                                    class="form-control form-control-sm" min="0.01" step="0.01"
                                                    placeholder="Ej: 150.00">
                                            </div>
                                            <div class="col-md-4">
                                                <label class="form-label small mb-0">
                                                    Costo de cada pieza
                                                    <i class="bi bi-pencil-fill text-muted"
                                                       style="font-size:.7rem" title="Puedes editarlo"></i>
                                                </label>
                                                <div class="input-group input-group-sm">
                                                    <span class="input-group-text">$</span>
                                                    <input type="number" id="prod-cost-pieza"
                                                        step="0.01" min="0"
                                                        class="form-control fw-bold"
                                                        style="color:#2B6CA3"
                                                        placeholder="se calcula solo">
                                                    <button type="button" class="btn btn-outline-secondary"
                                                        id="btn-recalc-costo"
                                                        title="Volver a calcular desde la bolsa">
                                                        <i class="bi bi-arrow-clockwise"></i></button>
                                                </div>
                                                <div class="form-text" id="hint-costo-pieza"
                                                     style="font-size:.68rem"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- VENTA: a cómo la das -->
                                    <div class="mb-1">
                                        <div class="small fw-bold text-success mb-1">
                                            <i class="bi bi-cart-up me-1"></i>A CÓMO LA VENDES</div>
                                        <div class="row g-2">
                                            <div class="col-md-6">
                                                <label class="form-label small mb-0">
                                                    Precio si llevan la BOLSA completa
                                                    <span class="text-muted">(opcional)</span></label>
                                                <div class="input-group input-group-sm">
                                                    <span class="input-group-text">$</span>
                                                    <input type="number" id="prod-precio-bolsa"
                                                        class="form-control" min="0.01" step="0.01"
                                                        placeholder="Ej: 200.00">
                                                </div>
                                                <div class="form-text" style="font-size:.68rem">
                                                    Déjalo vacío si solo vendes por pieza.
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label small mb-0">¿Conviene la bolsa?</label>
                                                <div class="form-control form-control-sm bg-white"
                                                    id="prod-compara-bolsa"
                                                    style="font-size:.76rem;min-height:31px">—</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="alert alert-light border small py-1 px-2 mb-0 mt-2"
                                         style="font-size:.72rem">
                                        <i class="bi bi-info-circle me-1"></i>
                                        El costo por pieza es una <strong>sugerencia editable</strong>:
                                        cámbialo si quieres redondear o poner otro precio. El inventario
                                        se lleva en piezas — al vender una bolsa se descuentan todas sus
                                        piezas del stock.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Precio venta -->
                        <div class="col-md-4">
                            <label class="form-label text-success fw-bold small">
                                Precio de Venta ($) <span class="text-danger">*</span>
                            </label>
                            <input type="number" name="listPrice" id="prod-price"
                                step="0.01" min="0.01" class="form-control"
                                placeholder="0.00"
                                oninput="window._filtro(this,'decimal')">
                        </div>

                        <!-- Stock mínimo -->
                        <div class="col-md-4">
                            <label class="form-label fw-bold small text-warning">
                                Stock Mínimo (Alerta)
                            </label>
                            <input type="number" name="minStockLevel"
                                id="prod-minstock" class="form-control"
                                placeholder="Ej: 10" min="0" step="0.001"
                                oninput="window._filtro(this,'decimal')">
                            <div class="form-text">No puede ser negativo.</div>
                        </div>

                        <!-- Unidad de Medida — controla si acepta fracciones -->
                        <div class="col-md-4">
                            <label class="form-label fw-bold small">
                                Unidad de Medida <span class="text-danger">*</span>
                            </label>
                            <div class="search-wrapper">
                                <i class="bi bi-rulers search-icon"></i>
                                <input type="text" class="search-input
                                    form-control" id="input-satClaveUnidad"
                                    placeholder="Ej: pieza, kg, metro...">
                                <div class="search-dropdown"
                                    id="dropdown-satClaveUnidad"></div>
                            </div>
                            <input type="hidden" name="satClaveUnidad"
                                id="f-satClaveUnidad">
                            <div id="sat-unidad-seleccion" class="mt-1"></div>
                            <!-- Badge que muestra si acepta decimales -->
                            <div id="badge-decimal" class="mt-1"
                                style="display:none"></div>
                        </div>

                        <!-- Categoría — buscador, no un dropdown plano.
                             Con las 491 categorías de Truper cargadas, un
                             <ul> sin filtro obligaba a desplazarse a ciegas
                             por toda la lista para encontrar una. -->
                        <div class="col-md-4">
                            <label class="form-label fw-bold small">Categoría</label>
                            <div class="search-select-wrap position-relative">
                                <input type="text" class="form-control"
                                    id="input-cat-modal" autocomplete="off"
                                    placeholder="Buscar categoría... (o dejar en blanco)">
                                <input type="hidden" name="categoryId"
                                    id="input-cat-id-modal">
                                <button type="button" id="btn-limpiar-cat-modal"
                                    class="btn btn-sm position-absolute"
                                    style="right:4px;top:4px;padding:2px 6px;
                                           display:none;line-height:1"
                                    title="Quitar categoría (Sin Categoría)">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                                <div class="search-dropdown" id="dropdown-cat-modal"></div>
                            </div>
                        </div>

                        <!-- Galería de fotos -->
                        <div class="col-md-8">
                            <label class="form-label small d-flex justify-content-between">
                                <span>Fotos del producto</span>
                                <span class="text-muted" style="font-size:.72rem"
                                    id="galeria-contador"></span>
                            </label>
                            <!-- La foto principal viaja en el payload como siempre -->
                            <input type="hidden" name="imagenUrl" id="prod-imagen-url">

                            <div id="galeria-fotos" class="d-flex flex-wrap gap-2 mb-2"></div>

                            <div class="d-flex gap-2 flex-wrap">
                                <button type="button" class="btn btn-warning btn-sm"
                                    id="btn-foto-producto" title="Tomar foto o elegir de galería">
                                    <i class="bi bi-camera me-1"></i>Tomar foto
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm"
                                    id="btn-foto-url" title="Agregar desde una URL de internet">
                                    <i class="bi bi-link-45deg me-1"></i>Desde URL
                                </button>
                            </div>
                            <div class="form-text" style="font-size:.72rem">
                                La primera foto es la principal (se ve en listas y ventas).
                                Las fotos se comprimen solas al subirlas.
                            </div>
                        </div>

                        <!-- Descripción -->
                        <div class="col-md-4">
                            <label class="form-label small">Descripción</label>
                            <textarea name="description" class="form-control"
                                rows="3" maxlength="500"
                                oninput="window._filtro(this,'conMedidas')"></textarea>
                        </div>

                        <!-- Atributos dinámicos -->
                        <div class="col-12">
                            <div class="d-flex justify-content-between
                                align-items-center mb-2">
                                <label class="form-label fw-bold mb-0 small">
                                    Atributos Dinámicos
                                </label>
                                <div class="d-flex gap-2">
                                    <select class="form-select form-select-sm"
                                        id="plantilla-atributos" style="width:auto"
                                        title="Agrega los campos de medida del tipo de producto">
                                        <option value="">Plantilla de medidas…</option>
                                        <option value="balero">Balero / Rodamiento</option>
                                        <option value="banda">Banda</option>
                                        <option value="microv_gates">Micro V gates</option>
                                        <option value="gs_gates">Bandas GS</option>
                                        <option value="hi_power_gates">Banda Lisa</option>
                                        <option value="tornillo_estandar">Tornillo STDR</option>
                                        <option value="tornillo_metrico">Tornillo MM</option>
                                        <option value="birlo">Birlo</option>
                                        <option value="tornillo">Tornillo / Tuerca</option>
                                    </select>
                                    <button type="button" class="btn btn-sm btn-dark"
                                        id="btn-agregar-atributo">
                                        <i class="bi bi-plus-circle"></i> Agregar
                                    </button>
                                </div>
                            </div>
                            <div class="border rounded p-3 bg-light">
                                <div id="lista-atributos">
                                    <p class="text-muted small text-center mb-0">
                                        Sin atributos.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Proveedores que surten este producto (opcional) -->
                        <div class="col-12">
                            <label class="form-label fw-bold">
                                <i class="bi bi-truck me-1"></i>Proveedores que lo surten
                                <small class="text-muted fw-normal">
                                    — opcional; el costo se llena solo con la primera compra
                                </small>
                            </label>
                            <div class="border rounded p-2 bg-light"
                                id="lista-proveedores-prod"
                                style="max-height:130px;overflow-y:auto">
                                <p class="text-muted small text-center mb-0">
                                    Cargando proveedores...
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- ── Clave Producto/Servicio SAT — siempre visible, ────
                         con valor genérico por default. Solo se busca si el
                         producto necesita una clave SAT específica para CFDI;
                         si no se toca, queda guardado con la clave genérica
                         (01010101) y el producto se puede vender sin problema. ── -->
                    <div class="border rounded-3 p-3 bg-light">
                        <label class="form-label fw-bold small mb-2">
                            <i class="bi bi-receipt me-1 text-primary"></i>
                            Clave Producto/Servicio SAT
                            <span class="badge bg-secondary ms-1 small">
                                Genérica por default
                            </span>
                        </label>
                        <div class="input-group">
                            <input type="text" id="sat-prod-buscar"
                                class="form-control"
                                placeholder="Buscar (ej: tornillo)... o dejar la genérica">
                            <button type="button"
                                class="btn btn-outline-secondary"
                                id="btn-buscar-sat-prod">
                                <i class="bi bi-search"></i>
                            </button>
                        </div>
                        <div id="sat-prod-resultados"
                            class="list-group mt-1"
                            style="max-height:200px;overflow-y:auto;
                                   display:none"></div>
                        <input type="hidden" name="satClaveProdServ"
                            id="f-satClaveProdServ" value="01010101">
                        <div id="sat-prod-seleccion" class="mt-1"></div>
                        <!-- Objeto de impuesto: siempre "Sí objeto de impuesto",
                             oculto porque no hay otro caso real en una ferretería. -->
                        <input type="hidden" name="satObjetoImp"
                            id="f-satObjetoImp" value="02">
                    </div>

                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary"
                        data-bs-dismiss="modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary px-4"
                        id="btn-submit-producto">Guardar</button>
                </div>
            </form>
        </div>
    </div>`;

    function seleccionarUnidadSat(item) {
            document.getElementById('f-satClaveUnidad').value = item.id;
            document.getElementById('input-satClaveUnidad').classList.remove('is-invalid');
            document.getElementById('sat-unidad-seleccion').innerHTML =
                `<span class="badge bg-primary me-1">${item.id}</span>
                 <small class="text-muted">${item.label}</small>
                 <a href="#" class="ms-2 text-danger small"
                    onclick="event.preventDefault();
                        document.getElementById('f-satClaveUnidad').value='';
                        document.getElementById('sat-unidad-seleccion').innerHTML='';
                        document.getElementById('badge-decimal').style.display='none';
                        window._ssUnidad.clear()">✕</a>`;
            const dec = esDecimal(item.id);
            const etq = etiquetaUnidad(item.id);
            const badge = document.getElementById('badge-decimal');
            badge.style.display = 'block';
            badge.innerHTML = dec
                ? `<span class="badge bg-success-subtle text-success border">
                       <i class="bi bi-calculator me-1"></i>
                       Acepta fracciones (${etq})
                   </span>`
                : `<span class="badge bg-secondary-subtle text-secondary border">
                       <i class="bi bi-hash me-1"></i>
                       Solo enteros (${etq})
                   </span>`;
    }

    
    const ALIAS_UNIDAD = {
        pieza:'H87', piezas:'H87', pza:'H87', pzas:'H87', pz:'H87', unidad:'H87',
        kilogramo:'KGM', kilogramos:'KGM', kilo:'KGM', kilos:'KGM', kg:'KGM', kgs:'KGM',
        metro:'MTR', metros:'MTR', mt:'MTR', mts:'MTR', m:'MTR',
        litro:'LTR', litros:'LTR', lt:'LTR', lts:'LTR', l:'LTR',
        gramo:'GRM', gramos:'GRM', gr:'GRM', grs:'GRM', g:'GRM',
        caja:'XBX', cajas:'XBX',
        paquete:'XPK', paquetes:'XPK', paq:'XPK',
        juego:'SET', juegos:'SET', set:'SET', kit:'KT',
        bolsa:'XBG', bolsas:'XBG',
        par:'PR', pares:'PR',
        docena:'DZN', docenas:'DZN',
        tonelada:'TNE', ton:'TNE',
        centimetro:'CMT', cm:'CMT',
        mililitro:'MLT', ml:'MLT',
        pulgada:'INH', pulgadas:'INH',
        'metro cuadrado':'MTK', m2:'MTK',
        'metro cubico':'MTQ', m3:'MTQ',
        hora:'HUR', horas:'HUR',
        servicio:'E48', actividad:'ACT',
    };

    const itemsUnidad = satUnidades.map(r => ({ id: r[0], label: r[1], sub: r[0] }));
    const normUni = s => s.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    function autoSeleccionarUnidad(conFallback = false) {
        const inp = document.getElementById('input-satClaveUnidad');
        const texto = normUni(inp.value || '');
        if (!texto) return false;

        let item = null;
        const clave = ALIAS_UNIDAD[texto];
        if (clave) item = itemsUnidad.find(i => i.id === clave);
        if (!item) item = itemsUnidad.find(i =>
            normUni(i.id) === texto || normUni(i.label) === texto);
        if (!item && conFallback) {
            const arranca = itemsUnidad.filter(i =>
                normUni(i.label).startsWith(texto));
            if (arranca.length === 1) item = arranca[0];
        }
        if (!item) return false;

        seleccionarUnidadSat(item);
        inp.value = item.label;
        document.getElementById('dropdown-satClaveUnidad').style.display = 'none';
        return true;
    }

    function itemsDeCategorias() {
        return flatCategories.map(c => {
            const padreId = c.parent?.id ?? c.parentId;
            const padre = padreId ? flatCategories.find(x => x.id === padreId) : null;
            return { id: c.id, label: c.name, sub: padre ? padre.name : null };
        });
    }

    const inpCat = document.getElementById('input-cat-modal');
    const btnLimpiarCat = document.getElementById('btn-limpiar-cat-modal');

    function elegirCategoria(item) {
        document.getElementById('input-cat-id-modal').value = item ? item.id : '';
        btnLimpiarCat.style.display = item ? '' : 'none';
    }

    ssCategoria = new SearchSelect({
        input:    inpCat,
        dropdown: document.getElementById('dropdown-cat-modal'),
        items:    itemsDeCategorias(),
        onSelect: elegirCategoria,
        placeholder: 'Buscar categoría... (o dejar en blanco)'
    });
    window._ssCategoria = ssCategoria;

    btnLimpiarCat.addEventListener('click', () => {
        ssCategoria.clear();
        elegirCategoria(null);
        inpCat.focus();
    });
    inpCat.addEventListener('input', () => {
        btnLimpiarCat.style.display = inpCat.value.trim() ? '' : 'none';
    });

    ssUnidad = new SearchSelect({
        input:    document.getElementById('input-satClaveUnidad'),
        dropdown: document.getElementById('dropdown-satClaveUnidad'),
        items:    itemsUnidad,
        onSelect: seleccionarUnidadSat,
        placeholder: 'Ej: pieza, kg, metro...'
    });
    window._ssUnidad = ssUnidad;

    {
        const inpUni = document.getElementById('input-satClaveUnidad');
        let tUni = null;
        inpUni.addEventListener('input', () => {
            clearTimeout(tUni);
            tUni = setTimeout(() => autoSeleccionarUnidad(false), 350);
        });
        inpUni.addEventListener('blur',
            () => setTimeout(() => autoSeleccionarUnidad(true), 150));
        inpUni.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();          
                autoSeleccionarUnidad(true);
            }
        });
    }

    
    document.getElementById('btn-escanear-barcode')?.addEventListener('click', async () => {
        const codigo = await escanearCodigoBarras();
        if (codigo) {
            document.getElementById('prod-barcode').value = codigo;
            window.mostrarToast?.('Código escaneado: ' + codigo, 'success');
        }
    });

   document.getElementById('btn-escanear-busqueda')?.addEventListener('click', async () => {
    const codigo = await escanearCodigoBarras();

    if (codigo) {
        const inp = document.getElementById('filter-search');

        const codigoCorregido = String(codigo)
            .replace(/[’‘']/g, '.');

        inp.value = codigoCorregido;

        buscarEnTabla(codigoCorregido);

        window.mostrarToast?.('Buscando: ' + codigoCorregido, 'info');
    }
});

    document.getElementById('btn-foto-producto')?.addEventListener('click', async () => {
        if (galeriaFotos.length >= MAX_FOTOS) {
            Swal.fire('Máximo alcanzado',
                `Un producto puede tener hasta ${MAX_FOTOS} fotos. Borra alguna para agregar otra.`,
                'info');
            return;
        }
        const url = await tomarYSubirFoto();
        if (url) await agregarFotoGaleria(url);
    });

    
document.getElementById('btn-foto-url')?.addEventListener('click', async () => {

    if (galeriaFotos.length >= MAX_FOTOS) {
        Swal.fire(
            'Máximo alcanzado',
            `Un producto puede tener hasta ${MAX_FOTOS} fotos.`,
            'info'
        );
        return;
    }

    const r = await Swal.fire({
        title: 'Foto desde URL',

        html: `
            <div style="text-align:left;">

                <label style="font-size:.9rem; margin-bottom:6px; display:block;">
                    URL de la imagen:
                </label>

                <input
                    id="input-url-foto"
                    type="text"
                    class="swal2-input"
                    placeholder="Pega aquí la URL de la imagen"
                    autocomplete="off"
                    style="width:90%; margin:0 auto 15px auto;"
                >

                <div
                    id="preview-url-foto"
                    style="
                        display:none;
                        text-align:center;
                        margin-top:10px;
                        padding:10px;
                        border:1px solid #ddd;
                        border-radius:8px;
                    "
                >

                    <div style="
                        font-size:.8rem;
                        color:#666;
                        margin-bottom:8px;
                    ">
                        Vista previa
                    </div>

                    <img
                        id="img-preview-url"
                        src=""
                        alt="Vista previa"
                        style="
                            max-width:100%;
                            max-height:220px;
                            object-fit:contain;
                            border-radius:6px;
                        "
                    >

                </div>

                <div
                    id="error-preview-url"
                    style="
                        display:none;
                        color:#dc3545;
                        font-size:.8rem;
                        margin-top:10px;
                        text-align:center;
                    "
                >
                    No se pudo cargar la imagen desde esta URL.
                </div>

            </div>
        `,

        showCancelButton: true,
        confirmButtonText: 'Agregar',
        cancelButtonText: 'Cancelar',

        heightAuto: false,

        
        target: document.getElementById('productoModal'),

        didOpen: () => {

            const input = document.getElementById('input-url-foto');
            const preview = document.getElementById('preview-url-foto');
            const img = document.getElementById('img-preview-url');
            const error = document.getElementById('error-preview-url');

            setTimeout(() => {
                input.focus();
            }, 100);

            input.addEventListener('input', () => {

                const url = input.value.trim();

                if (!url) {
                    preview.style.display = 'none';
                    error.style.display = 'none';
                    img.src = '';
                    return;
                }

                img.onload = () => {
                    preview.style.display = 'block';
                    error.style.display = 'none';
                };

                img.onerror = () => {
                    preview.style.display = 'none';
                    error.style.display = 'block';
                };

                img.src = url;
            });

        },

        preConfirm: () => {

            const input = document.getElementById('input-url-foto');

            const url = input?.value.trim();

            if (!url) {

                Swal.showValidationMessage(
                    'Pega primero la URL de la imagen.'
                );

                return false;
            }

            return url;
        }
    });

    if (r.isConfirmed && r.value) {

        await agregarFotoGaleria(r.value.trim());

    }

});

    document.getElementById('btn-buscar-sat-prod')
        .addEventListener('click', buscarClaveSat);
    document.getElementById('sat-prod-buscar')
        .addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); buscarClaveSat(); }
        });

    document.getElementById('productoModal')
        .addEventListener('hidden.bs.modal',
            () => limpiarValidaciones('form-producto'));
    productoModalBS = new bootstrap.Modal(
        document.getElementById('productoModal'));
    document.getElementById('form-producto').onsubmit    = guardarProducto;
    document.getElementById('btn-nuevo-producto').onclick = () => abrirModal();
    document.getElementById('btn-etiquetas').onclick = abrirSelectorEtiquetas;

    const btnStock = document.getElementById('btn-stock-masivo');
    if (!tieneRol('ADMIN')) btnStock.classList.add('d-none');
    else btnStock.onclick = abrirStockMasivo;
    document.getElementById('btn-agregar-atributo').onclick =
        () => agregarFilaAtributo();

    document.getElementById('plantilla-atributos').onchange = (e) => {
        const tpl = PLANTILLAS_MEDIDAS[e.target.value];
        if (!tpl) return;
        const existentes = new Set(
            [...document.querySelectorAll('.fila-atributo .attr-k')]
                .map(i => i.value.trim().toLowerCase()));
        tpl.campos.forEach(campo => {
            if (!existentes.has(campo.clave.toLowerCase()))
                agregarFilaAtributo(campo.clave, '');
        });
        e.target.value = '';   
    };
    
    window.onRestockSuccess = null;

    
    window._filtro = aplicarFiltroInput;

    const sub = document.getElementById('sub-modulo-container');

    
    const marcarTab = (id) => {
        ['tab-todos', 'tab-categorias'].forEach(t =>
            document.getElementById(t)?.classList.toggle('active', t === id));
    };
    document.getElementById('tab-todos').onclick = () => {
        marcarTab('tab-todos');
        renderVistaPrincipal(sub);
    };
    
    document.getElementById('tab-categorias').onclick = () => {
        marcarTab('tab-categorias');
        initCategorias(sub);
    };

    renderVistaPrincipal(sub);
    cargarCategorias();
}

async function buscarClaveSat() {
    const q = document.getElementById('sat-prod-buscar').value.trim();
    if (!q || q.length < 3) {
        Swal.fire('Aviso', 'Escribe al menos 3 caracteres.', 'warning'); return;
    }
    try {
        const resultados = await fetchAPI(
            `/sat/productos/buscar?q=${encodeURIComponent(q)}`);
        const contenedor = document.getElementById('sat-prod-resultados');
        if (!resultados.length) {
            contenedor.innerHTML =
                '<a class="list-group-item disabled">Sin resultados</a>';
            contenedor.style.display = 'block'; return;
        }
        contenedor.innerHTML = resultados.map(r => `
            <a href="#" class="list-group-item list-group-item-action small py-1"
                data-clave="${r[0]}" data-desc="${r[1]}">
                <span class="badge bg-secondary me-1">${r[0]}</span>${r[1]}
            </a>`).join('');
        contenedor.style.display = 'block';
        contenedor.querySelectorAll('a[data-clave]').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                document.getElementById('f-satClaveProdServ').value = a.dataset.clave;
                document.getElementById('sat-prod-buscar').value    = '';
                document.getElementById('sat-prod-seleccion').innerHTML =
                    `<span class="badge bg-primary me-1">${a.dataset.clave}</span>
                     <small class="text-muted">${a.dataset.desc}</small>
                     <a href="#" class="ms-2 text-danger small"
                        onclick="event.preventDefault();
                            document.getElementById('f-satClaveProdServ').value='';
                            document.getElementById('sat-prod-seleccion').innerHTML=''">
                        ✕ quitar</a>`;
                contenedor.style.display = 'none';
            });
        });
    } catch (e) { console.error(e); }
}

async function renderVistaPrincipal(container) {
    container.innerHTML = `
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body py-3">
                <div class="row g-3">
                    <div class="col-md-8">
                        <!-- 3 buscadores separados: cada uno para un tipo de
                             búsqueda distinto, sin adivinar en qué caja escribir. -->
                        <ul class="nav nav-pills nav-fill mb-2" id="prod-buscador-tabs"
                            style="gap:4px">
                            <li class="nav-item">
                                <button type="button" class="nav-link active w-100"
                                    data-tab-buscar-prod="general" style="font-size:.85rem">
                                    <i class="bi bi-search me-1"></i>General
                                </button>
                            </li>
                            <li class="nav-item">
                                <button type="button" class="nav-link w-100"
                                    data-tab-buscar-prod="truper" style="font-size:.85rem">
                                    <i class="bi bi-upc me-1"></i>Cód. Truper
                                </button>
                            </li>
                            <li class="nav-item">
                                <button type="button" class="nav-link w-100"
                                    data-tab-buscar-prod="atributo" style="font-size:.85rem">
                                    <i class="bi bi-tags me-1"></i>Por atributo
                                </button>
                            </li>
                        </ul>

                        <!-- Panel 1: General (nombre, SKU, descripción, escaneo) -->
                        <div id="prod-panel-general" class="prod-buscador-panel">
                            <div class="d-flex gap-2 align-items-start">
                                <div class="search-wrapper flex-grow-1">
                                    <i class="bi bi-search search-icon"></i>
                                    <input type="text" id="filter-search"
                                        class="search-input form-control" autofocus
                                        autocomplete="off"
                                        placeholder="Buscar por nombre, SKU o descripción...">
                                </div>
                                <button class="btn btn-outline-dark" id="btn-escanear-busqueda"
                                    title="Buscar producto escaneando"
                                    style="height:fit-content;padding:.65rem .9rem">
                                    <i class="bi bi-upc-scan"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Panel 2: Código Truper (el del catálogo impreso) -->
                        <div id="prod-panel-truper" class="prod-buscador-panel" style="display:none">
                            <div class="search-wrapper">
                                <i class="bi bi-upc search-icon"></i>
                                <input type="text" id="filter-truper"
                                    class="search-input form-control" inputmode="numeric"
                                    placeholder="Código Truper del catálogo impreso (ej: 100048)...">
                            </div>
                        </div>

                        <!-- Panel 3: Por atributo — búsqueda múltiple por plantilla -->
                        <div id="prod-panel-atributo" class="prod-buscador-panel" style="display:none">
                            <div class="row g-2 align-items-end">
                                <div class="col-md-6">
                                    <label class="form-label small fw-bold mb-1">
                                        <i class="bi bi-diagram-3 me-1"></i>
                                        Tipo de producto
                                    </label>
                                    <select id="filtro-plantilla-atributo" class="form-select">
                                        <option value="">Selecciona una plantilla...</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <div id="info-resultado-atributos" class="small text-muted pb-1">
                                        Selecciona una plantilla para comenzar.
                                    </div>
                                </div>
                            </div>

                            <div id="filtros-multiples-atributos" class="mt-2"></div>

                            <div class="mt-2">
                                <button type="button" id="btn-agregar-filtro-atributo"
                                    class="btn btn-sm btn-outline-primary" disabled>
                                    <i class="bi bi-plus-circle me-1"></i>
                                    Agregar atributo
                                </button>
                                <button type="button" id="btn-limpiar-filtros-atributo"
                                    class="btn btn-sm btn-outline-secondary ms-1">
                                    <i class="bi bi-x-circle me-1"></i>
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="dropdown">
                            <button class="btn btn-outline-secondary w-100
                                text-start dropdown-toggle" type="button"
                                id="btn-cat-main"
                                data-bs-toggle="dropdown"
                                data-bs-auto-close="outside">
                                <i class="bi bi-funnel me-1"></i>
                                <span id="label-cat-filtro">
                                    Todas las categorías
                                </span>
                            </button>
                            <ul class="dropdown-menu w-100 shadow"
                                id="dropdown-categorias-filtro"
                                style="max-height:400px;overflow-y:auto"></ul>
                        </div>
                        <label class="form-label fw-bold small mb-1 mt-3 d-block">
                            <i class="bi bi-eye me-1"></i>¿Qué productos mostrar?
                        </label>
                        <div class="btn-group btn-group-sm w-100" id="prod-filtro-estado">
                            <button type="button" class="btn btn-outline-secondary active"
                                data-estado="activos" title="Los que se venden hoy">
                                <i class="bi bi-check-circle me-1"></i>Activos</button>
                            <button type="button" class="btn btn-outline-secondary"
                                data-estado="inactivos" title="Dados de alta pero desactivados">
                                <i class="bi bi-moon me-1"></i>Dormidos</button>
                            <button type="button" class="btn btn-outline-secondary"
                                data-estado="todos">Todos</button>
                        </div>
                        <small class="text-muted d-block mt-1">
                            "Catálogo dormido" son los productos dados de alta pero
                            <strong>desactivados</strong>: no salen en Ventas ni en Faltantes
                            hasta que los actives.
                        </small>
                    </div>
                </div>
            </div>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2"
            id="prod-barra-seleccion" style="display:none !important">
            <div class="small"><strong id="prod-cnt-seleccion">0</strong> producto(s) seleccionados</div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-success" id="btn-activar-seleccionados">
                    <i class="bi bi-check-circle me-1"></i>Activar seleccionados
                </button>
                <button class="btn btn-sm btn-outline-danger" id="btn-desactivar-seleccionados">
                    <i class="bi bi-slash-circle me-1"></i>Desactivar seleccionados
                </button>
            </div>
        </div>
        <div class="card shadow-sm border-0">
            <div class="table-responsive" style="overflow-x:auto;min-width:0">
                <table class="table table-hover align-middle mb-0" style="min-width:900px">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-3" style="width:36px">
                                <input type="checkbox" class="form-check-input" id="prod-check-todos">
                            </th>
                            <th class="ps-2">SKU</th>
                            <th>Producto</th>
                            <th>Categoría</th>
                            <th class="text-end">Costo</th>
                            <th class="text-end">Venta</th>
                            <th class="text-center">Stock</th>
                            <th class="text-center">SAT</th>
                            <th class="text-center">Estado</th>
                            <th class="text-center pe-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-productos-body">
                        <tr><td colspan="10" class="text-center py-4">
                            <div class="spinner-border text-primary"></div>
                        </td></tr>
                    </tbody>
                </table>
            </div>
            <div id="paginacion-productos" class="card-footer bg-white"
                 style="display:none"></div>
        </div>`;

    setTimeout(() => document.getElementById('filter-search')?.focus(), 50);

    const inpBuscar = document.getElementById('filter-search');

    let _timerSug = null;
    inpBuscar.addEventListener('input', () => {
        clearTimeout(_timerSug);
        const v = inpBuscar.value;
        _timerSug = setTimeout(() => buscarEnTabla(v), 250);
    });

    inpBuscar.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(_timerSug);
            buscarEnTabla(inpBuscar.value);
            return;
        }
        if (e.key === 'Escape') {
            e.target.value = '';
            buscarEnTabla('');
        }
    });

    const inputTruper = document.getElementById('filter-truper');
    let timerTruper = null;
    inputTruper.addEventListener('input', () => {
        clearTimeout(timerTruper);
        const v = inputTruper.value;
        timerTruper = setTimeout(() => buscarEnTabla(v), 250);
    });
    inputTruper.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(timerTruper);
            buscarEnTabla(inputTruper.value);
        }
        if (e.key === 'Escape') { e.target.value = ''; buscarEnTabla(''); }
    });

    document.querySelectorAll('#prod-filtro-estado [data-estado]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.estado === filtroEstado);
        btn.addEventListener('click', () => {
            filtroEstado = btn.dataset.estado;
            document.querySelectorAll('#prod-filtro-estado [data-estado]')
                .forEach(b => b.classList.toggle('active', b === btn));
            const q = document.getElementById('filter-search').value;
            if (q.trim().length >= 2) buscarEnTabla(q);
            else if (catalogoCache) { paginaActual = 1; pintarPagina(); }
            else estadoInicialProductos();
        });
    });

   configurarPestanasBuscadorProductos();
inicializarBuscadorAtributos();
configurarSeleccionMultipleProductos();

await cargarCategoriasDropdownFiltro();


estadoInicialProductos();
await verTodosPaginado();
}


function configurarPestanasBuscadorProductos() {
    document.querySelectorAll('#prod-buscador-tabs [data-tab-buscar-prod]').forEach(btn => {
        btn.addEventListener('click', () => activarPestanaBuscadorProductos(btn.dataset.tabBuscarProd));
    });
}

function activarPestanaBuscadorProductos(tab) {
    document.querySelectorAll('#prod-buscador-tabs [data-tab-buscar-prod]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tabBuscarProd === tab);
    });
    document.getElementById('prod-panel-general').style.display  = tab === 'general'  ? '' : 'none';
    document.getElementById('prod-panel-truper').style.display   = tab === 'truper'   ? '' : 'none';
    document.getElementById('prod-panel-atributo').style.display = tab === 'atributo' ? '' : 'none';

    if (tab !== 'general')  { document.getElementById('filter-search').value = ''; }
    if (tab !== 'truper')   { document.getElementById('filter-truper').value = ''; }
    if (tab !== 'atributo') {
        filtrosAtributosActivos = [];
        const contenedor = document.getElementById('filtros-multiples-atributos');
        if (contenedor) contenedor.innerHTML = '';
        const plantilla = document.getElementById('filtro-plantilla-atributo');
        if (plantilla) plantilla.value = '';
        const btnAgregar = document.getElementById('btn-agregar-filtro-atributo');
        if (btnAgregar) btnAgregar.disabled = true;
    }

    if (tab === 'atributo') aplicarFiltros();
    else buscarEnTabla(tab === 'general'
        ? document.getElementById('filter-search').value
        : document.getElementById('filter-truper').value);

    setTimeout(() => {
        if (tab === 'general')  document.getElementById('filter-search').focus();
        if (tab === 'truper')   document.getElementById('filter-truper').focus();
        if (tab === 'atributo') document.getElementById('filtro-plantilla-atributo').focus();
    }, 30);
}


function configurarSeleccionMultipleProductos() {
    const tabla = document.getElementById('tabla-productos-body');
    const barra = document.getElementById('prod-barra-seleccion');
    const cnt   = document.getElementById('prod-cnt-seleccion');
    const checkTodos = document.getElementById('prod-check-todos');

    const actualizar = () => {
        const marcados = tabla.querySelectorAll('.prod-check:checked');
        cnt.textContent = marcados.length;
        barra.style.setProperty('display', marcados.length ? 'flex' : 'none', 'important');
    };

    tabla.addEventListener('change', e => {
        if (e.target.classList.contains('prod-check')) actualizar();
    });

    
    tabla.addEventListener('click', e => {
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        const id = Number(btn.dataset.id);
        switch (btn.dataset.accion) {
            case 'ver':     window.verFichaProducto(id); break;
            case 'editar':  window.editarProducto(id);   break;
            case 'estado':  window.eliminarProducto(id, btn.dataset.activo === 'true'); break;
            case 'ajustar': window.abrirAjusteStock(
                                id,
                                btn.dataset.nombre,
                                Number(btn.dataset.stock),
                                btn.dataset.unidad); break;
            case 'restock': window.abrirRestock(
                                id,
                                btn.dataset.nombre,
                                Number(btn.dataset.stock),
                                Number(btn.dataset.precio),
                                btn.dataset.unidad); break;
        }
    });

    checkTodos.addEventListener('change', () => {
        tabla.querySelectorAll('.prod-check').forEach(c => c.checked = checkTodos.checked);
        actualizar();
    });

    
    document.getElementById('btn-activar-seleccionados').addEventListener('click', async () => {
        const ids = [...tabla.querySelectorAll('.prod-check:checked')]
            .filter(c => c.dataset.active !== 'true')
            .map(c => Number(c.value));
        if (!ids.length) {
            Swal.fire({ icon:'info', title:'Ya estaban activos',
                text:'Los seleccionados ya estaban disponibles para vender.',
                timer:2000, showConfirmButton:false });
            return;
        }
        const r = await Swal.fire({
            title: `¿Activar ${ids.length} producto(s)?`,
            html: '<p class="small mb-0">Van a empezar a aparecer en Ventas, ' +
                  'en los buscadores y en Faltantes.</p>',
            icon:'question', showCancelButton:true,
            confirmButtonText:'Sí, activar', cancelButtonText:'Cancelar',
            confirmButtonColor:'#198754'
        });
        if (!r.isConfirmed) return;
        try {
            await fetchAPI('/products/estado-masivo',
                { method:'PATCH', body:{ ids, activo:true } });
            catalogoCache = null;
            checkTodos.checked = false;
            Swal.fire({ icon:'success', title:`${ids.length} producto(s) activados`,
                timer:1600, showConfirmButton:false });
            const q = document.getElementById('filter-search').value;
            if (q.trim().length >= 2) buscarEnTabla(q); else aplicarFiltros();
            if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });

    document.getElementById('btn-desactivar-seleccionados').addEventListener('click', async () => {
        const marcados = [...tabla.querySelectorAll('.prod-check:checked')]
            .filter(c => c.dataset.active === 'true');   // solo los que SÍ están activos
        if (!marcados.length) {
            Swal.fire({ icon: 'info', title: 'Ya estaban inactivos',
                text: 'Los seleccionados ya estaban desactivados.',
                timer: 2000, showConfirmButton: false });
            return;
        }
        const r = await Swal.fire({
            title: `¿Desactivar ${marcados.length} producto(s)?`,
            html: `<p class="small mb-0">No aparecerán en Ventas hasta que los actives de nuevo.</p>`,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Sí, desactivar', cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
        });
        if (!r.isConfirmed) return;
        try {
            
            await fetchAPI('/products/estado-masivo', {
                method: 'PATCH',
                body: { ids: marcados.map(c => Number(c.value)), activo: false }
            });
            catalogoCache = null;
            checkTodos.checked = false;
            Swal.fire({ icon: 'success', title: `${marcados.length} producto(s) desactivados`,
                timer: 1600, showConfirmButton: false });
            aplicarFiltros();
            if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });
}

function estadoInicialProductos() {
    const tabla = document.getElementById('tabla-productos-body');
    if (!tabla) return;

    ocultarPaginacion();

    tabla.innerHTML = `
        <tr>
            <td colspan="10" class="text-center text-muted py-5">
                <div class="spinner-border text-primary mb-3"
                     role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>

                <h5 class="fw-bold mb-1">
                    Cargando productos...
                </h5>

                <p class="small mb-0">
                    Estamos cargando el catálogo.
                </p>
            </td>
        </tr>`;
}




let filtroEstado = 'activos';

function pasaFiltroEstado(p) {
    if (filtroEstado === 'activos')   return p.active !== false;
    if (filtroEstado === 'inactivos') return p.active === false;
    return true;
}

let catalogoCache  = null;   
let paginaActual   = 1;
const POR_PAGINA   = 50;

window.verTodosPaginado = async () => {
    const tabla = document.getElementById('tabla-productos-body');
    if (!catalogoCache) {
        tabla.innerHTML = `<tr><td colspan="10" class="text-center py-5">
            <div class="spinner-border text-warning"></div>
            <p class="text-muted small mt-2 mb-0">
                Cargando el catálogo completo (solo esta vez)...</p></td></tr>`;
        try {
            catalogoCache = await fetchAPI('/products?incluirInactivos=true');
        } catch (e) {
            tabla.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-5">
                No se pudo cargar: ${e.message}</td></tr>`;
            return;
        }
    }
    paginaActual = 1;
    pintarPagina();
};

function pintarPagina() {
    if (!catalogoCache) return;
    const lista   = catalogoCache.filter(pasaFiltroEstado);
    const total   = lista.length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (paginaActual > paginas) paginaActual = paginas;
    if (paginaActual < 1) paginaActual = 1;

    const desde = (paginaActual - 1) * POR_PAGINA;
    const trozo = lista.slice(desde, desde + POR_PAGINA);

    renderFilasProductos(trozo);
    renderControlesPagina(total, paginas, desde, trozo.length);
    avisoCatalogoDormido();
}

function renderControlesPagina(total, paginas, desde, enPagina) {
    const cont = document.getElementById('paginacion-productos');
    if (!cont) return;
    cont.style.display = 'block';

    const ini = Math.max(1, paginaActual - 2);
    const fin = Math.min(paginas, ini + 4);

    cont.innerHTML = `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <small class="text-muted">
                Mostrando <strong>${desde + 1}–${desde + enPagina}</strong>
                de <strong>${total.toLocaleString('es-MX')}</strong> productos
            </small>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" ${paginaActual === 1 ? 'disabled' : ''}
                    onclick="window.irPagina(1)" title="Primera">
                    <i class="bi bi-chevron-double-left"></i></button>
                <button class="btn btn-outline-secondary" ${paginaActual === 1 ? 'disabled' : ''}
                    onclick="window.irPagina(${paginaActual - 1})" title="Anterior">
                    <i class="bi bi-chevron-left"></i></button>
                ${Array.from({ length: fin - ini + 1 }, (_, i) => ini + i).map(p => `
                    <button class="btn ${p === paginaActual ? 'btn-warning' : 'btn-outline-secondary'}"
                        onclick="window.irPagina(${p})">${p}</button>`).join('')}
                <button class="btn btn-outline-secondary" ${paginaActual === paginas ? 'disabled' : ''}
                    onclick="window.irPagina(${paginaActual + 1})" title="Siguiente">
                    <i class="bi bi-chevron-right"></i></button>
                <button class="btn btn-outline-secondary" ${paginaActual === paginas ? 'disabled' : ''}
                    onclick="window.irPagina(${paginas})" title="Última">
                    <i class="bi bi-chevron-double-right"></i></button>
            </div>
            <small class="text-muted">Página ${paginaActual} de ${paginas.toLocaleString('es-MX')}</small>
        </div>`;
}

window.irPagina = (p) => {
    paginaActual = p;
    pintarPagina();
    document.getElementById('tabla-productos-body')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function ocultarPaginacion() {
    const c = document.getElementById('paginacion-productos');
    if (c) c.style.display = 'none';
}

const escaparHtml = (t) => String(t ?? '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

async function buscarEnTabla(termino) {
    const tabla = document.getElementById('tabla-productos-body');
    const paginacion = document.getElementById('paginacion-productos');
    if (!tabla) return;

    if (termino.trim().length < 2) {
        if (catalogoCache) { paginaActual = 1; pintarPagina(); }
        else {
            tabla.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-5">
                <i class="bi bi-search fs-1 d-block mb-2 opacity-25"></i>
                Escribe el nombre, SKU o descripción del producto</td></tr>`;
            if (paginacion) paginacion.style.display = 'none';
        }
        return;
    }

    tabla.innerHTML = `<tr><td colspan="10" class="text-center py-4">
        <div class="spinner-border spinner-border-sm text-warning"></div></td></tr>`;
    if (paginacion) paginacion.style.display = 'none';

    try {
        const todos = await fetchAPI(
            `/products/search?q=${encodeURIComponent(termino)}&incluirInactivos=true`);
        const resultados = todos.filter(pasaFiltroEstado);
        if (!resultados.length) {
            tabla.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-5">
                <i class="bi bi-search fs-1 d-block mb-2 opacity-25"></i>
                Sin resultados para "${escaparHtml(termino)}"</td></tr>`;
            return;
        }
        renderFilasProductos(resultados);
        avisoCatalogoDormido();
        const cont = document.getElementById('paginacion-productos');
        if (cont) {
            cont.style.display = 'block';
            cont.innerHTML = `<small class="text-muted">
                <i class="bi bi-funnel me-1"></i>
                <strong>${resultados.length}</strong> resultado(s) para
                "${escaparHtml(termino)}"</small>`;
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-5">
            ${e.message}</td></tr>`;
    }
}

let etiquetasSeleccion = new Map();   // id → producto

async function abrirSelectorEtiquetas() {
    let catalogo;
    try { catalogo = (await fetchAPI('/products')).filter(p => p.id > 0 && p.active !== false); }
    catch (e) { Swal.fire('Error', e.message, 'error'); return; }
    etiquetasSeleccion = new Map();

    const pintarLista = (q = '') => {
    const normalizar = texto => String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00D7/g, 'x')
        .replace(/\u00F7/g, '/')
        .toLowerCase()
        .trim();

    const ql = normalizar(q);

const lista = catalogo.filter(p =>
    !ql ||
    normalizar(`${p.name} ${p.sku} ${p.barcode || ''}`).includes(ql)
).slice(0, 60);
        document.getElementById('etq-lista').innerHTML = lista.map(p => `
            <label class="list-group-item d-flex align-items-center gap-2 py-1"
                style="cursor:pointer;font-size:.85rem">
                <input type="checkbox" class="form-check-input etq-check"
                    value="${p.id}" ${etiquetasSeleccion.has(p.id) ? 'checked' : ''}>
                <span class="flex-grow-1 text-truncate">${p.name}</span>
                <span class="text-muted small font-monospace">${p.sku}</span>
                <strong>$${Number(p.price || p.listPrice || 0).toFixed(2)}</strong>
            </label>`).join('') ||
            '<p class="text-muted small text-center py-3 mb-0">Sin resultados</p>';
        document.querySelectorAll('.etq-check').forEach(c =>
            c.addEventListener('change', () => {
                const p = catalogo.find(x => x.id == c.value);
                c.checked ? etiquetasSeleccion.set(p.id, p)
                          : etiquetasSeleccion.delete(p.id);
                document.getElementById('etq-contador').textContent =
                    etiquetasSeleccion.size;
            }));
    };

    Swal.fire({
        title: '🏷 Etiquetas de anaquel',
        width: 560,
        html: `
            <input type="text" id="etq-buscar" class="form-control form-control-sm mb-2"
                placeholder="Buscar producto para etiquetar...">
            <div class="list-group text-start border rounded" id="etq-lista"
                style="max-height:44vh;overflow-y:auto"></div>
            <p class="small text-muted text-start mt-2 mb-0">
                Seleccionados: <strong id="etq-contador">0</strong> —
                se imprimen en hoja carta, 3 por fila, con líneas de corte.</p>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-printer me-1"></i>Imprimir etiquetas',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#2B6CA3',
        preConfirm: () => {
            if (!etiquetasSeleccion.size) {
                Swal.showValidationMessage('Selecciona al menos un producto');
                return false;
            }
            return true;
        },
        didOpen: () => {
            pintarLista();
            let t = null;
            document.getElementById('etq-buscar').addEventListener('input', e => {
                clearTimeout(t);
                t = setTimeout(() => pintarLista(e.target.value.trim()), 250);
            });
            document.getElementById('etq-buscar').focus();
        }
    }).then(r => { if (r.isConfirmed) imprimirEtiquetas([...etiquetasSeleccion.values()]); });
}

function imprimirEtiquetas(productos) {
    
    const bloques = productos.map((p, i) => {
        const precio = Number(p.price || p.listPrice || 0);
        const pesos  = Math.floor(precio);
        const cents  = Math.round((precio - pesos) * 100).toString().padStart(2, '0');
        const unidad = etiquetaUnidad(p.satClaveUnidad);
        const codigo = (p.barcode || p.sku || '').trim();
        const esUltima = i === productos.length - 1;
        return `
        <div class="etiqueta${esUltima ? ' sin-salto' : ''}">
            <div class="nom">${p.name}</div>
            <div class="precio">$${pesos}<sup>${cents}</sup>
                <span class="um">/${unidad}</span></div>
            <div class="meta">
    ${p.costCode && p.costCode !== '0000'
        ? `<span class="cifrado">${p.costCode}</span>` : ''}
</div>

${codigo
    ? `<svg class="barcode" data-codigo="${codigo}"></svg>`
    : `<div class="sinbar">Sin código de barras</div>`}
        </div>`;
    }).join('');

    const w = window.open('', '_blank', 'width=380,height=650');
    w.document.write(`<!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>Etiquetas</title>
        <style>
            /* Mismas medidas que el ticket: 58mm de rollo, alto AUTOMÁTICO
               por etiqueta (cada una es su propia "página" con salto entre
               ellas, así el alto se ajusta solo y nunca se pasa de largo).

               SIN fuentes de internet (antes cargaba "Barlow Condensed" de
               Google Fonts): si al imprimir no hay señal, esa fuente no
               carga y el navegador usaba "Arial Narrow" de reemplazo —
               una letra delgada que en térmica se ve débil y poco clara.
               Ahora todo usa Arial con negrita reforzada (funciona igual
               con o sin internet, y se lee mejor en el cabezal térmico:
               los trazos delgados "se pierden" al quemar el papel, los
               gruesos no). También se recortó el alto de cada etiqueta
               (menos relleno, código de barras más bajo) para gastar
               menos papel por producto. */
            @page {
                size: 58mm auto;
                margin: 0mm !important;
            }

            * {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 44mm !important;
                background-color: #fff;
                overflow-x: hidden;
            }

            body {
                font-family: Arial, Helvetica, sans-serif;
                color: #000000 !important;
            }

            .etiqueta {
    width: 100% !important;
    margin: 0 !important;
    padding: 0 1.5mm .5mm 1.5mm !important;
    text-align: center;
    page-break-after: always;
}
            .etiqueta.sin-salto { page-break-after: auto; }

            .nom {
                font-weight: 700; font-size: 10.5px; line-height: 1.1;
                color: #000 !important; margin-bottom: .5mm;
                word-break: break-word;
            }
            .precio {
                font-family: Arial, Helvetica, sans-serif;
                font-weight: 900; font-size: 22px; line-height: 1;
                color: #000 !important;
                /* Engrosa un poco más el trazo (además del 900 ya bien
                   grueso) — es lo que más ayuda a que se vea nítido en
                   térmica, más que subir el tamaño de letra. */
                -webkit-text-stroke: .3px #000;
            }
            .precio sup { font-size: .55em; }
            .precio .um { font-size: .4em; font-weight: 700; color: #000 !important; }

            .meta {
                display: flex; align-items: center; justify-content: center;
                gap: 5px; margin: .5mm 0; color: #000 !important;
            }
            .sku { font-family: 'Courier New', monospace; font-size: 9px; font-weight: 700; }
            .sep { font-size: 9px; }
            .cifrado {
                font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700;
                letter-spacing: .06em; color: #000 !important;
            }

            .barcode {
                display: block; margin: .5mm auto 0;
                max-width: 100%;   /* nunca se sale del ticket... */
                height: auto;      /* ...pero la proporción la decide el */
                width: auto;       /* propio código, no un tamaño forzado */
            }
            .sinbar { font-family: 'Courier New', monospace; font-size: 10px;
                      font-weight: 700; text-align: center; }

            @media print { button { display: none; } }
        </style>
    </head>
    <body>
        ${bloques}
        <script src="${location.origin}/vendor/JsBarcode.all.min.js"><\/script>
        <script>
            try {
                document.querySelectorAll('.barcode').forEach(svg => {
                    JsBarcode(svg, svg.dataset.codigo,
                       { format:'CODE128', displayValue:true, height:55,
  width:3.2, fontSize:11, fontOptions:'bold',
  margin:1, lineColor:'#000' });
                });
            } catch(e) {
                document.querySelectorAll('.barcode').forEach(svg => {
                    const d = document.createElement('div');
                    d.className = 'sinbar'; d.textContent = svg.dataset.codigo;
                    svg.replaceWith(d);
                });
            }
            window.onload = function () {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 300);
            };
        <\/script>
    </body></html>`);
    w.document.close();
}


function avisoCatalogoDormido() {
    document.getElementById('aviso-dormido')?.remove();
    if (filtroEstado !== 'inactivos') return;
    const tabla = document.getElementById('tabla-productos-body');
    const card  = tabla?.closest('.card');
    if (!card) return;
    const div = document.createElement('div');
    div.id = 'aviso-dormido';
    div.className = 'alert alert-secondary border-0 rounded-0 mb-0 py-2 small';
    div.innerHTML = `<i class="bi bi-moon me-1"></i>
        Estás viendo el <strong>catálogo dormido</strong>: productos dados de
        alta pero desactivados. No salen en Ventas ni en Faltantes.
        Márcalos y usa <strong>Activar seleccionados</strong>, o edítalos —
        al guardar se activan solos.`;
    card.insertBefore(div, card.firstChild);
}


function renderFilasProductos(productos) {
    const tabla = document.getElementById('tabla-productos-body');
    if (!tabla) return;

    tabla.innerHTML = productos.map(p => {
            const stock   = parseFloat(p.currentStock) || 0;
            const minStock = parseFloat(p.minStockLevel) || 0;
            const esBajo  = stock <= minStock;
            const esNulo  = stock === 0;
            const stockClass = esNulo ? 'stock-none'
                             : esBajo ? 'stock-low' : 'stock-ok';
            const etq = etiquetaUnidad(p.satClaveUnidad);
            const dec = esDecimal(p.satClaveUnidad);
            const btnAddClass = esNulo ? 'btn-add-none'
                              : esBajo ? 'btn-add-low' : 'btn-add-ok';

            const attrs = p.attributes
                ? Object.entries(p.attributes).map(([k,v]) =>
                    `<span class="badge bg-light text-dark border me-1"
                        style="font-size:.7rem">${escaparHtml(k)}: ${
                            v == null ? '—' : escaparHtml(v)}</span>`).join('')
                : '';

            const satBadge = p.satClaveProdServ
                ? `<span class="badge bg-success-subtle text-success border small"
                       title="${escaparHtml(p.satClaveProdServ)}">
                       <i class="bi bi-check-circle"></i> ${escaparHtml(p.satClaveProdServ)}
                   </span>`
                : `<span class="badge bg-light text-muted border small">
                       Sin clave
                   </span>`;

            return `
            <tr class="${!p.active ? 'opacity-50' : ''}">
                <td class="ps-3">
                    <input type="checkbox" class="form-check-input prod-check"
                        value="${p.id}" data-active="${p.active}">
                </td>
                <td class="ps-2">
                    <span class="badge bg-light text-dark border font-monospace">
                        ${escaparHtml(p.sku)}
                    </span>
                    ${p.attributes?.codigo_truper
                        ? `<div class="mt-1" style="font-size:.68rem;line-height:1"
                                title="Código del catálogo Truper">
                               <i class="bi bi-upc text-muted"></i>
                               <span class="text-muted">Truper:</span>
                               <span class="fw-bold text-dark">
                                   ${escaparHtml(p.attributes.codigo_truper)}</span>
                           </div>`
                        : ''}
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        ${p.imagenUrl
                            ? `<img src="${urlImagenCompleta(p.imagenUrl)}"
                                   style="width:36px;height:36px;object-fit:cover;
                                          border-radius:6px;border:1px solid #dee2e6;
                                          flex-shrink:0"
                                   onerror="this.style.display='none'">`
                            : `<div style="width:36px;height:36px;background:#f0f0f0;
                                           border-radius:6px;display:flex;
                                           align-items:center;justify-content:center;
                                           flex-shrink:0">
                                   <i class="bi bi-image text-muted small"></i>
                               </div>`}
                        <div>
                            <div class="fw-bold">${escaparHtml(p.name)}</div>
                            <div>${attrs}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border">
                        <i class="bi bi-tag"></i> ${escaparHtml(p.category?.name || '---')}
                    </span>
                </td>
                <td class="text-end font-monospace small text-muted">
                    ${escaparHtml(p.costCode || '---')}
                </td>
                <td class="text-end fw-bold text-success">
                    $${(p.price || 0).toFixed(2)}
                </td>
                <td class="text-center">
                    <span class="badge ${stockClass}">
                        ${stock} ${etq}
                        ${esBajo
                            ? '<i class="bi bi-exclamation-triangle-fill ms-1"></i>'
                            : ''}
                    </span>
                    ${dec
                        ? '<div><small class="text-muted" style="font-size:.65rem">fraccionable</small></div>'
                        : ''}
                </td>
                <td class="text-center">${satBadge}</td>
                <td class="text-center">
                    ${p.active
                        ? '<i class="bi bi-check-circle-fill text-success fs-5"></i>'
                        : '<i class="bi bi-x-circle text-danger fs-5"></i>'}
                </td>
                <td class="text-center pe-3">
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-secondary"
                            data-accion="ver" data-id="${p.id}"
                            title="Ver ficha completa">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button type="button" class="btn btn-outline-primary"
                            data-accion="editar" data-id="${p.id}"
                            title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button type="button" class="btn ${btnAddClass} border"
                            data-accion="restock" data-id="${p.id}"
                            data-nombre="${escaparHtml(p.name)}"
                            data-stock="${stock}"
                            data-precio="${p.price || 0}"
                            data-unidad="${escaparHtml(p.satClaveUnidad || '')}"
                            title="Agregar stock">
                            <i class="bi bi-plus-circle"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary"
                            data-accion="ajustar" data-id="${p.id}"
                            data-nombre="${escaparHtml(p.name)}"
                            data-stock="${stock}"
                            data-unidad="${escaparHtml(p.satClaveUnidad || '')}"
                            title="Ajustar existencias (conteo, merma...)">
                            <i class="bi bi-sliders2"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger"
                            data-accion="estado" data-id="${p.id}"
                            data-activo="${p.active}"
                            title="${p.active ? 'Desactivar' : 'Activar'}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`; }).join('');
}

async function cargarProductos(filtros = {
    q: '',
    categoria: '',
    atributo: '',
    plantilla: '',
    campo: ''
}) {
    const tabla = document.getElementById('tabla-productos-body');
    if (!tabla) return;
    tabla.innerHTML = `<tr><td colspan="10" class="text-center py-4">
        <div class="spinner-border text-primary"></div></td></tr>`;
    try {
        
        if (!filtros.categoria && !filtros.q && !filtros.plantilla) {
            estadoInicialProductos();
            return;
        }

        
       let url = filtros.categoria
    ? `/products/category/${filtros.categoria}`
    : filtros.q
        ? `/products/search?q=${encodeURIComponent(filtros.q)}&incluirInactivos=true`
        : '/products?incluirInactivos=true';
        let productos = (await fetchAPI(url)).filter(pasaFiltroEstado);


        if (filtros.plantilla) {
            const tpl = PLANTILLAS_MEDIDAS[filtros.plantilla];

            if (tpl) {
                const clavesIdentificadoras = tpl.identifica?.length
                    ? tpl.identifica
                    : (tpl.campos || []).map(c => c.clave);

                
                productos = productos.filter(p => {
                    const attrs = p.attributes || {};
                    return clavesIdentificadoras.length === 0 ||
                        clavesIdentificadoras.some(clave =>
                            Object.prototype.hasOwnProperty.call(attrs, clave)
                        );
                });

                const filtrosConValor = (filtros.atributos || []).filter(f =>
                    f?.clave && String(f?.valor ?? '').trim() !== ''
                );

                productos = productos.filter(p => {
                    const attrs = p.attributes || {};

                    return filtrosConValor.every(filtro => {
                        const valorProducto = attrs[filtro.clave];
                        if (valorProducto === undefined || valorProducto === null) return false;

                        const buscado = normalizarTextoBusqueda(filtro.valor);
                        const valor = normalizarTextoBusqueda(String(valorProducto));

                        
                        return valor === buscado || valor.includes(buscado);
                    });
                });
            }
        }

        if (!productos.length) {
            ocultarPaginacion();
            tabla.innerHTML = `<tr><td colspan="10" class="text-center
                text-muted py-5">
                <i class="bi bi-search fs-2 d-block mb-2 opacity-25"></i>
                No se encontraron productos.</td></tr>`;
            return;
        }

        
        ocultarPaginacion();
        renderFilasProductos(productos);
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">
            Error al cargar productos.</td></tr>`;
    }
}

async function guardarProducto(e) {
    e.preventDefault();
    limpiarValidaciones('form-producto');

    const nombreOk = validarTexto('prod-name', {
        label:'Nombre', minLen:2, maxLen:200, requerido:true,
        noEspeciales:true, permitirComillas:true
    });
    const skuOk  = validarSKU('prod-sku', true);
    const precioOk = validarPrecio('prod-price', {
        label:'Precio de venta', requerido:true
    });
    const minOk = validarNumero('prod-minstock', {
        label:'Stock mínimo', min:0, requerido:false, decimales:3
    });

    
    const esBolsaForm = document.getElementById('prod-es-bolsa')?.checked;
    const costoVal = esBolsaForm
        ? document.getElementById('prod-cost-pieza')?.value?.trim()
        : document.getElementById('prod-cost')?.value?.trim();
    const idCampoCosto = esBolsaForm ? 'prod-cost-pieza' : 'prod-cost';
    let costoOk = true;
    if (!editandoId) {
        costoOk = validarPrecio(idCampoCosto, {
            label: esBolsaForm ? 'Costo por pieza' : 'Costo', requerido:true });
    } else if (costoVal) {
        costoOk = validarPrecio(idCampoCosto, {
            label: esBolsaForm ? 'Costo por pieza' : 'Costo', requerido:false });
    }

    const imgVal = document.getElementById('prod-imagen-url')?.value?.trim();
    const imgOk  = (!imgVal || imgVal.startsWith('/uploads/'))
        ? true : validarURL('prod-imagen-url', false);

    
    const unidadVal = document.getElementById('f-satClaveUnidad').value;
    let unidadOk = true;
    if (!unidadVal) {
        unidadOk = false;
        document.getElementById('input-satClaveUnidad').classList.add('is-invalid');
    }

    if (![nombreOk, skuOk, precioOk, minOk, costoOk, imgOk, unidadOk].every(Boolean)) {
        Swal.fire({ icon:'warning', title:'Revisa los campos',
            text: !unidadOk
                ? 'Selecciona la Unidad de Medida del producto.'
                : 'Hay errores marcados en rojo.',
            timer:2500, showConfirmButton:false });
        return;
    }

    if (costoVal && precioOk) {
        const ok = validarCostoVsPrecio(idCampoCosto, 'prod-price');
        if (!ok) {
            const r = await Swal.fire({
                icon:'warning',
                title:'¿Precio menor al costo?',
                html:`El precio de venta es menor al costo del producto.
                      ¿Deseas guardar de todas formas?`,
                showCancelButton:true,
                confirmButtonText:'Sí, guardar',
                cancelButtonText:'Corregir precio',
                confirmButtonColor:'#d97706'
            });
            if (!r.isConfirmed) return;
        }
    }

    const f = new FormData(e.target);
    const attrs = {};
    document.querySelectorAll('.fila-atributo').forEach(row => {
        const OPC = { permitirComillas: true };
        const k = row.querySelector('.attr-k').value.trim();
        const v = row.querySelector('.attr-v').value.trim();
        if (k) attrs[sanitizar(k, OPC)] = v ? sanitizar(v, OPC) : null;
    });
    const codigoTruper = document.getElementById('prod-codigo-truper').value.trim();
    if (codigoTruper) attrs['codigo_truper'] = sanitizar(codigoTruper);
    else delete attrs['codigo_truper'];   // se dejó vacío: no se guarda

    const listPrice  = parseFloat(f.get('listPrice'));
    const categoryId = f.get('categoryId');

    const payload = {
        name:             sanitizar(f.get('name'), { permitirComillas: true }),
        sku:              f.get('sku').trim().toUpperCase(),
        barcode:          f.get('barcode')?.trim() || null,
        listPrice,
        minPrice:         0.01,
        description:      sanitizar(f.get('description') || '', { permitirComillas: true }),
        minStockLevel:    parseFloat(f.get('minStockLevel')) || 0,
        taxRate:          0.16,
        category:         categoryId ? { id:parseInt(categoryId) } : null,
        attributes:       attrs,
        active:           true,
        satClaveProdServ: f.get('satClaveProdServ') || null,
        satClaveUnidad:   f.get('satClaveUnidad')   || null,
        satObjetoImp:     f.get('satObjetoImp')     || null,
        imagenUrl:        imgVal || null
    };
    if (costoVal) payload.costPrice = parseFloat(costoVal);

    const esBolsa = document.getElementById('prod-es-bolsa')?.checked;
    payload.compraPorBolsa = !!esBolsa;
    if (esBolsa) {
        const piezas = parseInt(document.getElementById('prod-piezas-bolsa').value) || 0;
        const costoB = parseFloat(document.getElementById('prod-costo-bolsa').value) || 0;
        payload.piezasPorBolsa = piezas || null;
        payload.costoBolsa     = costoB || null;
        const precioB = parseFloat(document.getElementById('prod-precio-bolsa').value) || 0;
        payload.precioBolsa = precioB || null;
        
        const costoPiezaEdit = parseFloat(
            document.getElementById('prod-cost-pieza').value) || 0;
        if (costoPiezaEdit > 0) {
            payload.costPrice = costoPiezaEdit;
        } else if (piezas > 0 && costoB > 0) {
            payload.costPrice = Math.round((costoB / piezas) * 100) / 100;
        }
    } else {
        payload.piezasPorBolsa = null;
        payload.costoBolsa = null;
        payload.precioBolsa = null;
    }

    const btn = document.getElementById('btn-submit-producto');
    btn.disabled = true;
    btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    try {
        const guardado = await fetchAPI(editandoId ? `/products/${editandoId}` : '/products',
            { method: editandoId ? 'PUT' : 'POST', body: payload });

        
        if (!editandoId && guardado?.id && galeriaFotos.some(f => !f.id)) {
            await guardarFotosPendientes(guardado.id);
        }

        const provIds = [...document.querySelectorAll('.prov-check:checked')]
            .map(c => parseInt(c.value));
        try {
            await fetchAPI(`/products/${guardado.id}/suppliers`,
                { method: 'PUT', body: provIds });
        } catch (e) {
            console.warn('Producto guardado; falló la asignación de proveedores:', e.message);
        }

        productoModalBS.hide();
        catalogoCache = null;   
        if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
        aplicarFiltros();

        
        if (!editandoId) {
            const r = await Swal.fire({
                icon: 'success', title: '¡Producto guardado!',
                html: `<p class="small mb-0">${escaparHtml(guardado.name)}</p>`,
                showCancelButton: true,
                confirmButtonText: '<i class="bi bi-tags-fill me-1"></i>Imprimir etiqueta',
                cancelButtonText: 'No, gracias',
                confirmButtonColor: '#2B6CA3', timer: 6000, timerProgressBar: true
            });
            if (r.isConfirmed) imprimirEtiquetas([guardado]);
        } else {
            Swal.fire({ icon:'success', title:'Guardado',
                showConfirmButton:false, timer:1200 });
        }
    } catch (err) {
        Swal.fire({ icon:'error', title:'Error',
            text: err.message || 'Error al guardar.' });
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar';
    }
}



const MAX_FOTOS = 6;   

function renderGaleria() {
    const cont = document.getElementById('galeria-fotos');
    const cnt  = document.getElementById('galeria-contador');
    if (!cont) return;

    if (cnt) cnt.textContent = `${galeriaFotos.length} de ${MAX_FOTOS}`;

    if (!galeriaFotos.length) {
    cont.innerHTML = `
        <div class="text-muted small">
            Sin fotos todavía
        </div>`;

    
    return;
}

    cont.innerHTML = galeriaFotos.map((f, i) => `
        <div class="position-relative border rounded"
             style="width:92px;overflow:hidden;${i === 0 ? 'border-color:var(--amber-500) !important;border-width:2px !important' : ''}">
            <img src="${urlImagenCompleta(f.url)}" title="${f.titulo || ''}"
                 style="width:100%;height:70px;object-fit:cover;display:block"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2292%22 height=%2270%22%3E%3Crect fill=%22%23eee%22 width=%2292%22 height=%2270%22/%3E%3C/svg%3E'">
            ${i === 0
                ? `<span class="badge position-absolute top-0 start-0 m-1"
                       style="background:var(--amber-600);font-size:.55rem">PRINCIPAL</span>`
                : ''}
            <div class="d-flex border-top">
                ${i !== 0
                    ? `<button type="button" class="btn btn-sm btn-light flex-grow-1 border-0 rounded-0 py-0"
                           onclick="window.galeriaPrincipal(${i})" title="Hacer principal">
                           <i class="bi bi-star" style="font-size:.7rem"></i></button>`
                    : ''}
                <button type="button" class="btn btn-sm btn-light flex-grow-1 border-0 rounded-0 py-0"
                    onclick="window.galeriaTitulo(${i})" title="Poner nombre">
                    <i class="bi bi-tag" style="font-size:.7rem"></i></button>
                <button type="button" class="btn btn-sm btn-light flex-grow-1 border-0 rounded-0 py-0 text-danger"
                    onclick="window.galeriaBorrar(${i})" title="Borrar foto">
                    <i class="bi bi-trash" style="font-size:.7rem"></i></button>
            </div>
            ${f.titulo
                ? `<div class="text-center text-truncate px-1 pb-1"
                       style="font-size:.6rem;color:var(--text-soft)">${f.titulo}</div>`
                : ''}
        </div>`).join('');

    document.getElementById('prod-imagen-url').value = galeriaFotos[0].url;
}

async function agregarFotoGaleria(url, titulo = null) {
    if (editandoId) {
        try {
            const img = await fetchAPI(`/products/${editandoId}/imagenes`,
                { method: 'POST', body: { url, titulo } });
            galeriaFotos.push({ id: img.id, url: img.url, titulo: img.titulo });
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
            return;
        }
    } else {
        galeriaFotos.push({ id: null, url, titulo });
    }
    renderGaleria();
    window.mostrarToast?.('Foto agregada', 'success');
}

window.galeriaBorrar = async (i) => {
    const f = galeriaFotos[i];
    const r = await Swal.fire({
        title: '¿Borrar esta foto?',
        text: 'Se elimina también del servidor.',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545'
    });
    if (!r.isConfirmed) return;

    if (f.id && editandoId) {
        try {
            await fetchAPI(`/products/${editandoId}/imagenes/${f.id}`, { method: 'DELETE' });
        } catch (e) { Swal.fire('Error', e.message, 'error'); return; }
    }
    galeriaFotos.splice(i, 1);
    renderGaleria();
};

window.galeriaPrincipal = async (i) => {
    const f = galeriaFotos[i];
    if (f.id && editandoId) {
        try {
            await fetchAPI(`/products/${editandoId}/imagenes/${f.id}/principal`,
                { method: 'PATCH' });
        } catch (e) { Swal.fire('Error', e.message, 'error'); return; }
    }
    galeriaFotos.splice(i, 1);
    galeriaFotos.unshift(f);
    renderGaleria();
    window.mostrarToast?.('Foto principal actualizada', 'success');
};

window.galeriaTitulo = async (i) => {
    const f = galeriaFotos[i];
    const r = await Swal.fire({
        title: 'Nombre de la foto',
        input: 'text',
        inputValue: f.titulo || '',
        inputPlaceholder: 'Ej: Frente, Especificaciones, Etiqueta',
        showCancelButton: true,
        confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar'
    });
    if (!r.isConfirmed) return;
    const titulo = (r.value || '').trim().substring(0, 80);

    if (f.id && editandoId) {
        try {
            await fetchAPI(`/products/${editandoId}/imagenes/${f.id}/titulo`,
                { method: 'PATCH', body: { titulo } });
        } catch (e) {  }
    }
    f.titulo = titulo || null;
    renderGaleria();
};

async function cargarGaleria(productId, imagenPrincipalExistente = '') {
    try {
        const fotos = await fetchAPI(`/products/${productId}/imagenes`);

        if (Array.isArray(fotos) && fotos.length > 0) {
            galeriaFotos = fotos.map(f => ({
                id: f.id,
                url: f.url,
                titulo: f.titulo
            }));

            document.getElementById('prod-imagen-url').value =
                galeriaFotos[0]?.url || imagenPrincipalExistente || '';

        } else {
           galeriaFotos = [];

            document.getElementById('prod-imagen-url').value =
                imagenPrincipalExistente || '';
        }

    } catch (e) {
        console.warn(
            'No se pudo cargar la galería; se conserva la imagen principal existente:',
            e.message
        );

        galeriaFotos = [];

        document.getElementById('prod-imagen-url').value =
            imagenPrincipalExistente || '';
    }

    renderGaleria();
}

async function guardarFotosPendientes(productId) {
    for (const f of galeriaFotos.filter(x => !x.id)) {
        try {
            await fetchAPI(`/products/${productId}/imagenes`,
                { method: 'POST', body: { url: f.url, titulo: f.titulo } });
        } catch (e) {
            console.error('No se pudo guardar una foto:', e.message);
        }
    }
}

async function precargarCosto(id) {
    const campo = document.getElementById('prod-cost');
    const hint  = document.getElementById('hint-costo');
    campo.value = '';

    if (!tieneRol('ADMIN')) {
        campo.placeholder = 'Solo el dueño puede ver el costo';
        campo.disabled = true;
        if (hint) hint.textContent = 'El costo actual no se modifica.';
        return;
    }

    campo.disabled = false;
    campo.placeholder = '0.00';
    try {
        const r = await fetchAPI(`/products/${id}/costo`);
        if (r && r.costPrice != null) {
            campo.value = Number(r.costPrice).toFixed(2);
            if (hint) hint.textContent = 'Costo actual. Cámbialo si subió el precio de compra.';
        } else if (hint) {
            hint.textContent = 'Este producto no tiene costo registrado.';
        }
    } catch (e) {
        // Si el endpoint no está instalado aún, se comporta como antes
        if (hint) hint.textContent = 'Dejar vacío al editar para no cambiar.';
    }
}
let proveedoresCache = null;

async function renderProveedoresForm(seleccionados = []) {
    const cont = document.getElementById('lista-proveedores-prod');
    try {
        if (!proveedoresCache) {
            proveedoresCache = (await fetchAPI('/suppliers'))
                .filter(s => s.active !== false);
        }
    } catch (e) {
        cont.innerHTML = '<p class="text-danger small mb-0">No se pudieron cargar los proveedores.</p>';
        return;
    }
    if (!proveedoresCache.length) {
        cont.innerHTML = '<p class="text-muted small mb-0 text-center">' +
            'Sin proveedores registrados — dalos de alta en el módulo Proveedores.</p>';
        return;
    }
    const sel = new Set(seleccionados.map(s => s.supplierId ?? s));
    cont.innerHTML = proveedoresCache.map(s => {
        const info = seleccionados.find(x => x.supplierId === s.id);
        const conHist = info?.conHistorial;
        return `
        <div class="form-check">
            <input class="form-check-input prov-check" type="checkbox"
                value="${s.id}" id="prov-${s.id}"
                ${sel.has(s.id) ? 'checked' : ''}
                ${conHist ? 'disabled title="Con historial de compras — no se puede desligar"' : ''}>
            <label class="form-check-label small" for="prov-${s.id}">
                ${s.companyName}
                ${conHist ? `<span class="badge bg-success-subtle text-success border ms-1"
                    style="font-size:.62rem">último costo: $${Number(info.lastCost).toFixed(2)}</span>` : ''}
            </label>
        </div>`;
    }).join('');
}

function _setupBolsaUI() {
    const chk    = document.getElementById('prod-es-bolsa');
    const campos = document.getElementById('prod-bolsa-campos');
    const piezas = document.getElementById('prod-piezas-bolsa');
    const costoB = document.getElementById('prod-costo-bolsa');
    const costoPieza = document.getElementById('prod-cost-pieza');   // editable
    const costoReal  = document.getElementById('prod-cost');         // el del form
    const hint   = document.getElementById('hint-costo-pieza');
    const precioB = document.getElementById('prod-precio-bolsa');
    const compara = document.getElementById('prod-compara-bolsa');
    const precioPza = document.getElementById('prod-price');
    const btnRecalc = document.getElementById('btn-recalc-costo');
    if (!chk) return;

    const sugerir = (forzar) => {
        const p = parseInt(piezas.value) || 0;
        const c = parseFloat(costoB.value) || 0;
        if (p > 0 && c > 0) {
            const sug = c / p;
            if (forzar || !costoPieza.dataset.editado) {
                costoPieza.value = sug.toFixed(2);
                delete costoPieza.dataset.editado;
            }
            const actual = parseFloat(costoPieza.value) || 0;
            if (Math.abs(actual - sug) > 0.001)
                hint.innerHTML = '<span class="text-warning">Ajustado a mano</span> · ' +
                    'sugerido: $' + sug.toFixed(2);
            else
                hint.textContent = 'Calculado: $' + c.toFixed(2) + ' ÷ ' + p + ' piezas';
        } else {
            hint.textContent = 'Llena piezas y costo de la bolsa para calcularlo.';
        }
        compararVenta();
    };

    const compararVenta = () => {
        const p  = parseInt(piezas.value) || 0;
        const pb = parseFloat(precioB?.value) || 0;
        const pp = parseFloat(precioPza?.value) || 0;
        if (p > 0 && pb > 0 && pp > 0) {
            const sueltas = pp * p;
            const ahorro = sueltas - pb;
            compara.innerHTML = ahorro > 0
                ? 'Suelto saldría <strong>$' + sueltas.toFixed(2) + '</strong> · ' +
                  '<span class="text-success fw-bold">ahorran $' + ahorro.toFixed(2) + '</span>'
                : '<span class="text-warning">La bolsa no sale más barata ' +
                  '(suelto: $' + sueltas.toFixed(2) + ')</span>';
        } else {
            compara.innerHTML = '<span class="text-muted">Pon precio por pieza y de bolsa</span>';
        }
    };

    const toggle = () => {
        campos.style.display = chk.checked ? '' : 'none';
        const grupoCostoOriginal = costoReal ? costoReal.closest('.col-md-4') : null;
        if (grupoCostoOriginal) grupoCostoOriginal.style.display = chk.checked ? 'none' : '';
        if (chk.checked) sugerir(false);
    };

    chk.onchange = toggle;
    piezas.oninput = () => sugerir(false);
    costoB.oninput = () => sugerir(false);
    costoPieza.oninput = () => { costoPieza.dataset.editado = '1'; sugerir(false); };
    if (btnRecalc) btnRecalc.onclick = () => sugerir(true);  
    if (precioB) precioB.oninput = compararVenta;
    if (precioPza) precioPza.addEventListener('input', compararVenta);
    toggle();
}

async function abrirModal(id = null) {
    const form = document.getElementById('form-producto');
    form.reset();
    limpiarValidaciones('form-producto');
    document.getElementById('lista-atributos').innerHTML =
        '<p class="text-muted small text-center mb-0">Sin atributos.</p>';
    if (ssCategoria) ssCategoria.clear();
    document.getElementById('input-cat-modal').value = '';
    document.getElementById('input-cat-id-modal').value = '';
    document.getElementById('btn-limpiar-cat-modal').style.display = 'none';
    document.getElementById('sat-prod-seleccion').innerHTML = '';
    document.getElementById('sat-prod-resultados').style.display = 'none';
    document.getElementById('sat-unidad-seleccion').innerHTML = '';
    document.getElementById('input-satClaveUnidad').classList.remove('is-invalid');
    document.getElementById('badge-decimal').style.display = 'none';
    galeriaFotos = [];      
    renderGaleria();
    renderProveedoresForm();          
    if (ssUnidad)  ssUnidad.clear();

    document.getElementById('f-satClaveProdServ').value = '01010101';
    document.getElementById('f-satObjetoImp').value     = '02';

    editandoId = id;

    if (id) {
        document.getElementById('titulo-modal-producto').textContent =
            'Editar Producto';
        document.getElementById('hint-costo').style.display = 'block';
        document.getElementById('aviso-modal-dormido')?.remove();
        try {
            const p = await fetchAPI(`/products/${id}`);
            window._prodEnEdicion = p;
            document.getElementById('prod-name').value     = p.name  || '';
            document.getElementById('prod-sku').value      = p.sku   || '';
            document.getElementById('prod-barcode').value  = p.barcode || '';
            await precargarCosto(id);
            document.getElementById('prod-price').value    = p.price || '';
            form.description.value                         = p.description || '';
            document.getElementById('prod-minstock').value = p.minStockLevel || 0;
           const imagenPrincipalExistente = p.imagenUrl || '';

document.getElementById('prod-imagen-url').value =
    imagenPrincipalExistente;

await cargarGaleria(id, imagenPrincipalExistente);
            try {
                renderProveedoresForm(await fetchAPI(`/products/${id}/suppliers`));
            } catch (e) { }
            if (p.category) {
                if (ssCategoria) ssCategoria.setValue(p.category.id);
                else document.getElementById('input-cat-modal').value = p.category.name;
                document.getElementById('input-cat-id-modal').value = p.category.id;
                document.getElementById('btn-limpiar-cat-modal').style.display = '';
            }
            document.getElementById('prod-codigo-truper').value =
                p.attributes?.codigo_truper || '';
            if (p.attributes && Object.keys(p.attributes).length) {
                document.getElementById('lista-atributos').innerHTML = '';
                Object.entries(p.attributes)
                    .filter(([k]) => k !== 'codigo_truper')
                    .forEach(([k,v]) => agregarFilaAtributo(k, v ?? ''));
            }
            if (p.satClaveProdServ) {
                document.getElementById('f-satClaveProdServ').value = p.satClaveProdServ;
                document.getElementById('sat-prod-seleccion').innerHTML =
                    `<span class="badge bg-primary me-1">${p.satClaveProdServ}</span>`;
            }
            if (p.satClaveUnidad) {
                document.getElementById('f-satClaveUnidad').value = p.satClaveUnidad;
                const unidadItem = satUnidades.find(r => r[0] === p.satClaveUnidad);
                if (unidadItem) {
                    ssUnidad.setValue(p.satClaveUnidad);
                    const dec = esDecimal(p.satClaveUnidad);
                    const etq = etiquetaUnidad(p.satClaveUnidad);
                    const badge = document.getElementById('badge-decimal');
                    badge.style.display = 'block';
                    badge.innerHTML = dec
                        ? `<span class="badge bg-success-subtle text-success border">
                               <i class="bi bi-calculator me-1"></i>
                               Acepta fracciones (${etq})
                           </span>`
                        : `<span class="badge bg-secondary-subtle text-secondary border">
                               <i class="bi bi-hash me-1"></i>
                               Solo enteros (${etq})
                           </span>`;
                }
            }
            document.getElementById('f-satObjetoImp').value = p.satObjetoImp || '02';

            if (p.active === false) {
                const cuerpo = document.querySelector('#form-producto .modal-body');
                const aviso = document.createElement('div');
                aviso.id = 'aviso-modal-dormido';
                aviso.className = 'alert alert-warning py-2 small mb-3';
                aviso.innerHTML = `<i class="bi bi-moon me-1"></i>
                    Este producto está <strong>desactivado</strong> (catálogo dormido).
                    Al guardar se <strong>activará</strong> y empezará a aparecer en
                    Ventas, en los buscadores y en Faltantes.`;
                cuerpo?.insertBefore(aviso, cuerpo.firstChild);
            }
        } catch (e) {
            Swal.fire('Error', 'No se pudo cargar el producto.', 'error'); return;
        }
    } else {
        document.getElementById('titulo-modal-producto').textContent =
            'Nuevo Producto';
        const _costo = document.getElementById('prod-cost');
        _costo.disabled = false;
        _costo.placeholder = '0.00';
        document.getElementById('hint-costo').style.display = 'none';
    }
    const chkBolsa = document.getElementById('prod-es-bolsa');
    if (chkBolsa) {
        if (id && window._prodEnEdicion) {
            const pe = window._prodEnEdicion;
            chkBolsa.checked = !!pe.compraPorBolsa;
            document.getElementById('prod-piezas-bolsa').value = pe.piezasPorBolsa || '';
            document.getElementById('prod-costo-bolsa').value  = pe.costoBolsa || '';
            document.getElementById('prod-precio-bolsa').value = pe.precioBolsa || '';
             } else {
            chkBolsa.checked = false;
            document.getElementById('prod-piezas-bolsa').value = '';
            document.getElementById('prod-costo-bolsa').value  = '';
            document.getElementById('prod-precio-bolsa').value = '';
        }
        _setupBolsaUI();
    }

    productoModalBS.show();
}

async function cargarCategorias() {
    try {
        flatCategories = await fetchAPI('/categories');
       if (ssCategoria) {
            ssCategoria.setItems(flatCategories.map(c => {
                const padreId = c.parent?.id ?? c.parentId;
                const padre = padreId ? flatCategories.find(x => x.id === padreId) : null;
                return { id: c.id, label: c.name, sub: padre ? padre.name : null };
            }));
        }
    } catch (e) { console.error(e); }
}

async function cargarCategoriasDropdownFiltro() {
    const menu = document.getElementById('dropdown-categorias-filtro');
    if (!menu) return;
    menu.innerHTML = `
        <li><a class="dropdown-item fw-bold" href="#"
            id="filtro-todas-cats">
            <i class="bi bi-grid me-1"></i>Todas las categorías</a></li>
        <li><hr class="dropdown-divider"></li>`;
    document.getElementById('filtro-todas-cats').onclick = e => {
        e.preventDefault();
        categoriaFiltroActual = '';
        document.getElementById('label-cat-filtro').innerText =
            'Todas las categorías';
        aplicarFiltros();
    };
    renderTree(generarArbol(flatCategories), menu, 0, false);
}

function generarArbol(lista) {
    const map = {}, roots = [];
    lista.forEach(c => map[c.id] = { ...c, children:[] });
    lista.forEach(c => {
        const pId = c.parent?.id || c.parentId;
        if (pId && map[pId]) map[pId].children.push(map[c.id]);
        else roots.push(map[c.id]);
    });
    return roots;
}

function renderTree(nodos, container, nivel, isModal) {
    nodos.forEach(nodo => {
        const li = document.createElement('li');
        li.innerHTML = `<a class="dropdown-item py-2" href="#"
            style="padding-left:${nivel*15+12}px">
            ${nivel > 0
                ? '<i class="bi bi-arrow-return-right text-muted me-1 small"></i>'
                : ''}
            ${nodo.name}</a>`;
        li.querySelector('a').onclick = e => {
            e.preventDefault();
            categoriaFiltroActual = nodo.id;
            document.getElementById('label-cat-filtro').innerText = nodo.name;
            aplicarFiltros();
        };
        container.appendChild(li);
        if (nodo.children.length)
            renderTree(nodo.children, container, nivel+1, isModal);
    });
}

let _timerFiltros = null;
let filtrosAtributosActivos = [];

function normalizarBusqueda(q) {
    return q
        .replace(/×/g, 'x')     
        .replace(/÷/g, '/')      
        .replace(/[′’‘]/g, "'")  
        .replace(/[″“”]/g, '"')  
        .replace(/[–—]/g, '-')       
        .trim();
}

function aplicarFiltros(inmediato = false) {

    clearTimeout(_timerFiltros);

    const correr = () => {
        const q = normalizarBusqueda(
            document.getElementById('filter-search')
                ?.value.trim() || '');

        if (q.length === 1 && !categoriaFiltroActual) return;

        const plantilla =
            document.getElementById('filtro-plantilla-atributo')
                ?.value || '';

        cargarProductos({
            q,
            categoria: categoriaFiltroActual,
            plantilla,
            atributos: [...filtrosAtributosActivos]
        });
    };

    if (inmediato) correr();
    else _timerFiltros = setTimeout(correr, 350);
}


function normalizarTextoBusqueda(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00D7/g, 'x')
        .replace(/\u00F7/g, '/')
        .replace(/\u2032/g, "'")
        .replace(/\u2033/g, '"')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '-')
        .replace(/\u201C|\u201D/g, '"')
        .replace(/\u2018|\u2019/g, "'")
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}


function inicializarBuscadorAtributos() {
    const selectPlantilla = document.getElementById('filtro-plantilla-atributo');
    const btnAgregar = document.getElementById('btn-agregar-filtro-atributo');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros-atributo');

    if (!selectPlantilla || !btnAgregar || !btnLimpiar) return;

    selectPlantilla.innerHTML = `
        <option value="">Selecciona una plantilla...</option>
    `;

    Object.entries(PLANTILLAS_MEDIDAS).forEach(([id, tpl]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = tpl.etiqueta || id;
        selectPlantilla.appendChild(option);
    });

    selectPlantilla.addEventListener('change', () => {
        filtrosAtributosActivos = [];

        const contenedor = document.getElementById('filtros-multiples-atributos');
        if (contenedor) contenedor.innerHTML = '';

        const info = document.getElementById('info-resultado-atributos');

        if (!selectPlantilla.value) {
            btnAgregar.disabled = true;
            if (info) info.textContent = 'Selecciona una plantilla para comenzar.';
            aplicarFiltros(true);
            return;
        }

        const tpl = PLANTILLAS_MEDIDAS[selectPlantilla.value];
        btnAgregar.disabled = !(tpl?.campos?.length);

        if (info) {
            info.innerHTML = `
                <i class="bi bi-info-circle me-1"></i>
                ${tpl?.campos?.length || 0} atributos disponibles.
                Los filtros se combinan con <strong>Y</strong>.
            `;
        }

        
        if (tpl?.campos?.length) agregarFiltroAtributo();

        aplicarFiltros(true);
    });

    btnAgregar.addEventListener('click', agregarFiltroAtributo);

    btnLimpiar.addEventListener('click', () => {
        filtrosAtributosActivos = [];
        const contenedor = document.getElementById('filtros-multiples-atributos');
        if (contenedor) contenedor.innerHTML = '';
        selectPlantilla.value = '';
        btnAgregar.disabled = true;

        const info = document.getElementById('info-resultado-atributos');
        if (info) info.textContent = 'Selecciona una plantilla para comenzar.';

        aplicarFiltros(true);
    });
}

function agregarFiltroAtributo() {
    const plantillaId = document.getElementById('filtro-plantilla-atributo')?.value;
    if (!plantillaId) return;

    const tpl = PLANTILLAS_MEDIDAS[plantillaId];
    if (!tpl?.campos?.length) return;

    if (filtrosAtributosActivos.length >= tpl.campos.length) {
        Swal.fire({
            icon: 'info',
            title: 'Sin más atributos',
            text: 'Ya agregaste todos los atributos disponibles para esta plantilla.',
            timer: 1800,
            showConfirmButton: false
        });
        return;
    }

    const disponible = tpl.campos.find(campo =>
        !filtrosAtributosActivos.some(f => f.clave === campo.clave)
    );

    if (!disponible) return;

    const filtro = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        clave: disponible.clave,
        valor: ''
    };

    filtrosAtributosActivos.push(filtro);
    renderizarFiltrosAtributos();

    setTimeout(() => {
        document.querySelector(`[data-filtro-atributo="${filtro.id}"]`)?.focus();
    }, 30);
}

function renderizarFiltrosAtributos() {
    const contenedor = document.getElementById('filtros-multiples-atributos');
    const plantillaId = document.getElementById('filtro-plantilla-atributo')?.value;
    if (!contenedor || !plantillaId) return;

    const tpl = PLANTILLAS_MEDIDAS[plantillaId];
    if (!tpl) return;

    contenedor.innerHTML = '';

    filtrosAtributosActivos.forEach(filtro => {
        const campo = tpl.campos.find(c => c.clave === filtro.clave);
        if (!campo) return;

        const fila = document.createElement('div');
        fila.className = 'row g-2 mb-2 align-items-center';
        fila.dataset.filtroId = filtro.id;

        fila.innerHTML = `
            <div class="col-md-4">
                <select class="form-select form-select-sm" data-campo-filtro="${filtro.id}">
                    ${tpl.campos.map(c => `
                        <option value="${escaparHtml(c.clave)}" ${c.clave === filtro.clave ? 'selected' : ''}>
                            ${escaparHtml(c.label)}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="col-md-6">
                <input type="text"
                    class="form-control form-control-sm"
                    data-filtro-atributo="${filtro.id}"
                    value="${escaparHtml(filtro.valor)}"
                    placeholder="${escaparHtml(campo.ej || 'Valor...')}"
                    autocomplete="off">
            </div>
            <div class="col-md-2">
                <button type="button"
                    class="btn btn-sm btn-outline-danger w-100"
                    data-eliminar-filtro="${filtro.id}"
                    title="Eliminar filtro">
                    <i class="bi bi-trash"></i>
                </button>
            </div>`;

        contenedor.appendChild(fila);
    });

    contenedor.querySelectorAll('[data-campo-filtro]').forEach(select => {
        select.addEventListener('change', e => {
            const id = e.target.closest('[data-filtro-id]')?.dataset.filtroId;
            const filtro = filtrosAtributosActivos.find(f => f.id === id);
            if (!filtro) return;

            const repetido = filtrosAtributosActivos.some(
                f => f.id !== id && f.clave === e.target.value
            );
            if (repetido) {
                e.target.value = filtro.clave;
                Swal.fire({
                    icon: 'info',
                    title: 'Atributo ya seleccionado',
                    text: 'Ese atributo ya está siendo usado en otro filtro.',
                    timer: 1500,
                    showConfirmButton: false
                });
                return;
            }

            filtro.clave = e.target.value;
            filtro.valor = '';
            renderizarFiltrosAtributos();
            aplicarFiltros();
        });
    });

    contenedor.querySelectorAll('[data-filtro-atributo]').forEach(input => {
        input.addEventListener('input', e => {
            const id = e.target.closest('[data-filtro-id]')?.dataset.filtroId;
            const filtro = filtrosAtributosActivos.find(f => f.id === id);
            if (!filtro) return;
            filtro.valor = e.target.value;
            aplicarFiltros();
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                aplicarFiltros(true);
            }
        });
    });

    contenedor.querySelectorAll('[data-eliminar-filtro]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.eliminarFiltro;
            filtrosAtributosActivos = filtrosAtributosActivos.filter(f => f.id !== id);
            renderizarFiltrosAtributos();
            aplicarFiltros(true);
        });
    });
}

function agregarFilaAtributo(k='', v='') {
    const lista = document.getElementById('lista-atributos');
    lista.querySelector('p')?.remove();
    const div = document.createElement('div');
    div.className = 'row g-2 mb-2 fila-atributo';
    div.innerHTML = `
        <div class="col-5">
            <input type="text" class="form-control form-control-sm attr-k"
                placeholder="Propiedad (ej: Color)" value="${escaparHtml(k)}">
        </div>
        <div class="col-5">
            <input type="text" class="form-control form-control-sm attr-v"
                placeholder="Valor (ej: Rojo, 25 mm, 1&quot;)" value="${escaparHtml(v)}">
        </div>
        <div class="col-2 d-flex gap-1">
            <button type="button"
                class="btn btn-sm btn-outline-secondary flex-fill btn-dual"
                title="Agregar equivalencia pulgadas ⇄ milímetros">
                <i class="bi bi-arrow-left-right"></i>
            </button>
            <button type="button"
                class="btn btn-sm btn-outline-danger flex-fill"
                onclick="this.closest('.fila-atributo').remove()">
                <i class="bi bi-trash"></i>
            </button>
        </div>`;
    
    div.querySelector('.btn-dual').addEventListener('click', () => {
        const inp = div.querySelector('.attr-v');
        if (/\(.*\)/.test(inp.value)) return;          // ya es dual
        const dual = textoDual(inp.value);
        if (dual) { inp.value = dual; }
        else {
            inp.classList.add('is-invalid');
            inp.title = 'Escribe la medida con unidad: "25 mm" o \'1"\'';
            setTimeout(() => inp.classList.remove('is-invalid'), 1500);
        }
    });
    lista.appendChild(div);
}

let restockProdId     = null;
let restockProdModalBS = null;

function agregarModalRestock() {
    if (document.getElementById('restockModalProductos')) return;
    const w = document.createElement('div');
    w.innerHTML = `
        <div class="modal fade" id="restockModalProductos" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-light">
                        <h5 class="modal-title">Agregar Stock</h5>
                        <button type="button" class="btn-close"
                            data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="fw-bold mb-1" id="restock-prod-nombre"></p>
                        <p class="text-muted small mb-3" id="restock-prod-info"></p>

                        <!-- Modo BOLSA: aparece solo si el producto es de bolsa -->
                        <div class="mb-3 border rounded p-2" id="restock-bloque-bolsa"
                             style="display:none;background:#FAFBFC">
                            <div class="form-check form-switch mb-2">
                                <input class="form-check-input" type="checkbox"
                                    id="restock-por-bolsa" checked>
                                <label class="form-check-label small fw-bold" for="restock-por-bolsa">
                                    <i class="bi bi-box-seam me-1"></i>
                                    Estoy surtiendo bolsas/cajas completas
                                </label>
                            </div>
                            <div id="restock-bolsa-campos" class="row g-2">
                                <div class="col-6">
                                    <label class="form-label small mb-0">¿Cuántas bolsas llegaron?</label>
                                    <input type="number" id="restock-num-bolsas"
                                        class="form-control form-control-sm" min="1" step="1"
                                        placeholder="Ej: 5">
                                </div>
                                <div class="col-6">
                                    <label class="form-label small mb-0">Piezas que entran al stock</label>
                                    <div class="form-control form-control-sm bg-white fw-bold"
                                        id="restock-piezas-calc" style="color:#157F3D">—</div>
                                </div>
                                <div class="col-12">
                                    <small class="text-muted" id="restock-bolsa-hint"></small>
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold small">
                                Cantidad a agregar <span class="text-danger">*</span>
                            </label>
                            <div class="input-group">
                                <input type="number" id="restock-prod-cantidad"
                                    class="form-control" min="0.001" step="0.001">
                                <span class="input-group-text"
                                    id="restock-unidad-label">pza</span>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small">
                                Nuevo Costo (opcional)
                            </label>
                            <input type="number" id="restock-prod-costo"
                                step="0.01" min="0.01" class="form-control"
                                placeholder="Dejar vacío para no cambiar">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small">
                                Nuevo Precio de Venta (opcional)
                            </label>
                            <input type="number" id="restock-prod-precio"
                                step="0.01" min="0.01" class="form-control"
                                placeholder="Dejar vacío para no cambiar">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small">Ubicación en bodega</label>
                            <input type="text" id="restock-prod-ubicacion"
                                class="form-control"
                                placeholder="Ej: Pasillo A, Estante 3">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary"
                            data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success"
                            id="btn-confirmar-restock-prod">
                            <i class="bi bi-plus-circle"></i> Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(w);
    document.getElementById('btn-confirmar-restock-prod')
        .addEventListener('click', confirmarRestockProducto);
}

let _restockEsDecimal    = false;
let _restockCostoActual  = null; 
let _restockPrecioActual = null; 


let _restockPiezasPorBolsa = 0;
function _setupRestockBolsa(prod) {
    const bloque = document.getElementById('restock-bloque-bolsa');
    const chk    = document.getElementById('restock-por-bolsa');
    const campos = document.getElementById('restock-bolsa-campos');
    const numB   = document.getElementById('restock-num-bolsas');
    const calc   = document.getElementById('restock-piezas-calc');
    const hint   = document.getElementById('restock-bolsa-hint');
    const cantEl = document.getElementById('restock-prod-cantidad');
    if (!bloque) return;

    if (!prod) {                
        bloque.style.display = 'none';
        _restockPiezasPorBolsa = 0;
        return;
    }
    _restockPiezasPorBolsa = prod.piezasPorBolsa;
    bloque.style.display = '';
    chk.checked = true;
    numB.value = '';

    const recalc = () => {
        const b = parseInt(numB.value) || 0;
        const piezas = b * _restockPiezasPorBolsa;
        if (b > 0) {
            calc.textContent = piezas + ' pzas';
            hint.innerHTML = b + ' bolsa(s) × ' + _restockPiezasPorBolsa +
                ' piezas = <strong>' + piezas + ' piezas</strong> al stock';
            cantEl.value = piezas;         // el campo real recibe las piezas
        } else {
            calc.textContent = '—';
            hint.textContent = '';
            cantEl.value = '';
        }
    };
    const toggle = () => {
        campos.style.display = chk.checked ? '' : 'none';
        cantEl.readOnly = chk.checked;
        if (chk.checked) recalc();
        else { cantEl.readOnly = false; cantEl.value = ''; }
    };
    chk.onchange = toggle;
    numB.oninput = recalc;
    toggle();
}

window.abrirRestock = async (productId, nombre, stockActual, precio, satClaveUnidad) => {
    agregarModalRestock();
    restockProdId      = productId;
    _restockEsDecimal  = esDecimal(satClaveUnidad);
    const etq          = etiquetaUnidad(satClaveUnidad);
    restockProdModalBS = restockProdModalBS ||
        new bootstrap.Modal(document.getElementById('restockModalProductos'));

    document.getElementById('restock-prod-nombre').textContent = nombre;
    document.getElementById('restock-prod-info').textContent   =
        `Stock actual: ${stockActual} ${etq}${_restockEsDecimal
            ? ' · Acepta fracciones' : ' · Solo enteros'}`;

    
    _restockPrecioActual = precio != null ? Number(precio) : null;
    let ubicacionActual = '';
    let prodBolsa = null;
    try {
        const prod = await fetchAPI(`/products/${productId}`);
        if (prod.price != null) _restockPrecioActual = Number(prod.price);
        ubicacionActual = prod.locationRack || '';
        if (prod.compraPorBolsa && prod.piezasPorBolsa) prodBolsa = prod;
    } catch (e) {  }

    
    _setupRestockBolsa(prodBolsa);

    document.getElementById('restock-prod-info').textContent =
        `Stock actual: ${stockActual} ${etq}`
        + (_restockPrecioActual != null ? ` · Precio actual: $${_restockPrecioActual.toFixed(2)}` : '')
        + (ubicacionActual ? ` · Ubicación: ${ubicacionActual}` : '');

    const precioEl = document.getElementById('restock-prod-precio');
    precioEl.value = _restockPrecioActual != null ? _restockPrecioActual.toFixed(2) : '';
    const ubicEl = document.getElementById('restock-prod-ubicacion');
    ubicEl.value = ubicacionActual;
    document.getElementById('restock-unidad-label').textContent = etq;

    const cantInput = document.getElementById('restock-prod-cantidad');
    cantInput.step  = _restockEsDecimal ? '0.001' : '1';
    cantInput.min   = _restockEsDecimal ? '0.001' : '1';
    cantInput.value = '';

    const costoEl = document.getElementById('restock-prod-costo');
    costoEl.value = '';   
    ['restock-prod-costo','restock-prod-precio','restock-prod-ubicacion']
        .forEach(id => document.getElementById(id)?.classList.remove('is-invalid','is-valid'));
    cantInput.classList.remove('is-invalid','is-valid');
    restockProdModalBS.show();
};

async function confirmarRestockProducto() {
    const cantEl  = document.getElementById('restock-prod-cantidad');
    const cantVal = cantEl.value.trim();
    const cantidad = parseFloat(cantVal);

    cantEl.classList.remove('is-invalid','is-valid');

    if (!cantVal || isNaN(cantidad) || cantidad <= 0) {
        cantEl.classList.add('is-invalid');
        Swal.fire('Cantidad inválida',
            'Ingresa una cantidad mayor a 0.', 'warning');
        return;
    }
    if (!_restockEsDecimal && !Number.isInteger(cantidad)) {
        cantEl.classList.add('is-invalid');
        Swal.fire('Solo enteros',
            'Este producto se maneja por piezas completas.', 'warning');
        return;
    }
    cantEl.classList.add('is-valid');

    const costoVal  = document.getElementById('restock-prod-costo').value.trim();
    const precioVal = document.getElementById('restock-prod-precio').value.trim();

    if (costoVal && (isNaN(parseFloat(costoVal)) || parseFloat(costoVal) <= 0)) {
        Swal.fire('Costo inválido', 'El costo debe ser mayor a $0.', 'warning');
        return;
    }
    if (precioVal && (isNaN(parseFloat(precioVal)) || parseFloat(precioVal) <= 0)) {
        Swal.fire('Precio inválido', 'El precio debe ser mayor a $0.', 'warning');
        return;
    }
    
    if (cantidad >= 1000) {
        const r = await Swal.fire({
            icon: 'question', title: '¿Cantidad tan grande?',
            text: `Vas a agregar ${cantidad} unidades al stock. ¿Es correcto?`,
            showCancelButton: true,
            confirmButtonText: 'Sí, es correcto', cancelButtonText: 'Corregir'
        });
        if (!r.isConfirmed) return;
    }

    if (precioVal && _restockPrecioActual != null) {
        const nuevoP = parseFloat(precioVal);
        if (nuevoP < _restockPrecioActual * 0.5 || nuevoP > _restockPrecioActual * 3) {
            const r = await Swal.fire({
                icon: 'warning', title: 'Cambio de precio muy grande',
                html: `El precio pasaría de <strong>$${_restockPrecioActual.toFixed(2)}</strong>
                       a <strong>$${nuevoP.toFixed(2)}</strong>. ¿Es correcto?`,
                showCancelButton: true,
                confirmButtonText: 'Sí, cambiar precio', cancelButtonText: 'Corregir',
                focusCancel: true
            });
            if (!r.isConfirmed) return;
        }
    }

    const costoFinal  = costoVal  ? parseFloat(costoVal)  : _restockCostoActual;
    const precioFinal = precioVal ? parseFloat(precioVal) : _restockPrecioActual;

    if (costoFinal != null && precioFinal != null && precioFinal < costoFinal) {
        const perdida = (costoFinal - precioFinal).toFixed(2);
        const r = await Swal.fire({
            icon: 'error',
            title: '¡Precio por DEBAJO del costo!',
            html: `<div class="text-start">
                <p>Con estos valores el producto se vendería <strong>perdiendo dinero</strong>:</p>
                <ul class="mb-2">
                    <li>Costo: <strong>$${costoFinal.toFixed(2)}</strong>${costoVal ? '' : ' <small class="text-muted">(actual)</small>'}</li>
                    <li>Precio de venta: <strong>$${precioFinal.toFixed(2)}</strong>${precioVal ? '' : ' <small class="text-muted">(actual)</small>'}</li>
                    <li>Pérdida por unidad: <strong class="text-danger">$${perdida}</strong></li>
                </ul>
                <p class="small text-muted mb-0">Corrige el precio, o confirma solo si es
                intencional (remate/liquidación).</p></div>`,
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'Vender con pérdida',
            cancelButtonText: 'Corregir',
            focusCancel: true
        });
        if (!r.isConfirmed) return;
    }

    
    const precioNum = precioVal ? parseFloat(precioVal) : null;
    const precioCambio = precioNum != null &&
        (_restockPrecioActual == null || Math.abs(precioNum - _restockPrecioActual) > 0.009);
    const ubicVal = sanitizar(
        document.getElementById('restock-prod-ubicacion').value) || null;

    const payload = {
        quantityToAdd: cantidad,
        newCostPrice:  costoVal ? parseFloat(costoVal) : null,
        newListPrice:  precioCambio ? precioNum : null,
        location:      ubicVal,
        allowLoss:     false
    };
    const btn = document.getElementById('btn-confirmar-restock-prod');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    try {
        try {
            await fetchAPI(`/inventory/${restockProdId}`,
                { method:'POST', body:payload });
        } catch (e) {
            
            if ((e.message || '').includes('PRECIO_BAJO_COSTO')
                || (e.message || '').includes('por debajo del costo')) {
                const r = await Swal.fire({
                    icon: 'error', title: '¡Precio por debajo del costo!',
                    html: `<div class="text-start">
                        <p>El precio de venta quedaría <strong>por debajo del costo</strong>
                        del producto: se vendería perdiendo dinero.</p>
                        <p class="small text-muted mb-0">Corrige el precio, o confirma solo
                        si es intencional (remate/liquidación).</p></div>`,
                    showCancelButton: true, confirmButtonColor: '#dc3545',
                    confirmButtonText: 'Vender con pérdida',
                    cancelButtonText: 'Corregir', focusCancel: true
                });
                if (!r.isConfirmed) return;
                payload.allowLoss = true;
                await fetchAPI(`/inventory/${restockProdId}`,
                    { method:'POST', body:payload });
            } else { throw e; }
        }
        restockProdModalBS.hide();
        
        catalogoCache = null;
        const chkB = document.getElementById('restock-por-bolsa');
        const numBolsas = parseInt(document.getElementById('restock-num-bolsas')?.value) || 0;
        let msgOk = 'Stock actualizado';
        if (chkB && chkB.checked && numBolsas > 0 && _restockPiezasPorBolsa > 0) {
            msgOk = numBolsas + ' bolsa(s) = +' + (numBolsas * _restockPiezasPorBolsa) + ' piezas';
        }
        
        try { aplicarFiltros(); } catch (e) { /* no estamos en Productos */ }
        if (typeof window.onRestockSuccess === 'function') {
            try { window.onRestockSuccess(); } catch (e) {}
        }
        if (typeof window.refrescarBadges === 'function') window.refrescarBadges();

        
        let productoFresco = null;
        try { productoFresco = await fetchAPI(`/products/${restockProdId}`); } catch (e) {}

        if (productoFresco) {
            const r = await Swal.fire({
                icon: 'success', title: msgOk,
                html: `<p class="small mb-0">${escaparHtml(productoFresco.name)}</p>`,
                showCancelButton: true,
                confirmButtonText: '<i class="bi bi-tags-fill me-1"></i>Imprimir etiqueta',
                cancelButtonText: 'No, gracias',
                confirmButtonColor: '#2B6CA3', timer: 6000, timerProgressBar: true
            });
            if (r.isConfirmed) imprimirEtiquetas([productoFresco]);
        } else if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(msgOk, 'success');
        } else {
            Swal.fire({ icon:'success', title:'¡Stock actualizado!',
                timer:1800, showConfirmButton:false });
        }
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-plus-circle"></i> Confirmar';
    }
}

window.abrirAjuste = (id, nombre, stockActual, precio, satClaveUnidad) =>
    window.abrirRestock(id, nombre, stockActual, precio, satClaveUnidad);

window.editarProducto  = (id) => abrirModal(id);
window.verFichaProducto = (id) => mostrarFichaProducto(id);

window.eliminarProducto = async (id, active) => {
    
    const r = await Swal.fire({
        title: active ? '¿Desactivar producto?' : '¿Activar producto?',
        html:  active
            ? '<p class="small mb-0">No aparecerá en ventas, pero se conserva ' +
              'con todo su historial.</p>'
            : '<p class="small mb-0">Volverá a estar disponible para vender.</p>',
        icon: active ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonColor: active ? '#dc3545' : '#198754',
        confirmButtonText:  active ? 'Sí, desactivar' : 'Sí, activar',
        cancelButtonText: 'Cancelar',
        showDenyButton: !active,
        denyButtonText: '<i class="bi bi-trash3"></i> Borrar definitivamente',
        denyButtonColor: '#7f1d1d'
    });

    if (r.isDenied) { borrarProductoDefinitivo(id); return; }
    if (!r.isConfirmed) return;

    try {
        if (active) {
            await fetchAPI(`/products/${id}`, { method: 'DELETE' });
        } else {
            
            await fetchAPI('/products/estado-masivo', {
                method: 'PATCH',
                body: { ids: [id], activo: true }
            });
        }
        catalogoCache = null;
        aplicarFiltros();
        if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};


async function borrarProductoDefinitivo(id) {
    let prod = null;
    try { prod = await fetchAPI(`/products/${id}`); }
    catch (e) { Swal.fire('Error', 'No se pudo leer el producto.', 'error'); return; }

    const sku = (prod.sku || '').toUpperCase();

    
    const r = await Swal.fire({
        icon: 'warning',
        title: 'Borrar para siempre',
        html: `
            <div class="text-start">
                <p class="mb-2">Vas a borrar de la base de datos:</p>
                <p class="mb-3">
                    <strong>${escaparHtml(prod.name)}</strong><br>
                    <span class="font-monospace text-muted small">${escaparHtml(sku)}</span>
                </p>
                <div class="alert alert-danger py-2 small mb-3">
                    <strong>Esto no se puede deshacer.</strong> Se van también sus
                    fotos, su inventario y su historial de precios.
                    Si el producto ya se vendió alguna vez, el sistema
                    <u>no</u> te va a dejar borrarlo — desactívalo y ya.
                </div>
                <label class="form-label small mb-1">
                    Escribe <strong>${escaparHtml(sku)}</strong> para confirmar:
                </label>
                <input type="text" id="confirmar-sku" class="form-control"
                    autocomplete="off" placeholder="${escaparHtml(sku)}">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Borrar definitivamente',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7f1d1d',
        focusCancel: true,
        didOpen: () => document.getElementById('confirmar-sku')?.focus(),
        preConfirm: () => {
            const v = (document.getElementById('confirmar-sku').value || '')
                .trim().toUpperCase();
            if (v !== sku) {
                Swal.showValidationMessage('El código no coincide');
                return false;
            }
            return true;
        }
    });
    if (!r.isConfirmed) return;

    try {
        await fetchAPI(`/products/${id}/permanente`, { method: 'DELETE' });
        catalogoCache = null;
        aplicarFiltros();
        if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
        Swal.fire({ icon:'success', title:'Producto borrado',
            timer:1600, showConfirmButton:false });
    } catch (e) {
        
        const msg = e.message || '';
        const faltaEndpoint = /no existe en el servidor|404/i.test(msg);
        Swal.fire({
            icon: 'error',
            title: faltaEndpoint ? 'Falta instalar esta función' : 'No se pudo borrar',
            html: faltaEndpoint
                ? '<p class="small mb-0">El backend todavía no tiene el endpoint ' +
                  '<code>DELETE /products/{id}/permanente</code>. ' +
                  'Mientras tanto el producto queda desactivado, que para el uso ' +
                  'diario funciona igual.</p>'
                : `<p class="small mb-0">${escaparHtml(msg)}</p>`
        });
    }
}


const MOTIVOS_AJUSTE = {
    CONTEO_FISICO:        'Conteo fisico (recuento de anaquel)',
    MERMA:                'Merma o dano',
    ROBO:                 'Robo o extravio',
    ERROR_CAPTURA:        'Error de captura anterior',
    DEVOLUCION_PROVEEDOR: 'Devolucion al proveedor',
    USO_INTERNO:          'Uso interno del negocio',
    OTRO:                 'Otro'
};

window.abrirAjusteStock = async (id, nombre, stockActual, satClaveUnidad) => {
    const etq = etiquetaUnidad(satClaveUnidad);
    const dec = esDecimal(satClaveUnidad);
    const paso = dec ? '0.001' : '1';

    const r = await Swal.fire({
        title: 'Ajustar existencias',
        width: 520,
        html: `
            <div class="text-start">
                <p class="mb-1 fw-bold">${escaparHtml(nombre)}</p>
                <p class="text-muted small mb-3">
                    El sistema dice que hay
                    <strong>${stockActual} ${etq}</strong>.
                </p>

                <label class="form-label small fw-bold mb-1">
                    ¿Cuantas hay en realidad? <span class="text-danger">*</span>
                </label>
                <div class="input-group mb-1">
                    <input type="number" id="ajuste-cantidad" class="form-control form-control-lg"
                        min="0" step="${paso}" placeholder="Cuenta y escribe el numero">
                    <span class="input-group-text">${etq}</span>
                </div>
                <div id="ajuste-diferencia" class="small mb-3" style="min-height:20px"></div>

                <label class="form-label small fw-bold mb-1">
                    Motivo <span class="text-danger">*</span>
                </label>
                <select id="ajuste-motivo" class="form-select mb-3">
                    <option value="">Elige el motivo...</option>
                    ${Object.entries(MOTIVOS_AJUSTE).map(([k, v]) =>
                        `<option value="${k}">${v}</option>`).join('')}
                </select>

                <label class="form-label small mb-1">
                    Detalle <span class="text-muted">(opcional)</span>
                </label>
                <input type="text" id="ajuste-nota" class="form-control" maxlength="300"
                    placeholder="Ej: se mojaron 3 cajas en la bodega">
            </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg"></i> Ajustar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2B6CA3',
        didOpen: () => {
            const cant = document.getElementById('ajuste-cantidad');
            const dif  = document.getElementById('ajuste-diferencia');
            
            cant.addEventListener('input', () => {
                const v = parseFloat(cant.value);
                if (isNaN(v)) { dif.innerHTML = ''; return; }
                const d = v - stockActual;
                if (d === 0) {
                    dif.innerHTML = '<span class="text-muted">Es la misma cantidad ' +
                        'que ya tenia el sistema.</span>';
                } else if (d < 0) {
                    dif.innerHTML = '<span class="text-danger fw-bold">Faltan ' +
                        Math.abs(d).toFixed(dec ? 3 : 0) + ' ' + etq + '</span>' +
                        ' <span class="text-muted">— se van a descontar del inventario</span>';
                } else {
                    dif.innerHTML = '<span class="text-success fw-bold">Sobran ' +
                        d.toFixed(dec ? 3 : 0) + ' ' + etq + '</span>' +
                        ' <span class="text-muted">— se van a agregar al inventario</span>';
                }
            });
            cant.focus();
        },
        preConfirm: () => {
            const v      = document.getElementById('ajuste-cantidad').value.trim();
            const motivo = document.getElementById('ajuste-motivo').value;
            const nota   = document.getElementById('ajuste-nota').value.trim();
            const num    = parseFloat(v);

            if (!v || isNaN(num) || num < 0) {
                Swal.showValidationMessage('Escribe cuantas piezas hay (0 si no queda ninguna)');
                return false;
            }
            if (!dec && !Number.isInteger(num)) {
                Swal.showValidationMessage('Este producto se maneja por piezas completas');
                return false;
            }
            if (num === stockActual) {
                Swal.showValidationMessage('Esa es la cantidad que ya tenia: no hay nada que ajustar');
                return false;
            }
            if (!motivo) {
                Swal.showValidationMessage('Elige el motivo del ajuste');
                return false;
            }
            return { cantidadReal: num, motivo, nota: nota || null };
        }
    });
    if (!r.isConfirmed) return;

   
    const perdida = stockActual - r.value.cantidadReal;
    if (perdida > 0 && (perdida >= 50 || (stockActual > 0 && perdida / stockActual >= 0.5))) {
        const c = await Swal.fire({
            icon: 'warning',
            title: 'Es una baja grande',
            html: `<p class="small mb-0">Vas a dar de baja
                   <strong>${perdida.toFixed(dec ? 3 : 0)} ${etq}</strong> de
                   ${escaparHtml(nombre)}.<br>Queda registrado con tu usuario.</p>`,
            showCancelButton: true,
            confirmButtonText: 'Si, es correcto',
            cancelButtonText: 'Revisar',
            confirmButtonColor: '#dc3545',
            focusCancel: true
        });
        if (!c.isConfirmed) return;
    }

    try {
        await fetchAPI(`/inventory/${id}/ajuste`, { method: 'POST', body: r.value });
        catalogoCache = null;
        try { aplicarFiltros(); } catch (e) { /* no estamos en Productos */ }
        if (typeof window.onRestockSuccess === 'function') {
            try { window.onRestockSuccess(); } catch (e) {}
        }
        if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
        Swal.fire({ icon: 'success', title: 'Existencias ajustadas',
            html: `<p class="small mb-0">${escaparHtml(nombre)}: ahora hay
                   <strong>${r.value.cantidadReal} ${etq}</strong></p>`,
            timer: 2200, showConfirmButton: false });
    } catch (e) {
        const msg = e.message || '';
        const falta = /no existe en el servidor|404/i.test(msg);
        Swal.fire({
            icon: 'error',
            title: falta ? 'Falta instalar esta funcion' : 'No se pudo ajustar',
            html: falta
                ? '<p class="small mb-0">El backend todavia no tiene el endpoint ' +
                  '<code>POST /inventory/{id}/ajuste</code>. Revisa que hayas corrido ' +
                  'el SQL de la tabla y subido el jar nuevo.</p>'
                : `<p class="small mb-0">${escaparHtml(msg)}</p>`
        });
    }
};