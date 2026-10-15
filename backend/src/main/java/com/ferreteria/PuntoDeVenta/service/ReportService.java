package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.DailyReportDTO;
import com.ferreteria.PuntoDeVenta.model.Sale;
import com.ferreteria.PuntoDeVenta.model.SaleItem;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final com.ferreteria.PuntoDeVenta.repository.SaleRepository saleRepository;

    public DailyReportDTO generateDailyReport(LocalDateTime date) {
        LocalDateTime start = date.with(LocalTime.MIN);
        LocalDateTime end   = date.with(LocalTime.MAX);

        List<Sale> todasLasVentas = saleRepository.findByCreatedAtBetween(start, end);

        List<Sale> ventasActivas = todasLasVentas.stream()
                .filter(s -> s.getStatus() != null
                        && !s.getStatus().equals("CANCELLED"))
                .collect(Collectors.toList());

        long count = ventasActivas.size();

        BigDecimal grossRevenue = ventasActivas.stream()
                .map(s -> s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCost = ventasActivas.stream()
                .flatMap(s -> s.getItems().stream())
                .map(item -> {
                    BigDecimal costo = item.getCostAtSale() != null
                            ? item.getCostAtSale()
                            : BigDecimal.ZERO;
                    BigDecimal qty = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ZERO;
                    return costo.multiply(qty);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netProfit = grossRevenue.subtract(totalCost);

        Map<String, BigDecimal> topProducts = ventasActivas.stream()
                .flatMap(s -> s.getItems().stream())
                .filter(item -> item.getProduct() != null)
                .collect(Collectors.groupingBy(
                        item -> item.getProduct().getName(),
                        Collectors.reducing(BigDecimal.ZERO,
                                item -> item.getQuantity() != null ? item.getQuantity() : BigDecimal.ZERO,
                                BigDecimal::add)
                ));
        return new DailyReportDTO(count, grossRevenue, totalCost, netProfit, topProducts);
    }
}