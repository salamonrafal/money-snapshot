package com.moneysnapshot.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    boolean existsByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    Optional<Account> findByOwnerIdAndNormalizedName(UUID ownerId, String normalizedName);

    @Query("select account from Account account join fetch account.bank left join fetch account.owner where account.id = :id")
    Optional<Account> findByIdWithBank(@Param("id") UUID id);

    @Query("select account from Account account join fetch account.bank join fetch account.owner where account.id = :id and account.owner.id = :ownerId")
    Optional<Account> findByIdAndOwnerIdWithBank(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    @Query("select account from Account account join fetch account.bank left join fetch account.owner order by account.name")
    List<Account> findAllWithBankOrderByName();

    @Query("select account from Account account join fetch account.bank left join fetch account.owner where account.owner.id = :ownerId order by account.name")
    List<Account> findAllByOwnerIdWithBankOrderByName(@Param("ownerId") UUID ownerId);

    @Query("""
            select count(account)
            from Account account
            where account.owner.id = :ownerId
                and account.showInSnapshots = true
            """)
    long countTrackedAccountsVisibleInSnapshotsByOwnerId(@Param("ownerId") UUID ownerId);

    @Query("""
            select count(account)
            from Account account
            where account.owner.id = :ownerId
                and account.showInSnapshots = true
                and not exists (
                    select snapshot.id
                    from AccountSnapshot snapshot
                    where snapshot.account = account
                        and snapshot.owner.id = :ownerId
                        and snapshot.snapshotType = :snapshotType
                        and snapshot.snapshotDate between :fromDate and :toDate
                )
            """)
    long countTrackedAccountsWithoutSnapshotTypeInPeriod(
            @Param("ownerId") UUID ownerId,
            @Param("snapshotType") com.moneysnapshot.snapshot.SnapshotType snapshotType,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

    @Query("""
            select account.name
            from Account account
            where account.owner.id = :ownerId
                and account.showInSnapshots = true
                and not exists (
                    select snapshot.id
                    from AccountSnapshot snapshot
                    where snapshot.account = account
                        and snapshot.owner.id = :ownerId
                        and snapshot.snapshotType = :snapshotType
                        and snapshot.snapshotDate between :fromDate and :toDate
                )
            order by account.name
            """)
    List<String> findTrackedAccountNamesWithoutSnapshotTypeInPeriod(
            @Param("ownerId") UUID ownerId,
            @Param("snapshotType") com.moneysnapshot.snapshot.SnapshotType snapshotType,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

    @Modifying
    long deleteByBankId(UUID bankId);

    @Modifying
    long deleteByOwnerId(UUID ownerId);
}
