package com.moneysnapshot.report;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "report_cache_refresh_state")
public class ReportCacheRefreshState {

    @Id
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private boolean dirty;

    @Column(name = "refresh_requested_at", nullable = false)
    private OffsetDateTime refreshRequestedAt;

    @Column(name = "refreshed_at")
    private OffsetDateTime refreshedAt;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    protected ReportCacheRefreshState() {
    }

    public ReportCacheRefreshState(UUID ownerId) {
        this.ownerId = ownerId;
        this.dirty = true;
        this.refreshRequestedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public boolean isDirty() {
        return dirty;
    }

    public void markDirty() {
        dirty = true;
        refreshRequestedAt = OffsetDateTime.now(ZoneOffset.UTC);
        lastError = null;
    }

    public void markRefreshed() {
        dirty = false;
        refreshedAt = OffsetDateTime.now(ZoneOffset.UTC);
        lastError = null;
    }

    public void markFailed(String error) {
        dirty = true;
        lastError = error == null ? null : error.substring(0, Math.min(1000, error.length()));
    }
}
