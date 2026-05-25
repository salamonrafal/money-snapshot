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
@Table(name = "savings_forecast_month_values")
public class SavingsForecastMonthValue {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id", nullable = false)
    private SavingsForecastEntry entry;

    @Column(name = "forecast_month", nullable = false)
    private LocalDate forecastMonth;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal balance;

    protected SavingsForecastMonthValue() {
    }

    public SavingsForecastMonthValue(SavingsForecastEntry entry, LocalDate forecastMonth, BigDecimal balance) {
        this.entry = entry;
        this.forecastMonth = forecastMonth;
        this.balance = balance;
    }

    public UUID getId() {
        return id;
    }

    public SavingsForecastEntry getEntry() {
        return entry;
    }

    public LocalDate getForecastMonth() {
        return forecastMonth;
    }

    public BigDecimal getBalance() {
        return balance;
    }
}
