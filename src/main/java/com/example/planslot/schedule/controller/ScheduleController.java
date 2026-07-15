package com.example.planslot.schedule.controller;

import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.schedule.dto.ScheduleDTO;
import com.example.planslot.schedule.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Controller
@RequestMapping("/schedule")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final MemberRepository memberRepository;
    @ResponseBody
    @PostMapping
    public ResponseEntity<ScheduleDTO> createSchedule(
            @Valid @RequestBody ScheduleDTO requestDTO,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        ScheduleDTO response = scheduleService.createSchedule(memberId, requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @ResponseBody
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ScheduleDTO>> getScheduleList(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        List<ScheduleDTO> response = (start != null && end != null)
                ? scheduleService.getScheduleListByPeriod(memberId, start, end)
                : scheduleService.getScheduleList(memberId);
        return ResponseEntity.ok(response);
    }

    @ResponseBody
    @GetMapping(value = "/{scheduleId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ScheduleDTO> getSchedule(
            @PathVariable Long scheduleId,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        return ResponseEntity.ok(scheduleService.getSchedule(scheduleId, memberId));
    }

    @ResponseBody
    @PutMapping("/{scheduleId}")
    public ResponseEntity<ScheduleDTO> updateSchedule(
            @PathVariable Long scheduleId,
            @Valid @RequestBody ScheduleDTO requestDTO,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        return ResponseEntity.ok(scheduleService.updateSchedule(scheduleId, memberId, requestDTO));
    }

    @ResponseBody
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> deleteSchedule(
            @PathVariable Long scheduleId,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        scheduleService.deleteSchedule(scheduleId, memberId);
        return ResponseEntity.noContent().build();
    }

    // TODO: GroupSchedule 완성되면 구현
    @ResponseBody
    @PostMapping("/{scheduleId}/share")
    public ResponseEntity<Void> shareSchedule(
            @PathVariable Long scheduleId,
            @RequestParam Long groupId,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException("GroupSchedule 구현 후 연동 예정");
    }


    @GetMapping(produces = MediaType.TEXT_HTML_VALUE)
    public String calendarPage() {
        return "schedule/schedule"; // templates/schedule/schedule.html (캘린더 그리드)
    }

    @GetMapping(value = "/new", produces = MediaType.TEXT_HTML_VALUE)
    public String newSchedulePage() {
        return "schedule/schedule-register"; // templates/schedule/schedule-register.html (등록 폼)
    }

    @GetMapping(value = "/{scheduleId}", produces = MediaType.TEXT_HTML_VALUE)
    public String scheduleDetailPage(@PathVariable Long scheduleId) {
        return "schedule/schedule-detail"; // templates/schedule/schedule-detail.html (상세 조회 뷰)
    }

    @GetMapping(value = "/{scheduleId}/edit", produces = MediaType.TEXT_HTML_VALUE)
    public String scheduleEditPage(@PathVariable Long scheduleId) {
        return "schedule/schedule-modify"; // templates/schedule/schedule-modify.html (수정 폼)
    }
    private Long extractMemberId(Authentication authentication) {
        String email = authentication.getName();
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 사용자입니다."));
        return member.getId();
    }
}