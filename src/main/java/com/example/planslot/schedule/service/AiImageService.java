package com.example.planslot.schedule.service;

import com.example.planslot.schedule.dto.AiImageDTO;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AiImageService {

    // AI 일정 이미지 업로드
    AiImageDTO.Response uploadAiImage(Long memberId, MultipartFile file, String promptType, String promptText);

    // AI 일정 이미지 분석 실행 (시뮬레이션 및 실제 클로드 API 연동)
    AiImageDTO.Response analyzeAiImage(Long memberId, Long requestId);

    // AI 일정 이미지 분석 결과 조회
    AiImageDTO.Response getAiImageAnalysis(Long memberId, Long requestId);

    // AI 일정 이미지 분석 결과 수정 또는 재분석 요청
    AiImageDTO.Response updateAiImageAnalysis(Long memberId, Long requestId, AiImageDTO.UpdateRequest updateRequest);

    // 분석 데이터를 캘린더 등록 확정 (다중 일정 일괄 등록 지원)
    AiImageDTO.Response confirmAiImageSchedule(Long memberId, Long requestId, List<AiImageDTO.ConfirmRequest> confirmRequests);

    // 로그인 회원의 AI 일정 이미지 리스트 전체 조회
    List<AiImageDTO.Response> getAiImageList(Long memberId);

    // AI 일정 이미지 분석 요청 데이터 및 서버 물리 파일 일괄 삭제
    void deleteAiImageAnalysis(Long memberId, Long requestId);
}
