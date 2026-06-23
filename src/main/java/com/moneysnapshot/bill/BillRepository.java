package com.moneysnapshot.bill;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BillRepository extends JpaRepository<Bill, UUID> {

    @Query("""
            select bill
            from Bill bill
            join fetch bill.account account
            join fetch bill.counterparty counterparty
            where bill.owner.id = :ownerId
            order by bill.repaymentDay asc, bill.name asc
            """)
    List<Bill> findAllByOwnerIdOrderByRepaymentDayAndName(@Param("ownerId") UUID ownerId);

    @Query("""
            select bill
            from Bill bill
            join fetch bill.account account
            join fetch bill.counterparty counterparty
            where bill.id = :id and bill.owner.id = :ownerId
            """)
    Optional<Bill> findByIdAndOwnerId(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    @Query("""
            select bill
            from Bill bill
            join fetch bill.account account
            join fetch bill.counterparty counterparty
            where bill.id = :id
            """)
    Optional<Bill> findByIdWithAccountAndCounterparty(@Param("id") UUID id);

    Optional<Bill> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    boolean existsByCounterpartyIdAndOwnerId(UUID counterpartyId, UUID ownerId);

    boolean existsByAccountIdAndOwnerId(UUID accountId, UUID ownerId);

    List<Bill> findAllByAccountId(UUID accountId);
}
