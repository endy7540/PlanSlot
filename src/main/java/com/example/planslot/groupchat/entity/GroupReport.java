package com.example.planslot.groupchat.entity;

import com.example.planslot.group.entity.Group;
import com.example.planslot.group.entity.ReportStatus;
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
@Table(name = "group_report")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class GroupReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_message_id", nullable = false)
    private ChatMessage chatMessage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_member_id", nullable = false)
    private Member reportedMember;

    @Column(name = "reason", length = 30, nullable = false)
    private String reason;

    @Column(name = "reason_detail", length = 200)
    private String reasonDetail;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private ReportStatus status = ReportStatus.WAITING;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Builder
    public GroupReport(Group group, ChatMessage chatMessage, Member member, Member reportedMember, String reason, String reasonDetail, ReportStatus status) {
        this.group = group;
        this.chatMessage = chatMessage;
        this.member = member;
        this.reportedMember = reportedMember;
        this.reason = reason;
        this.reasonDetail = reasonDetail;
        if (status != null) {
            this.status = status;
        }
    }

    public void approve() {
        this.status = ReportStatus.APPROVED;
        this.processedAt = LocalDateTime.now();
    }

    public void reject() {
        this.status = ReportStatus.REJECTED;
        this.processedAt = LocalDateTime.now();
    }
}
