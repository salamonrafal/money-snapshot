package com.moneysnapshot.retirement;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RetirementAccountRepository extends JpaRepository<RetirementAccount, UUID> {

    boolean existsByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    Optional<RetirementAccount> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    @Query("select account from RetirementAccount account join fetch account.owner where account.id = :id and account.owner.id = :ownerId")
    Optional<RetirementAccount> findByIdAndOwnerId(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select account from RetirementAccount account join fetch account.owner where account.id = :id and account.owner.id = :ownerId")
    Optional<RetirementAccount> findByIdAndOwnerIdForUpdate(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    @Query("select account from RetirementAccount account join fetch account.owner where account.owner.id = :ownerId order by account.name")
    List<RetirementAccount> findAllByOwnerIdOrderByName(@Param("ownerId") UUID ownerId);
}
