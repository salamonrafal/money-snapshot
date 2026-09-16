package com.moneysnapshot.retirement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RetirementAccountContributionRepository extends JpaRepository<RetirementAccountContribution, UUID> {

    @Query("""
            select contribution
            from RetirementAccountContribution contribution
            join fetch contribution.retirementAccount account
            where contribution.owner.id = :ownerId
            order by contribution.contributionDate desc, contribution.createdAt desc
            """)
    List<RetirementAccountContribution> findAllByOwnerIdOrderByContributionDateDesc(@Param("ownerId") UUID ownerId);

    @Query("""
            select contribution
            from RetirementAccountContribution contribution
            join fetch contribution.retirementAccount account
            where account.id = :accountId and contribution.owner.id = :ownerId
            order by contribution.contributionDate desc, contribution.createdAt desc
            """)
    List<RetirementAccountContribution> findAllByAccountIdAndOwnerIdOrderByContributionDateDesc(
            @Param("accountId") UUID accountId,
            @Param("ownerId") UUID ownerId
    );
}
