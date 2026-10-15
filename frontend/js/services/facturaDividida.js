import { fetchAPI } from './api.js';

// ══════════════════════════════════════════════════════════════════════════════
// REGLA DE LOS $2,000 (deducibilidad de pagos en efectivo)
//
// 1) VENTA DE CONTADO EN EFECTIVO ≥ $2,000 → se ofrece dividir en varias
//    ventas menores a $2,000 (una factura c/u).
//
// 2) FIADO (notas de deuda): ninguna nota debe llegar a $2,000.
//    - Si el producto ya no cabe en la nota, se abre nota nueva.
//    - Si el trabajador vuelve con productos chicos y CABEN en una nota
//      pendiente con espacio, se agregan ahí (se aprovecha la nota y el
//      timbre en vez de abrir otra).
// ══════════════════════════════════════════════════════════════════════════════

export const LIMITE_EFECTIVO = 2000; // cada venta/nota queda POR DEBAJO de esto

const fmt = n => Number(n || 0).toLocaleString('es-MX',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── ATOMIZAR: convertir el carrito en piezas indivisibles ────────────────────
// Cantidades enteras se separan por unidad; decimales (0.35 m) son atómicas.

function atomizar(carrito) {
    const atomos = [];
    carrito.forEach(item => {
        const pu = Number(item.customPrice ?? item.precio);
        const cant = Number(item.cantidad);
        if (cant % 1 !== 0) {
            atomos.push({ item, cantidad: cant, monto: pu * cant });
        } else {
            for (let k = 0; k < cant; k++)
                atomos.push({ item, cantidad: 1, monto: pu });
        }
    });
    return atomos;
}

// Recombinar átomos del mismo producto en líneas con cantidad
function compactar(atomosGrupo) {
    const porProd = {};
    atomosGrupo.forEach(a => {
        const key = a.item.productId + '|' + (a.item.customPrice ?? a.item.precio);
        if (!porProd[key]) porProd[key] = { ...a.item, cantidad: 0 };
        porProd[key].cantidad += a.cantidad;
    });
    return Object.values(porProd);
}

// ─── REPARTO SIMPLE (venta de contado): solo grupos nuevos ───────────────────

export function dividirCarrito(carrito, limite = LIMITE_EFECTIVO) {
    const { existentes, nuevas } = repartirEnNotas(carrito, [], limite);
    return nuevas; // sin notas previas, todo son grupos nuevos
}

// ─── REPARTO EN NOTAS (fiado): primero llenar notas existentes ────────────────
// notasPendientes: deudas del cliente con status != PAID y total < limite.
// Devuelve:
//   existentes: [{ debt, atomos, items, delta, nuevoTotal }]
//   nuevas:     [{ items, total, excedido }]

export function repartirEnNotas(carrito, notasPendientes = [], limite = LIMITE_EFECTIVO) {
    const atomos = atomizar(carrito);

    // Productos que ni solos caben bajo el límite → nota propia, marcada
    const excedidos = atomos.filter(a => a.monto >= limite);
    const normales  = atomos.filter(a => a.monto < limite);
    normales.sort((a, b) => b.monto - a.monto); // los caros primero

    // Bins existentes: notas pendientes con espacio.
    // Se ordenan por espacio ASCENDENTE: primero se rellenan las más llenas
    // (mejor aprovechamiento: se "cierran" notas en lugar de dejar huecos).
    const binsExist = notasPendientes
        .map(d => ({ debt: d, base: Number(d.totalAmount), delta: 0, atomos: [] }))
        .sort((a, b) => (limite - a.base) - (limite - b.base));

    const binsNuevos = [];

    normales.forEach(a => {
        // 1º intentar notas existentes
        let bin = binsExist.find(b => b.base + b.delta + a.monto < limite);
        // 2º intentar notas nuevas ya abiertas en este reparto
        if (!bin) bin = binsNuevos.find(b => b.total + a.monto < limite);
        // 3º abrir nota nueva
        if (!bin) { bin = { total: 0, atomos: [], nuevo: true }; binsNuevos.push(bin); }

        bin.atomos.push(a);
        if (bin.nuevo) bin.total += a.monto; else bin.delta += a.monto;
    });

    const existentes = binsExist
        .filter(b => b.atomos.length)
        .map(b => ({
            debt: b.debt,
            items: compactar(b.atomos),
            delta: b.delta,
            nuevoTotal: b.base + b.delta
        }));

    const nuevas = binsNuevos.map(b => ({
        items: compactar(b.atomos), total: b.total, excedido: false
    }));
    excedidos.forEach(a => nuevas.push({
        items: compactar([a]), total: a.monto, excedido: true
    }));

    return { existentes, nuevas };
}

// ─── FIADO: flujo completo ────────────────────────────────────────────────────
// Reparte el carrito entre las notas pendientes del cliente y notas nuevas,
// previsualiza, y ejecuta. Devuelve 'CANCELADO' o un resumen {agregadas, creadas}.

export async function procesarDeudaEnNotas(carrito, clienteId, nota, totalNum) {
    // 1. Notas pendientes del cliente con espacio disponible
    let pendientes = [];
    try {
        const deudas = await fetchAPI(`/debts/customer/${clienteId}`);
        pendientes = deudas.filter(d =>
            d.status !== 'PAID' && Number(d.totalAmount) < LIMITE_EFECTIVO);
    } catch (e) { pendientes = []; }

    const plan = repartirEnNotas(carrito, pendientes);

    // 2. Caso trivial: nada que agregar a notas previas y una sola nota nueva
    //    normal → no hace falta previsualización, se ejecuta directo.
    const trivial = plan.existentes.length === 0
        && plan.nuevas.length === 1 && !plan.nuevas[0].excedido;

    if (!trivial) {
        const bloquesExist = plan.existentes.map(e => `
            <div class="border border-primary rounded mb-2">
                <div class="d-flex justify-content-between px-2 py-1 bg-primary bg-opacity-10">
                    <span><i class="bi bi-journal-plus me-1"></i>
                        Se agrega a <span class="font-monospace">${e.debt.invoiceNumber || 'nota'}</span>
                        <small class="text-muted">(tenía $${fmt(e.debt.totalAmount)})</small></span>
                    <strong class="text-primary">→ $${fmt(e.nuevoTotal)}</strong>
                </div>
                <div class="px-2 py-1 small">
                    ${e.items.map(i => `<div class="d-flex justify-content-between">
                        <span>+ ${i.cantidad} × ${i.nombre}</span>
                        <span class="text-muted">$${fmt(i.cantidad * Number(i.customPrice ?? i.precio))}</span>
                    </div>`).join('')}
                </div>
            </div>`).join('');

        const bloquesNuevas = plan.nuevas.map((g, idx) => `
            <div class="border rounded mb-2 ${g.excedido ? 'border-warning' : ''}">
                <div class="d-flex justify-content-between px-2 py-1
                            ${g.excedido ? 'bg-warning bg-opacity-25' : 'bg-light'}">
                    <span><i class="bi bi-journal me-1"></i>Nota nueva ${idx + 1}</span>
                    <strong class="${g.excedido ? 'text-warning' : 'text-success'}">$${fmt(g.total)}</strong>
                </div>
                <div class="px-2 py-1 small">
                    ${g.items.map(i => `<div class="d-flex justify-content-between">
                        <span>${i.cantidad} × ${i.nombre}</span>
                        <span class="text-muted">$${fmt(i.cantidad * Number(i.customPrice ?? i.precio))}</span>
                    </div>`).join('')}
                    ${g.excedido ? `<div class="text-warning small mt-1">
                        <i class="bi bi-exclamation-triangle me-1"></i>Este producto solo
                        ya pasa de $${fmt(LIMITE_EFECTIVO)}: no se puede dividir.</div>` : ''}
                </div>
            </div>`).join('');

        const conf = await Swal.fire({
            title: 'Reparto del fiado',
            html: `<div class="text-start" style="max-height:55vh;overflow-y:auto">
                    ${bloquesExist}${bloquesNuevas}</div>
                   <div class="d-flex justify-content-between border-top pt-2 mt-1">
                       <strong>Total fiado hoy</strong>
                       <strong class="text-danger">$${fmt(totalNum)}</strong>
                   </div>
                   <p class="small text-muted text-start mb-0 mt-1">
                       Ninguna nota llega a $${fmt(LIMITE_EFECTIVO)}: cada una podrá
                       facturarse deducible en efectivo.</p>`,
            width: '560px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-check-lg me-1"></i>Confirmar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#fd7e14'
        });
        if (!conf.isConfirmed) return 'CANCELADO';
    }

    // 3. Ejecutar
    const totalPasos = plan.existentes.length + plan.nuevas.length;
    Swal.fire({ title: 'Registrando fiado...',
        html: `<div class="spinner-border text-warning"></div>
               <p class="text-muted small mt-2" id="progreso-fiado">0 de ${totalPasos}</p>`,
        allowOutsideClick: false, showConfirmButton: false });

    const agregadas = [], creadas = [];
    let paso = 0;
    const avanzar = () => {
        paso++;
        const p = document.getElementById('progreso-fiado');
        if (p) p.textContent = `${paso} de ${totalPasos}`;
    };

    try {
        // 3a. Agregar a notas existentes
        for (const e of plan.existentes) {
            const deuda = await fetchAPI(`/debts/${e.debt.id}/agregar-items`, {
                method: 'POST',
                body: {
                    items: e.items.map(i => ({
                        productId:   i.productId,
                        quantity:    i.cantidad,
                        customPrice: i.customPrice ?? null
                    })),
                    nota: nota || null
                }
            });
            agregadas.push({ folio: deuda.invoiceNumber, delta: e.delta,
                nuevoTotal: Number(deuda.totalAmount) });
            avanzar();
        }
        // 3b. Crear notas nuevas (venta DEUDA + deuda), como el flujo normal
        for (const g of plan.nuevas) {
            const venta = await fetchAPI('/sales', { method: 'POST', body: {
                customerId: clienteId, paymentMethod: 'DEUDA', amountReceived: 0,
                items: g.items.map(i => ({
                    productId:   i.productId,
                    quantity:    i.cantidad,
                    customPrice: i.customPrice ?? null
                }))
            }});
            await fetchAPI('/debts', { method: 'POST', body: {
                customerId: clienteId, saleId: venta.id,
                totalAmount: venta.totalAmount, notes: nota || null
            }});
            creadas.push({ folio: venta.invoiceNumber,
                total: Number(venta.totalAmount), excedido: g.excedido });
            avanzar();
        }
    } catch (e) {
        await Swal.fire({ icon: 'error', title: 'Error a medio registro',
            html: `<div class="text-start"><p>${e.message}</p>
                <p class="small text-muted mb-0">Se alcanzó a registrar:
                ${[...agregadas.map(a => a.folio), ...creadas.map(c => c.folio)]
                    .join(', ') || 'nada'}.
                Revisa la Libreta de Deudas antes de reintentar para no duplicar.</p></div>`,
            confirmButtonText: 'Entendido' });
        return { agregadas, creadas, error: true };
    }

    // 4. Resumen
    await Swal.fire({
        icon: 'warning', title: '¡Fiado registrado!',
        html: `<div class="text-start">
            ${agregadas.map(a => `<div class="d-flex justify-content-between border-bottom py-1">
                <span><i class="bi bi-journal-plus text-primary me-1"></i>
                    <span class="font-monospace">${a.folio}</span>
                    <small class="text-muted">+$${fmt(a.delta)}</small></span>
                <strong>$${fmt(a.nuevoTotal)}</strong></div>`).join('')}
            ${creadas.map(c => `<div class="d-flex justify-content-between border-bottom py-1">
                <span><i class="bi bi-journal text-warning me-1"></i>
                    <span class="font-monospace">${c.folio}</span>
                    ${c.excedido ? '<span class="badge bg-warning text-dark ms-1">> $2,000</span>' : ''}</span>
                <strong>$${fmt(c.total)}</strong></div>`).join('')}
            <div class="d-flex justify-content-between pt-2">
                <strong>Total fiado hoy</strong>
                <strong class="text-danger">$${fmt(totalNum)}</strong>
            </div></div>`,
        confirmButtonText: 'Entendido', width: '480px'
    });
    return { agregadas, creadas };
}

// ─── CONTADO EN EFECTIVO: flujo completo (igual que antes) ────────────────────
// Devuelve 'UNA_SOLA' | 'CANCELADO' | [ventas creadas]

export async function procesarVentaDividida(carrito, clienteSeleccionado, recibido, totalNum) {
    const pregunta = await Swal.fire({
        title: 'Pago en efectivo mayor a $' + fmt(LIMITE_EFECTIVO),
        html: `<div class="text-start">
            <p>El total es <strong class="text-success">$${fmt(totalNum)}</strong> en efectivo.</p>
            <p class="small text-muted mb-0">Para que las facturas en efectivo sean deducibles,
            se pueden dividir los productos en varias ventas menores a $${fmt(LIMITE_EFECTIVO)}
            — cada una con su propio folio y su propia factura.</p></div>`,
        icon: 'question',
        showDenyButton: true, showCancelButton: true,
        confirmButtonText: '<i class="bi bi-scissors me-1"></i>Dividir en varias ventas',
        denyButtonText: 'Una sola venta',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0d6efd', denyButtonColor: '#6c757d'
    });
    if (pregunta.isDismissed) return 'CANCELADO';
    if (pregunta.isDenied)    return 'UNA_SOLA';

    const grupos = dividirCarrito(carrito);

    const bloques = grupos.map((g, idx) => `
        <div class="border rounded mb-2 ${g.excedido ? 'border-warning' : ''}">
            <div class="d-flex justify-content-between px-2 py-1
                        ${g.excedido ? 'bg-warning bg-opacity-25' : 'bg-light'}">
                <strong>Venta ${idx + 1}</strong>
                <strong class="${g.excedido ? 'text-warning' : 'text-success'}">$${fmt(g.total)}</strong>
            </div>
            <div class="px-2 py-1 small">
                ${g.items.map(i => `<div class="d-flex justify-content-between">
                    <span>${i.cantidad} × ${i.nombre}</span>
                    <span class="text-muted">$${fmt(i.cantidad * Number(i.customPrice ?? i.precio))}</span>
                </div>`).join('')}
                ${g.excedido ? `<div class="text-warning small mt-1">
                    <i class="bi bi-exclamation-triangle me-1"></i>Este producto solo
                    ya pasa de $${fmt(LIMITE_EFECTIVO)}: no se puede dividir.
                    Sugiere pagarlo por transferencia si quiere deducirlo.</div>` : ''}
            </div>
        </div>`).join('');

    const confirmar = await Swal.fire({
        title: `Se crearán ${grupos.length} ventas`,
        html: `<div class="text-start" style="max-height:55vh;overflow-y:auto">${bloques}</div>
               <div class="d-flex justify-content-between border-top pt-2 mt-1">
                   <strong>Total global</strong>
                   <strong class="text-success">$${fmt(totalNum)}</strong>
               </div>`,
        width: '540px',
        showCancelButton: true,
        confirmButtonText: `<i class="bi bi-check-lg me-1"></i>Confirmar ${grupos.length} ventas`,
        cancelButtonText: 'Atrás',
        confirmButtonColor: '#198754'
    });
    if (!confirmar.isConfirmed) return 'CANCELADO';

    Swal.fire({ title: 'Registrando ventas...',
        html: `<div class="spinner-border text-primary"></div>
               <p class="text-muted small mt-2" id="progreso-division">0 de ${grupos.length}</p>`,
        allowOutsideClick: false, showConfirmButton: false });

    const ventas = [];
    try {
        for (let idx = 0; idx < grupos.length; idx++) {
            const g = grupos[idx];
            const venta = await fetchAPI('/sales', { method: 'POST', body: {
                customerId:     clienteSeleccionado,
                paymentMethod:  'EFECTIVO',
                amountReceived: Number(g.total.toFixed(2)),
                items: g.items.map(i => ({
                    productId:   i.productId,
                    quantity:    i.cantidad,
                    customPrice: i.customPrice ?? null
                }))
            }});
            ventas.push(venta);
            const prog = document.getElementById('progreso-division');
            if (prog) prog.textContent = `${idx + 1} de ${grupos.length}`;
        }
    } catch (e) {
        await Swal.fire({ icon: 'error', title: 'Error a media división',
            html: `<div class="text-start"><p>${e.message}</p>
                <p class="small text-muted mb-0">Se alcanzaron a registrar
                <strong>${ventas.length}</strong> de ${grupos.length} ventas
                (${ventas.map(v => v.invoiceNumber).join(', ') || 'ninguna'}).
                Revisa el Historial antes de reintentar para no duplicar.</p></div>`,
            confirmButtonText: 'Entendido' });
        return ventas.length ? ventas : 'CANCELADO';
    }

    const cambio = recibido - totalNum;
    await Swal.fire({
        icon: 'success',
        title: `¡${ventas.length} ventas registradas!`,
        html: `<div class="text-start">
            ${ventas.map(v => `<div class="d-flex justify-content-between border-bottom py-1">
                <span><span class="badge bg-light text-dark border font-monospace">${v.invoiceNumber}</span></span>
                <strong>$${fmt(v.totalAmount)}</strong>
            </div>`).join('')}
            <div class="d-flex justify-content-between pt-2">
                <strong>Total cobrado</strong>
                <strong class="text-success">$${fmt(totalNum)}</strong>
            </div>
            ${cambio > 0 ? `<div class="d-flex justify-content-between">
                <strong>Cambio</strong>
                <strong class="text-primary">$${fmt(cambio)}</strong>
            </div>` : ''}
            <p class="small text-muted mt-2 mb-0"><i class="bi bi-info-circle me-1"></i>
            Cada venta se timbra por separado desde <strong>Historial</strong>.</p>
        </div>`,
        confirmButtonText: 'Aceptar', width: '480px'
    });
    return ventas;
}