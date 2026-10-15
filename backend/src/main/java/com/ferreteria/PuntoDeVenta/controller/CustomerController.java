package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.CustomerRequestDTO;
import com.ferreteria.PuntoDeVenta.dto.CustomerResponseDTO;
import com.ferreteria.PuntoDeVenta.model.Customer;
import com.ferreteria.PuntoDeVenta.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/customers")
@CrossOrigin(origins = "*")
public class CustomerController {

    @Autowired
    private CustomerService customerService;

    @Operation(summary = "Lista de clientes")
    @GetMapping
    public ResponseEntity<List<CustomerResponseDTO>> getAll(
            @RequestParam(required = false, defaultValue = "true") boolean active) {
        List<Customer> customers = active
                ? customerService.getActiveCustomers()
                : customerService.getInactiveCustomers();
        return ResponseEntity.ok(customers.stream().map(this::convertToDTO).collect(Collectors.toList()));
    }

    @Operation(summary = "Obtener cliente por ID")
    @GetMapping("/{id}")
    public ResponseEntity<CustomerResponseDTO> getById(@PathVariable Long id) {
        Customer customer = customerService.getCustomerById(id);
        if (customer == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(convertToDTO(customer));
    }

    @Operation(summary = "Alta de cliente")
    @PostMapping
    public ResponseEntity<CustomerResponseDTO> create(@Valid @RequestBody CustomerRequestDTO dto) {
        Customer customer = new Customer();
        mapDtoToEntity(dto, customer);
        return new ResponseEntity<>(convertToDTO(customerService.saveCustomer(customer)), HttpStatus.CREATED);
    }

    @Operation(summary = "Modificar cliente")
    @PutMapping("/{id}")
    public ResponseEntity<CustomerResponseDTO> update(
            @PathVariable Long id, @Valid @RequestBody CustomerRequestDTO dto) {
        Customer existing = customerService.getCustomerById(id);
        if (existing == null) return ResponseEntity.notFound().build();
        mapDtoToEntity(dto, existing);
        return ResponseEntity.ok(convertToDTO(customerService.saveCustomer(existing)));
    }

    @Operation(summary = "Eliminar cliente")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (customerService.getCustomerById(id) == null) return ResponseEntity.notFound().build();
        customerService.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/active")
    public ResponseEntity<Void> updateStatus(@PathVariable Long id, @RequestParam boolean status) {
        customerService.setActiveStatus(id, status);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Buscar clientes")
    @GetMapping("/search")
    public ResponseEntity<List<CustomerResponseDTO>> search(
            @RequestParam String term,
            @RequestParam(required = false, defaultValue = "true") boolean active) {
        return ResponseEntity.ok(
                customerService.searchCustomers(term, active).stream()
                        .map(this::convertToDTO).collect(Collectors.toList()));
    }

    // ── Mapeos ────────────────────────────────────────────────

    private CustomerResponseDTO convertToDTO(Customer c) {
        return new CustomerResponseDTO(
                c.getId(), c.getFullName(), c.getRfc(), c.getEmail(),
                c.getPhoneNumber(), c.getCustomerType(), c.getDiscountRate(),
                c.getCreatedAt(), c.getActive(), c.getAddress(), c.getCity(),
                c.getRazonSocial(), c.getRegimenFiscal(), c.getUsoCfdi(),
                c.getCodigoPostal(), c.getSatPais()
        );
    }

    private void mapDtoToEntity(CustomerRequestDTO dto, Customer c) {
        c.setFullName(dto.fullName());
        c.setRfc(dto.rfc());
        c.setEmail(dto.email());
        c.setPhoneNumber(dto.phoneNumber());
        c.setAddress(dto.address());
        c.setCity(dto.city());
        c.setCustomerType(dto.customerType());
        c.setDiscountRate(dto.discountRate());
        c.setRazonSocial(dto.razonSocial());
        c.setRegimenFiscal(dto.regimenFiscal());
        c.setUsoCfdi(dto.usoCfdi());
        c.setCodigoPostal(dto.codigoPostal());
        c.setSatPais(dto.satPais());
    }
}