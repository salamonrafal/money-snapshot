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
@Table(
        name = "report_billing_period_comparison_cache",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_report_billing_period_comparison_cache",
                columnNames = {"owner_id", "period_index", "currency_code"}
        )
)
public class ReportBillingPeriodComparisonCache {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @Column(name = "period_index", nullable = false)
    private int periodIndex;

    @Column(name = "period_start_date", nullable = false)
    private LocalDate periodStartDate;

    @Column(name = "period_end_date", nullable = false)
    private LocalDate periodEndDate;

    @Column(name = "reference_start_date", nullable = false)
    private LocalDate referenceStartDate;

    @Column(name = "reference_end_date", nullable = false)
    private LocalDate referenceEndDate;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "period_change", nullable = false, precision = 38, scale = 4)
    private BigDecimal periodChange;

    @Column(name = "reference_change", nullable = false, precision = 38, scale = 4)
    private BigDecimal referenceChange;

    @Column(name = "difference", nullable = false, precision = 38, scale = 4)
    private BigDecimal difference;

    @Column(name = "difference_percent", precision = 38, scale = 4)
    private BigDecimal differencePercent;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected ReportBillingPeriodComparisonCache() {
    }

    public ReportBillingPeriodComparisonCache(
            AppUser owner,
            int periodIndex,
            LocalDate periodStartDate,
            LocalDate periodEndDate,
            LocalDate referenceStartDate,
            LocalDate referenceEndDate,
            String currencyCode,
            BigDecimal periodChange,
            BigDecimal referenceChange,
            BigDecimal difference,
            BigDecimal differencePercent
    ) {
        this.owner = owner;
        this.periodIndex = periodIndex;
        this.periodStartDate = periodStartDate;
        this.periodEndDate = periodEndDate;
        this.referenceStartDate = referenceStartDate;
        this.referenceEndDate = referenceEndDate;
        this.currencyCode = currencyCode;
        this.periodChange = periodChange;
        this.referenceChange = referenceChange;
        this.difference = difference;
        this.differencePercent = differencePercent;
    }

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public int getPeriodIndex() { return periodIndex; }
    public LocalDate getPeriodStartDate() { return periodStartDate; }
    public LocalDate getPeriodEndDate() { return periodEndDate; }
    public LocalDate getReferenceStartDate() { return referenceStartDate; }
    public LocalDate getReferenceEndDate() { return referenceEndDate; }
    public String getCurrencyCode() { return currencyCode; }
    public BigDecimal getPeriodChange() { return periodChange; }
    public BigDecimal getReferenceChange() { return referenceChange; }
    public BigDecimal getDifference() { return difference; }
    public BigDecimal getDifferencePercent() { return differencePercent; }
}
