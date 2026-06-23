package com.moneysnapshot.bill;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BillScheduleEntryRepository extends JpaRepository<BillScheduleEntry, UUID> {

    @Query("""
            select entry
            from BillScheduleEntry entry
            where entry.bill.id = :billId
              and entry.owner.id = :ownerId
              and entry.dueDate >= :dueDate
            order by entry.dueDate asc, entry.installmentNumber asc
            """)
    Page<BillScheduleEntry> findUpcomingPageByBillIdAndOwnerId(
            @Param("billId") UUID billId,
            @Param("ownerId") UUID ownerId,
            @Param("dueDate") LocalDate dueDate,
            Pageable pageable
    );

    @Query("""
            select entry
            from BillScheduleEntry entry
            where entry.id = :id and entry.bill.id = :billId and entry.owner.id = :ownerId
            """)
    Optional<BillScheduleEntry> findByIdAndBillIdAndOwnerId(
            @Param("id") UUID id,
            @Param("billId") UUID billId,
            @Param("ownerId") UUID ownerId
    );

    Optional<BillScheduleEntry> findFirstByBillIdAndOwnerIdOrderByDueDateDescInstallmentNumberDesc(UUID billId, UUID ownerId);

    long countByBillId(UUID billId);

    long countByBillIdAndOwnerIdAndDueDateGreaterThanEqual(UUID billId, UUID ownerId, LocalDate dueDate);

    boolean existsByBillIdAndOwnerIdAndDueDateGreaterThanEqual(UUID billId, UUID ownerId, LocalDate dueDate);

    @Modifying
    void deleteByBillId(UUID billId);

    @Modifying
    void deleteByBillIdAndDueDateGreaterThanEqual(UUID billId, LocalDate dueDate);

    @Modifying
    void deleteByBillIdAndDueDateGreaterThanEqualAndPaidFalse(UUID billId, LocalDate dueDate);

    List<BillScheduleEntry> findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(UUID billId);
}
