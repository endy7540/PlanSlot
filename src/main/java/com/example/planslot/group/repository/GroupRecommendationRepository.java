package com.example.planslot.group.repository;

import com.example.planslot.group.entity.GroupRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupRecommendationRepository extends JpaRepository<GroupRecommendation, Long> {
    List<GroupRecommendation> findAllByGroup_IdAndRequestedBy_IdOrderByBookmarkedAtDesc(Long groupId, Long memberId);
    
    // 모임에 저장된 전체 추천 목록을 가져올 경우
    List<GroupRecommendation> findAllByGroup_IdOrderByBookmarkedAtDesc(Long groupId);
}
