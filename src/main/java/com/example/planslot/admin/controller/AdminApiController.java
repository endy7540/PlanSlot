package com.example.planslot.admin.controller;

import com.example.planslot.admin.service.AdminReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminApiController {

    private final AdminReportService adminReportService;

    @PostMapping("/reports/{reportId}/approve")
    public ResponseEntity<String> approveReport(@PathVariable Long reportId) {
        adminReportService.approveReport(reportId);
        return ResponseEntity.ok("신고가 승인되어 대상이 처리되었습니다.");
    }

    @PostMapping("/reports/{reportId}/reject")
    public ResponseEntity<String> rejectReport(@PathVariable Long reportId) {
        adminReportService.rejectReport(reportId);
        return ResponseEntity.ok("신고가 반려되었습니다.");
    }
}
