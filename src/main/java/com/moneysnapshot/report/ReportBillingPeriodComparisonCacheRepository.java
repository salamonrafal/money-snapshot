package com.moneysnapshot.report;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportBillingPeriodComparisonCacheRepository
        extends JpaRepository<ReportBillingPeriodComparisonCache, UUID> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ReportBillingPeriodComparisonCache entry where entry.owner.id = :ownerId")
    int deleteByOwnerId(@Param("ownerId") UUID ownerId);

    List<ReportBillingPeriodComparisonCache> findAllByOwnerIdAndPeriodIndexLessThanEqualOrderByPeriodIndexAscCurrencyCodeAsc(
            UUID ownerId,
            int periodIndex
    );
}
