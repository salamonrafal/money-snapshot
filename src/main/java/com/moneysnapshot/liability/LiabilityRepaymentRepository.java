package com.moneysnapshot.liability;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LiabilityRepaymentRepository extends JpaRepository<LiabilityRepayment, UUID> {

    @Query("""
            select repayment
            from LiabilityRepayment repayment
            join fetch repayment.liability liability
            join fetch liability.bank
            where repayment.owner.id = :ownerId
            order by liability.name, repayment.repaymentDate desc, repayment.createdAt desc
            """)
    List<LiabilityRepayment> findAllByOwnerIdOrderByLiabilityNameAndRepaymentDateDesc(@Param("ownerId") UUID ownerId);

    @Query("""
            select repayment
            from LiabilityRepayment repayment
            join fetch repayment.liability liability
            join fetch liability.bank
            where repayment.liability.id = :liabilityId
            order by repayment.repaymentDate desc, repayment.createdAt desc
            """)
    List<LiabilityRepayment> findAllByLiabilityIdOrderByRepaymentDateDesc(@Param("liabilityId") UUID liabilityId);

    @Query("""
            select repayment
            from LiabilityRepayment repayment
            join fetch repayment.liability liability
            join fetch liability.bank
            where repayment.liability.id = :liabilityId
            order by repayment.repaymentDate asc, repayment.createdAt asc
            """)
    List<LiabilityRepayment> findAllByLiabilityIdOrderByRepaymentDateAsc(@Param("liabilityId") UUID liabilityId);

    @Query("""
            select repayment
            from LiabilityRepayment repayment
            join fetch repayment.liability liability
            join fetch liability.bank
            where repayment.id = :repaymentId and repayment.owner.id = :ownerId
            """)
    java.util.Optional<LiabilityRepayment> findByIdAndOwnerId(@Param("repaymentId") UUID repaymentId, @Param("ownerId") UUID ownerId);

    @Modifying
    int deleteByOwnerId(UUID ownerId);
}
