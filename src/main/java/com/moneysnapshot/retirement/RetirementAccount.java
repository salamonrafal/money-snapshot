package com.moneysnapshot.retirement;

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
@Table(name = "retirement_accounts")
public class RetirementAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @Column(name = "account_type_code", nullable = false, length = 40)
    private String accountTypeCode;

    @Column(nullable = false, length = 120)
    private String institution;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "normalized_name", nullable = false, length = 120)
    private String normalizedName;

    @Column(name = "website_url", length = 2048)
    private String websiteUrl;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode = "PLN";

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal balance;

    @Column(name = "monthly_contribution", nullable = false, precision = 19, scale = 4)
    private BigDecimal monthlyContribution;

    @Column(name = "balance_updated_at", nullable = false)
    private LocalDate balanceUpdatedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RetirementAccountStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected RetirementAccount() {
    }

    public RetirementAccount(
            AppUser owner,
            String accountTypeCode,
            String institution,
            String name,
            String normalizedName,
            String websiteUrl,
            String currencyCode,
            BigDecimal balance,
            BigDecimal monthlyContribution,
            LocalDate balanceUpdatedAt,
            RetirementAccountStatus status
    ) {
        this.owner = owner;
        this.accountTypeCode = accountTypeCode;
        this.institution = institution;
        this.name = name;
        this.normalizedName = normalizedName;
        this.websiteUrl = websiteUrl;
        this.currencyCode = currencyCode;
        this.balance = balance;
        this.monthlyContribution = monthlyContribution;
        this.balanceUpdatedAt = balanceUpdatedAt;
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

    public void updateDetails(
            String accountTypeCode,
            String institution,
            String name,
            String normalizedName,
            String websiteUrl,
            BigDecimal monthlyContribution,
            RetirementAccountStatus status
    ) {
        this.accountTypeCode = accountTypeCode;
        this.institution = institution;
        this.name = name;
        this.normalizedName = normalizedName;
        this.websiteUrl = websiteUrl;
        this.monthlyContribution = monthlyContribution;
        this.status = status;
    }

    public void updateBalance(BigDecimal balance, LocalDate balanceUpdatedAt) {
        this.balance = balance;
        this.balanceUpdatedAt = balanceUpdatedAt;
    }

    public UUID getId() {
        return id;
    }

    public AppUser getOwner() {
        return owner;
    }

    public String getAccountTypeCode() {
        return accountTypeCode;
    }

    public String getInstitution() {
        return institution;
    }

    public String getName() {
        return name;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public String getWebsiteUrl() {
        return websiteUrl;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public BigDecimal getMonthlyContribution() {
        return monthlyContribution;
    }

    public LocalDate getBalanceUpdatedAt() {
        return balanceUpdatedAt;
    }

    public RetirementAccountStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
