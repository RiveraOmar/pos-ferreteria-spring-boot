import { initCatalogos } from './catalogoFiltros.js';
import { initCatalogosBaterias } from './catalogoBateria.js';
import { initCatalogoBirlos } from './catalogoBirlos.js';
import { initCatalogoAuto } from './catalogoAuto.js';


export function initInventario(container) {
    container.innerHTML = `
        <div class="mb-3">
            <h2 class="fw-bold mb-0"><i class="bi bi-journal-album me-2"></i>Catálogos</h2>
            <p class="text-muted mb-0 small">
                Catálogos técnicos de referencia. Los productos y sus categorías
                se gestionan en el menú <strong>Productos</strong>.
            </p>
        </div>

        <ul class="nav nav-tabs mb-0" id="inv-tabs" style="font-size:.85rem">
            <li class="nav-item"><a class="nav-link active py-1 px-3" href="#" data-tab="filtros">
                <i class="bi bi-funnel me-1"></i>Catálogo de Filtros</a></li>
            <li class="nav-item"><a class="nav-link py-1 px-3" href="#" data-tab="baterias">
                <i class="bi bi-battery-full me-1"></i>Catálogo de Baterías</a></li>
            <li class="nav-item"><a class="nav-link py-1 px-3" href="#" data-tab="birlos">
                <i class="bi bi-nut me-1"></i>Catálogo de Birlos</a></li>
            <li class="nav-item"><a class="nav-link py-1 px-3" href="#" data-tab="auto">
                <i class="bi bi-car-front me-1"></i>Bandas y Motor</a></li>
        </ul>

        <div class="bg-white border border-top-0 rounded-bottom p-3">
            <div id="inv-tab-filtros"></div>
            <div id="inv-tab-baterias" class="d-none"></div>
            <div id="inv-tab-birlos" class="d-none"></div>
            <div id="inv-tab-auto" class="d-none"></div>
        </div>`;

    const cargado = {};
    const mostrar = (tab) => {
        ['filtros', 'baterias', 'birlos', 'auto'].forEach(t =>
            document.getElementById('inv-tab-' + t)
                .classList.toggle('d-none', t !== tab));
        if (!cargado[tab]) {
            cargado[tab] = true;
            const cont = document.getElementById('inv-tab-' + tab);
            if (tab === 'filtros')  initCatalogos(cont);
            if (tab === 'baterias') initCatalogosBaterias(cont);
            if (tab === 'birlos')   initCatalogoBirlos(cont);
            if (tab === 'auto')     initCatalogoAuto(cont);
        }
    };

    document.querySelectorAll('#inv-tabs .nav-link').forEach(a =>
        a.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#inv-tabs .nav-link')
                .forEach(x => x.classList.remove('active'));
            a.classList.add('active');
            mostrar(a.dataset.tab);
        }));

    mostrar('filtros');
}