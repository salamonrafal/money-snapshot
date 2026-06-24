package com.moneysnapshot.bill.web;

import jakarta.validation.constraints.NotNull;

public record UpdateBillScheduleEntryStatusRequest(
        @NotNull Boolean paid
) {
}
