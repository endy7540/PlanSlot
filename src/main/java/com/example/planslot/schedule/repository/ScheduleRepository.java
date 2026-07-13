package com.example.planslot.schedule.repository;

import com.example.planslot.schedule.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    // 회원의 삭제되지 않은 전체 일정 목록 조회
    @Query("SELECT s FROM Schedule s WHERE s.member.id = :memberId AND s.deletedAt IS NULL")
    List<Schedule> findAllByMemberId(@Param("memberId") Long memberId);

    // 삭제되지 않은 단건 일정 조회 (상세 조회, 수정, 삭제 시 공통으로 사용)
    @Query("SELECT s FROM Schedule s WHERE s.scheduleId = :scheduleId AND s.deletedAt IS NULL")
    Optional<Schedule> findByIdAndNotDeleted(@Param("scheduleId") Long scheduleId);

    // 특정 기간 내 일정 조회 (캘린더 화면에서 월/주 단위 조회 시 사용)
    @Query("SELECT s FROM Schedule s WHERE s.member.id = :memberId " +
            "AND s.deletedAt IS NULL " +
            "AND s.startDate BETWEEN :start AND :end")
    List<Schedule> findAllByMemberIdAndPeriod(@Param("memberId") Long memberId,
                                              @Param("start") LocalDateTime start,
                                              @Param("end") LocalDateTime end);

    // 요청한 일정이 실제로 해당 회원 소유인지 확인 (수정/삭제 권한 체크용)
    boolean existsByScheduleIdAndMember_Id(Long scheduleId, Long memberId);
}