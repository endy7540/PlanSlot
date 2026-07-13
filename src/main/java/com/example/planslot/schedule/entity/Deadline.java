package com.example.planslot.schedule.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "schedule_deadline")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class Deadline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_deadline_id")
    private Long deadlineId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id", nullable = false, unique = true)
    private Schedule schedule;

    @Column(name = "deadline_date", nullable = false)
    private LocalDate deadlineDate;

    @Column(name = "notify_days_before", nullable = false)
    private Integer notifyDaysBefore;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public void update(LocalDate deadlineDate, Integer notifyDaysBefore) {
        this.deadlineDate = deadlineDate;
        this.notifyDaysBefore = notifyDaysBefore;
    }
}