package com.example.planslot.admin.controller;

import com.example.planslot.admin.service.AdminReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class
AdminApiController {

    private final AdminReportService adminReportService;

    @PostMapping("/reports/{reportId}/approve")
    public ResponseEntity<String> approveReport(@PathVariable String reportId) {
        if (reportId.startsWith("B_")) {
            adminReportService.approveReport(Long.parseLong(reportId.substring(2)));
        } else if (reportId.startsWith("C_")) {
            adminReportService.approveGroupReport(Long.parseLong(reportId.substring(2)));
        } else {
            return ResponseEntity.badRequest().body("잘못된 신고 ID 입니다.");
        }
        return ResponseEntity.ok("신고가 승인되어 대상이 처리되었습니다.");
    }

    @PostMapping("/reports/{reportId}/reject")
    public ResponseEntity<String> rejectReport(@PathVariable String reportId) {
        if (reportId.startsWith("B_")) {
            adminReportService.rejectReport(Long.parseLong(reportId.substring(2)));
        } else if (reportId.startsWith("C_")) {
            adminReportService.rejectGroupReport(Long.parseLong(reportId.substring(2)));
        } else {
            return ResponseEntity.badRequest().body("잘못된 신고 ID 입니다.");
        }
        return ResponseEntity.ok("신고가 반려되었습니다.");
    }

    private final com.example.planslot.admin.service.AdminMemberService adminMemberService;

    @PutMapping("/members/{memberId}/role")
    public ResponseEntity<String> updateMemberRole(@PathVariable Long memberId, @RequestBody Map<String, String> request) {
        adminMemberService.updateMemberRole(memberId, request.get("role"));
        return ResponseEntity.ok("회원 권한이 변경되었습니다.");
    }

    @PutMapping("/members/{memberId}/status")
    public ResponseEntity<String> updateMemberStatus(@PathVariable Long memberId, @RequestBody Map<String, String> request) {
        String status = request.get("status");
        Integer suspendDays = request.containsKey("suspendDays") && request.get("suspendDays") != null 
                ? Integer.parseInt(request.get("suspendDays")) 
                : null;
        adminMemberService.updateMemberStatus(memberId, status, suspendDays);
        return ResponseEntity.ok("회원 상태가 변경되었습니다.");
    }
}
