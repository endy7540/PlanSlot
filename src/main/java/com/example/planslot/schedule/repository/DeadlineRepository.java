package com.example.planslot.schedule.repository;

import com.example.planslot.schedule.entity.Deadline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeadlineRepository extends JpaRepository<Deadline, Long> {

    Optional<Deadline> findBySchedule_ScheduleId(Long scheduleId);

    void deleteBySchedule_ScheduleId(Long scheduleId);
}