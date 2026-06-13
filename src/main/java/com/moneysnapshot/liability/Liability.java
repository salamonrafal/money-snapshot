package com.moneysnapshot.liability;

import com.moneysnapshot.account.Bank;
import com.moneysnapshot.security.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "liabilities")
public class Liability {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_id", nullable = false)
    private Bank bank;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "normalized_name", nullable = false, length = 120)
    private String normalizedName;

    @Enumerated(EnumType.STRING)
    @Column(name = "liability_type_code", nullable = false, length = 40)
    private LiabilityTypeCode liabilityTypeCode;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "original_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal originalAmount;

    @Column(name = "current_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal currentAmount;

    @Column(name = "installment_amount", precision = 19, scale = 4)
    private BigDecimal installmentAmount;

    @Column(name = "credit_card_limit", precision = 19, scale = 4)
    private BigDecimal creditCardLimit;

    @Column(name = "credit_card_minimum_payment", precision = 19, scale = 4)
    private BigDecimal creditCardMinimumPayment;

    @Column(name = "repayment_start_date")
    private LocalDate repaymentStartDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "installment_count")
    private Integer installmentCount;

    @Column(name = "first_repayment_day")
    private Integer firstRepaymentDay;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_mode_code", length = 40)
    private LiabilityScheduleMode scheduleMode;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LiabilityStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Liability() {
    }

    public Liability(
            Bank bank,
            AppUser owner,
            String name,
            String normalizedName,
            LiabilityTypeCode liabilityTypeCode,
            String currencyCode,
            BigDecimal originalAmount,
            BigDecimal currentAmount,
            BigDecimal installmentAmount,
            BigDecimal creditCardLimit,
            BigDecimal creditCardMinimumPayment,
            LocalDate repaymentStartDate,
            LocalDate endDate,
            Integer installmentCount,
            Integer firstRepaymentDay,
            LiabilityScheduleMode scheduleMode,
            String note,
            LiabilityStatus status
    ) {
        this.bank = bank;
        this.owner = owner;
        this.name = name;
        this.normalizedName = normalizedName;
        this.liabilityTypeCode = liabilityTypeCode;
        this.currencyCode = currencyCode;
        this.originalAmount = originalAmount;
        this.currentAmount = currentAmount;
        this.installmentAmount = installmentAmount;
        this.creditCardLimit = creditCardLimit;
        this.creditCardMinimumPayment = creditCardMinimumPayment;
        this.repaymentStartDate = repaymentStartDate;
        this.endDate = endDate;
        this.installmentCount = installmentCount;
        this.firstRepaymentDay = firstRepaymentDay;
        this.scheduleMode = scheduleMode;
        this.note = note;
        this.status = status;
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

    public UUID getId() {
        return id;
    }

    public Bank getBank() {
        return bank;
    }

    public AppUser getOwner() {
        return owner;
    }

    public String getName() {
        return name;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public LiabilityTypeCode getLiabilityTypeCode() {
        return liabilityTypeCode;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public BigDecimal getOriginalAmount() {
        return originalAmount;
    }

    public BigDecimal getCurrentAmount() {
        return currentAmount;
    }

    public BigDecimal getInstallmentAmount() {
        return installmentAmount;
    }

    public BigDecimal getCreditCardLimit() {
        return creditCardLimit;
    }

    public BigDecimal getCreditCardMinimumPayment() {
        return creditCardMinimumPayment;
    }

    public LocalDate getRepaymentStartDate() {
        return repaymentStartDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public Integer getInstallmentCount() {
        return installmentCount;
    }

    public Integer getFirstRepaymentDay() {
        return firstRepaymentDay;
    }

    public LiabilityScheduleMode getScheduleMode() {
        return scheduleMode;
    }

    public String getNote() {
        return note;
    }

    public LiabilityStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void updateCurrentAmount(BigDecimal currentAmount) {
        this.currentAmount = currentAmount;
    }

    public void updateDetails(
            Bank bank,
            String name,
            String normalizedName,
            LiabilityTypeCode liabilityTypeCode,
            String currencyCode,
            BigDecimal originalAmount,
            BigDecimal currentAmount,
            BigDecimal installmentAmount,
            BigDecimal creditCardLimit,
            BigDecimal creditCardMinimumPayment,
            LocalDate repaymentStartDate,
            LocalDate endDate,
            Integer installmentCount,
            Integer firstRepaymentDay,
            LiabilityScheduleMode scheduleMode,
            String note,
            LiabilityStatus status
    ) {
        this.bank = bank;
        this.name = name;
        this.normalizedName = normalizedName;
        this.liabilityTypeCode = liabilityTypeCode;
        this.currencyCode = currencyCode;
        this.originalAmount = originalAmount;
        this.currentAmount = currentAmount;
        this.installmentAmount = installmentAmount;
        this.creditCardLimit = creditCardLimit;
        this.creditCardMinimumPayment = creditCardMinimumPayment;
        this.repaymentStartDate = repaymentStartDate;
        this.endDate = endDate;
        this.installmentCount = installmentCount;
        this.firstRepaymentDay = firstRepaymentDay;
        this.scheduleMode = scheduleMode;
        this.note = note;
        this.status = status;
    }
}
