package com.moneysnapshot.shared.normalization;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class NameNormalizationServiceTest {

    private final NameNormalizationService service = new NameNormalizationService();

    @Test
    void normalizesPolishCharacters() {
        assertThat(service.normalize("Zażółć gęślą jaźń")).isEqualTo("zazolc-gesla-jazn");
    }

    @Test
    void replacesSeparatorsAndNonPrintableCharactersWithHyphens() {
        assertThat(service.normalize("Bank Nowy\tTest\nDrugi")).isEqualTo("bank-nowy-test-drugi");
    }

    @Test
    void trimsAndCollapsesHyphens() {
        assertThat(service.normalize("  Łódź   Śląsk  ")).isEqualTo("lodz-slask");
    }

    @Test
    void handlesNullValue() {
        assertThat(service.normalize(null)).isEmpty();
    }
}
