package com.moneysnapshot.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BankRepository extends JpaRepository<Bank, UUID> {

    @Query("select bank from Bank bank join fetch bank.owner where bank.id = :id and bank.owner.id = :ownerId")
    Optional<Bank> findByIdAndOwnerId(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    Optional<Bank> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    @Query("select bank from Bank bank join fetch bank.owner where bank.owner.id = :ownerId order by bank.name")
    List<Bank> findAllByOwnerIdOrderByName(@Param("ownerId") UUID ownerId);

    long deleteByOwnerId(UUID ownerId);
}
