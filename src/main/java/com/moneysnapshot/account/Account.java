package com.moneysnapshot.account;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.shared.validation.BankAccountNumbers;
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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "accounts")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_id", nullable = false)
    private Bank bank;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private AppUser owner;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "normalized_name", nullable = false, length = 120)
    private String normalizedName;

    @Column(name = "account_type_code", nullable = false, length = 40)
    private String accountTypeCode = "BANK_ACCOUNT";

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(length = 500)
    private String description;

    @Column(name = "bank_account_number", length = 64)
    private String bankAccountNumber;

    @Column(name = "forecasted_monthly_contribution", precision = 19, scale = 2)
    private BigDecimal forecastedMonthlyContribution;

    @Column(name = "show_in_snapshots", nullable = false)
    private boolean showInSnapshots = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Account() {
    }

    public Account(
            Bank bank,
            AppUser owner,
            String name,
            String normalizedName,
            String accountTypeCode,
            String currencyCode,
            String description,
            String bankAccountNumber,
            BigDecimal forecastedMonthlyContribution,
            boolean showInSnapshots,
            AccountStatus status
    ) {
        this.bank = bank;
        this.owner = owner;
        this.name = name;
        this.normalizedName = normalizedName;
        this.accountTypeCode = accountTypeCode;
        this.currencyCode = currencyCode;
        this.description = description;
        this.bankAccountNumber = BankAccountNumbers.normalize(bankAccountNumber);
        this.forecastedMonthlyContribution = forecastedMonthlyContribution;
        this.showInSnapshots = showInSnapshots;
        this.status = status;
    }

    public Account(
            Bank bank,
            AppUser owner,
            String name,
            String normalizedName,
            String accountTypeCode,
            String currencyCode,
            String description,
            BigDecimal forecastedMonthlyContribution,
            AccountStatus status
    ) {
        this(bank, owner, name, normalizedName, accountTypeCode, currencyCode, description, null, forecastedMonthlyContribution, true, status);
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

    public void updateDetails(
            Bank bank,
            String name,
            String normalizedName,
            String accountTypeCode,
            String currencyCode,
            String description,
            String bankAccountNumber,
            BigDecimal forecastedMonthlyContribution,
            boolean showInSnapshots,
            AccountStatus status
    ) {
        this.bank = bank;
        this.name = name;
        this.normalizedName = normalizedName;
        this.accountTypeCode = accountTypeCode;
        this.currencyCode = currencyCode;
        this.description = description;
        this.bankAccountNumber = BankAccountNumbers.normalize(bankAccountNumber);
        this.forecastedMonthlyContribution = forecastedMonthlyContribution;
        this.showInSnapshots = showInSnapshots;
        this.status = status;
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

    public String getAccountTypeCode() {
        return accountTypeCode;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getForecastedMonthlyContribution() {
        return forecastedMonthlyContribution;
    }

    public String getBankAccountNumber() {
        return bankAccountNumber;
    }

    public void updateForecastedMonthlyContribution(BigDecimal forecastedMonthlyContribution) {
        this.forecastedMonthlyContribution = forecastedMonthlyContribution;
    }

    public boolean isShowInSnapshots() {
        return showInSnapshots;
    }

    public AccountStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
