package com.moneysnapshot.report;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportPeriodComparisonCacheRepository extends JpaRepository<ReportPeriodComparisonCache, UUID> {
    boolean existsByOwnerId(UUID ownerId);
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ReportPeriodComparisonCache entry where entry.owner.id = :ownerId")
    int deleteByOwnerId(@Param("ownerId") UUID ownerId);
    List<ReportPeriodComparisonCache> findAllByOwnerIdOrderByPeriodIndexAscPointDateAscCurrencyCodeAsc(UUID ownerId);
}
