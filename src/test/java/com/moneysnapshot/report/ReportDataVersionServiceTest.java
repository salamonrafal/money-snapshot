package com.moneysnapshot.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.security.CurrentUserService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReportDataVersionServiceTest {

    private final EntityManager entityManager = mock(EntityManager.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final ReportDataVersionService service = new ReportDataVersionService(entityManager, currentUserService);

    @Test
    void currentVersionScopesAllAggregateQueriesToCurrentOwner() {
        UUID ownerId = UUID.randomUUID();
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> accountQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> bankQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> snapshotQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> forecastQuery = mock(TypedQuery.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(entityManager.createQuery(anyString(), eq(Object[].class)))
                .thenReturn(accountQuery, bankQuery, snapshotQuery, forecastQuery);

        stubAggregateQuery(accountQuery, ownerId, 3L, OffsetDateTime.parse("2026-05-20T10:15:30Z"));
        stubAggregateQuery(bankQuery, ownerId, 2L, OffsetDateTime.parse("2026-05-21T10:15:30Z"));
        stubAggregateQuery(snapshotQuery, ownerId, 8L, OffsetDateTime.parse("2026-05-22T10:15:30Z"));
        UUID forecastId = UUID.randomUUID();
        stubForecastQuery(
                forecastQuery,
                ownerId,
                List.<Object[]>of(new Object[]{forecastId, OffsetDateTime.parse("2026-05-23T10:15:30Z")})
        );

        ReportDataVersionService.ReportDataVersion version = service.currentVersion();

        verify(accountQuery).setParameter("ownerId", ownerId);
        verify(bankQuery).setParameter("ownerId", ownerId);
        verify(snapshotQuery).setParameter("ownerId", ownerId);
        verify(forecastQuery).setParameter("ownerId", ownerId);
        verify(forecastQuery).setMaxResults(1);
        assertThat(version.accounts().count()).isEqualTo(3L);
        assertThat(version.banks().count()).isEqualTo(2L);
        assertThat(version.snapshots().count()).isEqualTo(8L);
        assertThat(version.latestForecast().id()).isEqualTo(forecastId);
    }

    @Test
    void currentVersionHandlesEmptyDataSets() {
        UUID ownerId = UUID.randomUUID();
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> accountQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> bankQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> snapshotQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> forecastQuery = mock(TypedQuery.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(entityManager.createQuery(anyString(), eq(Object[].class)))
                .thenReturn(accountQuery, bankQuery, snapshotQuery, forecastQuery);

        stubAggregateQuery(accountQuery, ownerId, 0L, null);
        stubAggregateQuery(bankQuery, ownerId, 0L, null);
        stubAggregateQuery(snapshotQuery, ownerId, 0L, null);
        stubForecastQuery(forecastQuery, ownerId, List.of());

        ReportDataVersionService.ReportDataVersion version = service.currentVersion();

        assertThat(version.accounts().cacheToken()).isEqualTo("0:none");
        assertThat(version.banks().cacheToken()).isEqualTo("0:none");
        assertThat(version.snapshots().cacheToken()).isEqualTo("0:none");
        assertThat(version.latestForecast().cacheToken()).isEqualTo("none");
        assertThat(version.cacheToken()).isEqualTo("accounts:0:none|banks:0:none|snapshots:0:none|forecast:none");
    }

    @Test
    void cacheTokenChangesWhenLatestForecastChanges() {
        OffsetDateTime timestamp = OffsetDateTime.parse("2026-05-29T12:00:00Z");
        ReportDataVersionService.ReportDataVersion first = new ReportDataVersionService.ReportDataVersion(
                new ReportDataVersionService.EntityAggregate(1L, timestamp),
                new ReportDataVersionService.EntityAggregate(1L, timestamp),
                new ReportDataVersionService.EntityAggregate(1L, timestamp),
                new ReportDataVersionService.ForecastAggregate(UUID.fromString("00000000-0000-0000-0000-000000000001"), timestamp)
        );
        ReportDataVersionService.ReportDataVersion second = new ReportDataVersionService.ReportDataVersion(
                new ReportDataVersionService.EntityAggregate(1L, timestamp),
                new ReportDataVersionService.EntityAggregate(1L, timestamp),
                new ReportDataVersionService.EntityAggregate(1L, timestamp),
                new ReportDataVersionService.ForecastAggregate(UUID.fromString("00000000-0000-0000-0000-000000000002"), timestamp.plusDays(1))
        );

        assertThat(first.cacheToken()).isNotEqualTo(second.cacheToken());
    }

    private void stubAggregateQuery(TypedQuery<Object[]> query, UUID ownerId, long count, OffsetDateTime maxUpdatedAt) {
        when(query.setParameter("ownerId", ownerId)).thenReturn(query);
        when(query.getSingleResult()).thenReturn(new Object[]{count, maxUpdatedAt});
    }

    private void stubForecastQuery(TypedQuery<Object[]> query, UUID ownerId, List<Object[]> rows) {
        when(query.setParameter("ownerId", ownerId)).thenReturn(query);
        when(query.setMaxResults(1)).thenReturn(query);
        when(query.getResultList()).thenReturn(rows);
    }
}
