package com.moneysnapshot.liability;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LiabilityRepository extends JpaRepository<Liability, UUID> {

    @Query("""
            select liability
            from Liability liability
            join fetch liability.bank
            join fetch liability.owner
            where liability.id = :id and liability.owner.id = :ownerId
            """)
    Optional<Liability> findByIdAndOwnerId(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    Optional<Liability> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    @Query("""
            select liability
            from Liability liability
            where liability.owner.id = :ownerId
              and liability.normalizedName = :normalizedName
              and liability.id <> :id
            """)
    Optional<Liability> findByOwnerIdAndNormalizedNameAndIdNot(
            @Param("ownerId") UUID ownerId,
            @Param("normalizedName") String normalizedName,
            @Param("id") UUID id
    );

    @Query("""
            select liability
            from Liability liability
            join fetch liability.bank
            join fetch liability.owner
            where liability.owner.id = :ownerId
            order by liability.bank.name, liability.name
            """)
    List<Liability> findAllByOwnerIdOrderByBankNameAndName(@Param("ownerId") UUID ownerId);

    long deleteByOwnerId(UUID ownerId);

    long deleteByBankId(UUID bankId);
}
