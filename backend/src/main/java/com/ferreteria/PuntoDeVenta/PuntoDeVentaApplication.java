package com.ferreteria.PuntoDeVenta;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling // habilita tareas programadas (timbrado automático de la global)
public class PuntoDeVentaApplication {

	public static void main(String[] args) {
		// Forzar zona horaria Sinaloa (UTC-7) en toda la JVM
		TimeZone.setDefault(TimeZone.getTimeZone("America/Mazatlan"));
		SpringApplication.run(PuntoDeVentaApplication.class, args);
	}
}