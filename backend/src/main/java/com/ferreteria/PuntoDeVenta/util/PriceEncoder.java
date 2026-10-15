package com.ferreteria.PuntoDeVenta.Util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Random;

public class PriceEncoder {
    private static final String KEY = "MEXICANOS"; // M=1, E=2, X=3... S=9, 0=Random
    private static final String ALPHABET = "ABFGHIJKLNPQRTUVWYZ";
    private static final Random RANDOM = new Random();

    public static String encode(BigDecimal price) {
        if (price == null) return "0000";

        String cleanPrice = price.setScale(2, RoundingMode.HALF_UP).toString().replace(".", "");
        StringBuilder encoded = new StringBuilder();

        for (char digitChar : cleanPrice.toCharArray()) {
            int digit = Character.getNumericValue(digitChar);
            if (digit == 0) {
                encoded.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            } else {
                encoded.append(KEY.charAt(digit - 1));
            }
        }

        if (encoded.length() > 2) {
            encoded.insert(encoded.length() - 2, ".");
        }
        return encoded.toString();
    }
}