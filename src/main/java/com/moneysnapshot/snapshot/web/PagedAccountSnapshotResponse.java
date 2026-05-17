package com.moneysnapshot.snapshot.web;

import java.util.List;
import org.springframework.data.domain.Page;

public record PagedAccountSnapshotResponse(
        List<AccountSnapshotResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {

    public static PagedAccountSnapshotResponse from(Page<AccountSnapshotResponse> page) {
        return new PagedAccountSnapshotResponse(
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
