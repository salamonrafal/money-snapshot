package com.moneysnapshot.liability;

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
@Table(name = "liability_repayments")
public class LiabilityRepayment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "liability_id", nullable = false)
    private Liability liability;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @Column(name = "repayment_date", nullable = false)
    private LocalDate repaymentDate;

    @Column(name = "current_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal currentAmount;

    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected LiabilityRepayment() {
    }

    public LiabilityRepayment(
            Liability liability,
            AppUser owner,
            LocalDate repaymentDate,
            BigDecimal currentAmount,
            BigDecimal amount,
            String note
    ) {
        this.liability = liability;
        this.owner = owner;
        this.repaymentDate = repaymentDate;
        this.currentAmount = currentAmount;
        this.amount = amount;
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

    public Liability getLiability() {
        return liability;
    }

    public AppUser getOwner() {
        return owner;
    }

    public LocalDate getRepaymentDate() {
        return repaymentDate;
    }

    public BigDecimal getCurrentAmount() {
        return currentAmount;
    }

    public BigDecimal getAmount() {
        return amount;
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

    public void updateDetails(
            LocalDate repaymentDate,
            BigDecimal currentAmount,
            BigDecimal amount,
            String note
    ) {
        this.repaymentDate = repaymentDate;
        this.currentAmount = currentAmount;
        this.amount = amount;
        this.note = note;
    }

    public void updateCurrentAmount(BigDecimal currentAmount) {
        this.currentAmount = currentAmount;
    }
}
