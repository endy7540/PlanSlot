package com.example.planslot.group.entity;

import com.example.planslot.member.entity.Member;
import com.example.planslot.schedule.entity.Schedule;
import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_schedule_share")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class GroupScheduleShare {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "share_card_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Schedule schedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sharer_id", nullable = false)
    private Member sharer;

    @Column(name = "shared_title", length = 100)
    private String sharedTitle;

    @Column(name = "shared_memo", length = 500)
    private String sharedMemo;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public GroupScheduleShare(Group group, Schedule schedule, Member sharer, String sharedTitle, String sharedMemo) {
        this.group = group;
        this.schedule = schedule;
        this.sharer = sharer;
        this.sharedTitle = sharedTitle;
        this.sharedMemo = sharedMemo;
    }
}
