package com.example.planslot.schedule.service;

import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.schedule.dto.ScheduleDTO;
import com.example.planslot.schedule.entity.Deadline;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.entity.SourceType;
import com.example.planslot.schedule.repository.DeadlineRepository;
import com.example.planslot.schedule.repository.ScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final MemberRepository memberRepository;
    private final DeadlineRepository deadlineRepository;

    @Override
    @Transactional
    public ScheduleDTO createSchedule(Long memberId, ScheduleDTO requestDTO) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        Schedule schedule = Schedule.builder()
                .member(member)
                .title(requestDTO.getTitle())
                .description(requestDTO.getDescription())
                .scheduleType(requestDTO.getScheduleType())
                .startDate(requestDTO.getStartDate())
                .endDate(requestDTO.getEndDate())
                .isPublic(Boolean.TRUE.equals(requestDTO.getIsPublic()) ? "Y" : "N")
                .googleSyncYn("N")
                .sourceType(SourceType.MANUAL)
                .location(requestDTO.getLocation())
                .build();

        Schedule saved = scheduleRepository.save(schedule);

        if (requestDTO.getDeadlineDate() != null) {
            Deadline deadline = Deadline.builder()
                    .schedule(saved)
                    .deadlineDate(requestDTO.getDeadlineDate())
                    .notifyDaysBefore(requestDTO.getNotifyDaysBefore())
                    .build();
            deadlineRepository.save(deadline);
        }

        return ScheduleDTO.from(saved);
    }
    @Override
    public ScheduleDTO getSchedule(Long scheduleId, Long memberId) {
        Schedule schedule = getOwnedSchedule(scheduleId, memberId);
        Deadline deadline = deadlineRepository.findBySchedule_ScheduleId(scheduleId).orElse(null);
        return ScheduleDTO.fromWithDeadline(schedule, deadline);
    }

    @Override
    @Transactional
    public ScheduleDTO updateSchedule(Long scheduleId, Long memberId, ScheduleDTO requestDTO) {
        Schedule schedule = getOwnedSchedule(scheduleId, memberId);

        schedule.update(
                requestDTO.getTitle(),
                requestDTO.getDescription(),
                requestDTO.getScheduleType(),
                requestDTO.getStartDate(),
                requestDTO.getEndDate(),
                Boolean.TRUE.equals(requestDTO.getIsPublic()) ? "Y" : "N",
                requestDTO.getLocation()
        );

        if (requestDTO.getDeadlineDate() != null) {
            Deadline deadline = deadlineRepository.findBySchedule_ScheduleId(scheduleId)
                    .orElse(Deadline.builder().schedule(schedule).build());
            deadline.update(requestDTO.getDeadlineDate(), requestDTO.getNotifyDaysBefore());
            deadlineRepository.save(deadline);
        }

        return ScheduleDTO.from(schedule);
    }

    @Override
    public List<ScheduleDTO> getScheduleList(Long memberId) {
        return scheduleRepository.findAllByMemberId(memberId).stream()
                .map(ScheduleDTO::from)
                .toList();
    }

    @Override
    public List<ScheduleDTO> getScheduleListByPeriod(Long memberId, LocalDateTime start, LocalDateTime end) {
        return scheduleRepository.findAllByMemberIdAndPeriod(memberId, start, end).stream()
                .map(ScheduleDTO::from)
                .toList();
    }

    @Override
    @Transactional
    public void deleteSchedule(Long scheduleId, Long memberId) {
        Schedule schedule = getOwnedSchedule(scheduleId, memberId);
        schedule.softDelete();
    }

    // ===== 공통 로직 =====

    private Schedule getOwnedSchedule(Long scheduleId, Long memberId) {
        Schedule schedule = scheduleRepository.findByIdAndNotDeleted(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "일정을 찾을 수 없습니다."));

        if (!schedule.getMember().getId().equals(memberId)) {
            throw new AccessDeniedException("해당 일정에 대한 권한이 없습니다.");
        }

        return schedule;
    }
}