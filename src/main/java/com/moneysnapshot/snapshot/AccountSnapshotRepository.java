package com.moneysnapshot.snapshot;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountSnapshotRepository extends JpaRepository<AccountSnapshot, UUID> {

    boolean existsByAccountIdAndSnapshotDate(UUID accountId, LocalDate snapshotDate);

    boolean existsByOwnerId(UUID ownerId);

    boolean existsByOwnerIdAndSnapshotType(UUID ownerId, SnapshotType snapshotType);

    @Query("select snapshot from AccountSnapshot snapshot join fetch snapshot.account account join fetch account.bank order by snapshot.snapshotDate desc, account.name")
    List<AccountSnapshot> findAllWithAccountOrderBySnapshotDateDesc();

    @Query("select snapshot from AccountSnapshot snapshot join fetch snapshot.account account join fetch account.bank where snapshot.owner.id = :ownerId order by snapshot.snapshotDate desc, account.name")
    List<AccountSnapshot> findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(@Param("ownerId") UUID ownerId);

    @Query("""
            select snapshot
            from AccountSnapshot snapshot
            join fetch snapshot.account account
            join fetch account.bank
            where snapshot.owner.id = :ownerId
            order by snapshot.snapshotDate asc, account.name
            """)
    List<AccountSnapshot> findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(@Param("ownerId") UUID ownerId);

    @Query("""
            select snapshot
            from AccountSnapshot snapshot
            join fetch snapshot.account account
            join fetch account.bank
            where account.id = :accountId
                and snapshot.owner.id = :ownerId
            order by snapshot.snapshotDate desc, account.name
            """)
    List<AccountSnapshot> findAllByAccountIdAndOwnerIdWithAccountOrderBySnapshotDateDesc(
            @Param("accountId") UUID accountId,
            @Param("ownerId") UUID ownerId
    );

    @Query("""
            select snapshot
            from AccountSnapshot snapshot
            join fetch snapshot.account account
            join fetch account.bank
            where snapshot.owner.id = :ownerId
                and snapshot.snapshotDate = :snapshotDate
            order by snapshot.snapshotDate desc, account.name
            """)
    List<AccountSnapshot> findAllByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
            @Param("ownerId") UUID ownerId,
            @Param("snapshotDate") LocalDate snapshotDate
    );

    @Query("""
            select snapshot
            from AccountSnapshot snapshot
            join fetch snapshot.account account
            join fetch account.bank
            where snapshot.owner.id = :ownerId
                and account.id = :accountId
                and snapshot.snapshotDate = :snapshotDate
            order by snapshot.snapshotDate desc, account.name
            """)
    List<AccountSnapshot> findAllByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
            @Param("accountId") UUID accountId,
            @Param("ownerId") UUID ownerId,
            @Param("snapshotDate") LocalDate snapshotDate
    );

    @Query(
            value = "select snapshot from AccountSnapshot snapshot join fetch snapshot.account account join fetch account.bank order by snapshot.snapshotDate desc, account.name",
            countQuery = "select count(snapshot) from AccountSnapshot snapshot"
    )
    Page<AccountSnapshot> findPageWithAccountOrderBySnapshotDateDesc(Pageable pageable);

    @Query(
            value = "select snapshot from AccountSnapshot snapshot join fetch snapshot.account account join fetch account.bank where snapshot.owner.id = :ownerId order by snapshot.snapshotDate desc, account.name",
            countQuery = "select count(snapshot) from AccountSnapshot snapshot where snapshot.owner.id = :ownerId"
    )
    Page<AccountSnapshot> findPageByOwnerIdWithAccountOrderBySnapshotDateDesc(@Param("ownerId") UUID ownerId, Pageable pageable);

    @Query(
            value = "select snapshot from AccountSnapshot snapshot join fetch snapshot.account account join fetch account.bank where account.id = :accountId and (:ownerId is null or snapshot.owner.id = :ownerId) order by snapshot.snapshotDate desc, account.name",
            countQuery = "select count(snapshot) from AccountSnapshot snapshot where snapshot.account.id = :accountId and (:ownerId is null or snapshot.owner.id = :ownerId)"
    )
    Page<AccountSnapshot> findPageByAccountIdWithAccountOrderBySnapshotDateDesc(@Param("accountId") UUID accountId, @Param("ownerId") UUID ownerId, Pageable pageable);

    @Query(
            value = """
                    select snapshot
                    from AccountSnapshot snapshot
                    join fetch snapshot.account account
                    join fetch account.bank
                    where snapshot.owner.id = :ownerId
                        and snapshot.snapshotDate = :snapshotDate
                    order by snapshot.snapshotDate desc, account.name
                    """,
            countQuery = """
                    select count(snapshot)
                    from AccountSnapshot snapshot
                    where snapshot.owner.id = :ownerId
                        and snapshot.snapshotDate = :snapshotDate
                    """
    )
    Page<AccountSnapshot> findPageByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
            @Param("ownerId") UUID ownerId,
            @Param("snapshotDate") LocalDate snapshotDate,
            Pageable pageable
    );

    @Query(
            value = """
                    select snapshot
                    from AccountSnapshot snapshot
                    join fetch snapshot.account account
                    join fetch account.bank
                    where snapshot.owner.id = :ownerId
                        and account.id = :accountId
                        and snapshot.snapshotDate = :snapshotDate
                    order by snapshot.snapshotDate desc, account.name
                    """,
            countQuery = """
                    select count(snapshot)
                    from AccountSnapshot snapshot
                    where snapshot.owner.id = :ownerId
                        and snapshot.account.id = :accountId
                        and snapshot.snapshotDate = :snapshotDate
                    """
    )
    Page<AccountSnapshot> findPageByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
            @Param("accountId") UUID accountId,
            @Param("ownerId") UUID ownerId,
            @Param("snapshotDate") LocalDate snapshotDate,
            Pageable pageable
    );

    @Query("select snapshot from AccountSnapshot snapshot join fetch snapshot.account account join fetch account.bank where snapshot.id = :id")
    Optional<AccountSnapshot> findByIdWithAccount(@Param("id") UUID id);

    @Query("select snapshot from AccountSnapshot snapshot join fetch snapshot.account account join fetch account.bank where snapshot.id = :id and snapshot.owner.id = :ownerId")
    Optional<AccountSnapshot> findByIdAndOwnerIdWithAccount(@Param("id") UUID id, @Param("ownerId") UUID ownerId);

    Optional<AccountSnapshot> findByAccountIdAndSnapshotDate(UUID accountId, LocalDate snapshotDate);

    @Modifying
    int deleteByAccountId(UUID accountId);

    @Modifying
    int deleteByOwnerId(UUID ownerId);

    @Query("select count(distinct snapshot.account.id) from AccountSnapshot snapshot")
    long countAccountsWithSnapshots();

    @Query("select count(distinct snapshot.account.id) from AccountSnapshot snapshot where snapshot.owner.id = :ownerId")
    long countAccountsWithSnapshotsByOwnerId(@Param("ownerId") UUID ownerId);

    @Query("""
            select new com.moneysnapshot.snapshot.CurrencyAmount(account.currencyCode, sum(snapshot.balance))
            from AccountSnapshot snapshot
            join snapshot.account account
            where snapshot.snapshotDate = (
                select max(candidate.snapshotDate)
                from AccountSnapshot candidate
                where candidate.account = snapshot.account
            )
            group by account.currencyCode
            order by account.currencyCode
            """)
    List<CurrencyAmount> sumLatestBalancesByCurrency();

    @Query("""
            select new com.moneysnapshot.snapshot.CurrencyAmount(account.currencyCode, sum(snapshot.balance))
            from AccountSnapshot snapshot
            join snapshot.account account
            where snapshot.owner.id = :ownerId
                and snapshot.snapshotDate = (
                    select max(candidate.snapshotDate)
                    from AccountSnapshot candidate
                    where candidate.account = snapshot.account
                        and candidate.owner.id = :ownerId
                )
            group by account.currencyCode
            order by account.currencyCode
            """)
    List<CurrencyAmount> sumLatestBalancesByOwnerIdAndCurrency(@Param("ownerId") UUID ownerId);

    @Query("""
            select new com.moneysnapshot.snapshot.CurrencyAmount(account.currencyCode, sum(snapshot.balance))
            from AccountSnapshot snapshot
            join snapshot.account account
            where snapshot.snapshotDate = (
                select max(candidate.snapshotDate)
                from AccountSnapshot candidate
                where candidate.account = snapshot.account
                    and candidate.snapshotDate < :beforeDate
            )
            group by account.currencyCode
            order by account.currencyCode
            """)
    List<CurrencyAmount> sumLatestBalancesBeforeDateByCurrency(@Param("beforeDate") LocalDate beforeDate);

    @Query("""
            select new com.moneysnapshot.snapshot.CurrencyAmount(account.currencyCode, sum(snapshot.balance))
            from AccountSnapshot snapshot
            join snapshot.account account
            where snapshot.owner.id = :ownerId
                and snapshot.snapshotDate = (
                    select max(candidate.snapshotDate)
                    from AccountSnapshot candidate
                    where candidate.account = snapshot.account
                        and candidate.owner.id = :ownerId
                        and candidate.snapshotDate < :beforeDate
                )
            group by account.currencyCode
            order by account.currencyCode
            """)
    List<CurrencyAmount> sumLatestBalancesBeforeDateByOwnerIdAndCurrency(@Param("ownerId") UUID ownerId, @Param("beforeDate") LocalDate beforeDate);

    @Query("""
            select snapshot
            from AccountSnapshot snapshot
            join fetch snapshot.account account
            join fetch account.bank
            where snapshot.owner.id = :ownerId
                and snapshot.snapshotDate = (
                    select max(candidate.snapshotDate)
                    from AccountSnapshot candidate
                    where candidate.account = snapshot.account
                        and candidate.owner.id = :ownerId
                        and candidate.snapshotDate <= :beforeOrOnDate
                )
            order by account.name
            """)
    List<AccountSnapshot> findLatestByOwnerIdBeforeOrOnDateWithAccountOrderByAccountName(
            @Param("ownerId") UUID ownerId,
            @Param("beforeOrOnDate") LocalDate beforeOrOnDate
    );

    @Modifying
    @Query("""
            delete from AccountSnapshot snapshot
            where snapshot.account.id in (
                select account.id
                from Account account
                where account.bank.id = :bankId
            )
            """)
    int deleteByBankId(@Param("bankId") UUID bankId);
}
