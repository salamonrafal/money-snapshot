package com.moneysnapshot.savings;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SavingsForecastEntryRepository extends JpaRepository<SavingsForecastEntry, UUID> {

    @Query("""
            select entry
            from SavingsForecastEntry entry
            join fetch entry.account account
            join fetch account.bank
            where entry.run.id = :runId
            order by account.name
            """)
    List<SavingsForecastEntry> findAllByRunIdWithAccountOrderByAccountName(@Param("runId") UUID runId);
}
