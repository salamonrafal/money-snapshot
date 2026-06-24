package com.moneysnapshot.bill;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.counterparty.Counterparty;
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
@Table(name = "bills")
public class Bill {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "counterparty_id", nullable = false)
    private Counterparty counterparty;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "normalized_name", nullable = false, length = 120)
    private String normalizedName;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "duration_type", nullable = false, length = 40)
    private BillDurationType durationType;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "installment_count")
    private Integer installmentCount;

    @Column(name = "repayment_day", nullable = false)
    private Integer repaymentDay;

    @Column(name = "start_from", nullable = false)
    private LocalDate startFrom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BillStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Bill() {
    }

    public Bill(
            AppUser owner,
            Counterparty counterparty,
            Account account,
            String name,
            String normalizedName,
            String currencyCode,
            BigDecimal amount,
            BillDurationType durationType,
            LocalDate endDate,
            Integer installmentCount,
            Integer repaymentDay,
            LocalDate startFrom,
            BillStatus status
    ) {
        this.owner = owner;
        this.counterparty = counterparty;
        this.account = account;
        this.name = name;
        this.normalizedName = normalizedName;
        this.currencyCode = currencyCode;
        this.amount = amount;
        this.durationType = durationType;
        this.endDate = endDate;
        this.installmentCount = installmentCount;
        this.repaymentDay = repaymentDay;
        this.startFrom = startFrom;
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

    public AppUser getOwner() {
        return owner;
    }

    public Counterparty getCounterparty() {
        return counterparty;
    }

    public Account getAccount() {
        return account;
    }

    public String getName() {
        return name;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public BillDurationType getDurationType() {
        return durationType;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public Integer getInstallmentCount() {
        return installmentCount;
    }

    public Integer getRepaymentDay() {
        return repaymentDay;
    }

    public LocalDate getStartFrom() {
        return startFrom;
    }

    public BillStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void updateDetails(
            Counterparty counterparty,
            Account account,
            String name,
            String normalizedName,
            String currencyCode,
            BigDecimal amount,
            BillDurationType durationType,
            LocalDate endDate,
            Integer installmentCount,
            Integer repaymentDay,
            LocalDate startFrom,
            BillStatus status
    ) {
        this.counterparty = counterparty;
        this.account = account;
        this.name = name;
        this.normalizedName = normalizedName;
        this.currencyCode = currencyCode;
        this.amount = amount;
        this.durationType = durationType;
        this.endDate = endDate;
        this.installmentCount = installmentCount;
        this.repaymentDay = repaymentDay;
        this.startFrom = startFrom;
        this.status = status;
    }

    public void updateCurrencyCode(String currencyCode) {
        this.currencyCode = currencyCode;
    }
}
