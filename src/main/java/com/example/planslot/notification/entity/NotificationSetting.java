package com.example.planslot.notification.entity;

import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

// 알림 수신 여부는 전체 설정과 각 기능별 설정값을 함께 확인하여 판단한다.
@Entity
@Table(name = "notification_setting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class NotificationSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_setting_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false, unique = true)
    private Member member;

    @Column(name = "all_enabled", nullable = false)
    private boolean allEnabled;

    @Column(name = "group_enabled", nullable = false)
    private boolean groupEnabled;

    @Column(name = "schedule_enabled", nullable = false)
    private boolean scheduleEnabled;

    @Column(name = "board_enabled", nullable = false)
    private boolean boardEnabled;

    @Column(name = "application_enabled", nullable = false)
    private boolean applicationEnabled;

    @Column(name = "reminder_enabled", nullable = false)
    private boolean reminderEnabled;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private NotificationSetting(Member member) {
        this.member = member;
        this.allEnabled = true;
        this.groupEnabled = true;
        this.scheduleEnabled = true;
        this.boardEnabled = true;
        this.applicationEnabled = true;
        this.reminderEnabled = true;
    }

    public void update(boolean allEnabled, boolean groupEnabled, boolean scheduleEnabled,
                       boolean boardEnabled, boolean applicationEnabled, boolean reminderEnabled) {
        this.allEnabled = allEnabled;
        this.groupEnabled = groupEnabled;
        this.scheduleEnabled = scheduleEnabled;
        this.boardEnabled = boardEnabled;
        this.applicationEnabled = applicationEnabled;
        this.reminderEnabled = reminderEnabled;
    }
}