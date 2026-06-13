package com.moneysnapshot.liability.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.moneysnapshot.account.Bank;
import com.moneysnapshot.liability.Liability;
import com.moneysnapshot.liability.LiabilityStatus;
import com.moneysnapshot.liability.LiabilityTypeCode;
import com.moneysnapshot.security.AppUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class LiabilityResponseTest {

    @Test
    void creditCardPaidAmountUsesRepaymentTotalInsteadOfLimitMinusDebt() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        setEntityField(bank, "id", UUID.randomUUID());
        Liability liability = new Liability(
                bank,
                owner,
                "Credit card",
                "credit-card",
                LiabilityTypeCode.CREDIT_CARD,
                "PLN",
                new BigDecimal("10000"),
                new BigDecimal("900"),
                null,
                new BigDecimal("10000"),
                new BigDecimal("50"),
                LocalDate.of(2026, 6, 1),
                null,
                null,
                10,
                null,
                null,
                LiabilityStatus.ACTIVE
        );
        setEntityField(liability, "id", UUID.randomUUID());

        LiabilityResponse response = LiabilityResponse.from(liability, List.of(
                repaymentResponse(new BigDecimal("100")),
                repaymentResponse(new BigDecimal("150"))
        ));

        assertThat(response.paidAmount()).isEqualByComparingTo("250");
    }

    @Test
    void loanPaidAmountUsesOriginalMinusCurrentAmount() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        setEntityField(bank, "id", UUID.randomUUID());
        Liability liability = new Liability(
                bank,
                owner,
                "Loan",
                "loan",
                LiabilityTypeCode.MORTGAGE,
                "PLN",
                new BigDecimal("10000"),
                new BigDecimal("8500"),
                new BigDecimal("500"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2030, 6, 1),
                null,
                10,
                null,
                null,
                LiabilityStatus.ACTIVE
        );
        setEntityField(liability, "id", UUID.randomUUID());

        LiabilityResponse response = LiabilityResponse.from(liability, List.of(repaymentResponse(new BigDecimal("200"))));

        assertThat(response.paidAmount()).isEqualByComparingTo("1500");
    }

    private LiabilityRepaymentResponse repaymentResponse(BigDecimal amount) {
        return new LiabilityRepaymentResponse(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Liability",
                "Bank",
                LocalDate.of(2026, 6, 1),
                BigDecimal.ZERO,
                amount,
                null,
                null,
                null
        );
    }

    private static void setEntityField(Object target, String name, Object value) {
        ReflectionTestUtils.setField(target, name, value);
    }
}
