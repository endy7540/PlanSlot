package com.example.planslot.schedule.controller;

import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.schedule.dto.AiImageDTO;
import com.example.planslot.schedule.service.AiImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/ai-image-schedule")
@RequiredArgsConstructor
public class AiImageController {

    private final AiImageService aiImageService;
    private final MemberRepository memberRepository;

    private Long getAuthenticatedMemberId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("인증되지 않은 사용자입니다.");
        }
        return memberRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."))
                .getId();
    }

    // 1. AI 일정 이미지 업로드 및 프롬프트 등록
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AiImageDTO.Response> uploadAiImage(
            @RequestPart("image") MultipartFile image,
            @RequestParam("promptType") String promptType,
            @RequestParam("promptText") String promptText,
            Authentication authentication
    ) {
        Long memberId = getAuthenticatedMemberId(authentication);
        AiImageDTO.Response response = aiImageService.uploadAiImage(memberId, image, promptType, promptText);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 2. AI 분석 요청 실행
    @PostMapping("/{requestId}/analyze")
    public ResponseEntity<AiImageDTO.Response> analyzeAiImage(
            @PathVariable Long requestId,
            Authentication authentication
    ) {
        Long memberId = getAuthenticatedMemberId(authentication);
        AiImageDTO.Response response = aiImageService.analyzeAiImage(memberId, requestId);
        return ResponseEntity.ok(response);
    }

    // 3. AI 분석 결과 조회
    @GetMapping("/{requestId}")
    public ResponseEntity<AiImageDTO.Response> getAiImageAnalysis(
            @PathVariable Long requestId,
            Authentication authentication
    ) {
        Long memberId = getAuthenticatedMemberId(authentication);
        AiImageDTO.Response response = aiImageService.getAiImageAnalysis(memberId, requestId);
        return ResponseEntity.ok(response);
    }

    // 4. 분석 결과 수정 및 재분석 요청
    @PatchMapping("/{requestId}")
    public ResponseEntity<AiImageDTO.Response> updateAiImageAnalysis(
            @PathVariable Long requestId,
            @RequestBody AiImageDTO.UpdateRequest updateRequest,
            Authentication authentication
    ) {
        Long memberId = getAuthenticatedMemberId(authentication);
        AiImageDTO.Response response = aiImageService.updateAiImageAnalysis(memberId, requestId, updateRequest);
        return ResponseEntity.ok(response);
    }

    // 5. 분석 데이터 캘린더 등록 확정 (다중 일정 수용)
    @PostMapping("/{requestId}/confirm")
    public ResponseEntity<AiImageDTO.Response> confirmAiImageSchedule(
            @PathVariable Long requestId,
            @RequestBody List<AiImageDTO.ConfirmRequest> confirmRequests,
            Authentication authentication
    ) {
        Long memberId = getAuthenticatedMemberId(authentication);
        AiImageDTO.Response response = aiImageService.confirmAiImageSchedule(memberId, requestId, confirmRequests);
        return ResponseEntity.ok(response);
    }

    // 6. 로그인 회원의 분석 목록 전체 조회
    @GetMapping
    public ResponseEntity<List<AiImageDTO.Response>> getAiImageList(
            Authentication authentication
    ) {
        Long memberId = getAuthenticatedMemberId(authentication);
        List<AiImageDTO.Response> list = aiImageService.getAiImageList(memberId);
        return ResponseEntity.ok(list);
    }
}
