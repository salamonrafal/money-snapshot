package com.moneysnapshot.account;

import java.util.UUID;

public record AccountDeletionRequestedEvent(UUID accountId) {
}
