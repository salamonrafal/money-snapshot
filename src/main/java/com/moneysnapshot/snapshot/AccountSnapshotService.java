package com.moneysnapshot.snapshot;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.account.AccountNotFoundException;
import com.moneysnapshot.report.ReportCacheRefreshService;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.snapshot.web.CreateAccountSnapshotRequest;
import com.moneysnapshot.snapshot.web.UpdateSnapshotTypeRequest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AccountSnapshotService {

    private final AccountSnapshotRepository snapshotRepository;
    private final AccountRepository accountRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final CurrentUserService currentUserService;
    private final ReportCacheRefreshService reportCacheRefreshService;

    public AccountSnapshotService(
            AccountSnapshotRepository snapshotRepository,
            AccountRepository accountRepository,
            ApplicationEventPublisher eventPublisher,
            CurrentUserService currentUserService,
            ReportCacheRefreshService reportCacheRefreshService
    ) {
        this.snapshotRepository = snapshotRepository;
        this.accountRepository = accountRepository;
        this.eventPublisher = eventPublisher;
        this.currentUserService = currentUserService;
        this.reportCacheRefreshService = reportCacheRefreshService;
    }

    public List<AccountSnapshot> listSnapshots() {
        return snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(currentUserService.currentUserId());
    }

    public List<AccountSnapshot> listSnapshots(UUID accountId, LocalDate snapshotDate) {
        UUID ownerId = currentUserService.currentUserId();

        if (accountId != null && snapshotDate != null) {
            return snapshotRepository.findAllByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
                    accountId,
                    ownerId,
                    snapshotDate
            );
        }

        if (accountId != null) {
            return snapshotRepository.findAllByAccountIdAndOwnerIdWithAccountOrderBySnapshotDateDesc(accountId, ownerId);
        }

        if (snapshotDate != null) {
            return snapshotRepository.findAllByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(ownerId, snapshotDate);
        }

        return snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(ownerId);
    }

    public Page<AccountSnapshot> listSnapshots(Pageable pageable) {
        return snapshotRepository.findPageByOwnerIdWithAccountOrderBySnapshotDateDesc(currentUserService.currentUserId(), pageable);
    }

    public Page<AccountSnapshot> listSnapshots(UUID accountId, LocalDate snapshotDate, Pageable pageable) {
        UUID ownerId = currentUserService.currentUserId();

        if (accountId != null && snapshotDate != null) {
            return snapshotRepository.findPageByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
                    accountId,
                    ownerId,
                    snapshotDate,
                    pageable
            );
        }

        if (accountId != null) {
            return snapshotRepository.findPageByAccountIdWithAccountOrderBySnapshotDateDesc(accountId, ownerId, pageable);
        }

        if (snapshotDate != null) {
            return snapshotRepository.findPageByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
                    ownerId,
                    snapshotDate,
                    pageable
            );
        }

        return snapshotRepository.findPageByOwnerIdWithAccountOrderBySnapshotDateDesc(ownerId, pageable);
    }

    public AccountSnapshot getSnapshot(UUID id) {
        return snapshotRepository.findByIdAndOwnerIdWithAccount(id, currentUserService.currentUserId())
                .orElseThrow(() -> new AccountSnapshotNotFoundException(id));
    }

    @Transactional
    public AccountSnapshot createSnapshot(CreateAccountSnapshotRequest request) {
        Account account = findAccountForCurrentUser(request.accountId())
                .orElseThrow(() -> new AccountNotFoundException(request.accountId()));

        if (snapshotRepository.existsByAccountIdAndSnapshotDate(request.accountId(), request.snapshotDate())) {
            throw new DuplicateAccountSnapshotException(request.accountId(), request.snapshotDate());
        }

        AccountSnapshot snapshot = new AccountSnapshot(
                account,
                resolveSnapshotOwner(account),
                request.snapshotDate(),
                request.balance(),
                normalizeNote(request.note()),
                request.snapshotType()
        );

        AccountSnapshot savedSnapshot = snapshotRepository.save(snapshot);
        eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                snapshotOwnerId(savedSnapshot),
                savedSnapshot.getId(),
                account.getId(),
                savedSnapshot.getSnapshotDate()
        ));
        refreshReportCache(savedSnapshot);

        return savedSnapshot;
    }

    @Transactional
    public List<AccountSnapshot> createSnapshots(List<CreateAccountSnapshotRequest> requests) {
        Set<SnapshotIdentity> requestIdentities = new HashSet<>();
        List<AccountSnapshot> snapshots = new ArrayList<>();

        for (CreateAccountSnapshotRequest request : requests) {
            Account account = findAccountForCurrentUser(request.accountId())
                    .orElseThrow(() -> new AccountNotFoundException(request.accountId()));
            SnapshotIdentity identity = new SnapshotIdentity(request.accountId(), request.snapshotDate());

            if (!requestIdentities.add(identity)
                    || snapshotRepository.existsByAccountIdAndSnapshotDate(request.accountId(), request.snapshotDate())) {
                throw new DuplicateAccountSnapshotException(request.accountId(), request.snapshotDate());
            }

            snapshots.add(new AccountSnapshot(
                    account,
                    resolveSnapshotOwner(account),
                    request.snapshotDate(),
                    request.balance(),
                    normalizeNote(request.note()),
                    request.snapshotType()
            ));
        }

        List<AccountSnapshot> savedSnapshots = snapshotRepository.saveAll(snapshots);
        savedSnapshots.forEach(savedSnapshot -> eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                snapshotOwnerId(savedSnapshot),
                savedSnapshot.getId(),
                savedSnapshot.getAccount().getId(),
                savedSnapshot.getSnapshotDate()
        )));
        refreshReportCache(savedSnapshots.isEmpty() ? currentUserService.currentUserId() : snapshotOwnerId(savedSnapshots.get(0)));

        return savedSnapshots;
    }

    @Transactional
    public AccountSnapshot updateSnapshot(UUID id, CreateAccountSnapshotRequest request) {
        AccountSnapshot snapshot = getSnapshot(id);
        Account account = findAccountForCurrentUser(request.accountId())
                .orElseThrow(() -> new AccountNotFoundException(request.accountId()));

        snapshotRepository.findByAccountIdAndSnapshotDate(request.accountId(), request.snapshotDate())
                .filter(existingSnapshot -> !existingSnapshot.getId().equals(id))
                .ifPresent(existingSnapshot -> {
                    throw new DuplicateAccountSnapshotException(request.accountId(), request.snapshotDate());
                });

        snapshot.updateDetails(
                account,
                request.snapshotDate(),
                request.balance(),
                normalizeNote(request.note()),
                request.snapshotType()
        );

        AccountSnapshot savedSnapshot = snapshotRepository.save(snapshot);
        eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                snapshotOwnerId(savedSnapshot),
                savedSnapshot.getId(),
                account.getId(),
                savedSnapshot.getSnapshotDate()
        ));
        refreshReportCache(savedSnapshot);

        return savedSnapshot;
    }

    @Transactional
    public AccountSnapshot updateSnapshotType(UUID id, UpdateSnapshotTypeRequest request) {
        AccountSnapshot snapshot = getSnapshot(id);
        snapshot.updateSnapshotType(request.snapshotType());
        AccountSnapshot savedSnapshot = snapshotRepository.save(snapshot);
        eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                snapshotOwnerId(savedSnapshot),
                savedSnapshot.getId(),
                savedSnapshot.getAccount().getId(),
                savedSnapshot.getSnapshotDate()
        ));
        refreshReportCache(savedSnapshot);
        return savedSnapshot;
    }

    @Transactional
    public void deleteSnapshot(UUID id) {
        AccountSnapshot snapshot = getSnapshot(id);
        snapshotRepository.deleteById(id);
        eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                snapshotOwnerId(snapshot),
                snapshot.getId(),
                snapshot.getAccount().getId(),
                snapshot.getSnapshotDate()
        ));
        refreshReportCache(snapshot);
    }

    private UUID snapshotOwnerId(AccountSnapshot snapshot) {
        return snapshot.getOwner() == null ? currentUserService.currentUserId() : snapshot.getOwner().getId();
    }

    private void refreshReportCache(AccountSnapshot snapshot) {
        refreshReportCache(snapshotOwnerId(snapshot));
    }

    private void refreshReportCache(UUID ownerId) {
        reportCacheRefreshService.markDirty(ownerId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    reportCacheRefreshService.refreshOwner(ownerId);
                }
            });
            return;
        }

        reportCacheRefreshService.refreshOwner(ownerId);
    }

    private Optional<Account> findAccountForCurrentUser(UUID accountId) {
        return accountRepository.findByIdAndOwnerIdWithBank(accountId, currentUserService.currentUserId());
    }

    private AppUser resolveSnapshotOwner(Account account) {
        return account.getOwner() == null ? currentUserService.currentUser() : account.getOwner();
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }

        return note.trim();
    }

    private record SnapshotIdentity(UUID accountId, LocalDate snapshotDate) {
    }
}
