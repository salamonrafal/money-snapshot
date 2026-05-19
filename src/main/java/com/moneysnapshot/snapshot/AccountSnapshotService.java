package com.moneysnapshot.snapshot;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.account.AccountNotFoundException;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.snapshot.web.CreateAccountSnapshotRequest;
import jakarta.transaction.Transactional;
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

@Service
public class AccountSnapshotService {

    private final AccountSnapshotRepository snapshotRepository;
    private final AccountRepository accountRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final CurrentUserService currentUserService;

    public AccountSnapshotService(
            AccountSnapshotRepository snapshotRepository,
            AccountRepository accountRepository,
            ApplicationEventPublisher eventPublisher,
            CurrentUserService currentUserService
    ) {
        this.snapshotRepository = snapshotRepository;
        this.accountRepository = accountRepository;
        this.eventPublisher = eventPublisher;
        this.currentUserService = currentUserService;
    }

    public List<AccountSnapshot> listSnapshots() {
        return snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(currentUserService.currentUserId());
    }

    public Page<AccountSnapshot> listSnapshots(Pageable pageable) {
        return snapshotRepository.findPageByOwnerIdWithAccountOrderBySnapshotDateDesc(currentUserService.currentUserId(), pageable);
    }

    public Page<AccountSnapshot> listSnapshots(UUID accountId, Pageable pageable) {
        if (accountId == null) {
            return listSnapshots(pageable);
        }

        return snapshotRepository.findPageByAccountIdWithAccountOrderBySnapshotDateDesc(accountId, currentUserService.currentUserId(), pageable);
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
                normalizeNote(request.note())
        );

        AccountSnapshot savedSnapshot = snapshotRepository.save(snapshot);
        eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                savedSnapshot.getId(),
                account.getId(),
                savedSnapshot.getSnapshotDate()
        ));

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
                    normalizeNote(request.note())
            ));
        }

        List<AccountSnapshot> savedSnapshots = snapshotRepository.saveAll(snapshots);
        savedSnapshots.forEach(savedSnapshot -> eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                savedSnapshot.getId(),
                savedSnapshot.getAccount().getId(),
                savedSnapshot.getSnapshotDate()
        )));

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
                normalizeNote(request.note())
        );

        AccountSnapshot savedSnapshot = snapshotRepository.save(snapshot);
        eventPublisher.publishEvent(new AccountSnapshotCreatedEvent(
                savedSnapshot.getId(),
                account.getId(),
                savedSnapshot.getSnapshotDate()
        ));

        return savedSnapshot;
    }

    @Transactional
    public void deleteSnapshot(UUID id) {
        getSnapshot(id);

        snapshotRepository.deleteById(id);
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
