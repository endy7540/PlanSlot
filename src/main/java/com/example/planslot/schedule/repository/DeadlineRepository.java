package com.example.planslot.schedule.repository;

import com.example.planslot.schedule.entity.Deadline;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

import java.time.LocalDate;

public interface DeadlineRepository extends JpaRepository<Deadline, Long> {

    Optional<Deadline> findBySchedule_ScheduleId(Long scheduleId);

    void deleteBySchedule_ScheduleId(Long scheduleId);

    @Query("SELECT d FROM Deadline d JOIN FETCH d.schedule s JOIN FETCH s.member m WHERE d.deadlineDate = :today")
    List<Deadline> findAllByDeadlineDate(@Param("today") LocalDate today);

    @Query("SELECT d FROM Deadline d JOIN FETCH d.schedule s JOIN FETCH s.member m WHERE d.notifyDaysBefore IS NOT NULL AND d.notifyDaysBefore > 0")
    List<Deadline> findAllWithNotifyDaysBefore();
}