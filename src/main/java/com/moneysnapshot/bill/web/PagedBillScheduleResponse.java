package com.moneysnapshot.bill.web;

import java.util.List;
import org.springframework.data.domain.Page;

public record PagedBillScheduleResponse(
        BillScheduleSummaryResponse bill,
        List<BillScheduleEntryResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {

    public static PagedBillScheduleResponse from(BillScheduleSummaryResponse bill, Page<BillScheduleEntryResponse> page) {
        return new PagedBillScheduleResponse(
                bill,
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }
}
