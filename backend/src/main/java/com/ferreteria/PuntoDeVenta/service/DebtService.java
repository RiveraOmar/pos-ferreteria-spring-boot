package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.DebtRequestDTO;
import com.ferreteria.PuntoDeVenta.dto.DebtResponseDTO;
import com.ferreteria.PuntoDeVenta.dto.PaymentRequestDTO;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.Customer;
import com.ferreteria.PuntoDeVenta.model.Debt;
import com.ferreteria.PuntoDeVenta.model.Sale;
import com.ferreteria.PuntoDeVenta.repository.CustomerRepository;
import com.ferreteria.PuntoDeVenta.repository.DebtRepository;
import com.ferreteria.PuntoDeVenta.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import com.ferreteria.PuntoDeVenta.model.DebtPayment;
import com.ferreteria.PuntoDeVenta.repository.DebtPaymentRepository;
import com.ferreteria.PuntoDeVenta.dto.DebtPaymentDTO;
import com.ferreteria.PuntoDeVenta.dto.AgregarItemsDebtDTO;
import com.ferreteria.PuntoDeVenta.dto.LibretaEntryDTO;
import com.ferreteria.PuntoDeVenta.model.SaleItem;
import java.util.ArrayList;
import java.util.Comparator;
@Service
@RequiredArgsConstructor
public class DebtService {

    private final DebtRepository debtRepository;
    private final CustomerRepository customerRepository;
    private final SaleRepository saleRepository;
    private final DebtPaymentRepository debtPaymentRepository;
    private final SaleService saleService;
    @Transactional
    public DebtResponseDTO createDebt(DebtRequestDTO request) {
        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado"));

        Debt debt = new Debt();
        debt.setCustomer(customer);
        debt.setTotalAmount(request.totalAmount());
        debt.setPaidAmount(BigDecimal.ZERO);
        debt.setRemainingAmount(request.totalAmount());
        debt.setStatus("PENDING");
        debt.setNotes(request.notes());
        debt.setCreatedAt(LocalDateTime.now());
        debt.setUpdatedAt(LocalDateTime.now());

        if (request.saleId() != null) {
            Sale sale = saleRepository.findById(request.saleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada"));
            debt.setSale(sale);
        }

        return toDTO(debtRepository.save(debt));
    }


    @Transactional
    public DebtResponseDTO applyPayment(Long debtId, PaymentRequestDTO request) {
        Debt debt = debtRepository.findById(debtId)
                .orElseThrow(() -> new ResourceNotFoundException("Deuda no encontrada"));

        if (debt.getStatus().equals("PAID")) {
            throw new RuntimeException("Esta deuda ya está liquidada.");
        }

        BigDecimal newPaid      = debt.getPaidAmount().add(request.amount());
        BigDecimal newRemaining = debt.getTotalAmount().subtract(newPaid);

        if (newPaid.compareTo(debt.getTotalAmount()) > 0) {
            throw new RuntimeException("El pago excede el monto total de la deuda.");
        }

        debt.setPaidAmount(newPaid);
        debt.setRemainingAmount(newRemaining.max(BigDecimal.ZERO));
        debt.setUpdatedAt(LocalDateTime.now());
        debt.setStatus(newRemaining.compareTo(BigDecimal.ZERO) <= 0 ? "PAID" : "PARTIAL");

        DebtPayment pago = new DebtPayment();
        pago.setDebt(debt);
        pago.setAmount(request.amount());
        pago.setNotes(request.notes());
        pago.setPaymentDate(LocalDateTime.now());
        debtPaymentRepository.save(pago);

        return toDTO(debtRepository.save(debt));
    }
    @Transactional(readOnly = true)
    public List<DebtResponseDTO> getAllPending() {
        return debtRepository.findAllPending().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DebtResponseDTO> getByCustomer(Long customerId) {
        return debtRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DebtPaymentDTO> getPaymentHistory(Long debtId) {
        return debtPaymentRepository.findByDebtIdOrderByPaymentDateDesc(debtId)
                .stream()
                .map(p -> new DebtPaymentDTO(p.getId(), p.getAmount(), p.getNotes(), p.getPaymentDate()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BigDecimal getTotalDebtByCustomer(Long customerId) {
        BigDecimal total = debtRepository.sumRemainingByCustomer(customerId);
        return total != null ? total : BigDecimal.ZERO;
    }



    @Transactional
    public DebtResponseDTO agregarItems(Long debtId, AgregarItemsDebtDTO request) {
        Debt debt = debtRepository.findById(debtId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Deuda no encontrada: " + debtId));

        if ("PAID".equals(debt.getStatus()))
            throw new IllegalStateException("La nota ya está liquidada; abre una nueva.");
        if (debt.getSale() == null)
            throw new IllegalStateException("La nota no tiene venta vinculada.");

        BigDecimal delta = saleService.addItemsToSale(
                debt.getSale().getId(), request.items(), request.nota());

        debt.setTotalAmount(debt.getTotalAmount().add(delta));
        debt.setRemainingAmount(debt.getRemainingAmount().add(delta));
        debt.setStatus(debt.getPaidAmount() != null
                && debt.getPaidAmount().compareTo(BigDecimal.ZERO) > 0
                ? "PARTIAL" : "PENDING");

        if (request.nota() != null && !request.nota().isBlank()) {
            debt.setNotes(debt.getNotes() == null || debt.getNotes().isBlank()
                    ? request.nota()
                    : debt.getNotes() + " | " + request.nota());
        }
        debt.setUpdatedAt(LocalDateTime.now());
        return toDTO(debtRepository.save(debt));
    }


    @Transactional(readOnly = true)
    public List<LibretaEntryDTO> getLibretaCliente(Long customerId) {
        List<Debt> deudas = debtRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);
        List<LibretaEntryDTO> entradas = new ArrayList<>();

        for (Debt d : deudas) {
            String folio = d.getSale() != null ? d.getSale().getInvoiceNumber() : null;

            if (d.getSale() != null && d.getSale().getItems() != null) {
                for (SaleItem item : d.getSale().getItems()) {
                    String nombre = (item.getCustomName() != null && !item.getCustomName().isBlank())
                            ? item.getCustomName()
                            : (item.getProduct() != null ? item.getProduct().getName() : "Producto");
                    BigDecimal cant = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE;
                    BigDecimal pu   = item.getUnitPrice()  != null ? item.getUnitPrice()  : BigDecimal.ZERO;
                    BigDecimal subtotal = pu.multiply(cant);

                    String cantTxt = cant.stripTrailingZeros().toPlainString();
                    entradas.add(new LibretaEntryDTO(
                            "CARGO",
                            item.getAddedAt() != null ? item.getAddedAt() : d.getCreatedAt(),
                            nombre,
                            cantTxt + " x $" + pu.setScale(2, java.math.RoundingMode.HALF_UP),
                            subtotal,
                            folio, d.getId(), d.getStatus()
                    ));
                }
            } else {
                entradas.add(new LibretaEntryDTO(
                        "CARGO", d.getCreatedAt(),
                        d.getNotes() != null && !d.getNotes().isBlank() ? d.getNotes() : "Nota de fiado",
                        null, d.getTotalAmount(), folio, d.getId(), d.getStatus()
                ));
            }

            List<DebtPayment> pagos = debtPaymentRepository.findByDebtIdOrderByPaymentDateDesc(d.getId());
            for (DebtPayment p : pagos) {
                entradas.add(new LibretaEntryDTO(
                        "ABONO", p.getPaymentDate(),
                        "Abono a cuenta",
                        p.getNotes(), p.getAmount(), folio, d.getId(), d.getStatus()
                ));
            }
        }

       entradas.sort(Comparator.comparing(LibretaEntryDTO::fecha).reversed());
        return entradas;
    }

    private DebtResponseDTO toDTO(Debt d) {
        return new DebtResponseDTO(
                d.getId(),
                d.getCustomer().getId(),
                d.getCustomer().getFullName(),
                d.getCustomer().getPhoneNumber(),
                d.getSale() != null ? d.getSale().getId() : null,
                d.getSale() != null ? d.getSale().getInvoiceNumber() : null,
                d.getTotalAmount(),
                d.getPaidAmount(),
                d.getRemainingAmount(),
                d.getStatus(),
                d.getNotes(),
                d.getCreatedAt(),
                d.getUpdatedAt()
        );
    }
}