import { fetchAPI } from '../services/api.js';
import { urlImagenCompleta } from '../services/camara.js';
import { fmtFecha } from '../services/fechas.js';
import { SearchSelect } from '../services/searchSelect.js';
import { sanitizar } from '../services/validaciones.js';
import { mostrarFichaProducto } from '../services/productDetailCard.js';
import { PLANTILLAS_MEDIDAS, evaluarMedida }
    from '../services/plantillasMedidas.js';

import { LIMITE_EFECTIVO, procesarVentaDividida, procesarDeudaEnNotas }
    from '../services/facturaDividida.js';


function inyectarTemaPos() {
    if (document.getElementById('pos-az-theme')) return;
    if (!document.getElementById('pos-az-font')) {
        const f = document.createElement('link');
        f.id = 'pos-az-font'; f.rel = 'stylesheet';
        f.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;1,700&display=swap';
        document.head.appendChild(f);
    }
    const s = document.createElement('style');
    s.id = 'pos-az-theme';
    s.textContent = `
    .pos-az{--az:#2B6CA3;--az-hover:#1F5480;--carbon:#1B1D21;--acero:#26292F;
        --pista:#EDEFF2;--linea:#DCE0E5;--tinta:#22252A;}
    .pos-az .fx-cond{font-family:'Barlow Condensed',Arial Narrow,sans-serif;}

    /* Franja superior carbón con corte diagonal */
    .pos-az .az-topbar{background:var(--carbon);color:#fff;border-radius:12px;
        padding:.65rem 1.25rem;display:flex;justify-content:space-between;
        align-items:center;position:relative;overflow:hidden;margin-bottom:1rem;}
    .pos-az .az-topbar::after{content:'';position:absolute;right:26%;top:-20%;
        width:14px;height:140%;background:var(--az);transform:skewX(-18deg);}
    .pos-az .az-topbar h2{font-family:'Barlow Condensed',sans-serif;
        font-style:italic;font-weight:700;letter-spacing:.03em;
        text-transform:uppercase;margin:0;font-size:1.65rem;}
    .pos-az .az-topbar h2 i{color:var(--az);}
    .pos-az .az-total-top{font-family:'Barlow Condensed',sans-serif;
        font-weight:700;font-size:2.1rem;color:var(--az);line-height:1;
        position:relative;z-index:1;}

    /* Paneles */
    .pos-az .az-panel{background:#fff;border:1px solid var(--linea);
        border-radius:12px;overflow:hidden;}
    .pos-az .az-panel-head{background:var(--acero);color:#fff;
        padding:.7rem 1rem;}

    /* Buscador grande */
    .pos-az .az-search input{border:2px solid var(--carbon);border-radius:10px;
        font-size:1.05rem;padding-left:2.6rem;height:52px;}
    .pos-az .az-search input:focus{border-color:var(--az);
        box-shadow:0 0 0 .2rem rgba(43,108,163,.18);}

    /* Pestañas del buscador: General / Código Truper / Por medidas */
    .pos-az #buscador-tabs .nav-link{color:var(--carbon);background:var(--pista);
        border:1px solid var(--linea);border-radius:8px;font-weight:700;
        padding:.4rem .5rem;}
    .pos-az #buscador-tabs .nav-link.active{background:var(--carbon);color:#fff;
        border-color:var(--carbon);}
    .pos-az #buscador-tabs .nav-link:hover:not(.active){border-color:var(--az);}

    /* GRID de tarjetas de producto */
    .pos-az .az-grid{display:grid;gap:.75rem;
        grid-template-columns:repeat(auto-fill,minmax(168px,1fr));
        max-height:520px;overflow-y:auto;padding:.9rem;}
    .pos-az .az-card{border:1px solid var(--linea);border-radius:10px;
        background:#fff;display:flex;flex-direction:column;overflow:hidden;
        transition:box-shadow .12s,transform .12s;}
    .pos-az .az-card:hover{box-shadow:0 6px 18px rgba(27,29,33,.14);
        transform:translateY(-2px);}
    .pos-az .az-card-img{height:96px;background:var(--pista);display:flex;
        align-items:center;justify-content:center;cursor:pointer;}
    .pos-az .az-card-img img{width:100%;height:100%;object-fit:cover;}
    .pos-az .az-card-body{padding:.5rem .6rem .35rem;flex-grow:1;}
    .pos-az .az-card-nom{font-weight:700;font-size:.82rem;line-height:1.15;
        color:var(--tinta);display:-webkit-box;-webkit-line-clamp:2;
        -webkit-box-orient:vertical;overflow:hidden;min-height:1.9em;}
    .pos-az .az-sku{font-size:.66rem;color:#6B7280;font-family:monospace;}

    /* Precio "etiqueta de anaquel": centavos elevados */
    .pos-az .az-precio{font-family:'Barlow Condensed',sans-serif;
        font-weight:700;color:var(--az);font-size:1.45rem;line-height:1;}
    .pos-az .az-precio sup{font-size:.62em;top:-.45em;font-weight:700;}
    .pos-az .az-precio .az-um{font-size:.55em;color:#6B7280;font-weight:600;}

    .pos-az .az-stock{font-size:.64rem;font-weight:700;border-radius:4px;
        padding:.12rem .4rem;letter-spacing:.02em;}
    .pos-az .az-stock.ok{background:#E3F4E8;color:#157F3D;}
    .pos-az .az-stock.low{background:#FBEFD9;color:#B26A00;}
    .pos-az .az-stock.none{background:#ECEDEF;color:#6B7280;}

    .pos-az .az-btn-add{background:var(--az);color:#fff;border:none;
        font-family:'Barlow Condensed',sans-serif;font-weight:700;
        font-size:1rem;letter-spacing:.04em;padding:.42rem;width:100%;
        text-transform:uppercase;}
    .pos-az .az-btn-add:hover{background:var(--az-hover);color:#fff;}
    .pos-az .az-btn-add:disabled{background:#C6CAD0;}

    /* Carrito */
    .pos-az .az-cart-list{max-height:360px;overflow-y:auto;}
    .pos-az .az-cart-item{display:flex;justify-content:space-between;
        align-items:center;padding:.55rem .85rem;
        border-bottom:1px solid var(--linea);}
    .pos-az .az-cart-item:nth-child(even){background:#FAFBFC;}
    .pos-az .az-qty button{width:30px;height:30px;border:1px solid var(--linea);
        background:#fff;border-radius:6px;font-weight:700;line-height:1;}
    .pos-az .az-qty button:hover{border-color:var(--az);color:var(--az);}
    .pos-az .az-qty input{width:62px;height:30px;text-align:center;
        border:1px solid var(--linea);border-radius:6px;font-weight:700;}

    /* Total y cobrar */
    .pos-az .az-total-bar{background:var(--az);color:#fff;border-radius:10px;
        display:flex;justify-content:space-between;align-items:center;
        padding:.5rem .9rem;margin-bottom:.6rem;}
    .pos-az .az-total-bar .lbl{font-weight:700;font-size:.8rem;
        letter-spacing:.06em;}
    .pos-az .az-total-bar .val{font-family:'Barlow Condensed',sans-serif;
        font-weight:700;font-size:1.9rem;line-height:1;}
    .pos-az .az-btn-cobrar{background:var(--carbon);color:#fff;border:none;
        width:100%;border-radius:10px;padding:.7rem;
        font-family:'Barlow Condensed',sans-serif;font-weight:700;
        font-size:1.45rem;letter-spacing:.06em;text-transform:uppercase;}
    .pos-az .az-btn-cobrar:hover:not(:disabled){background:#000;}
    .pos-az .az-btn-cobrar:disabled{background:#C6CAD0;}
    .pos-az .az-btn-pref{width:100%;border:2px solid var(--carbon);
        background:#fff;color:var(--carbon);border-radius:10px;
        font-weight:700;padding:.45rem;margin-top:.5rem;font-size:.85rem;}
    .pos-az .az-btn-pref:hover:not(:disabled){background:var(--carbon);color:#fff;}
    .pos-az .az-btn-pref:disabled{opacity:.45;}

    .pos-az .az-empty{color:#9AA1A9;text-align:center;padding:2.6rem 1rem;}
    @media (prefers-reduced-motion:reduce){
        .pos-az .az-card{transition:none;}}
    `;
    document.head.appendChild(s);
}


const UNIDADES_DECIMALES = new Set([
    'MTR','KGM','GRM','LTR','MLT','CMT','MTK','DMT',
    'DMQ','HLT','TNE','MGM','H87P'
]);
const ETIQUETA_UNIDAD = {
    H87:'pza', SET:'juego', KT:'kit', PR:'par', BX:'caja',
    MTR:'m',   CMT:'cm',   MMT:'mm', MTK:'m²',
    KGM:'kg',  GRM:'g',    MGM:'mg', TNE:'ton',
    LTR:'L',   MLT:'mL',   HLT:'hL',
};
function esDecimal(clave) {
    return UNIDADES_DECIMALES.has((clave||'').toUpperCase());
}
function etiqueta(clave) {
    return ETIQUETA_UNIDAD[(clave||'').toUpperCase()] || 'pza';
}

let carrito             = [];
let topVendidos         = [];  
let catalogoCompleto    = [];  
let _catalogoAt        = 0;    
const CATALOGO_VIGENCIA= 10*60*1000; 

window._invalidarCatalogoVentas = () => {
    _catalogoAt = 0;          
    catalogoCompleto = [];    
};
let descuentoCliente    = 0;   
let clienteSeleccionado = null;
let ssCliente           = null;

export function initVentas(container) {
    inyectarTemaPos();
    container.innerHTML = `
    <div class="pos-az">
        <!-- Franja superior carbón -->
        <div class="az-topbar">
            <h2><i class="bi bi-tools me-2"></i>Punto de venta</h2>
            <div class="text-end">
                <div class="az-total-top" id="total-header">$0.00</div>
                <div class="small" style="color:var(--linea);position:relative;z-index:1"
                    id="items-header"></div>
            </div>
        </div>

        <div class="row g-3">
            <!-- Panel izquierdo: buscador + grid de productos -->
            <div class="col-md-7">
                <div class="az-panel h-100">
                    <div class="p-3 pb-0">
                        <!-- 3 buscadores separados: cada uno para un tipo de
                             búsqueda distinto, así el vendedor sabe EXACTAMENTE
                             dónde escribir según lo que trae el cliente. -->
                        <ul class="nav nav-pills nav-fill mb-2" id="buscador-tabs"
                            style="gap:4px">
                            <li class="nav-item">
                                <button type="button" class="nav-link active w-100"
                                    data-tab-buscar="general" style="font-size:.85rem">
                                    <i class="bi bi-search me-1"></i>General
                                </button>
                            </li>
                            <li class="nav-item">
                                <button type="button" class="nav-link w-100"
                                    data-tab-buscar="truper" style="font-size:.85rem">
                                    <i class="bi bi-upc me-1"></i>Cód. Truper
                                </button>
                            </li>
                            <li class="nav-item">
                                <button type="button" class="nav-link w-100"
                                    data-tab-buscar="medidas" style="font-size:.85rem">
                                    <i class="bi bi-rulers me-1"></i>Por medidas
                                </button>
                            </li>
                        </ul>

                        <!-- Panel 1: General (nombre, SKU, descripción, código de barras) -->
                        <div id="buscador-panel-general" class="buscador-panel">
                            <div class="search-wrapper az-search mb-2">
                                <i class="bi bi-upc-scan search-icon"></i>
                                <input type="text" id="input-buscar-producto-venta"
                                    class="search-input form-control"
                                    placeholder="Escanea el código o escribe nombre / SKU...   (F1)"
                                    autofocus>
                            </div>
                        </div>

                        <!-- Panel 2: Código Truper (el del catálogo impreso) -->
                        <div id="buscador-panel-truper" class="buscador-panel" style="display:none">
                            <div class="search-wrapper az-search mb-2">
                                <i class="bi bi-upc search-icon"></i>
                                <input type="text" id="input-buscar-truper"
                                    class="search-input form-control" inputmode="numeric"
                                    placeholder="Código Truper del catálogo impreso (ej: 100048)...">
                            </div>
                        </div>

                        <!-- Panel 3: Por medidas (baleros, birlos, tornillería...) -->
                        <div id="buscador-panel-medidas" class="buscador-panel border rounded p-2"
                            style="display:none;background:var(--pista)">
                            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                <select id="medidas-tipo" class="form-select form-select-sm"
                                    style="width:auto">
                                    <option value="">Tipo de producto…</option>
                                </select>
                                <div id="medidas-campos" class="d-flex gap-2 flex-wrap"></div>
                            </div>
                            <small class="text-muted">
                                Llena solo las medidas que el cliente conoce —
                                "25" encuentra "25 mm".
                            </small>
                        </div>

                        <div class="d-flex justify-content-end gap-2 mt-2">
                            <button class="btn btn-sm az-btn-pref w-auto mt-0 px-3"
                                id="btn-producto-libre">
                                <i class="bi bi-plus-square-dotted me-1"></i>Producto libre<span style="opacity:.5;font-size:.75em;margin-left:.35rem">F4</span>
                            </button>
                        </div>
                    </div>
                    <div class="az-grid" id="tabla-resultados-productos">
                        <div class="az-empty" style="grid-column:1/-1">
                            <i class="bi bi-search fs-2 d-block mb-2"></i>
                            Busca un producto para agregarlo
                        </div>
                    </div>
                </div>
            </div>

            <!-- Panel derecho: carrito -->
            <div class="col-md-5">
                <div class="az-panel h-100 d-flex flex-column">
                    <div class="az-panel-head">
                        <div class="search-wrapper">
                            <i class="bi bi-person search-icon"></i>
                            <input type="text" class="search-input form-control"
                                id="input-cliente-venta"
                                placeholder="Público en General — buscar cliente...">
                            <div class="search-dropdown"
                                id="dropdown-cliente-venta"></div>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center px-3 pt-2"
                        id="carrito-encabezado" style="display:none !important">
                        <small class="text-muted fw-bold text-uppercase"
                            style="letter-spacing:.04em">Carrito</small>
                        <button class="btn btn-sm btn-link text-danger p-0" id="btn-vaciar-carrito">
                            <i class="bi bi-trash3 me-1"></i>Vaciar
                        </button>
                    </div>

                    <div class="az-cart-list flex-grow-1" id="lista-carrito">
                        <div class="az-empty">
                            <i class="bi bi-cart fs-2 d-block mb-2"></i>
                            El carrito está vacío
                        </div>
                    </div>

                    <div class="p-3" style="background:var(--pista);border-top:1px solid var(--linea)">
                        <div class="d-flex justify-content-between mb-1">
                            <span class="text-muted small">Subtotal (sin IVA):</span>
                            <span id="resumen-subtotal" class="small fw-bold">$0.00</span>
                        </div>
                        <div class="az-total-bar">
                            <span class="lbl">TOTAL (c/IVA)</span>
                            <span class="val" id="resumen-total">$0.00</span>
                        </div>
                        <button class="az-btn-cobrar" id="btn-cobrar" disabled>
                            <i class="bi bi-cash-coin me-1"></i>Cobrar venta<span style="opacity:.55;font-size:.75em;margin-left:.5rem">F2</span>
                        </button>
                        <button class="az-btn-pref" id="btn-guardar-prefactura" disabled>
                            <i class="bi bi-file-earmark-text me-1"></i>Guardar como pre-factura
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    configurarEventos();
    cargarClientes();
    cargarTopVendidos();  

    if (carrito.length) actualizarVistaCarrito();

    setTimeout(() =>
        document.getElementById('input-buscar-producto-venta')?.focus(), 50);

    if (!window.__ventasBeforeUnload) {
        window.__ventasBeforeUnload = true;
        window.addEventListener('beforeunload', (e) => {
            if (carrito.length > 0) {
                e.preventDefault();
                e.returnValue = ''; 
            }
        });
    }
}

function configurarEventos() {
    const inputBuscar = document.getElementById('input-buscar-producto-venta');
    let timeout;
    inputBuscar.addEventListener('input', e => {
        clearTimeout(timeout);
        const v = e.target.value.trim();
        if (v.length > 1) timeout = setTimeout(() => buscarProductos(v), 300);
        else if (!v) resetTablaProductos();
    });
    inputBuscar.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            clearTimeout(timeout);
            const v = e.target.value.trim();
            if (v) buscarProductos(v, true);
        }
        if (e.key === 'Escape') {
            e.target.value = '';
            resetTablaProductos();
        }
    });

   const inputTruper = document.getElementById('input-buscar-truper');
    let timeoutTruper;
    inputTruper.addEventListener('input', e => {
        clearTimeout(timeoutTruper);
        const v = e.target.value.trim();
        if (v.length > 1) timeoutTruper = setTimeout(() => buscarProductos(v), 300);
        else if (!v) resetTablaProductos();
    });
    inputTruper.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            clearTimeout(timeoutTruper);
            const v = e.target.value.trim();
            if (v) buscarProductos(v, true);
        }
        if (e.key === 'Escape') { e.target.value = ''; resetTablaProductos(); }
    });

    configurarPestanasBuscador();
    document.getElementById('btn-cobrar')
        .addEventListener('click', procesarVenta);
    document.getElementById('btn-producto-libre')
        .addEventListener('click', agregarProductoLibre);
    document.getElementById('btn-vaciar-carrito')
        .addEventListener('click', vaciarCarrito);
    configurarBusquedaPorMedidas();
    instalarAtajosVentas();
    document.getElementById('btn-guardar-prefactura')
        .addEventListener('click', guardarComoPrefactura);
}

function configurarPestanasBuscador() {
    document.querySelectorAll('#buscador-tabs [data-tab-buscar]').forEach(btn => {
        btn.addEventListener('click', () => activarPestanaBuscador(btn.dataset.tabBuscar));
    });
}

function activarPestanaBuscador(tab) {
    document.querySelectorAll('#buscador-tabs [data-tab-buscar]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tabBuscar === tab);
    });
    document.getElementById('buscador-panel-general').style.display =
        tab === 'general' ? '' : 'none';
    document.getElementById('buscador-panel-truper').style.display =
        tab === 'truper' ? '' : 'none';
    document.getElementById('buscador-panel-medidas').style.display =
        tab === 'medidas' ? '' : 'none';

    if (tab !== 'general') document.getElementById('input-buscar-producto-venta').value = '';
    if (tab !== 'truper')  document.getElementById('input-buscar-truper').value = '';
    if (tab !== 'medidas') {
        const selTipo = document.getElementById('medidas-tipo');
        if (selTipo) { selTipo.value = ''; document.getElementById('medidas-campos').innerHTML = ''; }
    }
    resetTablaProductos();

    setTimeout(() => {
        if (tab === 'general') document.getElementById('input-buscar-producto-venta').focus();
        if (tab === 'truper')  document.getElementById('input-buscar-truper').focus();
        if (tab === 'medidas') document.getElementById('medidas-tipo').focus();
    }, 30);
}

function resetTablaProductos() {
    const tbody = document.getElementById('tabla-resultados-productos');
    if (!tbody) return;
    if (topVendidos.length) {
        tbody.innerHTML = `
            <div style="grid-column:1/-1" class="pb-1">
                <small class="fw-bold fx-cond text-uppercase"
                    style="color:var(--az);letter-spacing:.06em;font-size:.85rem">
                    <i class="bi bi-star-fill me-1"></i>
                    Más vendidos — un clic para agregar
                </small>
            </div>` + topVendidos.map(filaProductoVenta).join('');
    } else {
        tbody.innerHTML = `
        <div class="az-empty" style="grid-column:1/-1">
            <i class="bi bi-search fs-2 d-block mb-2"></i>
            Busca un producto para agregarlo
        </div>`;
    }
}

async function cargarTopVendidos() {
    const fresco = catalogoCompleto.length > 0
        && (Date.now() - _catalogoAt) < CATALOGO_VIGENCIA;
    if (fresco) { resetTablaProductos(); return; }

    try {
        const [ventas, productos] = await Promise.all([
            fetchAPI('/sales/recent'),
            fetchAPI('/products')
        ]);
        const conteo = {};
        ventas.forEach(v => {
            if (String(v.status || '').toUpperCase().includes('CANCEL')) return;
            (v.items || []).forEach(i => {
                conteo[i.productId] = (conteo[i.productId] || 0) + Number(i.quantity || 0);
            });
        });
        catalogoCompleto = productos.filter(p => p.active !== false);
        _catalogoAt = Date.now();
        const mapa = {};
        productos.forEach(p => mapa[p.id] = p);
        topVendidos = Object.entries(conteo)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => mapa[id])
            .filter(p => p && p.active !== false)
            .slice(0, 12);
    } catch (e) { topVendidos = []; }
    const inp = document.getElementById('input-buscar-producto-venta');
    if (inp && !inp.value.trim()) resetTablaProductos();
}

async function cargarClientes() {
    try {
        const clientes = await fetchAPI('/customers?active=true');
        ssCliente = new SearchSelect({
            input:    document.getElementById('input-cliente-venta'),
            dropdown: document.getElementById('dropdown-cliente-venta'),
            items:    clientes.map(c => ({
                id:    c.id,
                label: c.fullName,
                sub:   [c.rfc, c.city].filter(Boolean).join(' · '),
                phone: c.phoneNumber || '',
                descuento: Number(c.discountRate) || 0
            })),
            onSelect: item => {
                clienteSeleccionado = item.id;
                descuentoCliente = item.descuento || 0;
                actualizarVistaCarrito();  
                if (descuentoCliente > 0) {
                    mostrarToast(`Descuento de ${descuentoCliente}% aplicado a ${item.label}`);
                }
            },
            placeholder: 'Público en General — buscar cliente...'
        });
        document.getElementById('input-cliente-venta')
            .addEventListener('input', e => {
                if (!e.target.value.trim()) {
                    clienteSeleccionado = null;
                    descuentoCliente = 0;
                    actualizarVistaCarrito();
                }
            });
    } catch (e) { console.error(e); }
}

function filaProductoVenta(p) {
    if (p.locationRack) {
        window._ubicacionesProd = window._ubicacionesProd || {};
        window._ubicacionesProd[p.id] = p.locationRack;
    }
    const esNulo  = parseFloat(p.currentStock) === 0;
    const esBajo  = !esNulo &&
        parseFloat(p.currentStock) <= (p.minStockLevel || 0);
    const stockCls = esNulo ? 'none' : esBajo ? 'low' : 'ok';
    const stockTxt = esNulo ? 'SIN STOCK'
                   : esBajo ? 'POCO STOCK' : 'EN STOCK';
    const dec = esDecimal(p.satClaveUnidad);
    const etq = etiqueta(p.satClaveUnidad);
    const stockVal = parseFloat(p.currentStock) || 0;
    const precio = p.price || 0;
    const pesos  = Math.floor(precio);
    const cents  = Math.round((precio - pesos) * 100)
        .toString().padStart(2, '0');
    return `
    <div class="az-card">
        <div class="az-card-img"
            onclick="window.verFichaProductoVenta(${p.id})"
            title="Ver ficha completa">
            ${p.imagenUrl
                ? `<img src="${urlImagenCompleta(p.imagenUrl)}"
                       onerror="this.parentElement.innerHTML=
                           '<i class=\\'bi bi-image text-muted fs-3\\'></i>'">`
                : `<i class="bi bi-image text-muted fs-3"></i>`}
        </div>
        <div class="az-card-body">
            <div class="az-card-nom" title="${p.name}">${p.name}</div>
            <div class="d-flex justify-content-between align-items-center mt-1">
                <span class="az-sku">${p.sku}</span>
                <span class="az-stock ${stockCls}"
                    title="${stockVal} ${etq} disponibles">
                    ${stockTxt}</span>
            </div>
            ${p.attributes?.codigo_truper
                ? `<div class="az-sku mt-1" title="Código Truper">
                       <i class="bi bi-upc"></i> ${p.attributes.codigo_truper}
                   </div>` : ''}
            <div class="d-flex justify-content-between align-items-end mt-1">
                <span class="az-precio">$${pesos}<sup>${cents}</sup>
                    <span class="az-um">/${etq}</span></span>
                <small class="text-muted" style="font-size:.66rem">
                    ${stockVal} ${etq}</small>
            </div>
            ${p.costCode && p.costCode !== '0000'
                ? `<div class="az-sku mt-1" style="letter-spacing:.08em"
                       title="Costo en clave de mostrador">
                       <i class="bi bi-lock-fill" style="font-size:.6rem"></i>
                       ${p.costCode}
                   </div>`
                : ''}
            ${dec
                ? `<div class="az-sku mt-1" style="color:#157F3D">
                       <i class="bi bi-rulers"></i> fraccionable
                   </div>` : ''}
            ${p.locationRack
                ? `<div class="az-sku mt-1 fw-bold" style="color:#1B1D21">
                       <i class="bi bi-geo-alt-fill" style="color:#2B6CA3"></i>
                       ${p.locationRack}
                   </div>` : ''}
        </div>
        ${(p.compraPorBolsa && p.precioBolsa && p.piezasPorBolsa)
            ? `<div class="d-flex gap-1">
                <button class="az-btn-add" style="flex:1"
                    onclick="window.agregarAlCarrito(
                        ${p.id},
                        '${p.name.replace(/'/g,"\\'")}',
                        ${p.price}, ${stockVal},
                        '${(p.imagenUrl||'').replace(/'/g,"\\'")}',
                        ${dec}, '${p.satClaveUnidad||'H87'}')"
                    ${esNulo ? 'disabled' : ''}>
                    <i class="bi bi-plus-lg"></i> Pieza
                </button>
                <button class="az-btn-add" style="flex:1;background:#157F3D"
                    title="Bolsa de ${p.piezasPorBolsa} pzas — $${Number(p.precioBolsa).toFixed(2)}"
                    onclick="window.agregarBolsaAlCarrito(
                        ${p.id},
                        '${p.name.replace(/'/g,"\\'")}',
                        ${p.precioBolsa}, ${p.piezasPorBolsa}, ${stockVal},
                        '${(p.imagenUrl||'').replace(/'/g,"\\'")}',
                        '${p.satClaveUnidad||'H87'}')"
                    ${esNulo || stockVal < p.piezasPorBolsa ? 'disabled' : ''}>
                    <i class="bi bi-box-seam"></i> Bolsa
                </button>
               </div>`
            : `<button class="az-btn-add"
                onclick="window.agregarAlCarrito(
                    ${p.id},
                    '${p.name.replace(/'/g,"\\'")}',
                    ${p.price}, ${stockVal},
                    '${(p.imagenUrl||'').replace(/'/g,"\\'")}',
                    ${dec}, '${p.satClaveUnidad||'H87'}')"
                ${esNulo ? 'disabled' : ''}>
                <i class="bi bi-plus-lg me-1"></i>Agregar
               </button>`}
    </div>`;
}


function configurarBusquedaPorMedidas() {
    const selTipo= document.getElementById('medidas-tipo');
    const cont   = document.getElementById('medidas-campos');

    Object.entries(PLANTILLAS_MEDIDAS).forEach(([id, tpl]) => {
        const o = document.createElement('option');
        o.value = id; o.textContent = tpl.etiqueta;
        selTipo.appendChild(o);
    });
   

    selTipo.addEventListener('change', () => {
        cont.innerHTML = '';
        const tpl = PLANTILLAS_MEDIDAS[selTipo.value];
        if (!tpl) { resetTablaProductos(); return; }
        tpl.campos.forEach(campo => {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'form-control form-control-sm medida-input';
            inp.style.width = '110px';
            inp.dataset.clave = campo.clave;
            inp.placeholder = `${campo.label} (${campo.ej})`;
            inp.title = campo.label;
            inp.addEventListener('input', filtrarPorMedidas);
            cont.appendChild(inp);
        });
        filtrarPorMedidas();   
        cont.querySelector('input')?.focus();
    });
}

function filtrarPorMedidas() {
    const tipo = document.getElementById('medidas-tipo').value;
    const tpl  = PLANTILLAS_MEDIDAS[tipo];
    const grid = document.getElementById('tabla-resultados-productos');
    if (!tpl) return;

    const criterios = [...document.querySelectorAll('.medida-input')]
        .map(i => ({ clave: i.dataset.clave, valor: i.value.trim() }))
        .filter(c => c.valor);

    const clavesTipo = tpl.campos.map(c => c.clave);
    const exactas = [], aproximadas = [];

    for (const p of catalogoCompleto) {
        const attrs = p.attributes || {};
        if (!clavesTipo.some(k => k in attrs)) continue;

        
        let nivel = 'exacta';
        let cumple = true;
        for (const c of criterios) {
            const r = evaluarMedida(attrs[c.clave], c.valor);
            if (r === null) { cumple = false; break; }
            if (r === 'aprox') nivel = 'aprox';
        }
        if (!cumple) continue;
        (nivel === 'exacta' ? exactas : aproximadas).push(p);
    }

    if (!exactas.length && !aproximadas.length) {
        grid.innerHTML = `<div class="az-empty" style="grid-column:1/-1">
            <i class="bi bi-rulers fs-2 d-block mb-2"></i>
            Sin coincidencias — ni siquiera aproximadas (±8%)</div>`;
        return;
    }

    const seccion = (titulo, icono, color, lista) => lista.length ? `
        <div style="grid-column:1/-1" class="pb-1 pt-1">
            <small class="fw-bold fx-cond text-uppercase"
                style="color:${color};letter-spacing:.06em;font-size:.85rem">
                <i class="bi ${icono} me-1"></i>${titulo} (${lista.length})
            </small>
        </div>` + lista.map(filaProductoVenta).join('') : '';

    grid.innerHTML =
        seccion(`${tpl.etiqueta} — coincidencia exacta`, 'bi-bullseye',
                'var(--az)', exactas)
        + seccion('≈ Aproximaciones — verifica la medida en físico',
                'bi-rulers', '#B26A00', aproximadas);
}

async function buscarProductos(termino, autoAgregar = false) {
    const tbody = document.getElementById('tabla-resultados-productos');
    tbody.innerHTML = `<div class="az-empty" style="grid-column:1/-1">
        <div class="spinner-border spinner-border-sm" style="color:var(--az)"></div>
        Buscando...</div>`;
    try {
        const productos = await fetchAPI(
            `/products/search?q=${encodeURIComponent(termino)}`);
        if (!productos.length) {
            tbody.innerHTML = `<div class="az-empty" style="grid-column:1/-1">
                <i class="bi bi-search d-block fs-3 mb-2"></i>
                Sin resultados</div>`;
            return;
        }

        
        if (autoAgregar && productos.length === 1) {
            const p = productos[0];
            const stockVal = parseFloat(p.currentStock) || 0;
            if (stockVal > 0) {
                window.agregarAlCarrito(
                    p.id, p.name, p.price, stockVal,
                    p.imagenUrl || '', esDecimal(p.satClaveUnidad),
                    p.satClaveUnidad || 'H87');
                const inp = document.getElementById('input-buscar-producto-venta');
                inp.value = '';
                resetTablaProductos();
                inp.focus();
                return;
            }
        }
        tbody.innerHTML = productos.map(filaProductoVenta).join('');
    } catch (e) {
        tbody.innerHTML = `<div class="az-empty text-danger" style="grid-column:1/-1">
            Error al buscar</div>`;
    }
}

window.verFichaProductoVenta = (id) => mostrarFichaProducto(id);

window.agregarAlCarrito = (id, nombre, precio, stock,
                           imagenUrl, dec, claveSat) => {
    const existe = carrito.find(i => i.id === id);
    if (existe) {
        const paso = dec
            ? (['GRM','MGM','MLT'].includes((claveSat||'').toUpperCase())
                ? 0.1 : 0.5)
            : 1;
        const nueva = parseFloat((existe.cantidad + paso).toFixed(3));
        if (nueva > stock) {
            Swal.fire({ icon:'warning', title:'Stock insuficiente',
                text:`Solo hay ${stock} ${etiqueta(claveSat)} disponibles.`,
                timer:2000, showConfirmButton:false });
            return;
        }
        existe.cantidad = nueva;
        existe.subtotal = parseFloat((nueva * existe.precio).toFixed(2));
    } else {
        carrito.push({
            id, productId:id, nombre, precio,
            cantidad:1, subtotal:precio,
            stockMax:stock, esLibre:false,
            customPrice:null, imagenUrl:imagenUrl||null,
            esDecimal:dec, claveSat:claveSat||'H87',
            ubicacion: window._ubicacionesProd?.[id] || null
        });
    }
    ultimoItemAgregado = id;   
    actualizarVistaCarrito();
    mostrarToast(nombre, {
        texto: 'Deshacer',
        fn: () => window.eliminarDelCarrito(id)
    });
};


window.agregarBolsaAlCarrito = (id, nombre, precioBolsa, piezasPorBolsa,
                                stock, imagenUrl, claveSat) => {
    const idBolsa = id + '-bolsa';
    const existe = carrito.find(i => i.id === idBolsa);
    const piezasEnCarrito = (existe ? existe.cantidad : 0) * piezasPorBolsa;

    if (piezasEnCarrito + piezasPorBolsa > stock) {
        Swal.fire({ icon:'warning', title:'Stock insuficiente para otra bolsa',
            text:`Una bolsa son ${piezasPorBolsa} piezas y solo hay ${stock} disponibles.`,
            timer:2600, showConfirmButton:false });
        return;
    }
    if (existe) {
        existe.cantidad += 1;
        existe.subtotal = parseFloat((existe.cantidad * precioBolsa).toFixed(2));
    } else {
        carrito.push({
            id: idBolsa, productId: id,
            nombre: '📦 ' + nombre + ' (BOLSA ' + piezasPorBolsa + ' pzas)',
            precio: precioBolsa, cantidad: 1, subtotal: precioBolsa,
            stockMax: stock, esLibre: false, customPrice: null,
            imagenUrl: imagenUrl || null, esDecimal: false,
            claveSat: claveSat || 'H87',
            ubicacion: window._ubicacionesProd?.[id] || null,
            esBolsa: true, piezasEquiv: piezasPorBolsa  
        });
    }
    ultimoItemAgregado = idBolsa;
    actualizarVistaCarrito();
    mostrarToast('Bolsa de ' + piezasPorBolsa + ' agregada', {
        texto: 'Deshacer',
        fn: () => window.eliminarDelCarrito(idBolsa)
    });
};

window.ajustarCantidadCarrito = (id, inc) => {
    const item = carrito.find(i => i.id === id);
    if (!item) return;
    const paso = item.esDecimal
        ? (['GRM','MGM','MLT'].includes((item.claveSat||'').toUpperCase())
            ? 0.1 : 0.5)
        : 1;
    const nueva = parseFloat((item.cantidad + inc * paso).toFixed(3));
    if (nueva <= 0) { carrito = carrito.filter(i => i.id !== id); }
    else if (nueva > item.stockMax) {
        Swal.fire({ icon:'warning', title:'Stock insuficiente',
            text:`Solo hay ${item.stockMax} ${etiqueta(item.claveSat)}.`,
            timer:2000, showConfirmButton:false });
        return;
    } else {
        item.cantidad = nueva;
        item.subtotal = parseFloat((nueva * item.precio).toFixed(2));
    }
    actualizarVistaCarrito();
};

window.editarCantidadCarrito = (id, val) => {
    const item  = carrito.find(i => i.id === id);
    if (!item) return;
    const nueva = parseFloat(parseFloat(val).toFixed(3));
    if (isNaN(nueva) || nueva <= 0) {
        actualizarVistaCarrito(); return;
    }
    if (!item.esDecimal && !Number.isInteger(nueva)) {
        Swal.fire({ icon:'warning', title:'Solo cantidades enteras',
            text:`"${item.nombre}" se vende por pieza completa, no fracciones.`,
            timer:2500, showConfirmButton:false });
        actualizarVistaCarrito(); return;
    }
    if (nueva > item.stockMax) {
        Swal.fire({ icon:'warning', title:'Stock insuficiente',
            text:`Solo hay ${item.stockMax} ${etiqueta(item.claveSat)} disponibles.`,
            timer:2000, showConfirmButton:false });
        actualizarVistaCarrito(); return;
    }
    item.cantidad = nueva;
    item.subtotal = parseFloat((nueva * item.precio).toFixed(2));
    actualizarVistaCarrito();
};

window.eliminarDelCarrito = id => {
    carrito = carrito.filter(i => i.id !== id);
    actualizarVistaCarrito();
};

async function vaciarCarrito() {
    if (!carrito.length) return;
    const r = await Swal.fire({
        title: '¿Vaciar todo el carrito?',
        html: `<p class="small mb-0">Se quitarán los <strong>${carrito.length}</strong>
            producto(s) — no se puede deshacer.</p>`,
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Sí, vaciar', cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545'
    });
    if (!r.isConfirmed) return;
    carrito = [];
    actualizarVistaCarrito();
}

window.editarPrecioCarrito = async id => {
    const item = carrito.find(i => i.id === id);
    if (!item) return;
    const r = await Swal.fire({
        title:'Editar precio',
        html:`<p class="mb-1 text-muted small text-start">${item.nombre}</p>
              <p class="mb-3 small text-start">Original:
                  <strong>$${item.precio.toFixed(2)}</strong></p>
              <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input type="number" id="nuevo-precio-item"
                      class="form-control form-control-lg text-center"
                      step="0.01" min="0.01"
                      value="${item.precio.toFixed(2)}" autofocus>
              </div>`,
        showCancelButton:true,
        confirmButtonText:'Aplicar',
        cancelButtonText:'Cancelar',
        confirmButtonColor:'#2B6CA3',
        preConfirm:() => {
            const v = parseFloat(document.getElementById('nuevo-precio-item').value);
            if (!v || v <= 0) {
                Swal.showValidationMessage('Precio debe ser mayor a $0'); return false;
            }
            if (v > 999999.99) {
                Swal.showValidationMessage('Precio demasiado alto'); return false;
            }
            return v;
        }
    });
    if (!r.isConfirmed) return;
    item.precio = item.customPrice = r.value;
    item.subtotal = parseFloat((r.value * item.cantidad).toFixed(2));
    actualizarVistaCarrito();
};

function actualizarVistaCarrito() {
    const lista    = document.getElementById('lista-carrito');
    const header   = document.getElementById('total-header');
    const itemsHdr = document.getElementById('items-header');
    const total    = document.getElementById('resumen-total');
    const subtotal = document.getElementById('resumen-subtotal');
    const btnC     = document.getElementById('btn-cobrar');
    const btnP     = document.getElementById('btn-guardar-prefactura');
    const encCarr  = document.getElementById('carrito-encabezado');

    if (!carrito.length) {
        lista.innerHTML = `<div class="az-empty">
            <i class="bi bi-cart fs-2 d-block mb-2"></i>
            El carrito está vacío</div>`;
        header.innerText = subtotal.innerText = total.innerText = '$0.00';
        if (itemsHdr) itemsHdr.innerText = '';
        btnC.disabled = btnP.disabled = true;
        if (encCarr) encCarr.style.setProperty('display', 'none', 'important');
        return;
    }
    btnC.disabled = btnP.disabled = false;
    if (encCarr) encCarr.style.setProperty('display', 'flex', 'important');
    let totalConIva = 0;

    lista.innerHTML = carrito.map(item => {
        totalConIva += item.subtotal;
        const etq     = etiqueta(item.claveSat);
        const step    = item.esDecimal ? '0.001' : '1';
        const cantFmt = item.esDecimal
            ? item.cantidad.toFixed(3).replace(/\.?0+$/,'')
            : item.cantidad;
        return `
        <div class="az-cart-item">
            <div class="d-flex align-items-center gap-2 flex-grow-1 me-2"
                style="min-width:0">
                ${item.imagenUrl
                    ? `<img src="${urlImagenCompleta(item.imagenUrl)}"
                           style="width:36px;height:36px;object-fit:cover;
                                  border-radius:6px;border:1px solid var(--linea);
                                  flex-shrink:0"
                           onerror="this.style.display='none'">`
                    : `<div style="width:36px;height:36px;background:var(--pista);
                                   border-radius:6px;display:flex;
                                   align-items:center;justify-content:center;
                                   flex-shrink:0">
                           <i class="bi bi-image text-muted small"></i>
                       </div>`}
                <div style="min-width:0;flex:1">
                    <div class="d-flex align-items-start gap-1">
                        <span class="fw-bold"
                            style="font-size:.82rem;line-height:1.15;
                                   display:-webkit-box;-webkit-line-clamp:2;
                                   -webkit-box-orient:vertical;overflow:hidden"
                            title="${item.nombre}">${item.nombre}</span>
                        ${!item.esLibre
                            ? `<i class="bi bi-eye-fill"
                                   style="font-size:13px;cursor:pointer;
                                          flex-shrink:0;color:var(--az)"
                                   onclick="window.verFichaProductoVenta(${item.productId})"
                                   title="Ver ficha completa"></i>`
                            : ''}
                    </div>
                    <small class="text-muted" style="cursor:pointer"
                        onclick="window.editarPrecioCarrito(${item.id})"
                        title="Click para editar precio">
                        $${item.precio.toFixed(2)}/${etq}
                        <i class="bi bi-pencil-fill"
                            style="font-size:9px;opacity:.4"></i>
                    </small>
                    ${item.ubicacion
                        ? `<div style="font-size:.68rem;font-weight:700;color:#1B1D21">
                               <i class="bi bi-geo-alt-fill" style="color:#2B6CA3"></i>
                               ${item.ubicacion}</div>` : ''}
                </div>
            </div>
            <div class="az-qty d-flex align-items-center me-2">
                <button onclick="window.ajustarCantidadCarrito(${item.id},-1)">−</button>
                <input type="number" class="mx-1"
                    step="${step}" min="${step}" max="${item.stockMax}"
                    value="${cantFmt}"
                    onchange="window.editarCantidadCarrito(${item.id},this.value)"
                    onclick="this.select()">
                <span class="text-muted small me-1"
                    style="white-space:nowrap;min-width:20px">${etq}</span>
                <button onclick="window.ajustarCantidadCarrito(${item.id},1)">+</button>
            </div>
            <div class="text-end" style="min-width:72px">
                <div class="fx-cond fw-bold" style="font-size:1.05rem">
                    $${item.subtotal.toFixed(2)}</div>
                <a href="#" class="text-danger small"
                    onclick="window.eliminarDelCarrito(${item.id});return false;">
                    <i class="bi bi-trash"></i>
                </a>
            </div>
        </div>`; }).join('');

    
    let totalFinal = totalConIva;
    if (descuentoCliente > 0) {
        const factor = 1 - (descuentoCliente / 100);
        totalFinal = carrito.reduce((sum, i) => {
            const puDesc = Math.round(i.precio * factor * 100) / 100;
            return sum + (puDesc * i.cantidad);
        }, 0);
        totalFinal = Math.round(totalFinal * 100) / 100;
    }
    const montoDescuento = totalConIva - totalFinal;
    const sinIva         = totalFinal / 1.16;

    subtotal.innerText = `$${sinIva.toFixed(2)}`;
    total.innerText    = `$${totalFinal.toFixed(2)}`;
    header.innerText   = `$${totalFinal.toFixed(2)}`;
    if (itemsHdr) {
        itemsHdr.innerText = `${carrito.length} producto(s) en el carrito`;
    }

    let filaDesc = document.getElementById('resumen-descuento-fila');
    if (descuentoCliente > 0) {
        if (!filaDesc) {
            filaDesc = document.createElement('div');
            filaDesc.id = 'resumen-descuento-fila';
            filaDesc.className = 'd-flex justify-content-between text-danger small mb-1';
            subtotal.closest('.d-flex')?.insertAdjacentElement('afterend', filaDesc);
        }
        filaDesc.innerHTML =
            `<span>Descuento (${descuentoCliente}%)</span>` +
            `<span class="fw-bold">-$${montoDescuento.toFixed(2)}</span>`;
    } else if (filaDesc) {
        filaDesc.remove();
    }
}


let ultimoItemAgregado = null;

function instalarAtajosVentas() {
    if (window._atajosVentas) document.removeEventListener('keydown', window._atajosVentas);
    window._atajosVentas = (e) => {
        if (!document.getElementById('input-buscar-producto-venta')) return;
        const enInput = ['INPUT', 'TEXTAREA', 'SELECT']
            .includes(document.activeElement?.tagName);
        const hayModal = document.querySelector('.swal2-container');

        if (e.key === 'F1') {
            e.preventDefault();  
            if (!hayModal) {
                const inp = document.getElementById('input-buscar-producto-venta');
                inp.focus(); inp.select();
            }
        } else if (e.key === 'F2') {
            e.preventDefault();
            if (!hayModal) document.getElementById('btn-cobrar')?.click();
        } else if (e.key === 'F4') {
            e.preventDefault();
            if (!hayModal) document.getElementById('btn-producto-libre')?.click();
        } else if ((e.key === '+' || e.key === '-') && !enInput && !hayModal) {
            if (ultimoItemAgregado != null
                && carrito.some(i => i.id === ultimoItemAgregado)) {
                e.preventDefault();
                window.ajustarCantidadCarrito(ultimoItemAgregado,
                    e.key === '+' ? 1 : -1);
            }
        }
    };
    document.addEventListener('keydown', window._atajosVentas);
}

function mostrarToast(msg, accion) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;' +
        'background:#1B1D21;color:white;border-left:4px solid #2B6CA3;padding:.6rem 1rem;border-radius:8px;' +
        'font-size:.85rem;box-shadow:0 4px 14px rgba(0,0,0,.2);animation:fadeInUp .3s';
    t.innerHTML = '<i class="bi bi-check-circle me-1"></i>' + msg +
        (accion ? ' <a href="#" style="color:#6FB3E0;font-weight:700;margin-left:.5rem">' +
            accion.texto + '</a>' : '');
    if (accion) t.querySelector('a').addEventListener('click', e => {
        e.preventDefault(); accion.fn(); t.remove();
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), accion ? 4000 : 2200);
}

async function agregarProductoLibre() {
    const r = await Swal.fire({
        title:'Producto Libre',
        html:`
            <div class="mb-3">
                <label class="form-label fw-bold small text-start d-block">
                    Descripción *
                </label>
                <input type="text" id="libre-nombre" class="form-control"
                    placeholder="Ej: Manguera 1/2 pulgada" autofocus>
            </div>
            <div class="mb-3">
                <label class="form-label fw-bold small text-start d-block">
                    Precio unitario *
                </label>
                <div class="input-group">
                    <span class="input-group-text">$</span>
                    <input type="number" id="libre-precio" class="form-control"
                        step="0.01" min="0.01">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label fw-bold small text-start d-block">
                    Se vende por
                </label>
                <select id="libre-unidad" class="form-select">
                    <option value="H87" selected>Pieza (cantidades enteras)</option>
                    <option value="MTR">Metro (fraccionable, ej. 2.5 m)</option>
                    <option value="KGM">Kilo (fraccionable, ej. 0.750 kg)</option>
                    <option value="LTR">Litro (fraccionable)</option>
                    <option value="GRM">Gramo (fraccionable)</option>
                </select>
            </div>
            <div class="mb-1">
                <label class="form-label fw-bold small text-start d-block">
                    Cantidad
                </label>
                <input type="number" id="libre-cantidad" class="form-control"
                    min="1" step="1" value="1">
            </div>`,
        didOpen: () => {
            
            const sel  = document.getElementById('libre-unidad');
            const cant = document.getElementById('libre-cantidad');
            sel.addEventListener('change', () => {
                const frac = sel.value !== 'H87';
                cant.step = frac ? '0.001' : '1';
                cant.min  = frac ? '0.001' : '1';
            });
        },
        showCancelButton:true,
        confirmButtonText:'<i class="bi bi-plus-lg"></i> Agregar',
        cancelButtonText:'Cancelar',
        confirmButtonColor:'#2B6CA3',
        preConfirm:() => {
            const nombre  = document.getElementById('libre-nombre').value.trim();
            const precio  = parseFloat(document.getElementById('libre-precio').value);
            const cantVal = document.getElementById('libre-cantidad').value;
            const cant    = parseFloat(cantVal);
            if (!nombre || nombre.length < 2) {
                Swal.showValidationMessage('Descripción mínimo 2 caracteres');
                return false;
            }
            if (/[<>'"`;\\]/.test(nombre)) {
                Swal.showValidationMessage(
                    'La descripción contiene caracteres no permitidos');
                return false;
            }
            if (isNaN(precio) || precio <= 0) {
                Swal.showValidationMessage('Precio debe ser mayor a $0');
                return false;
            }
            if (isNaN(cant) || cant <= 0) {
                Swal.showValidationMessage('Cantidad debe ser mayor a 0');
                return false;
            }
            const unidad = document.getElementById('libre-unidad').value;
            if (unidad === 'H87' && !Number.isInteger(cant)) {
                Swal.showValidationMessage(
                    'Por pieza solo van cantidades enteras. ' +
                    'Si vendes fracciones, elige metro/kilo/litro/gramo.');
                return false;
            }
            return { nombre:sanitizar(nombre), precio, cantidad:cant, unidad };
        }
    });
    if (!r.isConfirmed) return;
    const { nombre, precio, cantidad, unidad } = r.value;
    const idTmp = -(Date.now());
    const existe = carrito.find(i =>
        i.esLibre && i.nombre === `📦 ${nombre}` && i.precio === precio
        && i.claveSat === unidad);
    if (existe) {
        existe.cantidad  = parseFloat((existe.cantidad + cantidad).toFixed(3));
        existe.subtotal  = parseFloat((existe.cantidad * precio).toFixed(2));
    } else {
        carrito.push({
            id:idTmp, productId:-1, nombre:`📦 ${nombre}`, precio,
            cantidad, subtotal:parseFloat((precio*cantidad).toFixed(2)),
            stockMax:99999, esLibre:true, customPrice:precio,
            imagenUrl:null,
            esDecimal:unidad !== 'H87',   
            claveSat:unidad               
        });
    }
    ultimoItemAgregado = existe ? existe.id : idTmp;
    actualizarVistaCarrito();
    mostrarToast(`📦 ${nombre} agregado`, {
        texto: 'Deshacer',
        fn: () => window.eliminarDelCarrito(existe ? existe.id : idTmp)
    });
}

async function guardarComoPrefactura() {
    if (!carrito.length) return;
    if (!clienteSeleccionado) {
        await Swal.fire({ icon:'warning', title:'Cliente requerido',
            text:'Busca y selecciona un cliente para guardar una pre-factura.' });
        document.getElementById('input-cliente-venta').focus(); return;
    }
    const libres = carrito.some(i => i.esLibre);
    if (libres) {
        const conf = await Swal.fire({ icon:'warning',
            title:'Productos libres detectados',
            html:'Los productos libres no tienen clave SAT y serán ignorados. ¿Continuar?',
            showCancelButton:true,
            confirmButtonText:'Sí, ignorar',
            cancelButtonText:'Cancelar'
        });
        if (!conf.isConfirmed) return;
    }
    const itemsValidos = carrito.filter(i => !i.esLibre);
    if (!itemsValidos.length) {
        Swal.fire('Sin productos','No hay productos válidos.','warning'); return;
    }
    const totalConIva   = itemsValidos.reduce((s,i) => s + i.subtotal, 0);
    const clienteNombre = document.getElementById('input-cliente-venta').value;

    const result = await Swal.fire({
        title:'<i class="bi bi-file-earmark-text me-2"></i>Guardar Pre-Factura',
        html:`
            <div class="text-start">
                <div class="alert alert-info py-2 small mb-3">
                    <i class="bi bi-info-circle me-1"></i>
                    El stock se descuenta ahora. Al cancelar la pre-factura regresa.
                </div>
                <div class="mb-1">
                    <strong>Cliente:</strong> ${clienteNombre}
                </div>
                <div class="mb-3">
                    <strong>Total:</strong>
                    <span class="text-success fs-5 fw-bold">
                        $${totalConIva.toFixed(2)}
                    </span>
                    <small class="text-muted ms-2">
                        (${itemsValidos.length} producto(s))
                    </small>
                </div>
                <label class="form-label fw-bold small">Nota (opcional)</label>
                <input type="text" id="pre-nota-rapida" class="form-control"
                    placeholder="Ej: Lote 2 de facturación mensual">
            </div>`,
        showCancelButton:true,
        confirmButtonText:'<i class="bi bi-floppy"></i> Guardar Borrador',
        cancelButtonText:'Cancelar',
        confirmButtonColor:'#d97706',
        showDenyButton:true,
        denyButtonText:'<i class="bi bi-check-circle"></i> Guardar y marcar Lista',
        denyButtonColor:'#198754'
    });
    if (result.isDismissed) return;

    const nota        = sanitizar(
        document.getElementById('pre-nota-rapida')?.value?.trim() || '');
    const statusFinal = result.isDenied ? 'LISTA' : 'BORRADOR';
    const btn         = document.getElementById('btn-guardar-prefactura');
    btn.disabled      = true;
    btn.innerHTML     = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const payload = {
            customerId: clienteSeleccionado,
            notes:      nota || null,
            items:      itemsValidos.map(i => {
                if (i.esBolsa) {
                    const piezas = i.cantidad * i.piezasEquiv;
                    return {
                        productId:   i.productId,
                        productName: i.nombre,
                        productSku:  String(i.productId),
                        quantity:    piezas,
                        unitPrice:   parseFloat((i.precio / i.piezasEquiv).toFixed(4))
                    };
                }
                return {
                    productId:   i.productId,
                    productName: i.nombre,
                    productSku:  String(i.id),
                    quantity:    i.cantidad,
                    unitPrice:   i.precio
                };
            })
        };
        const pref = await fetchAPI('/prefacturas',
            { method:'POST', body:payload });
        if (statusFinal === 'LISTA')
            await fetchAPI(`/prefacturas/${pref.id}/status`,
                { method:'PATCH', body:{ status:'LISTA' } });

        await Swal.fire({
            icon:'success',
            title: statusFinal === 'LISTA'
                ? '¡Lista para emitir!' : 'Borrador guardado',
            html: `<span class="badge bg-light text-dark border font-monospace">${pref.folio}</span>
                &nbsp;·&nbsp; <strong class="text-success">$${Number(pref.total).toFixed(2)}</strong>`,
            timer: 2000, timerProgressBar: true, showConfirmButton: false
        });
        limpiarVenta();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar.', 'error');
    } finally {
        const b = document.getElementById('btn-guardar-prefactura');
        if (b) {
            b.disabled = carrito.length === 0;
            b.innerHTML =
                '<i class="bi bi-file-earmark-text"></i> Guardar como Pre-Factura';
        }
    }
}

async function procesarVenta() {
    if (!carrito.length) return;
    if (!clienteSeleccionado) {
        const c = await Swal.fire({
            title:'Sin cliente', text:'¿Continuar como Público General?',
            icon:'question', showCancelButton:true,
            confirmButtonText:'Sí, público general',
            cancelButtonText:'Seleccionar cliente'
        });
        if (!c.isConfirmed) {
            document.getElementById('input-cliente-venta').focus(); return;
        }
    }
    const tipoResult = await Swal.fire({
        title:'¿Cómo se registra?',
        html:`<p class="text-muted mb-3">Total:
              <strong class="text-success fs-5">
                  ${document.getElementById('resumen-total').innerText}
              </strong></p>`,
        showDenyButton:true, showCancelButton:true,
        confirmButtonText:'<i class="bi bi-cash-coin"></i> Cobrar ahora',
        denyButtonText:'<i class="bi bi-clock-history"></i> Registrar como deuda',
        cancelButtonText:'Cancelar',
        confirmButtonColor:'#2B6CA3', denyButtonColor:'#fd7e14'
    });
    if (tipoResult.isDismissed) return;
    if (tipoResult.isDenied) {
        if (!clienteSeleccionado) {
            Swal.fire('Cliente requerido',
                'Selecciona un cliente para registrar deuda.','warning'); return;
        }
        await registrarComoDeuda(); return;
    }
    const totalNum = parseFloat(
        document.getElementById('resumen-total').innerText
            .replace('$','').replace(',',''));
    const pagoResult = await Swal.fire({
        title:'Registrar pago',
        html:`
            <p class="mb-3">Total:
                <strong class="text-success fs-5">$${totalNum.toFixed(2)}</strong>
            </p>
            <div class="mb-3">
                <div class="btn-group w-100" id="metodo-pago-group">
                    <button type="button"
                        class="btn btn-outline-primary active"
                        data-metodo="EFECTIVO"
                        onclick="window._selMetodo(this)">
                        <i class="bi bi-cash"></i> Efectivo
                    </button>
                    <button type="button" class="btn btn-outline-primary"
                        data-metodo="TARJETA"
                        onclick="window._selMetodo(this)">
                        <i class="bi bi-credit-card"></i> Tarjeta
                    </button>
                    <button type="button" class="btn btn-outline-primary"
                        data-metodo="TRANSFERENCIA"
                        onclick="window._selMetodo(this)">
                        <i class="bi bi-phone"></i> Transferencia
                    </button>
                </div>
            </div>
            <div id="seccion-efectivo">
                <!-- Billetes: un toque en lugar de teclear -->
                <div class="d-flex flex-wrap gap-2 justify-content-center mb-2"
                    id="botones-billetes">
                    ${[50,100,200,500,1000].filter(b => b >= totalNum || b >= 50)
                        .map(b => `<button type="button"
                            class="btn btn-outline-dark fw-bold px-3"
                            style="font-size:1.05rem;min-width:74px"
                            onclick="window._ponerBillete(${b})"
                            ${b < totalNum ? 'disabled title="Menor al total"' : ''}
                            >$${b}</button>`).join('')}
                    <button type="button"
                        class="btn fw-bold px-3 text-white"
                        style="font-size:1.05rem;background:#198754"
                        onclick="window._ponerBillete(${totalNum})">EXACTO</button>
                </div>
                <div class="input-group">
                    <span class="input-group-text">$</span>
                    <input type="number" id="monto-recibido"
                        class="form-control form-control-lg text-center"
                        placeholder="o teclea el monto..." step="0.01"
                        min="${totalNum}" autofocus>
                </div>
                <!-- Cambio GIGANTE: se lee desde un metro de distancia -->
                <div id="cambio-display" class="mt-2 fw-bold text-center"
                    style="display:none;font-size:2.6rem;line-height:1.1"></div>
            </div>`,
        showCancelButton:true,
        confirmButtonText:'<i class="bi bi-check-lg"></i> Confirmar cobro',
        cancelButtonText:'Cancelar', confirmButtonColor:'#198754',
        didOpen:() => {
            window._ponerBillete = monto => {
                const inp = document.getElementById('monto-recibido');
                inp.value = monto;
                inp.dispatchEvent(new Event('input'));
            };
            window._selMetodo = btn => {
                document.querySelectorAll('#metodo-pago-group .btn')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('seccion-efectivo').style.display =
                    btn.dataset.metodo === 'EFECTIVO' ? 'block' : 'none';
            };
            document.getElementById('monto-recibido').addEventListener('input', e => {
                const rec = parseFloat(e.target.value)||0;
                const cam = rec - totalNum;
                const div = document.getElementById('cambio-display');
                if (rec >= totalNum) {
                    div.style.display='block';
                    div.className='mt-2 fw-bold text-center text-success';
                    div.style.cssText += ';font-size:2.6rem;line-height:1.1';
                    div.innerHTML=`<div class="text-muted"
                        style="font-size:.85rem;letter-spacing:.08em">CAMBIO</div>
                        $${cam.toFixed(2)}`;
                } else if (rec > 0) {
                    div.style.display='block';
                    div.className='mt-2 fw-bold text-center text-danger';
                    div.style.cssText += ';font-size:2rem;line-height:1.1';
                    div.innerHTML=`<div style="font-size:.85rem;letter-spacing:.08em">FALTAN</div>
                        $${Math.abs(cam).toFixed(2)}`;
                } else { div.style.display='none'; }
            });
        },
        preConfirm:() => {
            const metodoBtn =
                document.querySelector('#metodo-pago-group .btn.active');
            const metodo = metodoBtn?.dataset.metodo || 'EFECTIVO';
            if (metodo === 'EFECTIVO') {
                const rec = parseFloat(
                    document.getElementById('monto-recibido').value)||0;
                if (rec <= 0) {
                    Swal.showValidationMessage('Ingresa el monto recibido');
                    return false;
                }
                if (rec < totalNum) {
                    Swal.showValidationMessage(
                        `Faltan $${(totalNum-rec).toFixed(2)}`);
                    return false;
                }
                return { recibido:rec, metodo };
            }
            return { recibido:totalNum, metodo };
        }
    });
    if (!pagoResult.isConfirmed) return;
    const { recibido, metodo } = pagoResult.value;

    if (metodo === 'EFECTIVO' && totalNum >= LIMITE_EFECTIVO) {
        const resultado = await procesarVentaDividida(
            carrito, clienteSeleccionado, recibido, totalNum);
        if (resultado === 'CANCELADO') return;
        if (Array.isArray(resultado)) {   
            limpiarVenta();
            return;
        }
    }

    await ejecutarVenta(recibido, recibido - totalNum, metodo);
}

async function ejecutarVenta(montoRecibido, cambio, metodoPago) {
    const payload = {
        customerId:     clienteSeleccionado,
        paymentMethod:  metodoPago,
        amountReceived: montoRecibido,
        items: carrito.map(i => {
            
            if (i.esBolsa) {
                const piezas = i.cantidad * i.piezasEquiv;
                return {
                    productId:   i.productId,
                    quantity:    piezas,
                    customPrice: parseFloat((i.precio / i.piezasEquiv).toFixed(4)),
                    customName:  null
                };
            }
            return {
                productId:   i.productId,
                quantity:    i.cantidad,
                customPrice: i.customPrice ?? null,
                customName:  i.esLibre ? i.nombre.replace(/^📦 /, '') : null
            };
        })
    };
    const btn = document.getElementById('btn-cobrar');
    btn.disabled = true;
    btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Procesando...';
    try {
        const venta = await fetchAPI('/sales', { method:'POST', body:payload });
        limpiarVenta();
        mostrarTicket(venta, montoRecibido, cambio);
    } catch (e) {
        Swal.fire('Error en la venta', e.message, 'error');
    } finally {
        const b = document.getElementById('btn-cobrar');
        if (b) {
            b.disabled = carrito.length === 0;
            b.innerHTML = '<i class="bi bi-cash-coin"></i> Cobrar Venta';
        }
    }
}


function mostrarTicket(venta, montoRecibido, cambio) {
    const fecha = fmtFecha(venta.createdAt);

    const items = venta.items.map(i => {
        const cantFmt = parseFloat(i.quantity) % 1 === 0
            ? parseInt(i.quantity)
            : parseFloat(i.quantity).toFixed(3).replace(/\.?0+$/,'');
            
        const totalItem = (parseFloat(i.quantity) * Number(i.unitPrice)).toFixed(2);
        const puFmt = Number(i.unitPrice).toFixed(2);

        return `
        <div class="item-producto" style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px dotted #000;">
            <div class="prod-nombre" style="font-weight: bold; text-transform: uppercase;">${i.productName}</div>
            <div class="prod-detalles" style="display: flex; justify-content: space-between; font-size: 12px; color: #444;">
                <span>${cantFmt} pza(s) x $${puFmt}</span>
                <span class="prod-total" style="font-weight: bold; color: #000;">$${totalItem}</span>
            </div>
        </div>`;
    }).join('');

    Swal.fire({
        title: '',
        html: `
        <div id="ticket-content" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; text-align: left; padding: 4px; color: #000; margin: 0 auto; max-width: 100%;">
            <div style="text-align: center; margin-bottom: 8px;">
                <strong style="font-size: 18px;">⚙ Ferretería Fermín</strong><br>
                <small>${fecha}</small>
            </div>
            
            <!-- Línea separadora más gruesa y negra -->
            <hr style="border: none; border-top: 2px dashed #000; margin: 8px 0;">
            
            <div><strong>Folio:</strong> ${venta.invoiceNumber}</div>
            <div><strong>Cliente:</strong> ${venta.customerName}</div>
            <div><strong>Método:</strong> ${venta.paymentMethod}</div>
            
            <hr style="border: none; border-top: 3px dashed #000; margin: 8px 0;">
            
            <!-- LISTADO DE PRODUCTOS -->
            <div id="lista-productos-ticket" style="margin: 8px 0;">
    ${items}
</div>

<style>
#lista-productos-ticket,
#lista-productos-ticket * {
    font-weight: normal !important;
}
</style>
            
            <hr style="border: none; border-top: 3px dashed #000; margin: 8px 0;">
            
            <!-- TOTALES -->
            <div style="display: flex; justify-content: space-between;">
                <span>Subtotal sin IVA:</span>
                <span>$${(Number(venta.totalAmount) / 1.16).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>IVA (16%):</span>
                <span>$${Number(venta.taxAmount).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin-top: 2px;">
                <span>TOTAL:</span>
                <span>$${Number(venta.totalAmount).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: green; margin-top: 2px;">
                <span>Recibido:</span>
                <span>$${Number(montoRecibido).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 22px; color: #2B6CA3; margin-top: 4px;">
                <span>CAMBIO:</span>
                <span>$${Number(cambio).toFixed(2)}</span>
            </div>
            
            <hr style="border: none; border-top: 2px dashed #000; margin: 8px 0;">
            
            <div style="text-align: center; margin-top: 6px;">
                <small style="display: block; font-style: italic; margin-bottom: 2px;">Precios incluyen IVA</small>
                <small style="font-weight: bold;">¡Gracias por su compra!</small>
            </div>
        </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-printer"></i> Imprimir',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#2B6CA3',
        width: '420px',
        timer: 6000,
        timerProgressBar: true,
        didOpen: (el) => el.addEventListener('click', () => Swal.stopTimer())
    }).then(r => { 
        if (r.isConfirmed) {
            imprimirTicket(venta.invoiceNumber); 
        }
    });
}

function imprimirTicket(folio) {
    const contenido = document.getElementById('ticket-content').innerHTML;
    const w = window.open('', '_blank', 'width=380,height=650');
    
    w.document.write(`<!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>Ticket ${folio}</title>
        <style>
            /* Elimina totalmente cualquier margen que el navegador o driver añada a la izquierda */
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
                font-family: 'Arial', Courier, monospace;
                font-size: 10px;
                line-height: 1.15;
                color: #000000 !important;
                text-align: left;
            }
            
            #ticket-content {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important; 
            }

            #ticket-content, #ticket-content * {
                color: #000000 !important;
                font-size: 10px !important;
                font-weight: 600;
                word-break: break-word;
            }

            #ticket-content h1, #ticket-content h2, #ticket-content h3,
            #ticket-content .total, #ticket-content [style*="font-size"] {
                font-size: 11px !important;
            }

            table { 
                width: 100% !important; 
                border-collapse: collapse; 
                margin: 0 !important;
            }
            
            th, td {
                padding: 1px 0;
                font-size: 10px !important;
                vertical-align: top;
                word-wrap: break-word;
            }

            td:first-child, th:first-child {
                width: 1%;
                white-space: nowrap;
                padding-right: 3px;
                text-align: left;
            }

            td:nth-child(2), th:nth-child(2) {
                width: auto;
                text-align: left;
            }

            td:last-child, th:last-child {
                width: 1%;
                white-space: nowrap; 
                text-align: right;
            }

            .ticket-corte {
                text-align: center;
                margin-top: 8px;
                padding-top: 4px;
                padding-bottom: 12px;
                font-size: 9px;
                font-weight: none;
                /* Borde de corte más grueso */
                border-top: 2px dashed #000;
                width: 100%;
            }

            @media print { 
                button { display: none; }
                html, body {
                    width: 44mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
            }
        </style>
    </head>
    <body>
        <div id="ticket-content">${contenido}</div>
        <script>
            window.onload = function () {
                window.focus();
                window.print();
                setTimeout(function() {
                    window.close();
                }, 300);
            };
        </script>
    </body></html>`);
    
    w.document.close();
}

async function registrarComoDeuda() {
    const totalNum = parseFloat(
        document.getElementById('resumen-total').innerText
            .replace('$','').replace(',',''));
    const clienteNombre =
        document.getElementById('input-cliente-venta').value;
    const r = await Swal.fire({
        title:'Registrar Fiado',
        html:`<p class="mb-1">Cliente: <strong>${clienteNombre}</strong></p>
              <p class="mb-3">Total:
                  <strong class="text-danger">$${totalNum.toFixed(2)}</strong>
              </p>
              <textarea id="nota-deuda" class="form-control" rows="2"
                  placeholder="¿Quién llevó el producto? (ej: Llevó Juan del taller)"></textarea>`,
        showCancelButton:true,
        confirmButtonText:'Confirmar fiado',
        cancelButtonText:'Cancelar',
        confirmButtonColor:'#fd7e14'
    });
    if (!r.isConfirmed) return;
    const nota = sanitizar(document.getElementById('nota-deuda')?.value||'');
    const btn  = document.getElementById('btn-cobrar');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    try {
        
        const resultado = await procesarDeudaEnNotas(
            carrito, clienteSeleccionado, nota, totalNum);
        if (resultado !== 'CANCELADO' && !resultado.error) limpiarVenta();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    } finally {
        const b = document.getElementById('btn-cobrar');
        if (b) {
            b.disabled = false;
            b.innerHTML = '<i class="bi bi-cash-coin"></i> Cobrar Venta';
        }
    }
}

function limpiarVenta() {
    carrito = []; clienteSeleccionado = null; descuentoCliente = 0;
    if (ssCliente) ssCliente.clear();
    const buscar = document.getElementById('input-buscar-producto-venta');
    buscar.value = '';
    resetTablaProductos();
    actualizarVistaCarrito();
    setTimeout(() => buscar.focus(), 100);
    if (typeof window.refrescarBadges === 'function') window.refrescarBadges();
}