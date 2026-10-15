/**
 * SearchSelect — reemplaza los <select> con búsqueda en tiempo real
 * Uso:
 *   const ss = new SearchSelect({
 *     input:       document.getElementById('mi-input'),
 *     dropdown:    document.getElementById('mi-dropdown'),
 *     items:       [{ id, label, sub, extra }],  // sub y extra son opcionales
 *     onSelect:    (item) => { ... },
 *     placeholder: 'Buscar cliente...'
 *   });
 *   ss.setItems(items);   // actualizar items dinámicamente
 *   ss.clear();           // limpiar selección
 */
export class SearchSelect {
    constructor({ input, dropdown, items = [], onSelect, placeholder = 'Buscar...' }) {
        this.input     = input;
        this.dropdown  = dropdown;
        this.items     = items;
        this.onSelect  = onSelect;
        this.selected  = null;
        this.filtered  = [];

        this.input.placeholder = placeholder;
        this.input.autocomplete = 'off';

        this._bindEvents();
    }

    setItems(items) {
        this.items = items;
        if (this.input.value) this._filter(this.input.value);
    }

    setValue(id) {
        const item = this.items.find(i => String(i.id) === String(id));
        if (item) {
            this.input.value = item.label;
            this.selected    = item;
            this._hide();
        }
    }

    clear() {
        this.input.value = '';
        this.selected    = null;
        this._hide();
    }

    _bindEvents() {
        this.input.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (q.length === 0) { this.selected = null; this._hide(); return; }
            this._filter(q);
        });

        this.input.addEventListener('focus', () => {
            if (this.input.value.trim()) this._filter(this.input.value.trim());
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this._hide();
            }
        });

        // Navegación con teclado
        this.input.addEventListener('keydown', (e) => {
            const items = this.dropdown.querySelectorAll('.search-dropdown-item');
            const active = this.dropdown.querySelector('.search-dropdown-item.active');
            let idx = Array.from(items).indexOf(active);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                idx = Math.min(idx + 1, items.length - 1);
                items.forEach(i => i.classList.remove('active'));
                if (items[idx]) {
                    items[idx].classList.add('active');
                    items[idx].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                idx = Math.max(idx - 1, 0);
                items.forEach(i => i.classList.remove('active'));
                if (items[idx]) {
                    items[idx].classList.add('active');
                    items[idx].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (active) active.click();
            } else if (e.key === 'Escape') {
                this._hide();
            }
        });
    }

    _filter(q) {
    const normalizar = (texto) => String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00D7/g, 'x')
        .replace(/\u00F7/g, '/')
        .replace(/\u2032/g, "'")
        .replace(/\u2033/g, '"')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '-')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const term = normalizar(q);

    this.filtered = this.items.filter(i => {
        const campos = [
            i.label  || '',
            i.sub    || '',
            i.extra  || '',
            i.phone  || ''
        ].map(normalizar);

        return campos.some(c => c.includes(term));
    }).slice(0, 25);

    this._render();
}

    _render() {
        if (!this.filtered.length) {
            this.dropdown.innerHTML = `
                <div class="search-empty">
                    <i class="bi bi-search d-block fs-4 mb-1 opacity-25"></i>
                    Sin resultados
                </div>`;
            this._show();
            return;
        }

        this.dropdown.innerHTML = this.filtered.map(item => `
            <div class="search-dropdown-item" data-id="${item.id}">
                ${item.avatar
                    ? `<img src="${item.avatar}" style="width:32px;height:32px;
                               border-radius:50%;object-fit:cover;flex-shrink:0"
                               onerror="this.style.display='none'">`
                    : `<div style="width:32px;height:32px;border-radius:50%;
                                   background:#e0e7ff;display:flex;align-items:center;
                                   justify-content:center;flex-shrink:0;color:#4f46e5;
                                   font-weight:700;font-size:.8rem">
                           ${item.label.charAt(0).toUpperCase()}
                       </div>`
                }
                <div style="min-width:0">
                    <div class="item-title text-truncate">${this._highlight(item.label)}</div>
                    ${item.sub
                        ? `<div class="item-sub text-truncate">${this._highlight(item.sub)}</div>`
                        : ''}
                </div>
                ${item.badge
                    ? `<span class="badge ms-auto ${item.badgeClass || 'bg-secondary'}">
                           ${item.badge}
                       </span>`
                    : ''}
            </div>`).join('');

        this.dropdown.querySelectorAll('.search-dropdown-item').forEach(el => {
            el.addEventListener('click', () => {
                const id   = el.dataset.id;
                const item = this.filtered.find(i => String(i.id) === id);
                if (!item) return;
                this.selected    = item;
                this.input.value = item.label;
                this._hide();
                if (this.onSelect) this.onSelect(item);
            });
        });

        this._show();
    }

    _highlight(text) {
        if (!this.input.value.trim()) return text;
        const term = this.input.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${term})`, 'gi'),
            '<mark style="background:#dbeafe;color:#1d4ed8;padding:0;border-radius:2px">$1</mark>');
    }

    _show() { this.dropdown.classList.add('show'); }
    _hide() { this.dropdown.classList.remove('show'); }
}