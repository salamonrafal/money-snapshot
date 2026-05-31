package com.moneysnapshot.report;

import com.moneysnapshot.security.CurrentUserService;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ReportDataVersionService {

    private final EntityManager entityManager;
    private final CurrentUserService currentUserService;

    public ReportDataVersionService(EntityManager entityManager, CurrentUserService currentUserService) {
        this.entityManager = entityManager;
        this.currentUserService = currentUserService;
    }

    public ReportDataVersion currentVersion() {
        UUID ownerId = currentUserService.currentUserId();
        return new ReportDataVersion(
                aggregate("Account", "updatedAt", ownerId),
                aggregate("Bank", "updatedAt", ownerId),
                aggregate("AccountSnapshot", "updatedAt", ownerId),
                latestForecast(ownerId)
        );
    }

    private EntityAggregate aggregate(String entityName, String timestampField, UUID ownerId) {
        Object[] row = entityManager.createQuery(
                        "select count(entity), max(entity." + timestampField + ") "
                                + "from " + entityName + " entity "
                                + "where entity.owner.id = :ownerId",
                        Object[].class
                )
                .setParameter("ownerId", ownerId)
                .getSingleResult();
        return new EntityAggregate(
                ((Number) row[0]).longValue(),
                (OffsetDateTime) row[1]
        );
    }

    private ForecastAggregate latestForecast(UUID ownerId) {
        java.util.List<Object[]> rows = entityManager.createQuery(
                        """
                        select entity.id, entity.generatedAt
                        from SavingsForecastRun entity
                        where entity.owner.id = :ownerId
                        order by entity.generatedAt desc, entity.id desc
                        """,
                        Object[].class
                )
                .setParameter("ownerId", ownerId)
                .setMaxResults(1)
                .getResultList();
        Object[] row = rows.isEmpty() ? null : rows.get(0);
        if (row == null) {
            return new ForecastAggregate(null, null);
        }
        return new ForecastAggregate((UUID) row[0], (OffsetDateTime) row[1]);
    }

    public record ReportDataVersion(
            EntityAggregate accounts,
            EntityAggregate banks,
            EntityAggregate snapshots,
            ForecastAggregate latestForecast
    ) {
        public String cacheToken() {
            return String.join("|",
                    "accounts:" + accounts.cacheToken(),
                    "banks:" + banks.cacheToken(),
                    "snapshots:" + snapshots.cacheToken(),
                    "forecast:" + latestForecast.cacheToken()
            );
        }
    }

    public record EntityAggregate(long count, OffsetDateTime maxUpdatedAt) {
        public String cacheToken() {
            return count + ":" + (maxUpdatedAt == null ? "none" : maxUpdatedAt);
        }
    }

    public record ForecastAggregate(UUID id, OffsetDateTime generatedAt) {
        public String cacheToken() {
            return id == null ? "none" : id + ":" + generatedAt;
        }
    }
}
