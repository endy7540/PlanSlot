package com.example.planslot.schedule.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ScheduleViewController {

    @GetMapping("/schedule/calendar")
    public String calendarPage() {
        return "schedule/calendar"; // templates/schedule/calendar.html
    }

    @GetMapping("/schedule/schedule")
    public String schedulePage() {
        return "schedule/schedule"; // templates/schedule/schedule.html
    }
}