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

// ─── TOAST GLOBAL ─────────────────────────────────────────────────────────────
// Notificación breve no intrusiva (esquina inferior). La usan los módulos para
// confirmaciones que no ameritan un modal ("Guardado", "Copiado", etc.).
// Uso: window.mostrarToast('Mensaje', 'success' | 'danger' | 'warning' | 'info')
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
    // ─── GUARDIA DE SESIÓN ────────────────────────────────────────────────────
    // Sin sesión válida → pantalla de login. Con sesión → arranca el sistema.
    if (!estaAutenticado()) {
        mostrarLogin(() => location.reload());
        return;
    }
    iniciarApp();
});

// ══════════════════════════════════════════════════════════════════════════════
//  PRECARGA DE IMÁGENES DE PRODUCTO
// ══════════════════════════════════════════════════════════════════════════════
// Se ejecuta en segundo plano después de que el módulo inicial cargó. Recorre
// el catálogo, pide todas las fotos y deja que el navegador las cachee.
// Resultado: al abrir Productos, Ventas, Dashboard o cualquier pantalla que
// muestre fotos, las imágenes ya están ahí al instante — sin espera.
//
// Como todo viaja por localhost (el servidor corre en la misma PC), la carga
// es muy rápida y no bloquea nada. Las imágenes ya comprimidas pesan ~250 KB
// cada una (compresión del UploadController), así que un catálogo de 400
// productos ocuparía ~100 MB de caché — sin problema para cualquier PC moderna.
//
// El progreso se registra en la consola del navegador para depuración:
//   [CACHE-IMG] 237 de 237 imágenes precargadas
// ══════════════════════════════════════════════════════════════════════════════
async function precargarImagenes() {
    try {
        const productos = await fetchAPI('/products');
        if (!Array.isArray(productos)) return;

        // Solo los que tienen foto
        const urls = productos
            .filter(p => p.imagenUrl)
            .map(p => urlImagenCompleta(p.imagenUrl));

        if (!urls.length) {
            console.log('[CACHE-IMG] Ningún producto tiene imagen — nada que precargar.');
            return;
        }

        // Cargar en lotes de 6 para no saturar el navegador.
        // Cada lote va en paralelo; entre lotes se espera a que termine.
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
        // No es crítico: si falla, las fotos se cargan bajo demanda como antes.
        console.warn('[CACHE-IMG] No se pudieron precargar imágenes:', e.message);
    }
}

function iniciarApp() {
    const mainContent = document.getElementById('main-content');
    const menuLinks   = document.querySelectorAll('#main-menu .nav-link[data-module]');

    // ─── MENÚ MÓVIL ───────────────────────────────────────────────────────────
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

    // Módulos que aún NO están listos para móvil (se hará después)
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
        // En móvil, los módulos aún no adaptados muestran un aviso amable
        if (esMovil() && SOLO_DESKTOP.includes(moduleName)) {
            sessionStorage.setItem('modulo_activo', moduleName);
            const nombres = { ventas: 'Ventas' };
            avisoSoloDesktop(nombres[moduleName] || moduleName);
            return;
        }
        mostrarSpinner();
        // Recordar el módulo activo (si se recarga la página, vuelve aquí)
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
                // Categorías y catálogos ya no tienen entrada propia en el menú:
                // Categorías vive dentro de Productos; los catálogos técnicos
                // dentro de "Catálogos" (initInventario). Los cases se conservan
                // por compatibilidad con deep-links antiguos.
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

    // Marca visualmente el item activo del menú (por nombre de módulo)
    const marcarActivo = (moduleName) => {
        menuLinks.forEach(l =>
            l.classList.toggle('active', l.getAttribute('data-module') === moduleName));
    };

    // Navegación
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const mod = e.currentTarget.getAttribute('data-module');
            marcarActivo(mod);
            cerrarMenu();          // en móvil, cerrar el panel al elegir
            loadModule(mod);
        });
    });

    // ─── TABLAS RESPONSIVAS ───────────────────────────────────────────────────
    // Convierte cualquier <table> a formato "tarjeta" en móvil, copiando el
    // encabezado de cada columna a un data-label en sus celdas. Se ejecuta cada
    // vez que un módulo termina de pintar (observando cambios en #main-content).
    const adaptarTablas = () => {
        if (!esMovil()) return;
        mainContent.querySelectorAll('table').forEach(tabla => {
            if (tabla.classList.contains('tabla-movil-lista')) return; // ya procesada
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

    // Observa el contenido: cuando un módulo pinta su tabla, la adapta
    const observer = new MutationObserver(() => {
        clearTimeout(window.__adaptarTablasTimer);
        window.__adaptarTablasTimer = setTimeout(adaptarTablas, 60);
    });
    observer.observe(mainContent, { childList: true, subtree: true });

    // ─── TEMA OSCURO ──────────────────────────────────────────────────────────
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

    // ─── SESIÓN: mostrar usuario y botón de salir ─────────────────────────────
    const _u = usuarioActual();

    // La Consola de Desarrollo (SQL directo) solo la ve el dueño (ADMIN) —
    // el mismo rol que ya protege Reportes, Facturación, Compras, etc.
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

    // ─── BADGE DE DEUDAS EN SIDEBAR ───────────────────────────────────────────
    // Cuenta CLIENTES con deuda pendiente (no notas, no pagadas): coincide con
    // lo que muestra la Libreta.
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

    // ─── BADGE DE FALTANTES EN SIDEBAR (en Productos) ─────────────────────────
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

    // Exponer para que los módulos refresquen los badges tras una acción
    // (vender, abonar, agregar stock) sin esperar al intervalo.
    window.refrescarBadges = () => {
        actualizarBadgeDeudas();
        actualizarBadgeFaltantesSidebar();
    };

    actualizarBadgeDeudas();
    actualizarBadgeFaltantesSidebar();
    setInterval(actualizarBadgeDeudas, 120000);
    setInterval(actualizarBadgeFaltantesSidebar, 120000);

    // ─── ARRANQUE ─────────────────────────────────────────────────────────────
    // Vuelve al último módulo usado si se recargó la página; si no, al dashboard.
    // Arranque pensado para el mostrador: la primera pantalla es VENTAS
    // (a vender se abre la caja). Si el usuario navegó a otro módulo, la
    // sesión recuerda dónde estaba (sessionStorage) y regresa ahí.
    instalarBotonAyuda();   // botón "?" flotante en todas las pantallas
    const inicial = sessionStorage.getItem('modulo_activo') || 'ventas';
    const existe = [...menuLinks].some(l => l.getAttribute('data-module') === inicial);
    const arranque = existe ? inicial : 'ventas';
    marcarActivo(arranque);
    loadModule(arranque);

    // ─── PRECARGA DE IMÁGENES ─────────────────────────────────────────────────
    // 2 segundos después de que la pantalla inicial pintó: así el usuario ya
    // puede trabajar y las fotos se bajan en segundo plano sin que note nada.
    setTimeout(precargarImagenes, 2000);
}