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

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final MemberRepository memberRepository;
    private final DeadlineRepository deadlineRepository;
    private final GoogleCalendarService googleCalendarService;

    @Override
    @Transactional
    public ScheduleDTO createSchedule(Long memberId, ScheduleDTO requestDTO) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        if (requestDTO.getDeadlineDate() != null && requestDTO.getStartDate() != null) {
            if (requestDTO.getDeadlineDate().isAfter(requestDTO.getStartDate().toLocalDate())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "데드라인 날짜는 일정 시작일보다 이후일 수 없습니다.");
            }
        }

        if (requestDTO.getStartDate() != null && requestDTO.getEndDate() != null) {
            if (requestDTO.getEndDate().isBefore(requestDTO.getStartDate())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종료 날짜는 시작 날짜보다 빠를 수 없습니다.");
            }
        }

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
                .recurrenceEndDate(requestDTO.getRecurrenceEndDate())
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

        // 구글 캘린더 Push (비동기로 처리하거나 에러 발생 시 무시)
        if (member.isGoogleSyncEnabled() && member.getGoogleAccessToken() != null) {
            String googleEventId = googleCalendarService.insertEvent(member, saved);
            if (googleEventId != null) {
                saved.syncGoogleCalendar(googleEventId);
                // 트랜잭션 내이므로 변경 감지(Dirty checking)로 자동 업데이트 됨
            }
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

        if (requestDTO.getDeadlineDate() != null && requestDTO.getStartDate() != null) {
            if (requestDTO.getDeadlineDate().isAfter(requestDTO.getStartDate().toLocalDate())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "데드라인 날짜는 일정 시작일보다 이후일 수 없습니다.");
            }
        }

        if (requestDTO.getStartDate() != null && requestDTO.getEndDate() != null) {
            if (requestDTO.getEndDate().isBefore(requestDTO.getStartDate())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종료 날짜는 시작 날짜보다 빠를 수 없습니다.");
            }
        }

        schedule.update(
                requestDTO.getTitle(),
                requestDTO.getDescription(),
                requestDTO.getScheduleType(),
                requestDTO.getStartDate(),
                requestDTO.getEndDate(),
                Boolean.TRUE.equals(requestDTO.getIsPublic()) ? "Y" : "N",
                requestDTO.getLocation(),
                requestDTO.getRecurrenceEndDate()
        );

        if (requestDTO.getDeadlineDate() != null) {
            Deadline deadline = deadlineRepository.findBySchedule_ScheduleId(scheduleId)
                    .orElse(Deadline.builder().schedule(schedule).build());
            deadline.update(requestDTO.getDeadlineDate(), requestDTO.getNotifyDaysBefore());
            deadlineRepository.save(deadline);
        }

        // 구글 캘린더 연동되어 있다면 Update
        Member member = schedule.getMember();
        if (member.isGoogleSyncEnabled() && "Y".equals(schedule.getGoogleSyncYn()) && member.getGoogleAccessToken() != null) {
            googleCalendarService.updateEvent(member, schedule);
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
    public List<com.example.planslot.schedule.entity.Schedule> debugGetAllSchedules(Long memberId) {
        return scheduleRepository.debugFindAllByMemberId(memberId);
    }

    @Override
    public List<ScheduleDTO> getScheduleListByPeriod(Long memberId, LocalDateTime start, LocalDateTime end) {
        List<Schedule> candidates = scheduleRepository.findAllByMemberIdAndPeriodCandidate(memberId, start, end);
        List<ScheduleDTO> result = new ArrayList<>();

        for (Schedule s : candidates) {
            if (s.getScheduleType() == null || 
                s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.DAILY ||
                s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.NONE) {
                result.add(ScheduleDTO.from(s));
                continue;
            }

            ScheduleDTO baseDto = ScheduleDTO.from(s);
            LocalDateTime eventStart = s.getStartDate();
            LocalDateTime eventEnd = s.getEndDate();
            Duration duration = (eventStart != null && eventEnd != null) ? Duration.between(eventStart, eventEnd) : null;

            LocalDate searchStart = start.toLocalDate();
            LocalDate searchEnd = end.toLocalDate();
            LocalDate limitStart = eventStart.toLocalDate();
            LocalDate limitEnd = s.getRecurrenceEndDate();

            for (LocalDate date = searchStart; !date.isAfter(searchEnd); date = date.plusDays(1)) {
                if (date.isBefore(limitStart)) {
                    continue;
                }
                if (limitEnd != null && date.isAfter(limitEnd)) {
                    continue;
                }

                boolean matches = false;
                if (s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.WEEKLY) {
                    matches = (date.getDayOfWeek() == limitStart.getDayOfWeek());
                } else if (s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.MONTHLY) {
                    int targetDay = limitStart.getDayOfMonth();
                    int maxDayInMonth = date.lengthOfMonth();
                    int actualDay = Math.min(targetDay, maxDayInMonth);
                    matches = (date.getDayOfMonth() == actualDay);
                } else if (s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.YEARLY) {
                    int targetMonth = limitStart.getMonthValue();
                    int targetDay = limitStart.getDayOfMonth();
                    if (date.getMonthValue() == targetMonth) {
                        if (targetMonth == 2 && targetDay == 29 && !date.isLeapYear()) {
                            matches = (date.getDayOfMonth() == 28);
                        } else {
                            matches = (date.getDayOfMonth() == targetDay);
                        }
                    }
                }

                if (matches) {
                    LocalDateTime newStart = date.atTime(eventStart.toLocalTime());
                    LocalDateTime newEnd = (duration != null) ? newStart.plus(duration) : null;
                    result.add(baseDto.toBuilder()
                            .startDate(newStart)
                            .endDate(newEnd)
                            .build());
                }
            }
        }
        return result;
    }

    @Override
    @Transactional
    public void deleteSchedule(Long scheduleId, Long memberId) {
        Schedule schedule = getOwnedSchedule(scheduleId, memberId);
        
        // 구글 캘린더 연동되어 있다면 Delete
        Member member = schedule.getMember();
        if (member.isGoogleSyncEnabled() && "Y".equals(schedule.getGoogleSyncYn()) && member.getGoogleAccessToken() != null) {
            googleCalendarService.deleteEvent(member, schedule.getGoogleEventId());
        }
        
        schedule.softDelete();
    }

    @Override
    @Transactional
    public void syncFromGoogleCalendar(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        if (!member.isGoogleSyncEnabled() || member.getGoogleAccessToken() == null) {
            return;
        }

        List<Event> events = googleCalendarService.fetchEvents(member);
        for (Event e : events) {
            try {
                String gId = e.getId();
                Optional<Schedule> existingOpt = scheduleRepository.findByGoogleEventIdAndMember_Id(gId, memberId);

                if ("cancelled".equals(e.getStatus())) {
                    existingOpt.ifPresent(Schedule::softDelete);
                    continue;
                }

                String title = e.getSummary() != null ? e.getSummary() : "(제목 없음)";
                if (title.length() > 50) title = title.substring(0, 50);

                String description = e.getDescription();
                if (description != null && description.length() > 400) {
                    description = description.substring(0, 400);
                }

                String location = e.getLocation();
                if (location != null && location.length() > 200) {
                    location = location.substring(0, 200);
                }

                LocalDateTime start = parseEventDateTime(e.getStart(), false);
                LocalDateTime end = parseEventDateTime(e.getEnd(), true);
                if (start == null) continue;
                if (end == null) end = start;

                if (existingOpt.isPresent()) {
                    Schedule schedule = existingOpt.get();
                    // Update
                    schedule.update(
                            title, description,
                            schedule.getScheduleType(), // 기존 타입 유지
                            start, end,
                            schedule.getIsPublic(), location, schedule.getRecurrenceEndDate() // 기존 반복종료일 유지
                    );
                } else {
                    // Insert
                    Schedule schedule = Schedule.builder()
                            .member(member)
                            .title(title)
                            .description(description)
                            .scheduleType(com.example.planslot.schedule.entity.ScheduleType.DAILY)
                            .startDate(start)
                            .endDate(end)
                            .isPublic("N")
                            .googleSyncYn("Y")
                            .googleEventId(gId)
                            .sourceType(SourceType.GOOGLE_CALENDAR)
                            .location(location)
                            .build();
                    scheduleRepository.save(schedule);
                }
            } catch (Exception ex) {
                // 특정 이벤트 처리 실패 시 다른 이벤트에 영향을 주지 않도록 로깅만 함
                System.err.println("Failed to sync event " + e.getId() + ": " + ex.getMessage());
            }
        }
    }

    private LocalDateTime parseEventDateTime(EventDateTime edt, boolean isEnd) {
        if (edt == null) return null;
        if (edt.getDateTime() != null) {
            return LocalDateTime.ofInstant(Instant.ofEpochMilli(edt.getDateTime().getValue()), ZoneId.systemDefault());
        } else if (edt.getDate() != null) {
            String dateStr = edt.getDate().toString();
            if (dateStr.length() > 10) {
                dateStr = dateStr.substring(0, 10);
            }
            LocalDateTime ldt = LocalDate.parse(dateStr).atStartOfDay();
            if (isEnd) {
                // 구글 캘린더의 종일 일정 종료일은 다음날 00:00이므로, 당일 23:59:59로 보정
                return ldt.minusSeconds(1);
            }
            return ldt;
        }
        return null;
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