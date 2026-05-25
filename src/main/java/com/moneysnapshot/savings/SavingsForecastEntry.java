package com.moneysnapshot.savings;

import com.moneysnapshot.account.Account;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "savings_forecast_entries")
public class SavingsForecastEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private SavingsForecastRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(name = "starting_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal startingBalance;

    @Column(name = "forecasted_monthly_contribution", nullable = false, precision = 19, scale = 2)
    private BigDecimal forecastedMonthlyContribution;

    @Column(name = "projected_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal projectedBalance;

    @Column(name = "latest_snapshot_date")
    private LocalDate latestSnapshotDate;

    protected SavingsForecastEntry() {
    }

    public SavingsForecastEntry(
            SavingsForecastRun run,
            Account account,
            BigDecimal startingBalance,
            BigDecimal forecastedMonthlyContribution,
            BigDecimal projectedBalance,
            LocalDate latestSnapshotDate
    ) {
        this.run = run;
        this.account = account;
        this.startingBalance = startingBalance;
        this.forecastedMonthlyContribution = forecastedMonthlyContribution;
        this.projectedBalance = projectedBalance;
        this.latestSnapshotDate = latestSnapshotDate;
    }

    public UUID getId() {
        return id;
    }

    public SavingsForecastRun getRun() {
        return run;
    }

    public Account getAccount() {
        return account;
    }

    public BigDecimal getStartingBalance() {
        return startingBalance;
    }

    public BigDecimal getForecastedMonthlyContribution() {
        return forecastedMonthlyContribution;
    }

    public BigDecimal getProjectedBalance() {
        return projectedBalance;
    }

    public LocalDate getLatestSnapshotDate() {
        return latestSnapshotDate;
    }
}
