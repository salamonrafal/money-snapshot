package com.moneysnapshot.bill;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "bill_schedule_entries")
public class BillScheduleEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bill_id", nullable = false)
    private Bill bill;

    @Column(name = "installment_number", nullable = false)
    private Integer installmentNumber;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(nullable = false)
    private boolean paid;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected BillScheduleEntry() {
    }

    public BillScheduleEntry(
            AppUser owner,
            Bill bill,
            Integer installmentNumber,
            LocalDate dueDate,
            BigDecimal amount,
            String currencyCode
    ) {
        this.owner = owner;
        this.bill = bill;
        this.installmentNumber = installmentNumber;
        this.dueDate = dueDate;
        this.amount = amount;
        this.currencyCode = currencyCode;
        this.paid = false;
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

    public Bill getBill() {
        return bill;
    }

    public Integer getInstallmentNumber() {
        return installmentNumber;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public boolean isPaid() {
        return paid;
    }

    public OffsetDateTime getPaidAt() {
        return paidAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setPaid(boolean paid) {
        if (this.paid == paid) {
            return;
        }

        this.paid = paid;
        this.paidAt = paid ? OffsetDateTime.now(ZoneOffset.UTC) : null;
    }

    public void updateCurrencyCode(String currencyCode) {
        this.currencyCode = currencyCode;
    }
}
