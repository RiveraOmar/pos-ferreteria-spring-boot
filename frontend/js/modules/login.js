import { iniciarSesion } from '../config.js';

// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE LOGIN
// Se muestra a pantalla completa cuando no hay sesión. Al entrar bien, llama al
// callback onLogin() para arrancar el sistema.
// ══════════════════════════════════════════════════════════════════════════════

export function mostrarLogin(onLogin) {
    document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                background:var(--steel-950,#14181f);padding:1rem">
        <div style="width:100%;max-width:380px">
            <div style="text-align:center;margin-bottom:1.75rem">
                <div style="width:64px;height:64px;border-radius:16px;margin:0 auto 1rem;
                            background:linear-gradient(145deg,#f59e0b,#d97706);
                            display:flex;align-items:center;justify-content:center;
                            box-shadow:0 8px 24px rgba(217,119,6,.4)">
                    <i class="bi bi-tools" style="font-size:2rem;color:#fff"></i>
                </div>
                <h1 style="color:#fff;font-family:'Archivo',sans-serif;font-weight:800;
                           font-size:1.6rem;margin:0;letter-spacing:-.02em">FerrePOS</h1>
                <p style="color:#94a3b8;font-size:.8rem;letter-spacing:2px;
                          text-transform:uppercase;margin:.25rem 0 0">Punto de venta</p>
            </div>

            <div style="background:#fff;border-radius:14px;padding:1.75rem;
                        box-shadow:0 20px 60px rgba(0,0,0,.4)">
                <h5 style="font-weight:700;margin-bottom:1.25rem;text-align:center">
                    Iniciar sesión</h5>

                <div class="mb-3">
                    <label class="form-label small fw-bold">Usuario</label>
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-person"></i></span>
                        <input type="text" id="login-user" class="form-control"
                            placeholder="Tu usuario" autocomplete="username" autofocus>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Contraseña</label>
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-lock"></i></span>
                        <input type="password" id="login-pass" class="form-control"
                            placeholder="Tu contraseña" autocomplete="current-password">
                        <button class="btn btn-outline-secondary" type="button" id="login-ver"
                            title="Mostrar/ocultar"><i class="bi bi-eye"></i></button>
                    </div>
                </div>

                <div id="login-error" class="alert alert-danger py-2 small"
                     style="display:none"></div>

                <button id="login-btn" class="btn btn-warning w-100 mt-2">
                    <i class="bi bi-box-arrow-in-right me-1"></i>Entrar
                </button>
            </div>

            <p style="text-align:center;color:#475569;font-size:.72rem;margin-top:1.25rem">
                v1.1.0 · FerrePOS</p>
        </div>
    </div>`;

    const userEl  = document.getElementById('login-user');
    const passEl  = document.getElementById('login-pass');
    const btnEl   = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');

    document.getElementById('login-ver').onclick = () => {
        passEl.type = passEl.type === 'password' ? 'text' : 'password';
    };

    const intentar = async () => {
        const u = userEl.value.trim();
        const p = passEl.value;
        if (!u || !p) {
            errorEl.textContent = 'Escribe tu usuario y contraseña.';
            errorEl.style.display = 'block';
            return;
        }
        btnEl.disabled = true;
        btnEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Entrando...';
        errorEl.style.display = 'none';
        try {
            await iniciarSesion(u, p);
            onLogin();
        } catch (e) {
            errorEl.textContent = e.message;
            errorEl.style.display = 'block';
            btnEl.disabled = false;
            btnEl.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Entrar';
            passEl.focus();
            passEl.select();
        }
    };

    btnEl.onclick = intentar;
    passEl.addEventListener('keydown', e => { if (e.key === 'Enter') intentar(); });
    userEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl.focus(); });
}