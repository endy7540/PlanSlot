package com.example.planslot.schedule.service;

import com.example.planslot.member.entity.Member;
import com.example.planslot.schedule.dto.ScheduleDTO;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.entity.ScheduleType;
import com.example.planslot.schedule.entity.SourceType;
import com.example.planslot.schedule.repository.ScheduleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScheduleServiceImplTest {

    @Mock
    private ScheduleRepository scheduleRepository;

    @InjectMocks
    private ScheduleServiceImpl scheduleService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testGetScheduleListByPeriod_WeeklyRecurrence() {
        // Given
        Long memberId = 1L;
        LocalDateTime start = LocalDateTime.of(2026, 7, 1, 0, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 7, 31, 23, 59, 59);

        Member member = mock(Member.class);
        when(member.getId()).thenReturn(memberId);

        // 2026-07-16 (목요일) 09:00 시작하는 주간 반복 일정
        Schedule weeklySchedule = Schedule.builder()
                .scheduleId(100L)
                .member(member)
                .title("주간 회의")
                .scheduleType(ScheduleType.WEEKLY)
                .startDate(LocalDateTime.of(2026, 7, 16, 9, 0, 0))
                .isPublic("N")
                .sourceType(SourceType.MANUAL)
                .build();

        when(scheduleRepository.findAllByMemberIdAndPeriodCandidate(memberId, start, end))
                .thenReturn(Arrays.asList(weeklySchedule));

        // When
        List<ScheduleDTO> result = scheduleService.getScheduleListByPeriod(memberId, start, end);

        // Then
        // 7월 16일, 7월 23일, 7월 30일 (총 3번의 목요일)에 일정이 팽창되어야 함.
        assertEquals(3, result.size());

        assertEquals(LocalDateTime.of(2026, 7, 16, 9, 0, 0), result.get(0).getStartDate());
        assertEquals(LocalDateTime.of(2026, 7, 23, 9, 0, 0), result.get(1).getStartDate());
        assertEquals(LocalDateTime.of(2026, 7, 30, 9, 0, 0), result.get(2).getStartDate());

        for (ScheduleDTO dto : result) {
            assertEquals(100L, dto.getScheduleId());
            assertEquals("주간 회의", dto.getTitle());
            assertEquals(ScheduleType.WEEKLY, dto.getScheduleType());
        }
    }
}
