import { initVentas }           from './modules/ventas.js';
import { initClientes }         from './modules/clientes.js';
import { initCatalogos }        from './modules/catalogoFiltros.js';
import { initCatalogosBaterias } from './modules/catalogoBateria.js';
import { initInventario }       from './modules/inventario.js';
import { initProductos }        from './modules/productos.js';
import { initFaltantes }        from './modules/faltantes.js';
import { initReportes }         from './modules/reportes.js';
import { initDeudas }           from './modules/deudas.js';
import { initHistorial }        from './modules/historial.js';
import { initHistoriales }      from './modules/historiales.js';
import { initFacturacion }      from './modules/facturacion.js';
import { initCatalogosGemini }  from './modules/geminiBusqueda.js';
import { initDashboard }        from './modules/Dashboard.js';
import { initPrefacturas }      from './modules/prefacturas.js';
import { initProveedores }      from './modules/proveedores.js';
import { initCompras }          from './modules/compras.js';
import { initCategorias }       from './modules/categorias.js';
import { initDevConsole }       from './modules/devConsole.js';
import { fetchAPI }             from './services/api.js';
import { urlImagenCompleta }    from './services/camara.js';
import { estaAutenticado, cerrarSesion, usuarioActual } from './config.js';
import { mostrarLogin } from './modules/login.js';

import { instalarBotonAyuda } from './services/ayuda.js';


window.mostrarToast = (mensaje, tipo = 'success') => {
    const el = document.getElementById('liveToast');
    const body = document.getElementById('toast-mensaje');
    if (!el || !body) return;
    const colores = {
        success: 'var(--green-600, #16a34a)',
        danger:  'var(--red-600, #dc2626)',
        warning: 'var(--amber-600, #d97706)',
        info:    'var(--blue-600, #2563eb)'
    };
    const iconos = {
        success: 'bi-check-circle-fill',
        danger:  'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info:    'bi-info-circle-fill'
    };
    el.style.background = colores[tipo] || colores.success;
    body.innerHTML = `<i class="bi ${iconos[tipo] || iconos.success} me-2"></i>${mensaje}`;
    bootstrap.Toast.getOrCreateInstance(el, { delay: 2800 }).show();
};

document.addEventListener('DOMContentLoaded', () => {
    
    if (!estaAutenticado()) {
        mostrarLogin(() => location.reload());
        return;
    }
    iniciarApp();
});


async function precargarImagenes() {
    try {
        const productos = await fetchAPI('/products');
        if (!Array.isArray(productos)) return;

        const urls = productos
            .filter(p => p.imagenUrl)
            .map(p => urlImagenCompleta(p.imagenUrl));

        if (!urls.length) {
            console.log('[CACHE-IMG] Ningún producto tiene imagen — nada que precargar.');
            return;
        }

        const LOTE = 6;
        let cargadas = 0, fallidas = 0;

        for (let i = 0; i < urls.length; i += LOTE) {
            const grupo = urls.slice(i, i + LOTE);
            const resultados = await Promise.all(
                grupo.map(url => new Promise(resolve => {
                    const img = new Image();
                    img.onload  = () => { cargadas++; resolve(true); };
                    img.onerror = () => { fallidas++; resolve(false); };
                    img.src = url;
                }))
            );
        }

        console.log(
            `[CACHE-IMG] ${cargadas} de ${urls.length} imágenes precargadas`
            + (fallidas ? ` (${fallidas} no encontrada(s))` : '')
        );
    } catch (e) {
        console.warn('[CACHE-IMG] No se pudieron precargar imágenes:', e.message);
    }
}

function iniciarApp() {
    const mainContent = document.getElementById('main-content');
    const menuLinks   = document.querySelectorAll('#main-menu .nav-link[data-module]');

    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay-sidebar');
    const btnMenu = document.getElementById('btn-menu-movil');
    const esMovil = () => window.matchMedia('(max-width: 860px)').matches;

    const abrirMenu = () => {
        sidebar?.classList.add('open');
        overlay?.classList.add('show');
    };
    const cerrarMenu = () => {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
    };
    btnMenu?.addEventListener('click', abrirMenu);
    overlay?.addEventListener('click', cerrarMenu);

    const SOLO_DESKTOP = ['ventas'];

    const avisoSoloDesktop = (nombre) => {
        mainContent.innerHTML = `
            <div id="aviso-solo-desktop">
                <i class="bi bi-display"></i>
                <h3>Disponible en computadora</h3>
                <p class="mb-1">El módulo de <strong>${nombre}</strong> está pensado para
                usarse en la computadora del mostrador.</p>
                <p class="small text-muted">Desde el teléfono puedes gestionar productos,
                stock, historial, deudas y clientes.</p>
                <button class="btn btn-warning mt-3" onclick="document.querySelector('#main-menu .nav-link[data-module=\\'dashboard\\']').click()">
                    <i class="bi bi-speedometer2 me-1"></i>Ir al Dashboard
                </button>
            </div>`;
    };

    const mostrarSpinner = () => {
        mainContent.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height:300px">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>`;
    };

    const loadModule = async (moduleName) => {
        if (esMovil() && SOLO_DESKTOP.includes(moduleName)) {
            sessionStorage.setItem('modulo_activo', moduleName);
            const nombres = { ventas: 'Ventas' };
            avisoSoloDesktop(nombres[moduleName] || moduleName);
            return;
        }
        mostrarSpinner();
        sessionStorage.setItem('modulo_activo', moduleName);
        try {
            switch (moduleName) {
                case 'dashboard':       initDashboard(mainContent);          break;
                case 'ventas':          initVentas(mainContent);             break;
                case 'clientes':        await initClientes(mainContent);     break;
                case 'inventario':      initInventario(mainContent);         break;
                case 'productos':       await initProductos(mainContent);    break;
                case 'faltantes':       await initFaltantes(mainContent);    break;
                case 'geminiBusqueda':  initCatalogosGemini(mainContent);    break;
                case 'reportes':        initReportes(mainContent);           break;
                case 'deudas':          initDeudas(mainContent);             break;
                case 'historial':       initHistorial(mainContent);          break;
                case 'historiales':     initHistoriales(mainContent);        break;
                case 'facturacion':     initFacturacion(mainContent);        break;
                case 'prefacturas':     initPrefacturas(mainContent);        break;
                case 'proveedores':     initProveedores(mainContent);        break;
                case 'compras':         initCompras(mainContent);            break;
                case 'categorias':      initCategorias(mainContent);         break;
                case 'catalogos':       initCatalogos(mainContent);          break;
                case 'catalogoBateria': initCatalogosBaterias(mainContent);  break;
                case 'devConsole':      initDevConsole(mainContent);         break;
                default:
                    mainContent.innerHTML =
                        '<div class="text-center py-5 text-muted">' +
                        '<i class="bi bi-exclamation-circle fs-1 d-block mb-3 opacity-25"></i>' +
                        '<h4>Módulo no encontrado</h4></div>';
            }
        } catch (e) {
            console.error('Error al cargar módulo', moduleName, e);
            mainContent.innerHTML =
                `<div class="alert alert-danger m-4">
                    <h5><i class="bi bi-exclamation-triangle me-2"></i>Error al cargar el módulo</h5>
                    <p class="mb-0">${e.message}</p>
                    <p class="small text-muted mt-2 mb-0">Revisa que el servidor esté encendido.</p>
                </div>`;
        }
    };

    const marcarActivo = (moduleName) => {
        menuLinks.forEach(l =>
            l.classList.toggle('active', l.getAttribute('data-module') === moduleName));
    };

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const mod = e.currentTarget.getAttribute('data-module');
            marcarActivo(mod);
            cerrarMenu();          
            loadModule(mod);
        });
    });

    const adaptarTablas = () => {
        if (!esMovil()) return;
        mainContent.querySelectorAll('table').forEach(tabla => {
            if (tabla.classList.contains('tabla-movil-lista')) return; 
            const encabezados = [...tabla.querySelectorAll('thead th')]
                .map(th => th.textContent.trim());
            if (!encabezados.length) return;
            tabla.classList.add('tabla-movil', 'tabla-movil-lista');
            tabla.querySelectorAll('tbody tr').forEach(tr => {
                [...tr.children].forEach((td, i) => {
                    if (!td.hasAttribute('data-label'))
                        td.setAttribute('data-label', encabezados[i] || '');
                });
            });
        });
    };

    const observer = new MutationObserver(() => {
        clearTimeout(window.__adaptarTablasTimer);
        window.__adaptarTablasTimer = setTimeout(adaptarTablas, 60);
    });
    observer.observe(mainContent, { childList: true, subtree: true });

    function aplicarTema(tema) {
        const esDark = tema === 'dark';
        document.body.classList.toggle('dark-mode', esDark);
        const icono = document.getElementById('icono-tema');
        const texto = document.getElementById('texto-tema');
        if (icono) icono.className = esDark ? 'bi bi-sun-fill me-2' : 'bi bi-moon-fill me-2';
        if (texto) texto.textContent = esDark ? 'Modo claro' : 'Modo oscuro';
        localStorage.setItem('tema', tema);
    }

    const temaGuardado = localStorage.getItem('tema');
    if (temaGuardado === 'dark') aplicarTema('dark');

    document.getElementById('btn-toggle-tema')?.addEventListener('click', () => {
        aplicarTema(document.body.classList.contains('dark-mode') ? 'light' : 'dark');
    });

    const _u = usuarioActual();

    const _esAdmin = _u?.roles?.some(r =>
        String(r).toUpperCase().includes('ADMIN'));
    document.querySelectorAll('.solo-admin').forEach(el => {
        el.style.display = _esAdmin ? '' : 'none';
    });

    const _btnTema = document.getElementById('btn-toggle-tema');
    if (_u && _btnTema && !document.getElementById('btn-cerrar-sesion')) {
        const salir = document.createElement('button');
        salir.id = 'btn-cerrar-sesion';
        salir.className = 'btn btn-sm w-100 mt-2';
        salir.style.cssText = 'background:rgba(220,38,38,.15);color:#fca5a5;' +
            'border:1px solid rgba(220,38,38,.3);border-radius:7px;font-weight:500;font-size:.82rem';
        salir.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Salir (' + _u.username + ')';
        salir.onclick = () => cerrarSesion();
        _btnTema.parentElement.appendChild(salir);
    }

    async function actualizarBadgeDeudas() {
        try {
            const deudas = await fetchAPI('/debts');
            const badge  = document.getElementById('badge-sidebar-deudas');
            if (!badge) return;
            const clientesConDeuda = new Set(
                deudas.filter(d => d.status !== 'PAID').map(d => d.customerId));
            const n = clientesConDeuda.size;
            if (n > 0) {
                badge.textContent   = n > 99 ? '99+' : n;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { console.error('Badge deudas:', e); }
    }

    async function actualizarBadgeFaltantesSidebar() {
        try {
            const productos = await fetchAPI('/products');
            const badge = document.getElementById('badge-sidebar-faltantes');
            if (!badge) return;
            const count = productos.filter(p => {
                const stock = parseFloat(p.currentStock) || 0;
                const min   = parseFloat(p.minStockLevel) || 0;
                return p.active !== false && stock <= min;
            }).length;
            if (count > 0) {
                badge.textContent   = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { console.error('Badge faltantes:', e); }
    }

    window.refrescarBadges = () => {
        actualizarBadgeDeudas();
        actualizarBadgeFaltantesSidebar();
    };

    actualizarBadgeDeudas();
    actualizarBadgeFaltantesSidebar();
    setInterval(actualizarBadgeDeudas, 120000);
    setInterval(actualizarBadgeFaltantesSidebar, 120000);

    instalarBotonAyuda();   
    const inicial = sessionStorage.getItem('modulo_activo') || 'ventas';
    const existe = [...menuLinks].some(l => l.getAttribute('data-module') === inicial);
    const arranque = existe ? inicial : 'ventas';
    marcarActivo(arranque);
    loadModule(arranque);

    setTimeout(precargarImagenes, 2000);
}