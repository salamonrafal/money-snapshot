package com.moneysnapshot.report;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportDailyBalanceCacheRepository extends JpaRepository<ReportDailyBalanceCache, UUID> {

    boolean existsByOwnerIdAndBalanceDate(UUID ownerId, LocalDate balanceDate);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete
            from ReportDailyBalanceCache entry
            where entry.owner.id = :ownerId
            """)
    int deleteByOwnerId(@Param("ownerId") UUID ownerId);

    List<ReportDailyBalanceCache> findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
            UUID ownerId,
            LocalDate fromDate,
            LocalDate toDate
    );

    List<ReportDailyBalanceCache> findAllByOwnerIdAndBalanceDateOrderByAccountNameAsc(UUID ownerId, LocalDate balanceDate);

    @Query("""
            select max(entry.balanceDate)
            from ReportDailyBalanceCache entry
            where entry.owner.id = :ownerId
                and entry.balanceDate <= :balanceDate
            """)
    Optional<LocalDate> findLatestBalanceDateOnOrBefore(
            @Param("ownerId") UUID ownerId,
            @Param("balanceDate") LocalDate balanceDate
    );

    @Query("""
            select count(distinct entry.account.id)
            from ReportDailyBalanceCache entry
            where entry.owner.id = :ownerId
                and entry.balanceDate = :balanceDate
                and entry.account.showInSnapshots = true
            """)
    long countTrackedAccountsVisibleInSnapshots(@Param("ownerId") UUID ownerId, @Param("balanceDate") LocalDate balanceDate);
}
