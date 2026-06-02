package com.moneysnapshot.account;

import java.util.UUID;

public record BankChangedEvent(UUID ownerId) {
}
