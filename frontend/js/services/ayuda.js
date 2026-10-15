
const CONTACTOS = [
    { quien: 'Dueño (Luis)',            tel: '667-XXX-XXXX' },   
    { quien: 'Soporte del sistema',     tel: '667-XXX-XXXX' },   
];

export function instalarBotonAyuda() {
    if (document.getElementById('btn-ayuda-global')) return;

    const b = document.createElement('button');
    b.id = 'btn-ayuda-global';
    b.title = 'Ayuda — ¿cómo se hace?';
    b.innerHTML = '?';
    b.style.cssText = `
        position:fixed; bottom:1.2rem; left:1.2rem; z-index:1040;
        width:44px; height:44px; border-radius:50%;
        background:#1B1D21; color:#fff; border:2px solid #F26100;
        font-weight:800; font-size:1.25rem; line-height:1;
        box-shadow:0 4px 14px rgba(0,0,0,.25); cursor:pointer;`;
    b.addEventListener('mouseover', () => b.style.background = '#F26100');
    b.addEventListener('mouseout',  () => b.style.background = '#1B1D21');
    b.addEventListener('click', abrirAyuda);
    document.body.appendChild(b);
}

function seccion(titulo, icono, cuerpo, abierta = false) {
    return `
    <details ${abierta ? 'open' : ''}
        style="border:1px solid #DCE0E5;border-radius:10px;margin-bottom:.5rem;
               background:#fff">
        <summary style="padding:.7rem .9rem;font-weight:700;cursor:pointer;
                        font-size:.95rem;list-style-position:inside">
            <i class="bi ${icono} me-2" style="color:#F26100"></i>${titulo}
        </summary>
        <div style="padding:.2rem 1rem .9rem;font-size:.88rem;line-height:1.55;
                    text-align:left">${cuerpo}</div>
    </details>`;
}

function abrirAyuda() {
    Swal.fire({
        title: '¿Cómo se hace?',
        width: 620,
        showConfirmButton: true,
        confirmButtonText: 'Listo, entendido',
        confirmButtonColor: '#F26100',
        html: `<div style="max-height:62vh;overflow-y:auto;text-align:left">

        ${seccion('Cobrar una venta', 'bi-cash-coin', `
            <ol class="mb-1 ps-3">
                <li><strong>Escanea</strong> el producto con la pistola
                    (o escribe su nombre y da clic en AGREGAR).</li>
                <li>Repite con todos los productos.</li>
                <li>Presiona <kbd>F2</kbd> o el botón
                    <strong>COBRAR VENTA</strong>.</li>
                <li>Toca el <strong>billete</strong> con el que te pagan
                    ($100, $200, $500...) o EXACTO.</li>
                <li>El <strong>CAMBIO sale en grande</strong> — entrégalo
                    y confirma. ¡Listo!</li>
            </ol>
            <div class="text-muted small">Teclas rápidas:
                <kbd>F1</kbd> buscar · <kbd>F2</kbd> cobrar ·
                <kbd>F4</kbd> producto libre ·
                <kbd>+</kbd>/<kbd>−</kbd> cantidad del último producto</div>
        `, true)}

        ${seccion('Anotar un fiado (libreta)', 'bi-journal-bookmark', `
            Haz la venta normal, pero al cobrar elige
            <strong>Crédito / Fiado</strong> y selecciona al cliente
            (si no existe, se registra primero en <em>Clientes</em>).
            La deuda aparece sola en el módulo <strong>Deudas</strong>.<br>
            Para <strong>abonar</strong>: Deudas → tarjeta del cliente →
            botón Abonar → cantidad → listo. Ahí mismo se imprime su
            estado de cuenta.
        `)}

        ${seccion('Vendo algo que no está en el sistema', 'bi-plus-square-dotted', `
            Presiona <kbd>F4</kbd> (Producto libre): escribe
            <strong>qué es</strong> (ej. "Manguera 1/2"), el precio,
            elige si va por <em>pieza, metro o kilo</em>, y la cantidad.
            Se cobra igual que todo lo demás.
        `)}

        ${seccion('El cliente trae una pieza y no sé cuál es', 'bi-rulers', `
            En Ventas usa el botón <strong>"Por medidas"</strong>: elige el
            tipo (balero, birlo, tornillo), mide la pieza con el vernier y
            escribe las medidas — el sistema te enseña los que coinciden y
            los parecidos. Para birlos también está
            <em>Catálogos → Catálogo de Birlos</em>: búscalo por el
            carro del cliente o por la medida, con foto.
        `)}

        ${seccion('Me equivoqué', 'bi-arrow-counterclockwise', `
            <strong>Agregué de más:</strong> toca "Deshacer" en el avisito,
            o el bote de basura en el carrito.<br>
            <strong>Cantidad o precio mal:</strong> tócalos en el carrito y
            corrígelos.<br>
            <strong>Ya cobré y estaba mal:</strong> ve a
            <em>Historiales → Ventas</em>, busca la venta y cancélala
            (el producto regresa al inventario). Si no te deja porque ya
            tiene factura, <strong>no le muevas</strong> y avísale al dueño.
        `)}

        ${seccion('¿Y las facturas?', 'bi-receipt', `
            La factura del día se hace <strong>SOLA a las 8 PM</strong> —
            no tienes que hacer nada.<br>
            Si un cliente pide factura con sus datos, eso lo hace el
            dueño desde <em>Facturación CFDI</em>; tú solo guarda su
            ticket y toma sus datos (constancia fiscal).
        `)}

        ${seccion('Algo falla o se ve raro', 'bi-tools', `
            <ol class="mb-2 ps-3">
                <li>Recarga la página con
                    <kbd>Ctrl</kbd>+<kbd>F5</kbd>.</li>
                <li>¿Dice "Failed to fetch"? El sistema de la
                    computadora está apagado o sin red — revisa que
                    la compu principal esté encendida.</li>
                <li>¿Se fue la luz? El no-break te da unos minutos:
                    termina la venta y apaga bien.</li>
                <li>Si nada funciona: cobra a mano en papel
                    (producto, cantidad, precio) y captúralo después.</li>
            </ol>
            <div class="border rounded p-2" style="background:#FDEBDD">
                <strong> Llamar a:</strong><br>
                ${CONTACTOS.map(c =>
                    `${c.quien}: <strong>${c.tel}</strong>`).join('<br>')}
            </div>
        `)}
        </div>`
    });
}