package com.moneysnapshot.report;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

public interface ReportAverageContributionCacheRepository extends JpaRepository<ReportAverageContributionCache, UUID> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("""
            delete
            from ReportAverageContributionCache entry
            where entry.owner.id = :ownerId
            """)
    int deleteByOwnerId(@Param("ownerId") UUID ownerId);

    List<ReportAverageContributionCache> findAllByOwnerIdOrderByAccountNameAsc(UUID ownerId);
}
