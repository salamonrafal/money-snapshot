package com.moneysnapshot.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BankAccountNumbersTest {

    @Test
    void acceptsValidPolishBankAccountNumberWithoutCountryPrefix() {
        assertThat(BankAccountNumbers.isValid("61109010140000071219812874")).isTrue();
    }

    @Test
    void acceptsValidPolishIbanWithCountryPrefix() {
        assertThat(BankAccountNumbers.isValid("PL61109010140000071219812874")).isTrue();
    }

    @Test
    void acceptsValidPolishIbanWithSpaces() {
        assertThat(BankAccountNumbers.isValid("PL61 1090 1014 0000 0712 1981 2874")).isTrue();
    }

    @Test
    void rejectsInvalidBankAccountNumber() {
        assertThat(BankAccountNumbers.isValid("61109010140000071219812875")).isFalse();
    }

    @Test
    void normalizesByRemovingSpaces() {
        assertThat(BankAccountNumbers.normalize("PL61 1090 1014 0000 0712 1981 2874"))
                .isEqualTo("PL61109010140000071219812874");
    }
}
