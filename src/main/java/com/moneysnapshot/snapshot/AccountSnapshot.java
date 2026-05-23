package com.moneysnapshot.snapshot;

import com.moneysnapshot.account.Account;
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

@Entity
@Table(name = "account_snapshots")
public class AccountSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private AppUser owner;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal balance;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "snapshot_type", length = 20)
    private SnapshotType snapshotType;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected AccountSnapshot() {
    }

    public AccountSnapshot(
            Account account,
            AppUser owner,
            LocalDate snapshotDate,
            BigDecimal balance,
            String note,
            SnapshotType snapshotType
    ) {
        this.account = account;
        this.owner = owner;
        this.snapshotDate = snapshotDate;
        this.balance = balance;
        this.note = note;
        this.snapshotType = snapshotType;
    }

    public void updateDetails(
            Account account,
            LocalDate snapshotDate,
            BigDecimal balance,
            String note,
            SnapshotType snapshotType
    ) {
        this.account = account;
        this.owner = account.getOwner();
        this.snapshotDate = snapshotDate;
        this.balance = balance;
        this.note = note;
        this.snapshotType = snapshotType;
    }

    public void updateSnapshotType(SnapshotType snapshotType) {
        this.snapshotType = snapshotType;
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

    public Account getAccount() {
        return account;
    }

    public AppUser getOwner() {
        return owner;
    }

    public LocalDate getSnapshotDate() {
        return snapshotDate;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public String getNote() {
        return note;
    }

    public SnapshotType getSnapshotType() {
        return snapshotType;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
