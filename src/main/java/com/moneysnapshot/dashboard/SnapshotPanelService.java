package com.moneysnapshot.dashboard;

import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.snapshot.CurrencyAmount;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SnapshotPanelService {

    private final AccountSnapshotRepository snapshotRepository;
    private final CurrentUserService currentUserService;
    private final UserSettingsService userSettingsService;
    private final Clock clock;
    private final Map<UUID, SnapshotPanelResponse> cachedPanels = new HashMap<>();

    @Autowired
    public SnapshotPanelService(
            AccountSnapshotRepository snapshotRepository,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService
    ) {
        this(snapshotRepository, currentUserService, userSettingsService, Clock.systemUTC());
    }

    SnapshotPanelService(
            AccountSnapshotRepository snapshotRepository,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService,
            Clock clock
    ) {
        this.snapshotRepository = snapshotRepository;
        this.currentUserService = currentUserService;
        this.userSettingsService = userSettingsService;
        this.clock = clock;
    }

    public synchronized SnapshotPanelResponse getPanel() {
        UUID ownerId = currentUserService.currentUserId();
        return cachedPanels.computeIfAbsent(ownerId, this::buildPanel);
    }

    public synchronized void recalculate() {
        cachedPanels.clear();
    }

    private SnapshotPanelResponse buildPanel(UUID ownerId) {
        LocalDate periodDate = resolvePeriodStart(LocalDate.now(clock), userSettingsService.currentUserSettings().billingMonthStartDay());
        List<CurrencyAmount> currentBalances = snapshotRepository.sumLatestBalancesByOwnerIdAndCurrency(ownerId);
        List<CurrencyAmount> previousBalances = snapshotRepository.sumLatestBalancesBeforeDateByOwnerIdAndCurrency(ownerId, periodDate);
        List<CurrencyAmount> monthlyChanges = subtractByCurrency(currentBalances, previousBalances);

        return new SnapshotPanelResponse(
                periodDate,
                calculateMonthlyChangePercent(currentBalances, previousBalances),
                snapshotRepository.countAccountsWithSnapshotsByOwnerId(ownerId),
                toResponse(currentBalances),
                toResponse(monthlyChanges)
        );
    }

    static LocalDate resolvePeriodStart(LocalDate today, int billingMonthStartDay) {
        int normalizedStartDay = Math.max(1, Math.min(31, billingMonthStartDay));
        LocalDate currentMonthStart = today.withDayOfMonth(Math.min(normalizedStartDay, today.lengthOfMonth()));
        if (!today.isBefore(currentMonthStart)) {
            return currentMonthStart;
        }

        LocalDate previousMonth = today.minusMonths(1);
        return previousMonth.withDayOfMonth(Math.min(normalizedStartDay, previousMonth.lengthOfMonth()));
    }

    private BigDecimal calculateMonthlyChangePercent(List<CurrencyAmount> currentBalances, List<CurrencyAmount> previousBalances) {
        if (currentBalances.size() != 1 || previousBalances.size() != 1) {
            return null;
        }

        CurrencyAmount current = currentBalances.get(0);
        CurrencyAmount previous = previousBalances.get(0);
        if (!current.currencyCode().equals(previous.currencyCode()) || previous.amount().compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }

        return current.amount()
                .subtract(previous.amount())
                .multiply(BigDecimal.valueOf(100))
                .divide(previous.amount(), 1, RoundingMode.HALF_UP);
    }

    private List<CurrencyAmount> subtractByCurrency(List<CurrencyAmount> currentBalances, List<CurrencyAmount> previousBalances) {
        Map<String, BigDecimal> changesByCurrency = new LinkedHashMap<>();
        currentBalances.forEach(amount -> changesByCurrency.put(amount.currencyCode(), amount.amount()));
        previousBalances.forEach(amount -> changesByCurrency.merge(
                amount.currencyCode(),
                amount.amount().negate(),
                BigDecimal::add
        ));

        return changesByCurrency.entrySet().stream()
                .map(entry -> new CurrencyAmount(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<SnapshotPanelAmountResponse> toResponse(List<CurrencyAmount> amounts) {
        return amounts.stream()
                .map(amount -> new SnapshotPanelAmountResponse(amount.currencyCode(), amount.amount()))
                .toList();
    }
}
