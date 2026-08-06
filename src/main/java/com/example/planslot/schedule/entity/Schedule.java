package com.example.planslot.schedule.entity;

import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

import java.time.LocalDate;

@Entity
@Table(name = "schedule")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Long scheduleId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "title", length = 50, nullable = false)
    private String title;

    @Column(name = "description", length = 400)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", length = 10, nullable = false)
    private ScheduleType scheduleType;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "is_public", length = 1, nullable = false)
    @Builder.Default
    private String isPublic = "N";

    @Column(name = "google_sync_yn", length = 1, nullable = false)
    @Builder.Default
    private String googleSyncYn = "N";

    @Column(name = "google_event_id", length = 200)
    private String googleEventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 20, nullable = false)
    private SourceType sourceType;

    @Column(name = "location", length = 200)
    private String location;

    @Column(name = "recurrence_end_date")
    private LocalDate recurrenceEndDate;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    // ===== 비즈니스 로직 =====

    public void update(String title, String description, ScheduleType scheduleType,
                       LocalDateTime startDate, LocalDateTime endDate,
                       String isPublic, String location, LocalDate recurrenceEndDate) {
        this.title = title;
        this.description = description;
        this.scheduleType = scheduleType;
        this.startDate = startDate;
        this.endDate = endDate;
        this.isPublic = isPublic;
        this.location = location;
        this.recurrenceEndDate = recurrenceEndDate;
        this.deletedAt = null; // Update 시 삭제 상태 해제 (Revive)
    }

    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    public void syncGoogleCalendar(String googleEventId) {
        this.googleSyncYn = "Y";
        this.googleEventId = googleEventId;
    }
}