package com.moneysnapshot.counterparty;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CounterpartyRepository extends JpaRepository<Counterparty, UUID> {

    Optional<Counterparty> findByIdAndOwnerId(UUID id, UUID ownerId);

    Optional<Counterparty> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    @Query("select counterparty from Counterparty counterparty where counterparty.owner.id = :ownerId order by counterparty.name")
    List<Counterparty> findAllByOwnerIdOrderByName(@Param("ownerId") UUID ownerId);
}
