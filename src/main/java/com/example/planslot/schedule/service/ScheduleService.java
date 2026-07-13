package com.example.planslot.schedule.service;

import com.example.planslot.schedule.dto.ScheduleDTO;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduleService {

    ScheduleDTO createSchedule(Long memberId, ScheduleDTO requestDTO);

    List<ScheduleDTO> getScheduleList(Long memberId);

    List<ScheduleDTO> getScheduleListByPeriod(Long memberId, LocalDateTime start, LocalDateTime end);

    ScheduleDTO getSchedule(Long scheduleId, Long memberId);

    ScheduleDTO updateSchedule(Long scheduleId, Long memberId, ScheduleDTO requestDTO);

    void deleteSchedule(Long scheduleId, Long memberId);
}