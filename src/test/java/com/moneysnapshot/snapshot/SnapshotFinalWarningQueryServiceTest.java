package com.moneysnapshot.snapshot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.security.web.UserSettingsResponse;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SnapshotFinalWarningQueryServiceTest {

    private final AccountSnapshotRepository snapshotRepository = mock(AccountSnapshotRepository.class);
    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final UserSettingsService userSettingsService = mock(UserSettingsService.class);

    @Test
    void warningsReportMissingAndMultipleFinalSnapshotsForCompletedPeriods() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID emptyAccountId = UUID.randomUUID();
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                1,
                Map.of()
        ));
        Account trackedAccount = account(accountId, "Main", LocalDate.of(2026, 5, 2));
        Account emptyTrackedAccount = account(emptyAccountId, "Empty", LocalDate.of(2026, 6, 15));
        when(accountRepository.findTrackedAccountsVisibleInSnapshotsByOwnerId(ownerId))
                .thenReturn(List.of(trackedAccount, emptyTrackedAccount));
        List<AccountSnapshot> snapshots = List.of(
                snapshot(accountId, LocalDate.of(2026, 5, 5), "100", SnapshotType.PARTIAL),
                snapshot(accountId, LocalDate.of(2026, 6, 2), "110", SnapshotType.PARTIAL),
                snapshot(accountId, LocalDate.of(2026, 6, 5), "115", SnapshotType.PARTIAL),
                snapshot(accountId, LocalDate.of(2026, 7, 20), "120", SnapshotType.FINAL),
                snapshot(accountId, LocalDate.of(2026, 7, 25), "125", SnapshotType.FINAL)
        );
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);
        SnapshotFinalWarningQueryService service = new SnapshotFinalWarningQueryService(
                snapshotRepository,
                accountRepository,
                currentUserService,
                userSettingsService,
                Clock.fixed(Instant.parse("2026-08-13T00:00:00Z"), ZoneOffset.UTC)
        );

        var response = service.warnings();

        assertThat(response.missingFinalPeriods()).hasSize(3);
        assertThat(response.missingFinalPeriods().get(0).periodStartDate()).isEqualTo(LocalDate.of(2026, 7, 2));
        assertThat(response.missingFinalPeriods().get(0).periodEndDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(response.missingFinalPeriods().get(0).accounts()).extracting("accountName").containsExactly("Empty");
        assertThat(response.missingFinalPeriods().get(1).periodStartDate()).isEqualTo(LocalDate.of(2026, 6, 2));
        assertThat(response.missingFinalPeriods().get(1).periodEndDate()).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(response.missingFinalPeriods().get(1).accounts()).extracting("accountName").containsExactly("Empty", "Main");
        assertThat(response.missingFinalPeriods().get(2).periodStartDate()).isEqualTo(LocalDate.of(2026, 5, 2));
        assertThat(response.missingFinalPeriods().get(2).periodEndDate()).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(response.missingFinalPeriods().get(2).accounts()).extracting("accountName").containsExactly("Main");
        assertThat(response.multipleFinalPeriods()).hasSize(1);
        assertThat(response.multipleFinalPeriods().get(0).periodStartDate()).isEqualTo(LocalDate.of(2026, 7, 2));
        assertThat(response.multipleFinalPeriods().get(0).periodEndDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(response.multipleFinalPeriods().get(0).accounts()).hasSize(1);
        assertThat(response.multipleFinalPeriods().get(0).accounts().get(0).accountName()).isEqualTo("Main");
        assertThat(response.multipleFinalPeriods().get(0).accounts().get(0).finalSnapshots()).isEqualTo(2);
    }

    @Test
    void warningsIgnoreMissingFinalSnapshotForCurrentOpenPeriod() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                31,
                Map.of()
        ));
        Account trackedAccount = account(accountId, "Main", LocalDate.of(2026, 8, 1));
        when(accountRepository.findTrackedAccountsVisibleInSnapshotsByOwnerId(ownerId))
                .thenReturn(List.of(trackedAccount));
        List<AccountSnapshot> snapshots = List.of(
                snapshot(accountId, LocalDate.of(2026, 8, 5), "100", SnapshotType.PARTIAL)
        );
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);
        SnapshotFinalWarningQueryService service = new SnapshotFinalWarningQueryService(
                snapshotRepository,
                accountRepository,
                currentUserService,
                userSettingsService,
                Clock.fixed(Instant.parse("2026-08-13T00:00:00Z"), ZoneOffset.UTC)
        );

        var response = service.warnings();

        assertThat(response.missingFinalPeriods()).isEmpty();
        assertThat(response.multipleFinalPeriods()).isEmpty();
    }

    @Test
    void warningsReportCompletedPeriodsWithoutAnySnapshots() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                1,
                Map.of()
        ));
        Account trackedAccount = account(accountId, "Main", LocalDate.of(2026, 6, 2));
        when(accountRepository.findTrackedAccountsVisibleInSnapshotsByOwnerId(ownerId))
                .thenReturn(List.of(trackedAccount));
        List<AccountSnapshot> snapshots = List.of(
                snapshot(accountId, LocalDate.of(2026, 6, 20), "100", SnapshotType.FINAL),
                snapshot(accountId, LocalDate.of(2026, 8, 20), "120", SnapshotType.FINAL)
        );
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);
        SnapshotFinalWarningQueryService service = new SnapshotFinalWarningQueryService(
                snapshotRepository,
                accountRepository,
                currentUserService,
                userSettingsService,
                Clock.fixed(Instant.parse("2026-09-13T00:00:00Z"), ZoneOffset.UTC)
        );

        var response = service.warnings();

        assertThat(response.missingFinalPeriods()).hasSize(1);
        assertThat(response.missingFinalPeriods().get(0).periodStartDate()).isEqualTo(LocalDate.of(2026, 7, 2));
        assertThat(response.missingFinalPeriods().get(0).periodEndDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(response.missingFinalPeriods().get(0).accounts()).extracting("accountName").containsExactly("Main");
        assertThat(response.multipleFinalPeriods()).isEmpty();
    }

    @Test
    void warningsUseOwnerFirstSnapshotDateForSharedAccountTrackingStart() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                1,
                Map.of()
        ));
        Account sharedAccount = sharedAccount(accountId, "Shared", LocalDate.of(2025, 1, 1));
        when(accountRepository.findTrackedAccountsVisibleInSnapshotsByOwnerId(ownerId))
                .thenReturn(List.of(sharedAccount));
        List<AccountSnapshot> snapshots = List.of(
                snapshot(accountId, LocalDate.of(2026, 7, 15), "100", SnapshotType.PARTIAL)
        );
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);
        SnapshotFinalWarningQueryService service = new SnapshotFinalWarningQueryService(
                snapshotRepository,
                accountRepository,
                currentUserService,
                userSettingsService,
                Clock.fixed(Instant.parse("2026-09-13T00:00:00Z"), ZoneOffset.UTC)
        );

        var response = service.warnings();

        assertThat(response.missingFinalPeriods()).extracting("periodStartDate")
                .containsExactly(LocalDate.of(2026, 8, 2), LocalDate.of(2026, 7, 2));
        assertThat(response.missingFinalPeriods()).allSatisfy(period ->
                assertThat(period.accounts()).extracting("accountName").containsExactly("Shared")
        );
        assertThat(response.multipleFinalPeriods()).isEmpty();
    }

    private AccountSnapshot snapshot(UUID accountId, LocalDate date, String balance, SnapshotType type) {
        AccountSnapshot snapshot = mock(AccountSnapshot.class);
        Account account = account(accountId, "Main");
        when(snapshot.getAccount()).thenReturn(account);
        when(snapshot.getSnapshotDate()).thenReturn(date);
        when(snapshot.getBalance()).thenReturn(new BigDecimal(balance));
        when(snapshot.getSnapshotType()).thenReturn(type);
        return snapshot;
    }

    private Account account(UUID accountId, String accountName) {
        return account(accountId, accountName, LocalDate.of(2026, 1, 1));
    }

    private Account account(UUID accountId, String accountName, LocalDate createdAt) {
        Account account = mock(Account.class);
        when(account.getId()).thenReturn(accountId);
        when(account.getName()).thenReturn(accountName);
        when(account.getOwner()).thenReturn(mock(AppUser.class));
        when(account.isShowInSnapshots()).thenReturn(true);
        when(account.getCreatedAt()).thenReturn(OffsetDateTime.of(createdAt.atStartOfDay(), ZoneOffset.UTC));
        return account;
    }

    private Account sharedAccount(UUID accountId, String accountName, LocalDate createdAt) {
        Account account = account(accountId, accountName, createdAt);
        when(account.getOwner()).thenReturn(null);
        return account;
    }
}
