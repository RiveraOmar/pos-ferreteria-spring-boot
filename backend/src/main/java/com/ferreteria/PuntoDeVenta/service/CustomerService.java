package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.model.Customer;
import com.ferreteria.PuntoDeVenta.repository.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CustomerService {

    @Autowired
    private CustomerRepository customerRepository;


    @Transactional(readOnly = true)
    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Customer getCustomerById(Long id) {
        return customerRepository.findById(id).orElse(null);
    }


    @Transactional
    public Customer saveCustomer(Customer customer) {
        // ── Validación y normalización del RFC ───────────────────────────
        // El RFC ahora DECIDE cosas fiscales: 12 caracteres = persona moral
        // → retención ISR 1.25% automática en sus facturas. Un RFC mal
        // capturado activaría (o dejaría de activar) la retención, y el PAC
        // rechazaría el CFDI 4.0 si el RFC no existe o no coincide.
        if (customer.getRfc() != null && !customer.getRfc().isBlank()) {
            String rfc = customer.getRfc().trim().toUpperCase();
            // Persona moral: 3 letras + fecha(6) + homoclave(3) = 12
            // Persona física: 4 letras + fecha(6) + homoclave(3) = 13
            if (!rfc.matches("^[A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3}$")) {
                throw new IllegalArgumentException(
                        "El RFC '" + rfc + "' no tiene un formato válido. "
                                + "Debe ser de 13 caracteres (persona física) o "
                                + "12 (empresa), ej. XAXX010101AAA o ABC010101XY9. "
                                + "Verifícalo en la constancia de situación fiscal "
                                + "del cliente.");
            }
            customer.setRfc(rfc); // guardar normalizado en mayúsculas
        }

        if (customer.getId() == null) {
            customer.setCreatedAt(LocalDateTime.now());
            if (customer.getActive() == null) {
                customer.setActive(true);
            }
        }
        return customerRepository.save(customer);
    }


    @Transactional
    public void deleteCustomer(Long id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
        // Evita "eliminar" dos veces el mismo cliente (doble clic, dos
        // pestañas abiertas, etc.) con un mensaje claro en vez de un
        // "éxito" silencioso que no dice nada.
        if (Boolean.FALSE.equals(customer.getActive())) {
            throw new IllegalStateException(
                    "Este cliente ya estaba eliminado (inactivo).");
        }
        customer.setActive(false);
        customerRepository.save(customer);
    }


    @Transactional(readOnly = true)
    public List<Customer> getActiveCustomers() {
        return customerRepository.findAllActive();
    }

    @Transactional(readOnly = true)
    public List<Customer> getInactiveCustomers() {
        return customerRepository.findAll().stream()
                .filter(c -> !c.getActive())
                .collect(Collectors.toList());
    }

    @Transactional
    public void setActiveStatus(Long id, boolean status) {
        if (!customerRepository.existsById(id)) {
            throw new RuntimeException("Cliente no encontrado");
        }
        customerRepository.updateActiveStatus(id, status);
    }

    @Transactional(readOnly = true)
    public List<Customer> searchCustomers(String term, boolean active) {
        if (active) {
            return customerRepository.findByNameLoose(term);
        } else {
            return customerRepository.findByNameInactiveLoose(term);
        }
    }
}