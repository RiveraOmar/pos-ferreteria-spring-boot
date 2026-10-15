package com.ferreteria.PuntoDeVenta.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSetMetaData;
import java.time.LocalDateTime;
import java.util.*;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CONSOLA DE DESARROLLO — ejecución directa de SQL (equivalente a pgAdmin)
 *
 *  SELECT           → regresa filas + columnas para pintar una tabla.
 *  INSERT/UPDATE/... → ejecuta y regresa cuántas filas se afectaron.
 *
 *  Cada ejecución se guarda en dev_console_log (se crea sola la primera
 *  vez que se usa) para poder ver después qué se ejecutó y cuándo — la
 *  única red de seguridad que tiene esta consola de control total.
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DevConsoleService {

    private final JdbcTemplate jdbcTemplate;

    private boolean tablaLogLista = false;

    /** Crea la tabla de bitácora la primera vez que se usa la consola. */
    private void asegurarTablaLog() {
        if (tablaLogLista) return;
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS dev_console_log (
                id BIGSERIAL PRIMARY KEY,
                ejecutado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                sql_texto TEXT NOT NULL,
                resultado TEXT,
                error TEXT
            )
            """);
        tablaLogLista = true;
    }

    @Transactional
    public Map<String, Object> ejecutar(String sqlOriginal) {
        asegurarTablaLog();
        String sql = sqlOriginal.trim();
        String primeraPalabra = sql.split("\\s+", 2)[0].toUpperCase();
        boolean esConsulta = primeraPalabra.equals("SELECT")
                || primeraPalabra.equals("SHOW")
                || primeraPalabra.equals("EXPLAIN")
                || primeraPalabra.equals("WITH");

        Map<String, Object> respuesta = new LinkedHashMap<>();
        long inicio = System.currentTimeMillis();

        try {
            if (esConsulta) {
                List<Map<String, Object>> filas = new ArrayList<>();
                List<String> columnas = new ArrayList<>();

                jdbcTemplate.query(sql, rs -> {
                    if (columnas.isEmpty()) {
                        ResultSetMetaData meta = rs.getMetaData();
                        for (int i = 1; i <= meta.getColumnCount(); i++) {
                            columnas.add(meta.getColumnLabel(i));
                        }
                    }
                    Map<String, Object> fila = new LinkedHashMap<>();
                    for (String col : columnas) {
                        fila.put(col, rs.getObject(col));
                    }
                    filas.add(fila);
                });

                respuesta.put("tipo", "consulta");
                respuesta.put("columnas", columnas);
                respuesta.put("filas", filas);
                respuesta.put("totalFilas", filas.size());
                registrarLog(sql, filas.size() + " fila(s) devueltas", null);
            } else {
                int afectadas = jdbcTemplate.update(sql);
                respuesta.put("tipo", "cambio");
                respuesta.put("filasAfectadas", afectadas);
                registrarLog(sql, afectadas + " fila(s) afectadas", null);
            }
            respuesta.put("ms", System.currentTimeMillis() - inicio);
            log.info("[DEV-CONSOLE] Ejecutado en {} ms: {}",
                    respuesta.get("ms"), resumen(sql));
            return respuesta;

        } catch (Exception e) {
            registrarLog(sql, null, e.getMessage());
            log.warn("[DEV-CONSOLE] Error ejecutando: {} — {}", resumen(sql), e.getMessage());
            throw new RuntimeException(mensajeAmigable(e), e);
        }
    }

    /** Guarda la ejecución en su propia transacción para que quede aunque falle el SQL. */
    private void registrarLog(String sql, String resultado, String error) {
        try {
            jdbcTemplate.update(
                    "INSERT INTO dev_console_log (sql_texto, resultado, error) VALUES (?, ?, ?)",
                    sql, resultado, error);
        } catch (Exception ignored) {
            // Si falla el registro del log, no debe tumbar la consulta original.
        }
    }

    public List<Map<String, Object>> historial() {
        asegurarTablaLog();
        return jdbcTemplate.queryForList(
                "SELECT id, ejecutado_en, sql_texto, resultado, error " +
                        "FROM dev_console_log ORDER BY ejecutado_en DESC LIMIT 100");
    }

    /** Lista de tablas y columnas del esquema público, para explorar la BD. */
    public List<Map<String, Object>> esquema() {
        return jdbcTemplate.queryForList("""
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
            """);
    }

    private String resumen(String sql) {
        String limpio = sql.replaceAll("\\s+", " ").trim();
        return limpio.length() > 120 ? limpio.substring(0, 120) + "..." : limpio;
    }

    /** Traduce los errores más comunes de Postgres a algo entendible. */
    private String mensajeAmigable(Exception e) {
        String msg = e.getMessage() != null ? e.getMessage() : "Error desconocido";
        if (msg.contains("does not exist") && msg.contains("relation"))
            return "Esa tabla no existe. Revisa el nombre (mayúsculas/minúsculas y que exista).";
        if (msg.contains("column") && msg.contains("does not exist"))
            return "Esa columna no existe en la tabla. Revisa el nombre exacto.";
        if (msg.contains("syntax error"))
            return "Error de sintaxis SQL — revisa comas, paréntesis o palabras clave.";
        if (msg.contains("violates foreign key constraint"))
            return "No se puede — hay otros registros que dependen de este (llave foránea).";
        if (msg.contains("violates not-null constraint"))
            return "Falta un valor obligatorio (columna que no acepta NULL).";
        return msg;
    }
}
