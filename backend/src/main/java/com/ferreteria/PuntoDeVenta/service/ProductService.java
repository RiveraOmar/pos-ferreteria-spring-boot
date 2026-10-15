package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.Util.PriceEncoder;
import com.ferreteria.PuntoDeVenta.dto.ProductFullDetailsDTO;
import com.ferreteria.PuntoDeVenta.dto.ProductResponseDTO;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.Inventory;
import com.ferreteria.PuntoDeVenta.model.PriceHistory;
import com.ferreteria.PuntoDeVenta.model.Product;
import com.ferreteria.PuntoDeVenta.model.SupplierProduct;
import com.ferreteria.PuntoDeVenta.repository.CategoryRepository;
import com.ferreteria.PuntoDeVenta.repository.InventoryRepository;
import com.ferreteria.PuntoDeVenta.repository.PriceHistoryRepository;
import com.ferreteria.PuntoDeVenta.repository.ProductRepository;
import com.ferreteria.PuntoDeVenta.repository.ProductImageRepository;
import com.ferreteria.PuntoDeVenta.repository.SaleItemRepository;
import com.ferreteria.PuntoDeVenta.repository.PrefacturaItemRepository;
import com.ferreteria.PuntoDeVenta.repository.PurchaseOrderItemRepository;
import com.ferreteria.PuntoDeVenta.repository.SupplierProductRepository;
import com.ferreteria.PuntoDeVenta.repository.SupplierRepository;
import com.ferreteria.PuntoDeVenta.model.Supplier;
import com.ferreteria.PuntoDeVenta.model.Category;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Comparator;
import java.util.Arrays;
import java.text.Normalizer;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final CategoryRepository categoryRepository;
    private final InventoryService inventoryService;
    private final CategoryService categoryService;
    private final PriceHistoryRepository priceHistoryRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final SupplierRepository supplierRepository;
    private final ProductImageRepository productImageRepository;
    private final SaleItemRepository saleItemRepository;
    private final PrefacturaItemRepository prefacturaItemRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;

    private static final Set<String> UNIDADES_DECIMALES = new HashSet<>(List.of(
            "MTR", "KGM", "GRM", "LTR", "MLT", "CMT", "MTK", "DMT",
            "DMQ", "HLT", "TNE", "MGM", "H87P"
    ));

    private boolean esDecimal(String claveUnidad) {
        return claveUnidad != null && UNIDADES_DECIMALES.contains(claveUnidad.toUpperCase());
    }

    private String etiquetaUnidad(String claveUnidad) {
        if (claveUnidad == null) return "pza";
        return switch (claveUnidad.toUpperCase()) {
            case "MTR" -> "m";
            case "CMT" -> "cm";
            case "MMT" -> "mm";
            case "MTK" -> "m²";
            case "KGM" -> "kg";
            case "GRM" -> "g";
            case "MGM" -> "mg";
            case "TNE" -> "ton";
            case "LTR" -> "L";
            case "MLT" -> "mL";
            case "HLT" -> "hL";
            case "SET" -> "juego";
            case "KT"  -> "kit";
            case "PR"  -> "par";
            case "BX"  -> "caja";
            default -> "pza";
        };
    }

    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getAllActive() {
        return getAll(false);
    }

    public List<ProductResponseDTO> getAll(boolean incluirInactivos) {
        List<Product> productos = incluirInactivos
                ? productRepository.findAll()
                : productRepository.findByActiveTrue();

       List<Inventory> invs = inventoryRepository.findAll();
        Map<Long, BigDecimal> stocks = invs.stream()
                .filter(i -> i.getProduct() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(),
                        i -> i.getStockActual() != null
                                ? i.getStockActual() : BigDecimal.ZERO,
                        (a, b) -> a));
        Map<Long, String> racks = invs.stream()
                .filter(i -> i.getProduct() != null && i.getLocationRack() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(), Inventory::getLocationRack,
                        (a, b) -> a));

        return productos.stream()
                .map(p -> convertToDTO(p,
                        stocks.getOrDefault(p.getId(), BigDecimal.ZERO),
                        racks.get(p.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductResponseDTO> searchProducts(String term) {
        return searchProducts(term, false);
    }

    /**
     * @param incluirInactivos true SOLO desde el módulo de Productos, que
     *        necesita encontrar lo desactivado para poder activarlo. En
     *        Ventas siempre va false: un producto que no manejas no debe
     *        aparecerle al cajero con el cliente enfrente.
     */
    public List<ProductResponseDTO> searchProducts(String term, boolean incluirInactivos) {
        if (term == null || term.isBlank()) return List.of();

        String limpio = normalizar(term);
        if (limpio.isBlank()) return List.of();

        String posibleCodigo = term.trim();

        if (posibleCodigo.length() >= 8 && posibleCodigo.chars().allMatch(Character::isDigit)) {
            List<Product> porBarras = productRepository.findByBarcode(posibleCodigo);
            if (!porBarras.isEmpty()) return convertirConStock(porBarras, incluirInactivos);
        }

        if (posibleCodigo.matches("\\d{4,10}")) {
            List<Product> porTruper = productRepository.findByCodigoTruper(posibleCodigo);
            if (!porTruper.isEmpty()) return convertirConStock(porTruper, incluirInactivos);
        }

        List<Product> porSku = productRepository.findBySkuIgnoreCase(posibleCodigo);
        if (!porSku.isEmpty()) return convertirConStock(porSku, incluirInactivos);

        List<String> encontradas = Arrays.stream(limpio.split("\\s+"))
                .filter(w -> w.length() > 1 && !RELLENO.contains(w))
                .distinct()
                .collect(Collectors.toList());

        final List<String> palabras = encontradas.isEmpty()
                ? List.of(limpio.trim())
                : encontradas;

        String ancla = palabras.stream()
                .max(Comparator.comparingInt(String::length))
                .orElse(limpio);

        List<Product> candidatos = productRepository.searchByTerm(ancla);

        List<Product> filtrados = candidatos.stream()
                .filter(p -> p.getId() > 0)  
                .filter(p -> {
                    
                    String texto = normalizar(
                            (p.getName() == null ? "" : p.getName()) + " " +
                                    (p.getSku()  == null ? "" : p.getSku())  + " " +
                                    (p.getDescription() == null ? "" : p.getDescription()) + " " +
                                    (p.getBarcode() == null ? "" : p.getBarcode()) + " " +
                                    textoAtributos(p));
                    return palabras.stream().allMatch(texto::contains);
                })
                .sorted(Comparator.comparingInt((Product p) -> relevancia(p, palabras))
                        .thenComparing(p -> p.getName() == null ? "" : p.getName()))
                .limit(200)   
                .collect(Collectors.toList());

        return convertirConStock(filtrados, incluirInactivos);
    }

    private String textoAtributos(Product p) {
        if (p.getAttributes() == null || p.getAttributes().isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        p.getAttributes().forEach((k, v) -> {
            sb.append(k).append(' ');
            if (v != null) sb.append(v).append(' ');
        });
        return sb.toString();
    }

    private static final Set<String> RELLENO = Set.of(
            "de", "del", "la", "el", "los", "las", "para", "con", "por",
            "un", "una", "y", "en", "al", "a");

    private String normalizar(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        
        n = n.replace("\u00D7", "x")   
                .replace("\u00F7", "/")  
                .replace("\u2032", "'")  
                .replace("\u2033", "\"") 
                .replace("\u2013", "-")   
                .replace("\u2014", "-")  
                .replace("\u201C", "\"") 
                .replace("\u201D", "\"") 
                .replace("\u2018", "'")  
                .replace("\u2019", "'");  
        return n.toLowerCase().trim();
    }

    private int relevancia(Product p, List<String> palabras) {
        String nombre = normalizar(p.getName());
        String sku    = normalizar(p.getSku());
        String frase  = String.join(" ", palabras);

        if (sku.equals(frase))            return 0;  
        if (nombre.equals(frase))         return 1;  
        if (nombre.startsWith(frase))     return 2;  
        if (sku.startsWith(frase))        return 3;
        if (nombre.contains(frase))       return 4;  
        if (palabras.stream().allMatch(nombre::contains)) return 5; 
        return 6;                                    
    }

    
    private List<ProductResponseDTO> convertirConStock(List<Product> productos) {
        return convertirConStock(productos, false);
    }

    
    private List<ProductResponseDTO> convertirConStock(List<Product> productos,
                                                       boolean incluirInactivos) {
        if (!incluirInactivos) {
            productos = productos.stream().filter(Product::isActive).toList();
        }
        if (productos.isEmpty()) return List.of();
        List<Inventory> invs = inventoryRepository.findAll();
        Map<Long, BigDecimal> stocks = invs.stream()
                .filter(i -> i.getProduct() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(),
                        i -> i.getStockActual() != null ? i.getStockActual() : BigDecimal.ZERO,
                        (a, b) -> a));
        Map<Long, String> racks = invs.stream()
                .filter(i -> i.getProduct() != null && i.getLocationRack() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(), Inventory::getLocationRack, (a, b) -> a));
        return productos.stream()
                .map(p -> convertToDTO(p, stocks.getOrDefault(p.getId(), BigDecimal.ZERO),
                        racks.get(p.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductResponseDTO getById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        return convertToDTO(product);
    }

    public ProductResponseDTO convertToDTO(Product p) {
        BigDecimal stock = inventoryService.getStockStatus(p.getId())
                .map(Inventory::getStockActual).orElse(BigDecimal.ZERO);
        return convertToDTO(p, stock);
    }

    public ProductResponseDTO convertToDTO(Product p, BigDecimal stock) {
        return convertToDTO(p, stock, null);
    }

    public ProductResponseDTO convertToDTO(Product p, BigDecimal stock, String rack) {

        ProductResponseDTO.CategorySlimDTO catDTO = null;
        if (p.getCategory() != null) {
            catDTO = new ProductResponseDTO.CategorySlimDTO(
                    p.getCategory().getId(), p.getCategory().getName());
        }

        BigDecimal price = p.getListPrice() != null ? p.getListPrice() : BigDecimal.ZERO;
        BigDecimal cost  = p.getCostPrice() != null ? p.getCostPrice() : BigDecimal.ZERO;

        return new ProductResponseDTO(
                p.getId(),
                p.getSku(),
                p.getName(),
                p.getDescription(),
                price,
                PriceEncoder.encode(cost),
                stock,
                p.getAttributes(),
                catDTO,
                p.isActive(),
                p.getMinStockLevel(),
                p.getBarcode(),
                p.getSatClaveProdServ(),
                p.getSatClaveUnidad(),
                p.getSatObjetoImp(),
                p.getImagenUrl(),
                rack,
                p.getCompraPorBolsa(),
                p.getPiezasPorBolsa(),
                p.getPrecioBolsa()
        );
    }

    @Transactional

    private void validarPrecios(Product p) {
        if (p.getSku() == null || p.getSku().isBlank())
            throw new IllegalArgumentException("El SKU es obligatorio.");
        if (p.getName() == null || p.getName().isBlank())
            throw new IllegalArgumentException("El nombre del producto es obligatorio.");
        if (p.getListPrice() == null
                || p.getListPrice().compareTo(java.math.BigDecimal.ZERO) <= 0)
            throw new IllegalArgumentException(
                    "El precio de venta debe ser mayor a cero.");
        if (p.getCostPrice() != null
                && p.getCostPrice().compareTo(java.math.BigDecimal.ZERO) < 0)
            throw new IllegalArgumentException(
                    "El costo no puede ser negativo.");
        if (p.getCostPrice() != null
                && p.getListPrice().compareTo(p.getCostPrice()) < 0)
            throw new IllegalArgumentException(
                    "El precio de venta ($" + p.getListPrice()
                            + ") es menor al costo ($" + p.getCostPrice()
                            + "): venderías perdiendo dinero. Corrige uno de los dos.");
    }


    private Category obtenerCategoriaDefault() {
        return categoryRepository.findFirstByNameIgnoreCase("Sin Categoría")
                .orElseGet(() -> {
                    Category c = new Category();
                    c.setName("Sin Categoría");
                    c.setDescription(
                            "Productos pendientes de clasificar. "
                                    + "Asígnales su categoría real al editarlos.");
                    c.setActive(true);
                    return categoryRepository.save(c);
                });
    }

    public Product saveFullProduct(Product product) {
        validarPrecios(product);

        if (product.getCategory() != null && product.getCategory().getId() != null) {
            categoryRepository.findById(product.getCategory().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Categoría inexistente"));
        } else {
            product.setCategory(obtenerCategoriaDefault());
        }
        if (product.getTaxRate() == null) {
            product.setTaxRate(BigDecimal.valueOf(0.16));
        }
        Product saved = productRepository.save(product);
        if (!inventoryRepository.existsByProductId(saved.getId())) {
            Inventory inv = new Inventory();
            inv.setProduct(saved);
            inv.setStockActual(BigDecimal.ZERO);
            inventoryRepository.save(inv);
        }
        return saved;
    }

    @Transactional
    public Product updateProduct(Long id, Product details) {
        validarPrecios(details);
        Product existing = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado: " + id));

        if (details.getListPrice() != null &&
                (existing.getListPrice() == null ||
                        existing.getListPrice().compareTo(details.getListPrice()) != 0)) {
            PriceHistory h = new PriceHistory();
            h.setProduct(existing);
            h.setOldPrice(existing.getListPrice());
            h.setNewPrice(details.getListPrice());
            h.setChangeDate(LocalDateTime.now());
            priceHistoryRepository.save(h);
        }

        existing.setName(details.getName());
        existing.setSku(details.getSku());
        existing.setBarcode(details.getBarcode());
        existing.setDescription(details.getDescription());
        existing.setListPrice(details.getListPrice());
        existing.setCostPrice(details.getCostPrice());
        existing.setMinPrice(details.getMinPrice());
        existing.setMinStockLevel(details.getMinStockLevel());
        existing.setAttributes(details.getAttributes());
        existing.setCategory(
                details.getCategory() != null && details.getCategory().getId() != null
                        ? details.getCategory()
                        : obtenerCategoriaDefault());   
        existing.setTaxRate(details.getTaxRate() != null
                ? details.getTaxRate() : BigDecimal.valueOf(0.16));
        existing.setActive(details.isActive());

        existing.setSatClaveProdServ(details.getSatClaveProdServ());
        existing.setSatClaveUnidad(details.getSatClaveUnidad());
        existing.setSatObjetoImp(details.getSatObjetoImp());
        if (details.getImagenUrl() != null
                && !details.getImagenUrl().isBlank()) {
            existing.setImagenUrl(details.getImagenUrl().trim());
        }
        existing.setCompraPorBolsa(details.getCompraPorBolsa() != null
                && details.getCompraPorBolsa());
        existing.setPiezasPorBolsa(details.getPiezasPorBolsa());
        existing.setCostoBolsa(details.getCostoBolsa());
        existing.setPrecioBolsa(details.getPrecioBolsa());

        return productRepository.save(existing);
    }

    @Transactional
    public void deleteProduct(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No encontrado"));
        if (!p.isActive()) {
            throw new IllegalStateException(
                    "Este producto ya estaba eliminado (inactivo).");
        }
        p.setActive(false);
        productRepository.save(p);
    }

    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getProductsByCategoryRecursive(Long categoryId) {
        List<Long> ids = categoryService.getAllChildIds(categoryId);
        return productRepository.findByCategoryIdIn(ids).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductFullDetailsDTO getFullDetails(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));

        var inventoryOpt = inventoryService.getStockStatus(p.getId());
        BigDecimal stock = inventoryOpt.map(Inventory::getStockActual).orElse(BigDecimal.ZERO);
        String ubicacion = inventoryOpt.map(Inventory::getLocationRack).orElse(null);

        ProductFullDetailsDTO.CategorySlimDTO catDTO = null;
        if (p.getCategory() != null) {
            catDTO = new ProductFullDetailsDTO.CategorySlimDTO(
                    p.getCategory().getId(), p.getCategory().getName());
        }

        List<ProductFullDetailsDTO.PriceChangeDTO> historial =
                priceHistoryRepository.findByProductIdOrderByChangeDateDesc(id).stream()
                        .map(h -> {
                            String direccion;
                            if (h.getOldPrice() == null) {
                                direccion = "SIN_CAMBIO_PREVIO";
                            } else if (h.getNewPrice().compareTo(h.getOldPrice()) > 0) {
                                direccion = "SUBIO";
                            } else if (h.getNewPrice().compareTo(h.getOldPrice()) < 0) {
                                direccion = "BAJO";
                            } else {
                                direccion = "SIN_CAMBIO_PREVIO";
                            }
                            return new ProductFullDetailsDTO.PriceChangeDTO(
                                    h.getChangeDate(), direccion);
                        })
                        .collect(Collectors.toList());

        List<ProductFullDetailsDTO.SupplierForProductDTO> proveedores =
                supplierProductRepository.findByProductIdOrderByLastCostAsc(id).stream()
                        .map((SupplierProduct sp) -> new ProductFullDetailsDTO.SupplierForProductDTO(
                                sp.getSupplier().getId(),
                                sp.getSupplier().getCompanyName(),
                                sp.getSupplier().getPhoneNumber(),
                                sp.getSupplierSku(),
                                sp.getLastPurchaseAt()
                        ))
                        .collect(Collectors.toList());

        return new ProductFullDetailsDTO(
                p.getId(), p.getSku(), p.getName(), p.getDescription(),
                p.getListPrice() != null ? p.getListPrice() : BigDecimal.ZERO,
                stock, p.getAttributes(), catDTO, p.isActive(),
                p.getMinStockLevel() != null
                        ? p.getMinStockLevel() : BigDecimal.ZERO,
                p.getImagenUrl(),
                etiquetaUnidad(p.getSatClaveUnidad()),
                esDecimal(p.getSatClaveUnidad()),
                p.getBarcode(),
                ubicacion,
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getSatClaveProdServ(), p.getSatClaveUnidad(), p.getSatObjetoImp(),
                historial, proveedores,
                p.getCompraPorBolsa(), p.getPiezasPorBolsa(), p.getCostoBolsa(),
                p.getPrecioBolsa()
        );
    }

    
    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> proveedoresDeProducto(Long productId) {
        return supplierProductRepository
                .findByProductIdOrderByLastCostAsc(productId).stream()
                .map(sp -> {
                    java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("supplierId",   sp.getSupplier().getId());
                    m.put("companyName",  sp.getSupplier().getCompanyName());
                    m.put("lastCost",     sp.getLastCost());
                    m.put("supplierSku",  sp.getSupplierSku());
                    m.put("conHistorial", sp.getLastCost() != null);
                    return m;
                }).toList();
    }

    @Transactional
    public List<java.util.Map<String, Object>> asignarProveedores(
            Long productId, List<Long> supplierIds) {

        Product producto = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado: " + productId));
        List<Long> deseados = supplierIds == null ? List.of() : supplierIds;

        List<SupplierProduct> actuales = supplierProductRepository
                .findByProductIdOrderByLastCostAsc(productId);

        for (SupplierProduct sp : actuales) {
            boolean sigue = deseados.contains(sp.getSupplier().getId());
            if (!sigue && sp.getLastCost() == null) {
                supplierProductRepository.delete(sp);
            }
        }

        java.util.Set<Long> yaLigados = actuales.stream()
                .map(sp -> sp.getSupplier().getId())
                .collect(java.util.stream.Collectors.toSet());
        for (Long supplierId : deseados) {
            if (yaLigados.contains(supplierId)) continue;
            Supplier proveedor = supplierRepository.findById(supplierId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Proveedor no encontrado: " + supplierId));
            SupplierProduct nuevo = new SupplierProduct();
            nuevo.setSupplier(proveedor);
            nuevo.setProduct(producto);
            supplierProductRepository.save(nuevo);
        }
        return proveedoresDeProducto(productId);
    }



    private String codigoFabricante(Product p) {
        if (p.getAttributes() == null) return null;
        for (String clave : List.of("codigo_truper", "codigo_fabricante",
                "codigo_fab", "clave_fabricante", "codigo_catalogo")) {
            Object v = p.getAttributes().get(clave);
            if (v != null && !v.toString().isBlank()) return v.toString();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> sugerenciaCompra() {
        List<Product> faltantes = productRepository.findAll().stream()
                .filter(p -> p.getId() != null && p.getId() > 0)
                .filter(Product::isActive)
                .filter(p -> {
                    java.math.BigDecimal stock = inventoryRepository
                            .findByProductId(p.getId())
                            .map(Inventory::getStockActual)
                            .orElse(java.math.BigDecimal.ZERO);
                    java.math.BigDecimal min = p.getMinStockLevel() != null
                            ? p.getMinStockLevel() : java.math.BigDecimal.ZERO;
                    return stock.compareTo(min) <= 0;
                })
                .toList();

        java.util.Map<String, java.util.Map<String, Object>> grupos =
                new java.util.LinkedHashMap<>();

        for (Product p : faltantes) {
            java.math.BigDecimal stock = inventoryRepository
                    .findByProductId(p.getId())
                    .map(Inventory::getStockActual)
                    .orElse(java.math.BigDecimal.ZERO);
            java.math.BigDecimal min = p.getMinStockLevel() != null
                    ? p.getMinStockLevel() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal sugerido = min.multiply(java.math.BigDecimal.TWO)
                    .subtract(stock).max(java.math.BigDecimal.ONE);

            List<SupplierProduct> links = supplierProductRepository
                    .findByProductIdOrderByLastCostAsc(p.getId());

            java.util.function.BiConsumer<String, SupplierProduct> agregar =
                    (clave, sp) -> {
                        java.util.Map<String, Object> g = grupos.computeIfAbsent(clave, k -> {
                            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                            m.put("supplierId",   sp != null ? sp.getSupplier().getId() : null);
                            m.put("supplierName", sp != null
                                    ? sp.getSupplier().getCompanyName() : "SIN PROVEEDOR ASIGNADO");
                            m.put("telefono",     sp != null
                                    ? sp.getSupplier().getPhoneNumber() : null);
                            m.put("productos",    new java.util.ArrayList<java.util.Map<String, Object>>());
                            return m;
                        });
                        java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
                        item.put("productId",  p.getId());
                        item.put("sku",        p.getSku());
                        item.put("name",       p.getName());
                        item.put("stock",      stock);
                        item.put("minStock",   min);
                        item.put("sugerido",   sugerido);
                        item.put("lastCost",   sp != null ? sp.getLastCost() : null);
                        item.put("supplierSku", sp != null ? sp.getSupplierSku() : null);
                        @SuppressWarnings("unchecked")
                        var lista = (java.util.List<java.util.Map<String, Object>>) g.get("productos");
                        lista.add(item);
                    };

            if (links.isEmpty()) {
                agregar.accept("__SIN__", null);
            } else {
                for (SupplierProduct sp : links) {
                    agregar.accept("S" + sp.getSupplier().getId(), sp);
                }
            }
        }
        return new java.util.ArrayList<>(grupos.values());
    }


    @Transactional(readOnly = true)
    public java.util.Map<String, Object> catalogoProveedorParaCompra(Long supplierId) {
        Supplier prov = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Proveedor no encontrado: " + supplierId));

        List<SupplierProduct> links = supplierProductRepository
                .findBySupplierIdOrderByLastPurchaseAtDesc(supplierId);

        java.util.List<java.util.Map<String, Object>> productos = new java.util.ArrayList<>();
        for (SupplierProduct sp : links) {
            Product p = sp.getProduct();
            if (p == null || p.getId() == null || p.getId() <= 0 || !p.isActive())
                continue;

            java.math.BigDecimal stock = inventoryRepository
                    .findByProductId(p.getId())
                    .map(Inventory::getStockActual)
                    .orElse(java.math.BigDecimal.ZERO);
            java.math.BigDecimal min = p.getMinStockLevel() != null
                    ? p.getMinStockLevel() : java.math.BigDecimal.ZERO;

            String urgencia;
            if (stock.signum() == 0)                              urgencia = "agotado";
            else if (stock.compareTo(min) <= 0)                   urgencia = "bajo";
            else if (min.signum() > 0 && stock.compareTo(
                    min.multiply(new java.math.BigDecimal("1.5"))) <= 0)
                urgencia = "proximo";
            else                                                  urgencia = "ok";

            java.math.BigDecimal sugerido = urgencia.equals("ok")
                    ? java.math.BigDecimal.ZERO
                    : min.multiply(java.math.BigDecimal.TWO).subtract(stock)
                    .max(java.math.BigDecimal.ONE);

            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("productId",   p.getId());
            m.put("sku",         p.getSku());
            m.put("name",        p.getName());
            m.put("stock",       stock);
            m.put("minStock",    min);
            m.put("urgencia",    urgencia);
            m.put("sugerido",    sugerido);
            m.put("lastCost",    sp.getLastCost());
            m.put("supplierSku", sp.getSupplierSku());
            m.put("codigoFabricante", codigoFabricante(p));
            productos.add(m);
        }

        java.util.Map<String, Integer> rank = java.util.Map.of(
                "agotado", 0, "bajo", 1, "proximo", 2, "ok", 3);
        productos.sort((a, b) -> Integer.compare(
                rank.get(a.get("urgencia")), rank.get(b.get("urgencia"))));

        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("supplierId",   prov.getId());
        out.put("supplierName", prov.getCompanyName());
        out.put("telefono",     prov.getPhoneNumber());
        out.put("productos",    productos);
        return out;
    }


    @Transactional
    public void borrarPermanente(Long id) {

        Product p = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "El producto no existe o ya fue borrado."));

        if (p.isActive())
            throw new IllegalArgumentException(
                    "Primero desactiva el producto. Solo se borran los que ya "
                            + "estan dados de baja.");

        long enVentas = saleItemRepository.countByProductId(id);
        if (enVentas > 0)
            throw new IllegalArgumentException(
                    "Ya se vendio " + enVentas + " vez(ces). Solo se puede desactivar.");

        if (prefacturaItemRepository.countByProductId(id) > 0)
            throw new IllegalArgumentException(
                    "No se puede borrar: aparece en pre-facturas.");
        if (purchaseOrderItemRepository.countByProductId(id) > 0)
            throw new IllegalArgumentException(
                    "No se puede borrar: aparece en ordenes de compra.");

        productImageRepository.deleteByProductId(id);
        priceHistoryRepository.deleteByProductId(id);
        supplierProductRepository.deleteByProductId(id);
        inventoryRepository.deleteByProductId(id);

        productRepository.delete(p);
    }

    @Transactional
    public int cambiarEstadoMasivo(List<Long> ids, boolean activo) {
        if (ids == null || ids.isEmpty()) return 0;
        if (ids.size() > 5000)
            throw new IllegalArgumentException(
                    "Demasiados productos de un jalon (maximo 5000). Hazlo por partes.");

        List<Product> productos = productRepository.findAllById(ids);
        for (Product p : productos) p.setActive(activo);
        productRepository.saveAll(productos);
        return productos.size();
    }
}