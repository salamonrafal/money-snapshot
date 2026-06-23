package com.moneysnapshot.shared.validation;

public final class BankAccountNumbers {

    private BankAccountNumbers() {
    }

    public static String normalize(String value) {
        if (value == null) {
            return null;
        }

        return value.replaceAll("\\s+", "").toUpperCase();
    }

    public static boolean isValid(String value) {
        String normalized = normalize(value);
        if (normalized == null || normalized.isBlank()) {
            return false;
        }

        String iban = normalized;
        if (normalized.matches("\\d{26}")) {
            iban = "PL" + normalized;
        } else if (!normalized.matches("PL\\d{26}")) {
            return false;
        }

        return ibanMod97(iban) == 1;
    }

    private static int ibanMod97(String iban) {
        String rearranged = iban.substring(4) + iban.substring(0, 4);
        int remainder = 0;

        for (int index = 0; index < rearranged.length(); index++) {
            char character = rearranged.charAt(index);
            if (Character.isDigit(character)) {
                remainder = (remainder * 10 + (character - '0')) % 97;
                continue;
            }

            if (!Character.isLetter(character)) {
                return -1;
            }

            int value = Character.toUpperCase(character) - 'A' + 10;
            remainder = (remainder * 10 + (value / 10)) % 97;
            remainder = (remainder * 10 + (value % 10)) % 97;
        }

        return remainder;
    }
}
