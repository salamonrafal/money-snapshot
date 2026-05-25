package com.moneysnapshot.savings;

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
@Table(name = "savings_forecast_month_summaries")
public class SavingsForecastMonthSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private SavingsForecastRun run;

    @Column(name = "forecast_month", nullable = false)
    private LocalDate forecastMonth;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "total_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalBalance;

    protected SavingsForecastMonthSummary() {
    }

    public SavingsForecastMonthSummary(
            SavingsForecastRun run,
            LocalDate forecastMonth,
            String currencyCode,
            BigDecimal totalBalance
    ) {
        this.run = run;
        this.forecastMonth = forecastMonth;
        this.currencyCode = currencyCode;
        this.totalBalance = totalBalance;
    }

    public UUID getId() {
        return id;
    }

    public SavingsForecastRun getRun() {
        return run;
    }

    public LocalDate getForecastMonth() {
        return forecastMonth;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public BigDecimal getTotalBalance() {
        return totalBalance;
    }
}
