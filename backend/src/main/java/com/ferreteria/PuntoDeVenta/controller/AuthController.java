package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public record LoginRequest(String username, String password) {}

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest req) {
        try {
            authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.username(), req.password()));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Usuario o contraseña incorrectos"));
        }

        UserDetails user = userDetailsService.loadUserByUsername(req.username());
        String token = jwtService.generarToken(user);

        List<String> roles = user.getAuthorities().stream()
                .map(a -> a.getAuthority()).toList();

        Map<String, Object> r = new HashMap<>();
        r.put("token", token);
        r.put("username", user.getUsername());
        r.put("roles", roles);
        return ResponseEntity.ok(r);
    }

    /** Permite al frontend verificar si su token sigue vigente. */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        if (auth == null || !auth.startsWith("Bearer "))
            return ResponseEntity.status(401).body(Map.of("error", "Sin token"));
        try {
            String usuario = jwtService.extraerUsuario(auth.substring(7));
            UserDetails user = userDetailsService.loadUserByUsername(usuario);
            if (!jwtService.esValido(auth.substring(7), user))
                return ResponseEntity.status(401).body(Map.of("error", "Token expirado"));
            return ResponseEntity.ok(Map.of(
                    "username", user.getUsername(),
                    "roles", user.getAuthorities().stream().map(a -> a.getAuthority()).toList()));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Token inválido"));
        }
    }
}