// ══════════════════════════════════════════════════════════════════════════════
// FerrePOS Frontend — CONFIGURACIÓN ÚNICA (con login JWT)
// Guardar como:  js/config.js
// ══════════════════════════════════════════════════════════════════════════════

// Dirección del backend. En una instalación nueva SOLO se cambia esta línea.
//   • Desde esta misma computadora:        http://localhost:9090/api
//   • Desde el celular (misma red WiFi):   la IP de la compu.
//   • En un servidor con dominio:          https://tudominio.com/api
export const APP_CONFIG = {
    // IP dinámica: se toma de la dirección con la que se abrió la página.
    // Así el sistema sigue funcionando aunque cambie de red WiFi o de PC
    // sin tener que editar este archivo cada vez.
    API_BASE: `http://${window.location.hostname}:9090/api`,
};

// ── AUTENTICACIÓN CON TOKEN JWT ───────────────────────────────────────────────
// El usuario inicia sesión una vez; el servidor devuelve un token firmado que
// se guarda y se manda en cada petición. El token EXPIRA (12 h por defecto),
// así que una sesión vieja deja de servir sola. Ya no hay contraseñas en el
// código ni en prompts.

const TOKEN_KEY = 'ferrepos_token';
const USER_KEY  = 'ferrepos_user';

// Header para las peticiones: "Bearer <token>"
export function getAuthHeader() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return token ? 'Bearer ' + token : '';
}

export function estaAutenticado() {
    return !!sessionStorage.getItem(TOKEN_KEY);
}

export function usuarioActual() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch (e) { return null; }
}

export function tieneRol(rol) {
    const u = usuarioActual();
    return u && u.roles && u.roles.includes('ROLE_' + rol);
}

// Llama al backend /auth/login. Si es correcto, guarda el token y devuelve true.
export async function iniciarSesion(username, password) {
    const resp = await fetch(APP_CONFIG.API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'No se pudo iniciar sesión');
    sessionStorage.setItem(TOKEN_KEY, data.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify({
        username: data.username, roles: data.roles
    }));
    return true;
}

// Cierra sesión: borra el token y recarga (mostrará la pantalla de login).
export function cerrarSesion() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    location.reload();
}

// fetchAPI llama esto al recibir 401 (token vencido o inválido).
export function resetAuth() {
    cerrarSesion();
}