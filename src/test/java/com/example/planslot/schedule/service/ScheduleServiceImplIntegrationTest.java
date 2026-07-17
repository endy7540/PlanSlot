package com.example.planslot.schedule.service;

import com.example.planslot.schedule.dto.ScheduleDTO;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.repository.ScheduleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;

@SpringBootTest
class ScheduleServiceImplIntegrationTest {

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private ScheduleService scheduleService;

    @Test
    void debugSchedules() {
        System.out.println("========== START DEBUGGING SCHEDULES ==========");
        
        // 7월 조회
        LocalDateTime startJuly = LocalDateTime.of(2026, 7, 1, 0, 0, 0);
        LocalDateTime endJuly = LocalDateTime.of(2026, 7, 31, 23, 59, 59);
        List<ScheduleDTO> julyResults = scheduleService.getScheduleListByPeriod(1L, startJuly, endJuly);
        System.out.println("--- Expanded schedules for July 2026: " + julyResults.size());
        for (ScheduleDTO dto : julyResults) {
            System.out.println("July Item - ID: " + dto.getScheduleId() + ", Title: " + dto.getTitle() + ", StartDate: " + dto.getStartDate());
        }

        // 8월 조회
        LocalDateTime startAug = LocalDateTime.of(2026, 8, 1, 0, 0, 0);
        LocalDateTime endAug = LocalDateTime.of(2026, 8, 31, 23, 59, 59);
        List<ScheduleDTO> augResults = scheduleService.getScheduleListByPeriod(1L, startAug, endAug);
        System.out.println("--- Expanded schedules for August 2026: " + augResults.size());
        for (ScheduleDTO dto : augResults) {
            System.out.println("August Item - ID: " + dto.getScheduleId() + ", Title: " + dto.getTitle() + ", StartDate: " + dto.getStartDate());
        }

        System.out.println("========== END DEBUGGING SCHEDULES ==========");
    }
}
