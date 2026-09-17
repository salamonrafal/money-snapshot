package com.moneysnapshot.report;

import com.moneysnapshot.security.AppUser;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "report_retirement_account_cache", uniqueConstraints = @UniqueConstraint(
        name = "uq_report_retirement_account_cache", columnNames = {"owner_id", "retirement_account_id"}))
public class ReportRetirementAccountCache {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "owner_id", nullable = false) private AppUser owner;
    @Column(name = "retirement_account_id", nullable = false) private UUID retirementAccountId;
    @Column(name = "account_type_code", nullable = false, length = 40) private String accountTypeCode;
    @Column(nullable = false, length = 120) private String institution;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "currency_code", nullable = false, length = 3) private String currencyCode;
    @Column(nullable = false, precision = 19, scale = 4) private BigDecimal balance;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt;
    protected ReportRetirementAccountCache() {}
    public ReportRetirementAccountCache(AppUser owner, UUID id, String type, String institution, String currency, BigDecimal balance) {
        this.owner = owner; this.retirementAccountId = id; this.accountTypeCode = type; this.institution = institution;
        this.currencyCode = currency; this.balance = balance;
    }
    @PrePersist void prePersist() { createdAt = updatedAt = OffsetDateTime.now(ZoneOffset.UTC); }
    @PreUpdate void preUpdate() { updatedAt = OffsetDateTime.now(ZoneOffset.UTC); }
    public String getAccountTypeCode() { return accountTypeCode; }
    public String getInstitution() { return institution; }
    public String getCurrencyCode() { return currencyCode; }
    public BigDecimal getBalance() { return balance; }
}
