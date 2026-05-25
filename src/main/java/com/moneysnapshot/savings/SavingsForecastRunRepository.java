package com.moneysnapshot.savings;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavingsForecastRunRepository extends JpaRepository<SavingsForecastRun, UUID> {

    Optional<SavingsForecastRun> findFirstByOwnerIdOrderByGeneratedAtDesc(UUID ownerId);

    long deleteByOwnerId(UUID ownerId);
}
