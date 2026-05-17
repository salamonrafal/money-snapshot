package com.moneysnapshot.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    boolean existsByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    Optional<Account> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    @Query("select account from Account account join fetch account.bank where account.id = :id")
    Optional<Account> findByIdWithBank(@Param("id") UUID id);

    @Query("select account from Account account join fetch account.bank where account.id = :id and account.owner.id = :ownerId")
    Optional<Account> findByIdAndOwnerIdWithBank(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    @Query("select account from Account account join fetch account.bank order by account.name")
    List<Account> findAllWithBankOrderByName();

    @Query("select account from Account account join fetch account.bank where account.owner.id = :ownerId order by account.name")
    List<Account> findAllByOwnerIdWithBankOrderByName(@Param("ownerId") UUID ownerId);

    @Modifying
    long deleteByBankId(UUID bankId);

    @Modifying
    long deleteByOwnerId(UUID ownerId);
}
