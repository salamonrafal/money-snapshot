package com.moneysnapshot.report;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportCacheRefreshStateRepository extends JpaRepository<ReportCacheRefreshState, UUID> {

    Optional<ReportCacheRefreshState> findByOwnerId(UUID ownerId);

    List<ReportCacheRefreshState> findTop20ByDirtyTrueOrderByRefreshRequestedAtAsc();
}
