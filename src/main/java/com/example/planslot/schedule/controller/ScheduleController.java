package com.example.planslot.schedule.controller;

import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.schedule.dto.ScheduleDTO;
import com.example.planslot.schedule.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/schedule")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final MemberRepository memberRepository;

    @PostMapping
    public ResponseEntity<ScheduleDTO> createSchedule(
            @Valid @RequestBody ScheduleDTO requestDTO,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        ScheduleDTO response = scheduleService.createSchedule(memberId, requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
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

    @GetMapping("/{scheduleId}")
    public ResponseEntity<ScheduleDTO> getSchedule(
            @PathVariable Long scheduleId,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        return ResponseEntity.ok(scheduleService.getSchedule(scheduleId, memberId));
    }

    @PutMapping("/{scheduleId}")
    public ResponseEntity<ScheduleDTO> updateSchedule(
            @PathVariable Long scheduleId,
            @Valid @RequestBody ScheduleDTO requestDTO,
            Authentication authentication
    ) {
        Long memberId = extractMemberId(authentication);
        return ResponseEntity.ok(scheduleService.updateSchedule(scheduleId, memberId, requestDTO));
    }

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
    @PostMapping("/{scheduleId}/share")
    public ResponseEntity<Void> shareSchedule(
            @PathVariable Long scheduleId,
            @RequestParam Long groupId,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException("GroupSchedule 구현 후 연동 예정");
    }

    // JWT subject에는 email이 들어있음 (AuthServiceImpl.login 참고)
    private Long extractMemberId(Authentication authentication) {
        String email = authentication.getName();
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 사용자입니다."));
        return member.getId();
    }
}