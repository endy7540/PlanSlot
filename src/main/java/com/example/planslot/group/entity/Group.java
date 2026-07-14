package com.example.planslot.group.entity;

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
@Table(name = "group_table")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "group_id")
    private Long id;

    @Column(name = "group_name", length = 30, nullable = false)
    private String groupName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private Member owner;

    @Column(name = "person_count", nullable = false)
    private int personCount;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private Group(String groupName, Member owner) {
        this.groupName = groupName;
        this.owner = owner;
        this.personCount = 1;
    }

    public void increasePersonCount() {
        this.personCount++;
    }

    public void decreasePersonCount() {
        this.personCount--;
    }

    public void updateGroupName(String groupName) {
        this.groupName = groupName;
    }

    public void changeOwner(Member newOwner) {
        this.owner = newOwner;
    }
}
