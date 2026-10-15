import { APP_CONFIG, getAuthHeader } from '../config.js';


let zxingReader = null;

async function cargarZXing() {
    if (window.ZXingBrowser) return window.ZXingBrowser;
    await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
        s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el lector'));
        document.head.appendChild(s);
    });
    return window.ZXingBrowser;
}

export async function escanearCodigoBarras() {
    return new Promise(async (resolve) => {
        // Modal con el video
        const overlay = document.createElement('div');
        overlay.style.cssText =
            'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.92);' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem';
        overlay.innerHTML = `
            <div style="color:#fff;text-align:center;margin-bottom:1rem">
                <h5 style="margin:0"><i class="bi bi-upc-scan me-2"></i>Escanear código</h5>
                <small style="opacity:.8">Apunta la cámara al código de barras</small>
            </div>
            <div style="position:relative;width:100%;max-width:420px;
                        border-radius:14px;overflow:hidden;box-shadow:0 0 0 3px #f59e0b">
                <video id="cam-video" playsinline muted
                    style="width:100%;display:block;background:#000"></video>
                <div style="position:absolute;inset:0;border:2px solid rgba(245,158,11,.6);
                            border-radius:14px;pointer-events:none"></div>
                <div style="position:absolute;left:8%;right:8%;top:50%;height:2px;
                            background:#f59e0b;box-shadow:0 0 12px #f59e0b"></div>
            </div>
            <div id="cam-estado" style="color:#fbbf24;margin-top:1rem;font-size:.85rem;min-height:1.2em"></div>
            <button id="cam-cancelar" class="btn btn-light mt-3">
                <i class="bi bi-x-lg me-1"></i>Cancelar</button>`;
        document.body.appendChild(overlay);

        const video   = overlay.querySelector('#cam-video');
        const estado  = overlay.querySelector('#cam-estado');
        let stream    = null;
        let corriendo = true;

        const cerrar = (resultado) => {
            corriendo = false;
            try { stream?.getTracks().forEach(t => t.stop()); } catch (e) {}
            try { zxingReader?.reset?.(); } catch (e) {}
            overlay.remove();
            resolve(resultado);
        };
        overlay.querySelector('#cam-cancelar').onclick = () => cerrar(null);

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }, audio: false
            });
            video.srcObject = stream;
            await video.play();
        } catch (e) {
            estado.textContent = 'No se pudo abrir la cámara. Revisa los permisos.';
            setTimeout(() => cerrar(null), 2500);
            return;
        }

        if ('BarcodeDetector' in window) {
            try {
                const detector = new window.BarcodeDetector({
                    formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf','codabar']
                });
                estado.textContent = 'Buscando código...';
                const loop = async () => {
                    if (!corriendo) return;
                    try {
                        const codes = await detector.detect(video);
                        if (codes.length) {
                            navigator.vibrate?.(120);
                            cerrar(codes[0].rawValue);
                            return;
                        }
                    } catch (e) { }
                    requestAnimationFrame(loop);
                };
                loop();
                return;
            } catch (e) {  }
        }

        try {
            estado.textContent = 'Cargando lector...';
            const ZX = await cargarZXing();
            zxingReader = new ZX.BrowserMultiFormatReader();
            estado.textContent = 'Buscando código...';
            zxingReader.decodeFromVideoElement(video, (result) => {
                if (result && corriendo) {
                    navigator.vibrate?.(120);
                    cerrar(result.getText());
                }
            });
        } catch (e) {
            estado.textContent = 'No se pudo iniciar el lector en este navegador.';
            setTimeout(() => cerrar(null), 2500);
        }
    });
}


export function tomarYSubirFoto() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; 
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async () => {
            const file = input.files?.[0];
            input.remove();
            if (!file) { resolve(null); return; }

            Swal.fire({
                title: 'Subiendo foto...',
                html: '<div class="spinner-border text-warning"></div>',
                allowOutsideClick: false, showConfirmButton: false
            });

            try {
                const fd = new FormData();
                fd.append('file', file);
                const resp = await fetch(APP_CONFIG.API_BASE + '/uploads/producto-imagen', {
                    method: 'POST',
                    headers: { 'Authorization': getAuthHeader() }, 
                    body: fd
                });
                let data = {};
                try { data = await resp.json(); }
                catch (e) { data = { error: `El servidor respondió ${resp.status}` }; }
                if (!resp.ok) throw new Error(data.error || `Error ${resp.status} al subir`);
                Swal.close();
                resolve(data.url);
            } catch (e) {
                Swal.fire('No se pudo subir la foto', e.message, 'error');
                resolve(null);
            }
        };

        input.oncancel = () => { input.remove(); resolve(null); };
        input.click();
    });
}

export function urlImagenCompleta(url) {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    const base = APP_CONFIG.API_BASE.replace(/\/api\/?$/, '');
    return base + url;
}