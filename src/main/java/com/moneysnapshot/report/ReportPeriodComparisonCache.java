package com.moneysnapshot.report;

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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "report_period_comparison_cache", uniqueConstraints = @UniqueConstraint(
        name = "uq_report_period_comparison_cache",
        columnNames = {"owner_id", "period_index", "point_date", "currency_code"}
))
public class ReportPeriodComparisonCache {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;
    @Column(name = "period_index", nullable = false) private int periodIndex;
    @Column(name = "period_start_date", nullable = false) private LocalDate periodStartDate;
    @Column(name = "period_end_date", nullable = false) private LocalDate periodEndDate;
    @Column(name = "point_date", nullable = false) private LocalDate pointDate;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "currency_code", nullable = false, length = 3) private String currencyCode;
    @Column(nullable = false, precision = 38, scale = 4) private BigDecimal amount;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt;

    protected ReportPeriodComparisonCache() {}

    public ReportPeriodComparisonCache(AppUser owner, int periodIndex, LocalDate periodStartDate,
            LocalDate periodEndDate, LocalDate pointDate, String currencyCode, BigDecimal amount) {
        this.owner = owner; this.periodIndex = periodIndex; this.periodStartDate = periodStartDate;
        this.periodEndDate = periodEndDate; this.pointDate = pointDate; this.currencyCode = currencyCode; this.amount = amount;
    }
    @PrePersist void prePersist() { createdAt = OffsetDateTime.now(ZoneOffset.UTC); updatedAt = createdAt; }
    @PreUpdate void preUpdate() { updatedAt = OffsetDateTime.now(ZoneOffset.UTC); }
    public int getPeriodIndex() { return periodIndex; }
    public LocalDate getPeriodStartDate() { return periodStartDate; }
    public LocalDate getPeriodEndDate() { return periodEndDate; }
    public LocalDate getPointDate() { return pointDate; }
    public String getCurrencyCode() { return currencyCode; }
    public BigDecimal getAmount() { return amount; }
}
