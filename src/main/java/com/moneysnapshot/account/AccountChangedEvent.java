package com.moneysnapshot.account;

import java.util.UUID;

public record AccountChangedEvent(UUID ownerId) {
}
