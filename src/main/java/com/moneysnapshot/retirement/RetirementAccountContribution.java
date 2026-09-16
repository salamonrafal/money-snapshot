package com.moneysnapshot.retirement;

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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "retirement_account_contributions")
public class RetirementAccountContribution {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "retirement_account_id", nullable = false)
    private RetirementAccount retirementAccount;

    @Column(name = "contribution_date", nullable = false)
    private LocalDate contributionDate;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(name = "previous_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal previousBalance;

    @Column(name = "current_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal currentBalance;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected RetirementAccountContribution() {
    }

    public RetirementAccountContribution(
            AppUser owner,
            RetirementAccount retirementAccount,
            LocalDate contributionDate,
            BigDecimal amount,
            BigDecimal previousBalance,
            BigDecimal currentBalance,
            String note
    ) {
        this.owner = owner;
        this.retirementAccount = retirementAccount;
        this.contributionDate = contributionDate;
        this.amount = amount;
        this.previousBalance = previousBalance;
        this.currentBalance = currentBalance;
        this.note = note;
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

    public RetirementAccount getRetirementAccount() {
        return retirementAccount;
    }

    public LocalDate getContributionDate() {
        return contributionDate;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public BigDecimal getPreviousBalance() {
        return previousBalance;
    }

    public BigDecimal getCurrentBalance() {
        return currentBalance;
    }

    public String getNote() {
        return note;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
