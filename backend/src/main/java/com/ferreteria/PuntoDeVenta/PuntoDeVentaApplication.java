package com.ferreteria.PuntoDeVenta;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling 
public class PuntoDeVentaApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("America/Mazatlan"));
		SpringApplication.run(PuntoDeVentaApplication.class, args);
	}
}