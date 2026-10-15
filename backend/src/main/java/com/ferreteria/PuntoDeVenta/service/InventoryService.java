package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.InventoryAdjustmentDTO;
import com.ferreteria.PuntoDeVenta.dto.InventoryRequestDTO;
import com.ferreteria.PuntoDeVenta.dto.StockMasivoDTO;
import com.ferreteria.PuntoDeVenta.exception.InsufficientStockException;
import com.ferreteria.PuntoDeVenta.model.Inventory;
import com.ferreteria.PuntoDeVenta.model.InventoryAdjustment;
import com.ferreteria.PuntoDeVenta.model.Product;
import com.ferreteria.PuntoDeVenta.repository.InventoryAdjustmentRepository;
import com.ferreteria.PuntoDeVenta.repository.InventoryRepository;
import com.ferreteria.PuntoDeVenta.repository.ProductRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final InventoryAdjustmentRepository adjustmentRepository;
    private final ProductRepository productRepository;

    private static final BigDecimal MAX_STOCK_MASIVO = new BigDecimal("100000");

    @Transactional(readOnly = true)
    public boolean hasEnoughStock(Long productId, BigDecimal quantityRequested) {
        return inventoryRepository.findByProductId(productId)
                .map(inv -> inv.getStockActual().compareTo(quantityRequested) >= 0)
                .orElse(false);
    }

    @Transactional
    public boolean deductStock(Long productId, BigDecimal quantityToDeduct) {
        Inventory inventory = inventoryRepository.findByProductIdWithLock(productId)
                .orElseThrow(() -> new RuntimeException(
                        "El producto con ID " + productId + " no existe en el inventario."));

        if (inventory.getStockActual().compareTo(quantityToDeduct) < 0) {
            throw new InsufficientStockException(
                    "No hay suficiente stock. Disponible: "
                            + inventory.getStockActual()
                            + ", Solicitado: " + quantityToDeduct);
        }

        inventory.setStockActual(inventory.getStockActual().subtract(quantityToDeduct));
        inventoryRepository.save(inventory);
        return inventory.isLowStock();
    }

    public Optional<Inventory> getStockStatus(Long productId) {
        return inventoryRepository.findByProductId(productId);
    }

    @Transactional
    public void addStock(Long productId, InventoryRequestDTO request) {
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new RuntimeException(
                        "Producto con ID " + productId + " no encontrado"));

        inventory.setStockActual(inventory.getStockActual().add(request.quantityToAdd()));
        inventory.setLastRestock(LocalDateTime.now());

        if (request.location() != null) {
            inventory.setLocationRack(request.location());
        }

        Product product = inventory.getProduct();

        java.math.BigDecimal costoFinal  = request.newCostPrice() != null
                ? request.newCostPrice() : product.getCostPrice();
        java.math.BigDecimal precioFinal = request.newListPrice() != null
                ? request.newListPrice() : product.getListPrice();

        boolean permitido = Boolean.TRUE.equals(request.allowLoss());
        if (!permitido && costoFinal != null && precioFinal != null
                && precioFinal.compareTo(costoFinal) < 0) {
            throw new IllegalArgumentException(
                    "PRECIO_BAJO_COSTO: El precio de venta quedaría por debajo "
                            + "del costo del producto (se vendería con pérdida).");
        }

        if (request.newCostPrice() != null) product.setCostPrice(request.newCostPrice());
        if (request.newListPrice() != null) {
            product.setListPrice(request.newListPrice());
            if (product.getMinPrice() != null
                    && product.getMinPrice().compareTo(request.newListPrice()) > 0) {
                product.setMinPrice(request.newListPrice());
            }
        }

        inventoryRepository.save(inventory);
    }

    @Transactional
    public Map<String, Object> establecerStockMasivo(StockMasivoDTO request) {

        BigDecimal cantidad = request.cantidad();
        if (cantidad == null)
            throw new IllegalArgumentException(
                    "Falta la cantidad de piezas a cargar (ej. 100).");
        if (cantidad.compareTo(BigDecimal.ZERO) < 0)
            throw new IllegalArgumentException(
                    "La cantidad no puede ser negativa. Si no hay piezas, pon 0.");
        if (cantidad.compareTo(MAX_STOCK_MASIVO) > 0)
            throw new IllegalArgumentException(
                    "La cantidad es demasiado alta (máximo "
                            + MAX_STOCK_MASIVO.toPlainString() + " por producto). "
                            + "¿Se te fue un cero de más?");

        boolean soloEnCero       = !Boolean.FALSE.equals(request.soloEnCero());
        boolean incluirInactivos = Boolean.TRUE.equals(request.incluirInactivos());
        String motivo = (request.motivo() != null && !request.motivo().isBlank())
                ? request.motivo()
                : "Carga masiva de existencias para facturación";
        String usuario = usuarioActual();
        LocalDateTime ahora = LocalDateTime.now();

        List<Product> productos = productRepository.findAll().stream()
                .filter(p -> incluirInactivos || p.isActive())
                .toList();

        List<Inventory> aGuardar          = new ArrayList<>();
        List<InventoryAdjustment> bitacora = new ArrayList<>();
        int creados = 0, actualizados = 0, sinCambio = 0, respetados = 0;

        for (Product p : productos) {
            Optional<Inventory> opt = inventoryRepository.findByProductId(p.getId());

            if (opt.isEmpty()) {
                Inventory nuevo = new Inventory();
                nuevo.setProduct(p);
                nuevo.setStockActual(cantidad);
                nuevo.setStockMinimo(p.getMinStockLevel() != null
                        ? p.getMinStockLevel() : new BigDecimal("5"));
                nuevo.setLastRestock(ahora);
                aGuardar.add(nuevo);
                bitacora.add(nuevoAjuste(p, BigDecimal.ZERO, cantidad,
                        motivo + " (alta de inventario)", usuario, ahora));
                creados++;
                continue;
            }

            Inventory inv  = opt.get();
            BigDecimal antes = inv.getStockActual() != null
                    ? inv.getStockActual() : BigDecimal.ZERO;

            if (soloEnCero && antes.compareTo(BigDecimal.ZERO) > 0) {
                respetados++;
                continue;
            }
            if (antes.compareTo(cantidad) == 0) { sinCambio++; continue; }

            inv.setStockActual(cantidad);
            inv.setLastRestock(ahora);
            aGuardar.add(inv);
            bitacora.add(nuevoAjuste(p, antes, cantidad, motivo, usuario, ahora));
            actualizados++;
        }

        inventoryRepository.saveAll(aGuardar);
        adjustmentRepository.saveAll(bitacora);

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("cantidad",       cantidad);
        r.put("soloEnCero",     soloEnCero);
        r.put("productos",      productos.size());
        r.put("creados",        creados);       
        r.put("actualizados",   actualizados);
        r.put("sinCambio",      sinCambio);     
        r.put("respetados",     respetados);    
        r.put("mensaje", (creados + actualizados) + " producto(s) quedaron con "
                + cantidad.stripTrailingZeros().toPlainString() + " piezas.");
        log.info("[STOCK-MASIVO] {} productos revisados — {} creados, {} "
                        + "actualizados, {} respetados (soloEnCero={}), por {}",
                productos.size(), creados, actualizados, respetados,
                soloEnCero, usuario);
        return r;
    }

    private InventoryAdjustment nuevoAjuste(Product p, BigDecimal antes,
                                            BigDecimal despues, String motivo,
                                            String usuario, LocalDateTime fecha) {
        InventoryAdjustment a = new InventoryAdjustment();
        a.setProduct(p);
        a.setCantidadAntes(antes);
        a.setCantidadDespues(despues);
        a.setDiferencia(despues.subtract(antes));
        a.setMotivo(motivo);
        a.setUsuario(usuario);
        a.setFecha(fecha);
        return a;
    }

    @Transactional
    public InventoryAdjustment adjustStock(Long productId, InventoryAdjustmentDTO request) {

        if (request.cantidadReal() == null)
            throw new IllegalArgumentException("Falta la cantidad real contada.");

        if (request.cantidadReal().compareTo(BigDecimal.ZERO) < 0)
            throw new IllegalArgumentException(
                    "La cantidad no puede ser negativa. Si no hay ninguna pieza, pon 0.");

        if (request.motivo() == null || request.motivo().isBlank())
            throw new IllegalArgumentException(
                    "Indica el motivo del ajuste (conteo, merma, error de captura...).");

        Inventory inventory = inventoryRepository.findByProductIdWithLock(productId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "El producto no tiene registro de inventario."));

        BigDecimal antes   = inventory.getStockActual();
        BigDecimal despues = request.cantidadReal();

        if (antes.compareTo(despues) == 0)
            throw new IllegalArgumentException(
                    "La cantidad es la misma que ya tenía el sistema: no hay nada que ajustar.");

        inventory.setStockActual(despues);
        inventoryRepository.save(inventory);

        InventoryAdjustment ajuste = new InventoryAdjustment();
        ajuste.setProduct(inventory.getProduct());
        ajuste.setCantidadAntes(antes);
        ajuste.setCantidadDespues(despues);
        ajuste.setDiferencia(despues.subtract(antes));
        ajuste.setMotivo(request.motivo());
        ajuste.setNota(request.nota());
        ajuste.setUsuario(usuarioActual());
        ajuste.setFecha(LocalDateTime.now());
        return adjustmentRepository.save(ajuste);
    }

    @Transactional(readOnly = true)
    public java.util.List<InventoryAdjustment> historialAjustes(Long productId) {
        return adjustmentRepository.findByProductIdOrderByFechaDesc(productId);
    }

   private String usuarioActual() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            return (auth != null && auth.getName() != null) ? auth.getName() : "desconocido";
        } catch (Exception e) {
            return "desconocido";
        }
    }
}