import { fetchAPI } from '../services/api.js';


// Escapa un texto que va DENTRO de un onclick="...('AQUI')".
// Ahi conviven dos lenguajes y cada uno tiene su comilla: el atributo HTML
// esta delimitado por " y la cadena de JavaScript por '. Por eso hay que
// escapar para LOS DOS, en este orden:
//   1. la barra invertida, o los escapes de abajo se rompen entre si
//   2. la comilla simple, con \' — es escape de JAVASCRIPT
//   3. y hasta el final el HTML: & " < >
// La comilla simple NO se convierte a &#39; a proposito: el navegador la
// decodificaria de vuelta a ' y cerraria la cadena de JS a media instruccion.
function escAttr(s) {
    return String(s ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

let categoriaModalBS;
let currentPath = [{ id: null, name: 'Inicio' }];

export function initCategorias(container) {
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="mb-0"><i class="bi bi-tags"></i> Categorías</h2>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb mt-2" id="categoria-breadcrumb"></ol>
                </nav>
            </div>
            <button class="btn btn-primary shadow-sm" id="btn-nueva-categoria">
                <i class="bi bi-plus-circle"></i > Nueva Categoría
            </button>
        </div>

        <!-- Barra de Búsqueda -->
        <div class="row mb-3">
            <div class="col-md-6">
                <div class="input-group shadow-sm">
                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
                    <input type="text" id="input-buscar-categoria" class="form-control border-start-0" placeholder="Buscar por nombre o ID...">
                    <button class="btn btn-outline-secondary" type="button" id="btn-limpiar-busqueda">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- TABS PARA ACTIVOS / INACTIVOS -->
        <div class="card shadow-sm border-0">
            <div class="card-header bg-white border-bottom-0 pt-3">
                <ul class="nav nav-tabs card-header-tabs" id="categoriaTabs" role="tablist">
                    <li class="nav-item">
                        <button class="nav-link active fw-bold" id="activos-tab" data-bs-toggle="tab" data-bs-target="#tab-activas" type="button">
                            <i class="bi bi-check-circle"></i> Activas
                        </button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link text-danger fw-bold" id="inactivos-tab" data-bs-toggle="tab" data-bs-target="#tab-inactivas" type="button">
                            <i class="bi bi-trash"></i> Inactivas
                        </button>
                    </li>
                </ul>
            </div>
            <div class="card-body p-0">
                <div class="tab-content">
                    <div class="tab-pane fade show active" id="tab-activas" role="tabpanel">
                        <div class="list-group list-group-flush" id="lista-categorias-activas"></div>
                    </div>
                    <div class="tab-pane fade" id="tab-inactivas" role="tabpanel">
                        <div class="list-group list-group-flush" id="lista-categorias-inactivas"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal para Categorías -->
        <div class="modal fade" id="modalCategoria" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="modal-titulo">Nueva Categoría</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="form-categoria">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Nombre</label>
                                <input type="text" name="name" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Descripción</label>
                                <textarea name="description" class="form-control" rows="2"></textarea>
                            </div>
                            <input type="hidden" name="parentId" id="parent-id-hidden">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    categoriaModalBS = new bootstrap.Modal(document.getElementById('modalCategoria'));

    // --- EVENTOS ---
    let timeoutBusqueda;
    document.getElementById('input-buscar-categoria').oninput = (e) => {
        clearTimeout(timeoutBusqueda);
        const valor = e.target.value.trim();
        timeoutBusqueda = setTimeout(() => {
            if (valor.length > 0) buscarCategorias(valor);
            else recargarNivelActual();
        }, 400);
    };

    document.getElementById('btn-limpiar-busqueda').onclick = () => {
        document.getElementById('input-buscar-categoria').value = '';
        recargarNivelActual();
    };

    document.getElementById('btn-nueva-categoria').onclick = () => {
        const currentParent = currentPath[currentPath.length - 1];
        document.getElementById('form-categoria').reset();
        document.getElementById('parent-id-hidden').value = currentParent.id || "";
        document.getElementById('modal-titulo').innerText = currentParent.id 
            ? `Subcategoría en: ${currentParent.name}` 
            : 'Nueva Categoría Raíz';
        categoriaModalBS.show();
    };

    document.getElementById('form-categoria').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());
        const parentId = payload.parentId;
        delete payload.parentId; 

        try {
            const url = parentId ? `/categories/${parentId}` : '/categories';
            await fetchAPI(url, { method: 'POST', body: payload });
            categoriaModalBS.hide();
            Swal.fire('¡Éxito!', 'Categoría guardada', 'success');
            recargarNivelActual();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    };

    // --- FUNCIONES GLOBALES ---
    window.irACategoria = (id, nombre) => {
        if (id) {
            currentPath.push({ id, name: nombre });
            cargarSubcategorias(id);
        } else {
            currentPath = [{ id: null, name: 'Inicio' }];
            cargarCategoriasRaiz();
        }
        actualizarBreadcrumb();
    };

    window.eliminarCategoria = async (id, nombre) => {
        const result = await Swal.fire({
            title: `¿Desactivar "${nombre}"?`,
            text: "Se ocultará de la lista de activas y sus subcategorías también se desactivarán.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, desactivar'
        });

        if (result.isConfirmed) {
            try {
                // Enviamos active=false al endpoint de status
                await fetchAPI(`/categories/${id}/status?active=false`, { method: 'PUT' });
                Swal.fire('Desactivada', '', 'success');
                recargarNivelActual();
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        }
    };

    window.restaurarCategoria = async (id, nombre) => {
        try {
            await fetchAPI(`/categories/${id}/status?active=true`, { method: 'PUT' });
            Swal.fire('Restaurada', `"${nombre}" vuelve a estar activa.`, 'success');
            recargarNivelActual();
        } catch (error) {
            Swal.fire('Error', 'No se pudo restaurar', 'error');
        }
    };

    cargarCategoriasRaiz();
    actualizarBreadcrumb();
}

// --- LOGICA DE DATOS ---
async function cargarCategoriasRaiz() {
    renderLoading();
    try {
        const items = await fetchAPI('/categories');
        renderizarLista(items);
    } catch (error) {
        renderError("Error de conexión");
    }
}

async function cargarSubcategorias(parentId) {
    renderLoading();
    try {
        const items = await fetchAPI(`/categories/${parentId}`);
        renderizarLista(items);
    } catch (error) {
        renderError("Error al cargar subcategorías");
    }
}

async function buscarCategorias(termino) {
    renderLoading();
    try {
        const queryParam = isNaN(termino) ? `name=${termino}` : `id=${termino}`;
        const resultados = await fetchAPI(`/categories/search?${queryParam}`);
        renderizarLista(Array.isArray(resultados) ? resultados : [resultados]);
    } catch (error) {
        renderError("No se encontraron resultados");
    }
}

function recargarNivelActual() {
    const current = currentPath[currentPath.length - 1];
    if (current.id) cargarSubcategorias(current.id);
    else cargarCategoriasRaiz();
}

// --- RENDERIZADO ---
function renderizarLista(items) {
    const listaActivas = document.getElementById('lista-categorias-activas');
    const listaInactivas = document.getElementById('lista-categorias-inactivas');
    
    listaActivas.innerHTML = '';
    listaInactivas.innerHTML = '';

    // Filtrado robusto basado en el booleano del DTO
    const activas = items.filter(cat => cat.active === true);
    const inactivas = items.filter(cat => cat.active === false);

    if (activas.length === 0) {
        listaActivas.innerHTML = '<div class="p-5 text-center text-muted">No hay categorías activas aquí.</div>';
    } else {
        activas.forEach(cat => listaActivas.appendChild(crearFila(cat, true)));
    }

    if (inactivas.length === 0) {
        listaInactivas.innerHTML = '<div class="p-5 text-center text-muted">La papelera está vacía.</div>';
    } else {
        inactivas.forEach(cat => listaInactivas.appendChild(crearFila(cat, false)));
    }
}

function crearFila(cat, esActiva) {
    const item = document.createElement('div');
    item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3';
    
    const botones = esActiva 
        ? `<button class="btn btn-sm btn-outline-danger border-0 me-2" onclick="event.stopPropagation(); eliminarCategoria(${cat.id}, '${escAttr(cat.name)}')">
            <i class="bi bi-trash3"></i>
           </button>`
        : `<button class="btn btn-sm btn-outline-success border-0 me-2" onclick="event.stopPropagation(); restaurarCategoria(${cat.id}, '${escAttr(cat.name)}')">
            <i class="bi bi-arrow-counterclockwise"></i> Restaurar
           </button>`;

    item.innerHTML = `
        <div onclick="${esActiva ? `irACategoria(${cat.id}, '${escAttr(cat.name)}')` : ''}" 
             class="flex-grow-1" style="${esActiva ? 'cursor:pointer' : 'opacity:0.6'}">
            <div class="d-flex align-items-center">
                <h6 class="mb-0 fw-bold ${esActiva ? 'text-dark' : 'text-danger text-decoration-line-through'} me-2">
                    ${cat.name}
                </h6>
                <span class="badge bg-light text-muted border">ID: ${cat.id}</span>
            </div>
            <small class="text-muted">${cat.description || 'Sin descripción'}</small>
        </div>
        <div class="d-flex align-items-center">
            ${cat.hasChildren && esActiva ? '<span class="badge bg-info-subtle text-info rounded-pill me-3">Subcategorías</span>' : ''}
            ${botones}
            ${esActiva ? '<i class="bi bi-chevron-right text-muted"></i>' : ''}
        </div>
    `;
    return item;
}

function actualizarBreadcrumb() {
    const bread = document.getElementById('categoria-breadcrumb');
    if(!bread) return;
    bread.innerHTML = '';
    currentPath.forEach((step, index) => {
        const isLast = index === currentPath.length - 1;
        const li = document.createElement('li');
        li.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
        if (isLast) li.innerText = step.name;
        else {
            const a = document.createElement('a');
            a.href = "#";
            a.innerText = step.name;
            a.onclick = (e) => {
                e.preventDefault();
                currentPath = currentPath.slice(0, index + 1);
                window.irACategoria(step.id, step.name);
            };
            li.appendChild(a);
        }
        bread.appendChild(li);
    });
}

function renderLoading() {
    const loaders = ['lista-categorias-activas', 'lista-categorias-inactivas'];
    loaders.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    });
}

function renderError(msg) {
    const el = document.getElementById('lista-categorias-activas');
    if(el) el.innerHTML = `<div class="p-5 text-center text-danger">${msg}</div>`;
}