package com.moneysnapshot.savings;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SavingsForecastMonthSummaryRepository extends JpaRepository<SavingsForecastMonthSummary, UUID> {

    @Query("""
            select summary
            from SavingsForecastMonthSummary summary
            where summary.run.id = :runId
            order by summary.forecastMonth, summary.currencyCode
            """)
    List<SavingsForecastMonthSummary> findAllByRunIdOrderByForecastMonthAndCurrencyCode(@Param("runId") UUID runId);
}
