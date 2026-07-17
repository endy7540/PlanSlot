package com.example.planslot.admin.controller;

import com.example.planslot.admin.service.AdminReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminReportService adminReportService;

    @GetMapping
    public String adminDashboard() {
        return "admin/dashboard";
    }

    @GetMapping("/reports")
    public String adminReports(Model model) {
        model.addAttribute("reports", adminReportService.getAllReports());
        return "admin/reports";
    }
}
