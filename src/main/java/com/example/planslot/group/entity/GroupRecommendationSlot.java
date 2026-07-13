package com.example.planslot.group.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_recommendation_slot")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GroupRecommendationSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "recommendation_slot_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recommendation_id", nullable = false)
    private GroupRecommendation groupRecommendation;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(name = "available_count", nullable = false)
    private int availableCount;

    @Column(name = "is_all_available", nullable = false)
    private boolean isAllAvailable;

    @Column(name = "is_selected", nullable = false)
    private boolean isSelected = false;

    @Builder
    public GroupRecommendationSlot(GroupRecommendation groupRecommendation, LocalDateTime startTime, LocalDateTime endTime, int availableCount, boolean isAllAvailable, boolean isSelected) {
        this.groupRecommendation = groupRecommendation;
        this.startTime = startTime;
        this.endTime = endTime;
        this.availableCount = availableCount;
        this.isAllAvailable = isAllAvailable;
        this.isSelected = isSelected;
    }
}
