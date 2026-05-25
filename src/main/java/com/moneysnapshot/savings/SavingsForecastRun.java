package com.moneysnapshot.savings;

import com.moneysnapshot.security.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "savings_forecast_runs")
public class SavingsForecastRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @Column(name = "forecast_start_date", nullable = false)
    private LocalDate forecastStartDate;

    @Column(name = "duration_months", nullable = false)
    private int durationMonths;

    @Column(name = "generated_at", nullable = false)
    private OffsetDateTime generatedAt;

    protected SavingsForecastRun() {
    }

    public SavingsForecastRun(AppUser owner, LocalDate forecastStartDate, int durationMonths) {
        this.owner = owner;
        this.forecastStartDate = forecastStartDate;
        this.durationMonths = durationMonths;
    }

    @PrePersist
    void prePersist() {
        generatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getId() {
        return id;
    }

    public AppUser getOwner() {
        return owner;
    }

    public LocalDate getForecastStartDate() {
        return forecastStartDate;
    }

    public int getDurationMonths() {
        return durationMonths;
    }

    public OffsetDateTime getGeneratedAt() {
        return generatedAt;
    }
}
