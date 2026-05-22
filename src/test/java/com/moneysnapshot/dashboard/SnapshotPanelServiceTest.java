package com.moneysnapshot.dashboard;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class SnapshotPanelServiceTest {

    @Test
    void resolvePeriodStartUsesCurrentMonthWhenCurrentDateReachedConfiguredDay() {
        LocalDate result = SnapshotPanelService.resolvePeriodStart(LocalDate.of(2026, 5, 22), 15);

        assertEquals(LocalDate.of(2026, 5, 15), result);
    }

    @Test
    void resolvePeriodStartFallsBackToPreviousMonthWhenCurrentDateIsBeforeConfiguredDay() {
        LocalDate result = SnapshotPanelService.resolvePeriodStart(LocalDate.of(2026, 5, 10), 15);

        assertEquals(LocalDate.of(2026, 4, 15), result);
    }

    @Test
    void resolvePeriodStartClampsConfiguredDayToMonthLength() {
        LocalDate result = SnapshotPanelService.resolvePeriodStart(LocalDate.of(2026, 2, 27), 31);

        assertEquals(LocalDate.of(2026, 1, 31), result);
    }
}
