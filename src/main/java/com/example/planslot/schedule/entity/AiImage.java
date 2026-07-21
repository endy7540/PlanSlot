package com.example.planslot.schedule.entity;

import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_image_schedule")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(toBuilder = true)
@EntityListeners(AuditingEntityListener.class)
public class AiImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ai_image_schedule_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "image_url", length = 500, nullable = false)
    private String imageUrl;

    @Column(name = "prompt_type", length = 10, nullable = false)
    private String promptType;

    @Column(name = "prompt_text", length = 500, nullable = false)
    private String promptText;

    @Column(name = "status", length = 20, nullable = false)
    @Builder.Default
    private String status = "WAITING"; // WAITING, ANALYZING, COMPLETED, FAILED

    @Column(name = "extracted_title", length = 50)
    private String extractedTitle;

    @Column(name = "extracted_start_date")
    private LocalDateTime extractedStartDate;

    @Column(name = "extracted_end_date")
    private LocalDateTime extractedEndDate;

    @Column(name = "extracted_location", length = 200)
    private String extractedLocation;

    @Column(name = "confidence_score", precision = 5, scale = 2)
    private BigDecimal confidenceScore;

    @Column(name = "fail_reason", length = 200)
    private String failReason;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    private Schedule schedule;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    // ===== 비즈니스 로직 =====

    public void updateStatus(String status) {
        this.status = status;
    }

    public void completeAnalysis(String title, LocalDateTime startDate, LocalDateTime endDate, String location, BigDecimal confidenceScore) {
        this.status = "COMPLETED";
        this.extractedTitle = title;
        this.extractedStartDate = startDate;
        this.extractedEndDate = endDate;
        this.extractedLocation = location;
        this.confidenceScore = confidenceScore;
        this.analyzedAt = LocalDateTime.now();
        this.failReason = null;
    }

    public void failAnalysis(String failReason) {
        this.status = "FAILED";
        this.failReason = failReason;
        this.analyzedAt = LocalDateTime.now();
        this.extractedTitle = null;
        this.extractedStartDate = null;
        this.extractedEndDate = null;
        this.extractedLocation = null;
        this.confidenceScore = null;
    }

    public void confirmSchedule(Schedule schedule) {
        this.schedule = schedule;
        this.confirmedAt = LocalDateTime.now();
    }
}
