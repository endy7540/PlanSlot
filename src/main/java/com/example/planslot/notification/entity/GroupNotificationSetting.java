package com.example.planslot.notification.entity;

import com.example.planslot.group.entity.Group;
import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

// 특정 모임의 알림 수신 여부를 저장하며 전체·기능별 설정과 함께 확인한다.
@Entity
@Table(name = "group_notification_setting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class GroupNotificationSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "group_setting_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "is_enabled", nullable = false)
    private boolean enabled;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private GroupNotificationSetting(Group group, Member member) {
        this.group = group;
        this.member = member;
        this.enabled = true;
    }

    public void update(boolean enabled) {
        this.enabled = enabled;
    }
}