
(function () {
    'use strict';

    
    const ATAJOS = {
        F3: 'ventas',
        F6: 'productos',
        F7: 'faltantes',
        F8: 'deudas',
        F9: 'clientes'
    };

    
    const ABRIR_CON_MOUSE = true;

    
    const ENFOCAR_PRIMER_CAMPO = true;

    const MODO_POR_DEFECTO = 'oculto';

    const RETARDO_ABRIR  = 140;  
    const RETARDO_CERRAR = 260;  
    const CLAVE_GUARDADO = 'ferrepos_modo_menu';


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

    if (hamburgu) {
        hamburgu.addEventListener('mouseenter', function () { clearTimeout(temporizador); });
    }


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
        if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            alternar();
            return;
        }

        if (e.key === 'Escape' && estaAbierta() && modo !== 'fijo' && !hayModalAbierto()) {
            cerrar();
            return;
        }

        const modulo = ATAJOS[e.key];
        if (!modulo) return;

        
        if (hayModalAbierto()) return;

        e.preventDefault();
        const enlace = document.querySelector('[data-module="' + modulo + '"]');
        if (enlace) enlace.click();
    });

   
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
        
        setTimeout(enfocarPrimerCampo, 260);
        setTimeout(enfocarPrimerCampo, 700);
    });


    aplicarModo();
    window.addEventListener('resize', aplicarModo);

    
    const vigilante = new MutationObserver(function () {
        if (!esEscritorio()) return;
        if (document.body.classList.contains('menu-' + modo)) return;
        document.body.classList.remove('menu-fijo', 'menu-riel', 'menu-oculto');
        document.body.classList.add('menu-' + modo);
    });
    vigilante.observe(document.body, { attributes: true, attributeFilter: ['class'] });

})();