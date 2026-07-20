package com.example.planslot.boardreport.entity;

import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "board_report", uniqueConstraints = {@UniqueConstraint(name = "uk_board_report_reporter_target",
                columnNames = {"reporter_id", "target_type", "target_id"})})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class BoardReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_id")
    private Long reportId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    private Member reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private BoardReportTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_code", nullable = false, length = 30)
    private BoardReportReasonCode reasonCode;

    @Column(name = "reason_detail", columnDefinition = "TEXT")
    private String reasonDetail;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private BoardReportStatus status;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Builder
    private BoardReport(
            Member reporter,
            BoardReportTargetType targetType,
            Long targetId,
            BoardReportReasonCode reasonCode,
            String reasonDetail
    ) {
        this.reporter = reporter;
        this.targetType = targetType;
        this.targetId = targetId;
        this.reasonCode = reasonCode;
        this.reasonDetail = reasonDetail;
        this.status = BoardReportStatus.WAITING;
    }

    public void approve() {
        this.status = BoardReportStatus.APPROVED;
        this.processedAt = LocalDateTime.now();
    }

    public void reject() {
        this.status = BoardReportStatus.REJECTED;
        this.processedAt = LocalDateTime.now();
    }
}
