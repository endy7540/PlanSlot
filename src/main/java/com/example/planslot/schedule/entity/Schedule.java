package com.example.planslot.schedule.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "schedule")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Long scheduleId;

    // TODO: Member 엔티티 완성되면 @ManyToOne(fetch = FetchType.LAZY)
    //       @JoinColumn(name = "member_id", nullable = false) private Member member; 로 교체
    @Column(name = "member_id", nullable = false)
    private Long memberId;

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

    // TODO: 공용 컨버터(YnToBooleanConverter) 생기면 @Convert 붙여서 Boolean으로 교체
    @Column(name = "is_public", length = 1, nullable = false)
    @Builder.Default
    private String isPublic = "N";

    // TODO: 공용 컨버터 생기면 @Convert 붙여서 Boolean으로 교체
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

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ===== 비즈니스 로직 =====

    public void update(String title, String description, ScheduleType scheduleType,
                       LocalDateTime startDate, LocalDateTime endDate,
                       String isPublic, String location) {
        this.title = title;
        this.description = description;
        this.scheduleType = scheduleType;
        this.startDate = startDate;
        this.endDate = endDate;
        this.isPublic = isPublic;
        this.location = location;
    }

    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    public void syncGoogleCalendar(String googleEventId) {
        this.googleSyncYn = "Y";
        this.googleEventId = googleEventId;
    }
}