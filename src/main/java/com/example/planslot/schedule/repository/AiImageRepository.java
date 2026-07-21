package com.example.planslot.schedule.repository;

import com.example.planslot.schedule.entity.AiImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiImageRepository extends JpaRepository<AiImage, Long> {

    // 특정 사용자의 AI 이미지 일정 분석 요청 내역 목록 조회
    List<AiImage> findAllByMemberId(Long memberId);

    // 특정 사용자의 특정 요청 내역 조회
    Optional<AiImage> findByIdAndMemberId(Long id, Long memberId);
}
