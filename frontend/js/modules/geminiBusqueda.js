import { fetchAPI } from '../services/api.js';

export function initCatalogosGemini(container) {
    container.innerHTML = `
        <div class="mb-4">
            <h2><i class="bi bi-search-heart"></i> Consulta de Compatibilidades</h2>
            <p class="text-muted">
                Busca equivalencias, compatibilidades y especificaciones de productos
                usando inteligencia artificial.
            </p>
        </div>

        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body">
                <div class="input-group">
                    <span class="input-group-text bg-white"><i class="bi bi-chat-dots"></i></span>
                    <input type="text" id="input-pregunta-ia" class="form-control form-control-lg"
                        placeholder="Ej: qué filtro de aceite lleva el Tsuru 2004">
                    <button class="btn btn-primary px-4" id="btn-buscar-ia">
                        <i class="bi bi-search"></i> Buscar
                    </button>
                </div>
                <div class="form-text mt-2">
                    Ejemplos: "qué aceite usa una Suburban 2015", "equivalencia del filtro PH3614"
                </div>
            </div>
        </div>

        <div id="resultado-ia-container"></div>
    `;

    const input = document.getElementById('input-pregunta-ia');
    const btn   = document.getElementById('btn-buscar-ia');

    btn.addEventListener('click', () => buscarConIA());
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') buscarConIA();
    });
}

async function buscarConIA() {
    const input     = document.getElementById('input-pregunta-ia');
    const resultado = document.getElementById('resultado-ia-container');
    const pregunta  = input.value.trim();

    if (!pregunta) {
        Swal.fire('Aviso', 'Escribe una pregunta primero.', 'warning');
        return;
    }
    if (pregunta.length < 5) {
        Swal.fire('Aviso', 'Escribe una pregunta más específica.', 'warning');
        return;
    }

    resultado.innerHTML = `
        <div class="card border-0 shadow-sm">
            <div class="card-body text-center py-4">
                <div class="spinner-border text-primary"></div>
                <p class="text-muted mt-2 mb-0">Consultando...</p>
            </div>
        </div>`;

    try {
        const data = await fetchAPI('/ia/buscar-compatibilidad', {
            method: 'POST',
            body: { pregunta }
        });

        resultado.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-light">
                    <i class="bi bi-question-circle me-2"></i>
                    <strong>${pregunta}</strong>
                </div>
                <div class="card-body">
                    <div class="d-flex">
                        <i class="bi bi-robot fs-3 text-primary me-3"></i>
                        <p class="mb-0" style="white-space: pre-line">${data.respuesta}</p>
                    </div>
                </div>
                <div class="card-footer bg-white text-muted small">
                    <i class="bi bi-info-circle me-1"></i>
                    Respuesta generada por IA. Verifica siempre con el cliente o el empaque original antes de vender.
                </div>
            </div>`;
    } catch (e) {
        resultado.innerHTML = `<div class="alert alert-danger">
            Error al consultar: ${e.message}</div>`;
    }
}