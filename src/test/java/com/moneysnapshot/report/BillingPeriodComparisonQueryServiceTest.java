package com.moneysnapshot.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BillingPeriodComparisonQueryServiceTest {

    @Test
    void comparisonReadsAtMostSixPeriodsFromCache() {
        ReportBillingPeriodComparisonCacheRepository repository = mock(ReportBillingPeriodComparisonCacheRepository.class);
        ReportCacheRefreshService refreshService = mock(ReportCacheRefreshService.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportBillingPeriodComparisonCache cached = new ReportBillingPeriodComparisonCache(
                owner, 1, LocalDate.of(2026, 4, 2), LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 2), LocalDate.of(2026, 6, 1), "PLN",
                new BigDecimal("20"), new BigDecimal("40"), new BigDecimal("-20"), new BigDecimal("-50")
        );
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(repository.findAllByOwnerIdAndPeriodIndexLessThanEqualOrderByPeriodIndexAscCurrencyCodeAsc(ownerId, 6))
                .thenReturn(List.of(cached));
        BillingPeriodComparisonQueryService service = new BillingPeriodComparisonQueryService(
                repository, refreshService, currentUserService,
                Clock.fixed(Instant.parse("2026-06-03T00:00:00Z"), ZoneOffset.UTC)
        );

        var response = service.comparison(20);

        verify(refreshService).ensureOwnerCacheReady(ownerId, LocalDate.of(2026, 6, 3));
        assertThat(response.rows()).hasSize(1);
        assertThat(response.rows().get(0).difference()).isEqualByComparingTo("-20");
    }
}
