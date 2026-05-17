package com.moneysnapshot;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;

class MoneySnapshotApplicationTests {

    @Test
    void applicationCanBeConstructed() {
        assertNotNull(new MoneySnapshotApplication());
    }
}
