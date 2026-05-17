package com.moneysnapshot.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BankRepository extends JpaRepository<Bank, UUID> {

    Optional<Bank> findByIdAndOwnerId(UUID id, UUID ownerId);
    Optional<Bank> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);
    List<Bank> findAllByOwnerIdOrderByName(UUID ownerId);
    long deleteByOwnerId(UUID ownerId);
}
