package com.moneysnapshot.savings;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SavingsForecastMonthValueRepository extends JpaRepository<SavingsForecastMonthValue, UUID> {

    @Query("""
            select monthValue
            from SavingsForecastMonthValue monthValue
            join fetch monthValue.entry entry
            where entry.run.id = :runId
            order by monthValue.forecastMonth, entry.account.name
            """)
    List<SavingsForecastMonthValue> findAllByRunIdOrderByForecastMonthAndAccountName(@Param("runId") UUID runId);
}
