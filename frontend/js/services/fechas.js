
export function fmtFecha(valor) {
    if (!valor) return '---';
    const d = new Date(valor);
    return d.toLocaleString('es-MX', {
        timeZone:   'America/Mazatlan',
        day:        '2-digit',
        month:      '2-digit',
        year:       'numeric',
        hour:       '2-digit',
        minute:     '2-digit',
        hour12:     false
    });
}
 
/**
 * Solo fecha: "22/06/2026"
 */
export function fmtFechaCorta(valor) {
    if (!valor) return '---';
    const d = new Date(valor);
    return d.toLocaleDateString('es-MX', {
        timeZone: 'America/Mazatlan',
        day:      '2-digit',
        month:    '2-digit',
        year:     'numeric'
    });
}
 
/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD para inputs type="date"
 * usando la zona horaria de Sinaloa
 */
export function hoyISO() {
    const d = new Date();
    // Ajustar a UTC-7
    const offset = d.getTimezoneOffset(); // minutos de diferencia con UTC
    const local  = new Date(d.getTime() - (offset + 420) * 60000); // 420 = 7*60
    return local.toISOString().split('T')[0];
}