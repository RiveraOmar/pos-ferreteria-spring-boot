package com.ferreteria.PuntoDeVenta.util;

import com.ferreteria.PuntoDeVenta.model.Periodicidad;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.Locale;
import java.util.Objects;


public final class PeriodoFiscal implements Comparable<PeriodoFiscal> {

    private static final String[] MESES = {
            "", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
            "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    };

    private final Periodicidad tipo;
    private final LocalDate ancla;

    private PeriodoFiscal(Periodicidad tipo, LocalDate ancla) {
        this.tipo = Objects.requireNonNull(tipo, "tipo de periodicidad requerido");
        this.ancla = Objects.requireNonNull(ancla, "fecha ancla requerida");
    }

    public static PeriodoFiscal de(Periodicidad tipo, LocalDate fecha) {
        return new PeriodoFiscal(tipo, fecha);
    }

    public static PeriodoFiscal deLocalDateTime(Periodicidad tipo, LocalDateTime dt) {
        return de(tipo, dt.toLocalDate());
    }

    public static PeriodoFiscal actual(Periodicidad tipo) {
        return de(tipo, LocalDate.now());
    }

    public static PeriodoFiscal parse(String s) {
        if (s == null || s.isBlank())
            throw new IllegalArgumentException("Periodo vacío.");
        String[] partes = s.trim().split(":", 2);
        if (partes.length != 2)
            throw new IllegalArgumentException(
                    "Periodo inválido: '" + s + "'. Formato esperado LETRA:AAAA-MM-DD "
                            + "(ej. Q:2026-08-20 para una quincena, M:2026-08-01 para un mes).");
        try {
            Periodicidad tipo = Periodicidad.deLetra(partes[0].toUpperCase());
            LocalDate fecha = LocalDate.parse(partes[1]);
            return de(tipo, fecha);
        } catch (Exception e) {
            throw new IllegalArgumentException(
                    "Periodo inválido: '" + s + "'. " + e.getMessage());
        }
    }

    public LocalDateTime inicio() {
        return switch (tipo) {
            case DIARIA   -> ancla.atStartOfDay();
            case SEMANAL  -> ancla.with(DayOfWeek.MONDAY).atStartOfDay();
            case QUINCENAL -> (ancla.getDayOfMonth() <= 15
                    ? ancla.withDayOfMonth(1)
                    : ancla.withDayOfMonth(16)).atStartOfDay();
            case MENSUAL  -> ancla.withDayOfMonth(1).atStartOfDay();
        };
    }

    public LocalDateTime fin() {
        return switch (tipo) {
            case DIARIA   -> ancla.atTime(23, 59, 59);
            case SEMANAL  -> ancla.with(DayOfWeek.SUNDAY).atTime(23, 59, 59);
            case QUINCENAL -> (ancla.getDayOfMonth() <= 15
                    ? ancla.withDayOfMonth(15)
                    : YearMonth.from(ancla).atEndOfMonth()).atTime(23, 59, 59);
            case MENSUAL  -> YearMonth.from(ancla).atEndOfMonth().atTime(23, 59, 59);
        };
    }

    public YearMonth mesFiscal() {
        return YearMonth.from(inicio());
    }

    public Periodicidad tipo() { return tipo; }

    public boolean yaCerro() {
        return LocalDate.now().isAfter(fin().toLocalDate());
    }

    public boolean contiene(LocalDateTime dt) {
        return dt != null && !dt.isBefore(inicio()) && !dt.isAfter(fin());
    }

    public PeriodoFiscal anterior() {
        return switch (tipo) {
            case DIARIA   -> de(tipo, ancla.minusDays(1));
            case SEMANAL  -> de(tipo, ancla.minusWeeks(1));
            case QUINCENAL -> (ancla.getDayOfMonth() <= 15)
                    ? de(tipo, ancla.minusMonths(1).withDayOfMonth(16))
                    : de(tipo, ancla.withDayOfMonth(1));
            case MENSUAL  -> de(tipo, ancla.minusMonths(1));
        };
    }

    @Override
    public String toString() {
        return tipo.getLetra() + ":" + inicio().toLocalDate();
    }

    public String etiqueta() {
        LocalDate ini = inicio().toLocalDate();
        LocalDate fn  = fin().toLocalDate();
        return switch (tipo) {
            case DIARIA -> "el " + ini.getDayOfMonth() + " de " + MESES[ini.getMonthValue()]
                    + " de " + ini.getYear();
            case SEMANAL -> "la semana del " + ini.getDayOfMonth() + " al "
                    + fn.getDayOfMonth() + " de " + MESES[fn.getMonthValue()]
                    + " de " + fn.getYear();
            case QUINCENAL -> {
                String ord = (ini.getDayOfMonth() == 1) ? "1ª" : "2ª";
                yield ord + " quincena de " + MESES[ini.getMonthValue()] + " " + ini.getYear();
            }
            case MENSUAL -> MESES[ini.getMonthValue()] + " " + ini.getYear();
        };
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PeriodoFiscal p)) return false;
        return tipo == p.tipo && inicio().equals(p.inicio());
    }

    @Override
    public int hashCode() {
        return Objects.hash(tipo, inicio());
    }

    @Override
    public int compareTo(PeriodoFiscal o) {
        return this.inicio().compareTo(o.inicio());
    }
}
