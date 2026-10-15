
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
 
export function hoyISO() {
    const d = new Date();
  
    const offset = d.getTimezoneOffset(); 
    const local  = new Date(d.getTime() - (offset + 420) * 60000); 
    return local.toISOString().split('T')[0];
}