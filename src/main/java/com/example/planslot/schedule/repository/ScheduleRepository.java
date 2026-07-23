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

    @Query("SELECT s FROM Schedule s WHERE s.member.id = :memberId")
    List<Schedule> debugFindAllByMemberId(@Param("memberId") Long memberId);

    // 삭제되지 않은 단건 일정 조회 (상세 조회, 수정, 삭제 시 공통으로 사용)
    @Query("SELECT s FROM Schedule s WHERE s.scheduleId = :scheduleId AND s.deletedAt IS NULL")
    Optional<Schedule> findByIdAndNotDeleted(@Param("scheduleId") Long scheduleId);

    // 특정 기간 내 일정 조회를 위한 후보 일정 조회 (반복 일정 처리 목적)
    @Query("SELECT s FROM Schedule s WHERE s.member.id = :memberId " +
            "AND s.deletedAt IS NULL " +
            "AND (" +
            "  (s.scheduleType = com.example.planslot.schedule.entity.ScheduleType.DAILY AND (" +
            "     (s.endDate IS NOT NULL AND s.startDate <= :end AND s.endDate >= :start) OR " +
            "     (s.endDate IS NULL AND s.startDate BETWEEN :start AND :end)" +
            "  )) OR " +
            "  (s.scheduleType != com.example.planslot.schedule.entity.ScheduleType.DAILY AND s.startDate <= :end)" +
            ")")
    List<Schedule> findAllByMemberIdAndPeriodCandidate(@Param("memberId") Long memberId,
                                                       @Param("start") LocalDateTime start,
                                                       @Param("end") LocalDateTime end);

    // 요청한 일정이 실제로 해당 회원 소유인지 확인 (수정/삭제 권한 체크용)
    boolean existsByScheduleIdAndMember_Id(Long scheduleId, Long memberId);

    // 구글 이벤트 ID로 일정 찾기
    Optional<Schedule> findByGoogleEventIdAndMember_Id(String googleEventId, Long memberId);

    // 특정 회원의 제목, 시작일, 종료일이 일치하는 삭제되지 않은 일정이 있는지 확인
    @Query("SELECT s FROM Schedule s WHERE s.member.id = :memberId AND s.title = :title AND s.startDate = :startDate AND s.endDate = :endDate AND s.deletedAt IS NULL")
    List<Schedule> findDuplicateSchedule(@Param("memberId") Long memberId,
                                         @Param("title") String title,
                                         @Param("startDate") LocalDateTime startDate,
                                         @Param("endDate") LocalDateTime endDate);
}