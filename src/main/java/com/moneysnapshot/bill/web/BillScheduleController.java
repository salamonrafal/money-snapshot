package com.moneysnapshot.bill.web;

import com.moneysnapshot.bill.BillScheduleService;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/bills/{billId}/schedule")
public class BillScheduleController {

    private final BillScheduleService billScheduleService;

    public BillScheduleController(BillScheduleService billScheduleService) {
        this.billScheduleService = billScheduleService;
    }

    @GetMapping
    public PagedBillScheduleResponse listSchedule(
            @PathVariable UUID billId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        int pageNumber = Math.max(page == null ? 0 : page, 0);
        int pageSize = Math.max(1, Math.min(size == null ? 12 : size, 100));
        return billScheduleService.listSchedule(billId, PageRequest.of(pageNumber, pageSize));
    }

    @PatchMapping("/{entryId}")
    public BillScheduleEntryResponse updatePaidStatus(
            @PathVariable UUID billId,
            @PathVariable UUID entryId,
            @Valid @RequestBody UpdateBillScheduleEntryStatusRequest request
    ) {
        return billScheduleService.updatePaidStatus(billId, entryId, request.paid());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of(
                "message", exception.getReason() == null ? "Request failed." : exception.getReason()
        ));
    }
}
