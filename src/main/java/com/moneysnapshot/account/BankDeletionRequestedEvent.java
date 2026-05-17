package com.moneysnapshot.account;

import java.util.UUID;

public record BankDeletionRequestedEvent(UUID bankId) {
}
