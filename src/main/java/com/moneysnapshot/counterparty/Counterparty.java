package com.moneysnapshot.counterparty;

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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "counterparties")
public class Counterparty {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(name = "normalized_name", nullable = false, length = 180)
    private String normalizedName;

    @Column(name = "bank_account_number", nullable = false, length = 64)
    private String bankAccountNumber;

    @Column(length = 500)
    private String address;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Counterparty() {
    }

    public Counterparty(AppUser owner, String name, String normalizedName, String bankAccountNumber, String address, String note) {
        this.owner = owner;
        this.name = name;
        this.normalizedName = normalizedName;
        this.bankAccountNumber = bankAccountNumber;
        this.address = address;
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

    public String getName() {
        return name;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public String getBankAccountNumber() {
        return bankAccountNumber;
    }

    public String getAddress() {
        return address;
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

    public void updateDetails(String name, String normalizedName, String bankAccountNumber, String address, String note) {
        this.name = name;
        this.normalizedName = normalizedName;
        this.bankAccountNumber = bankAccountNumber;
        this.address = address;
        this.note = note;
    }
}
