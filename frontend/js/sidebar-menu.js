/* ═══════════════════════════════════════════════════════════════════════
   FerrePOS — Menú lateral: comportamiento

   · Tres modos: fijo (248px) → riel (64px) → oculto (0px). El botón del
     pie los va rotando y la elección se recuerda entre sesiones.
   · En modo oculto hay un botón de hamburguesa arriba a la izquierda:
     un clic lo abre, otro clic lo cierra. También se abre acercando el
     mouse al borde izquierdo, o con Ctrl+B.
   · Teclas de acceso rápido para saltar de módulo sin abrir el menú.
   · Devuelve el foco al primer campo del módulo, para que el lector de
     código de barras escriba donde debe.

   No depende de app.js: los atajos hacen click en el enlace del menú que
   ya existe, así que toda tu lógica de módulos sigue igual.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    /* ─── CONFIGURACIÓN — cámbiala a tu gusto ──────────────────────────── */

    /* Tecla → data-module.

       ¡OJO CON ESTA LISTA! Los módulos ya tienen sus PROPIAS teclas y no
       se deben pisar. Hasta donde vi en Ventas:
           F1 → campo de escaneo
           F2 → cobrar venta
           F4 → producto libre
       Además el navegador se queda con F5 (recargar), F10 (su menú),
       F11 (pantalla completa) y F12 (herramientas de desarrollo).

       Por eso aquí solo se usan F3, F6, F7, F8 y F9. Si algún día le
       agregas una tecla a un módulo, quítala también de aquí. */
    const ATAJOS = {
        F3: 'ventas',
        F6: 'productos',
        F7: 'faltantes',
        F8: 'deudas',
        F9: 'clientes'
    };

    /* Abrir el menú al acercar el mouse al borde izquierdo. Ponlo en false
       si prefieres que SOLO se abra con el botón de hamburguesa. */
    const ABRIR_CON_MOUSE = true;

    /* Al cambiar de módulo, poner el cursor en el primer campo de texto.
       Ponlo en false si en algún módulo te resulta molesto. */
    const ENFOCAR_PRIMER_CAMPO = true;

    /* Modo con el que arranca la primera vez: 'oculto', 'riel' o 'fijo' */
    const MODO_POR_DEFECTO = 'oculto';

    const RETARDO_ABRIR  = 140;  /* ms sosteniendo el mouse en el borde */
    const RETARDO_CERRAR = 260;  /* ms de gracia al salirse del menú */
    const CLAVE_GUARDADO = 'ferrepos_modo_menu';

    /* ─── Elementos ────────────────────────────────────────────────────── */

    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const zona     = document.getElementById('zona-menu');
    const hamburgu = document.getElementById('btn-cajon');
    const velo     = document.getElementById('overlay-cajon');
    const btnModo  = document.getElementById('btn-modo-menu');

    const MODOS = ['fijo', 'riel', 'oculto'];
    const ETIQUETAS = {
        fijo:   { icono: 'bi-layout-sidebar-inset',   texto: 'Menú: fijo' },
        riel:   { icono: 'bi-layout-sidebar',         texto: 'Menú: iconos' },
        oculto: { icono: 'bi-layout-sidebar-reverse', texto: 'Menú: oculto' }
    };

    let modo = localStorage.getItem(CLAVE_GUARDADO);
    if (MODOS.indexOf(modo) === -1) modo = MODO_POR_DEFECTO;

    let temporizador = null;

    const esEscritorio = () => window.matchMedia('(min-width: 861px)').matches;
    const estaAbierta  = () => sidebar.classList.contains('abierta');

    /* ─── Abrir / cerrar ───────────────────────────────────────────────── */

    /* La hamburguesa cambia de cara (☰ / ✕) y se corre a un lado del menú
       cuando está abierto, para que no quede sepultada debajo. */
    function pintarHamburguesa() {
        if (!hamburgu) return;
        const abierta = estaAbierta();
        const icono = hamburgu.querySelector('i');
        if (icono) icono.className = abierta ? 'bi bi-x-lg' : 'bi bi-list';
        hamburgu.classList.toggle('abierto', abierta);
        hamburgu.setAttribute('aria-expanded', abierta ? 'true' : 'false');
        hamburgu.setAttribute('aria-label', abierta ? 'Cerrar menú' : 'Abrir menú');
        hamburgu.title = (abierta ? 'Cerrar menú' : 'Abrir menú') + ' (Ctrl + B)';
    }

    function abrir() {
        clearTimeout(temporizador);
        if (modo === 'fijo' || !esEscritorio()) return;
        sidebar.classList.add('abierta');
        if (modo === 'oculto' && velo) velo.classList.add('show');
        pintarHamburguesa();
    }

    function cerrar() {
        clearTimeout(temporizador);
        if (modo === 'fijo') return;
        sidebar.classList.remove('abierta');
        if (velo) velo.classList.remove('show');
        pintarHamburguesa();
    }

    function alternar() {
        if (estaAbierta()) cerrar();
        else abrir();
    }

    /* ─── Cambio de modo ───────────────────────────────────────────────── */

    function pintarBotonModo() {
        if (!btnModo) return;
        const icono = btnModo.querySelector('i');
        const texto = btnModo.querySelector('.riel-etiqueta');
        if (icono) icono.className = 'bi ' + ETIQUETAS[modo].icono;
        if (texto) texto.textContent = ETIQUETAS[modo].texto;
        btnModo.title = ETIQUETAS[modo].texto + ' — clic para cambiar';
    }

    function aplicarModo() {
        document.body.classList.remove('menu-fijo', 'menu-riel', 'menu-oculto');
        if (esEscritorio()) {
            document.body.classList.add('menu-' + modo);
            sidebar.classList.toggle('abierta', modo === 'fijo');
        } else {
            /* En celular manda el panel deslizable de siempre */
            sidebar.classList.remove('abierta');
        }
        if (velo) velo.classList.remove('show');
        pintarBotonModo();
        pintarHamburguesa();
    }

    function siguienteModo() {
        if (!esEscritorio()) return;
        modo = MODOS[(MODOS.indexOf(modo) + 1) % MODOS.length];
        localStorage.setItem(CLAVE_GUARDADO, modo);
        aplicarModo();
    }

    if (btnModo) btnModo.addEventListener('click', siguienteModo);

    /* ─── Hamburguesa y mouse ──────────────────────────────────────────── */

    if (hamburgu) {
        hamburgu.addEventListener('click', function (e) {
            e.stopPropagation();
            alternar();
        });
    }

    function programarApertura() {
        if (!ABRIR_CON_MOUSE || !esEscritorio() || modo === 'fijo') return;
        clearTimeout(temporizador);
        temporizador = setTimeout(abrir, RETARDO_ABRIR);
    }
    function programarCierre() {
        if (!esEscritorio() || modo === 'fijo') return;
        clearTimeout(temporizador);
        temporizador = setTimeout(cerrar, RETARDO_CERRAR);
    }

    sidebar.addEventListener('mouseenter', function () {
        clearTimeout(temporizador);
        if (ABRIR_CON_MOUSE) programarApertura();
    });
    sidebar.addEventListener('mouseleave', programarCierre);

    if (zona) {
        zona.addEventListener('mouseenter', programarApertura);
        zona.addEventListener('mouseleave', programarCierre);
        zona.addEventListener('click', abrir);
    }
    if (velo) velo.addEventListener('click', cerrar);

    /* Si el mouse pasa por encima de la hamburguesa, no se cierre solo */
    if (hamburgu) {
        hamburgu.addEventListener('mouseenter', function () { clearTimeout(temporizador); });
    }

    /* ─── Teclado ──────────────────────────────────────────────────────── */

    /* Pinta la tecla junto al nombre del módulo, para que el cajero la
       aprenda solo, sin que nadie tenga que enseñársela. */
    Object.keys(ATAJOS).forEach(function (tecla) {
        const enlace = document.querySelector('[data-module="' + ATAJOS[tecla] + '"]');
        if (!enlace || enlace.querySelector('.tecla')) return;
        const kbd = document.createElement('kbd');
        kbd.className = 'tecla';
        kbd.textContent = tecla;
        enlace.appendChild(kbd);
    });

    function hayModalAbierto() {
        return document.querySelector('.modal.show') !== null
            || document.querySelector('.swal2-container') !== null;
    }

    document.addEventListener('keydown', function (e) {
        /* Ctrl + B → abrir o cerrar el menú */
        if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            alternar();
            return;
        }

        /* Esc cierra el menú, pero solo si no hay un modal encima */
        if (e.key === 'Escape' && estaAbierta() && modo !== 'fijo' && !hayModalAbierto()) {
            cerrar();
            return;
        }

        const modulo = ATAJOS[e.key];
        if (!modulo) return;

        /* Con un modal o una alerta abiertos no se navega: primero que el
           usuario termine o cancele lo que está haciendo. */
        if (hayModalAbierto()) return;

        e.preventDefault();
        const enlace = document.querySelector('[data-module="' + modulo + '"]');
        if (enlace) enlace.click();
    });

    /* ─── Foco para el lector de código de barras ──────────────────────── */

    /* El escáner es un teclado: si el foco se quedó en un botón del menú,
       el código se "escribe" ahí y se pierde. Después de navegar, se
       devuelve el cursor al primer campo de captura del módulo. */
    function enfocarPrimerCampo() {
        if (!ENFOCAR_PRIMER_CAMPO || hayModalAbierto()) return;
        const main = document.getElementById('main-content');
        if (!main) return;
        const campo = main.querySelector(
            'input[data-foco], input[type="text"], input[type="search"], input:not([type])'
        );
        if (campo && campo.offsetParent !== null && !campo.disabled && !campo.readOnly) {
            campo.focus();
            if (campo.select) campo.select();
        }
    }

    sidebar.addEventListener('click', function (e) {
        const enlace = e.target.closest('.nav-link[data-module]');
        if (!enlace) return;
        if (typeof enlace.blur === 'function') enlace.blur();
        cerrar();
        /* Los módulos se dibujan de forma asíncrona: dos pasadas por si
           la primera llega antes que el HTML del módulo. */
        setTimeout(enfocarPrimerCampo, 260);
        setTimeout(enfocarPrimerCampo, 700);
    });

    /* ─── Inicio ───────────────────────────────────────────────────────── */

    aplicarModo();
    window.addEventListener('resize', aplicarModo);

    /* Vigilante de la clase del <body>.

       Hace falta porque app.js es un módulo y por eso Chrome lo ejecuta
       DESPUÉS de este archivo. Si al cargar el tema guardado hiciera algo
       como  document.body.className = 'dark-mode'  (asignación completa,
       en vez de classList.add), borraría de un plumazo la clase menu-*
       que acabamos de poner, y el menú se quedaría visible con el
       contenido escondido debajo. Con esto, si alguien la quita, se
       repone al instante y nadie se entera. */
    const vigilante = new MutationObserver(function () {
        if (!esEscritorio()) return;
        if (document.body.classList.contains('menu-' + modo)) return;
        document.body.classList.remove('menu-fijo', 'menu-riel', 'menu-oculto');
        document.body.classList.add('menu-' + modo);
    });
    vigilante.observe(document.body, { attributes: true, attributeFilter: ['class'] });

})();