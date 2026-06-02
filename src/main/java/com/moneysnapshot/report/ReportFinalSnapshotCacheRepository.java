package com.moneysnapshot.report;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface ReportFinalSnapshotCacheRepository extends JpaRepository<ReportFinalSnapshotCache, UUID> {

    @Modifying
    int deleteByOwnerId(UUID ownerId);

    boolean existsByOwnerId(UUID ownerId);

    List<ReportFinalSnapshotCache> findAllByOwnerIdAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
            UUID ownerId,
            LocalDate fromDate,
            LocalDate toDate
    );
}
