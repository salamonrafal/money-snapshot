package com.moneysnapshot.report;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.Bank;
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
        name = "report_average_contribution_cache",
        uniqueConstraints = @UniqueConstraint(name = "uq_report_average_contribution_cache", columnNames = {"owner_id", "account_id"})
)
public class ReportAverageContributionCache {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_id", nullable = false)
    private Bank bank;

    @Column(name = "account_name", nullable = false, length = 120)
    private String accountName;

    @Column(name = "bank_name", nullable = false, length = 120)
    private String bankName;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "average_contribution", nullable = false, precision = 19, scale = 4)
    private BigDecimal averageContribution;

    @Column(name = "sample_from_date", nullable = false)
    private LocalDate sampleFromDate;

    @Column(name = "sample_to_date", nullable = false)
    private LocalDate sampleToDate;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected ReportAverageContributionCache() {
    }

    public ReportAverageContributionCache(
            AppUser owner,
            Account account,
            Bank bank,
            String accountName,
            String bankName,
            String currencyCode,
            BigDecimal averageContribution,
            LocalDate sampleFromDate,
            LocalDate sampleToDate
    ) {
        this.owner = owner;
        this.account = account;
        this.bank = bank;
        this.accountName = accountName;
        this.bankName = bankName;
        this.currencyCode = currencyCode;
        this.averageContribution = averageContribution;
        this.sampleFromDate = sampleFromDate;
        this.sampleToDate = sampleToDate;
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

    public UUID getAccountId() {
        return account.getId();
    }

    public String getAccountName() {
        return accountName;
    }

    public String getBankName() {
        return bankName;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public BigDecimal getAverageContribution() {
        return averageContribution;
    }

    public LocalDate getSampleFromDate() {
        return sampleFromDate;
    }

    public LocalDate getSampleToDate() {
        return sampleToDate;
    }
}
