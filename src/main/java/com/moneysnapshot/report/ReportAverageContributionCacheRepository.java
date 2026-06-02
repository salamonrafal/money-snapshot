package com.moneysnapshot.report;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface ReportAverageContributionCacheRepository extends JpaRepository<ReportAverageContributionCache, UUID> {

    @Modifying
    int deleteByOwnerId(UUID ownerId);

    List<ReportAverageContributionCache> findAllByOwnerIdOrderByAccountNameAsc(UUID ownerId);
}
