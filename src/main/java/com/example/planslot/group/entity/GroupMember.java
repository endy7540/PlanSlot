package com.example.planslot.group.entity;

import com.example.planslot.member.entity.Member;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_member")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "group_member_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inviter_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Member inviter;

    @Column(name = "nickname", length = 30, nullable = false)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(name = "member_status", length = 20, nullable = false)
    private GroupMemberStatus memberStatus;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    @Builder
    private GroupMember(Group group, Member member, Member inviter, String nickname, GroupMemberStatus memberStatus) {
        this.group = group;
        this.member = member;
        this.inviter = inviter;
        this.nickname = nickname;
        this.memberStatus = memberStatus;
        this.joinedAt = LocalDateTime.now();
    }

    public static GroupMember createOwner(Group group, Member owner) {
        return GroupMember.builder()
                .group(group)
                .member(owner)
                .inviter(owner)
                .nickname(owner.getNickname())
                .memberStatus(GroupMemberStatus.ACTIVE)
                .build();
    }

    public static GroupMember createInvited(Group group, Member invitee, Member inviter) {
        return GroupMember.builder()
                .group(group)
                .member(invitee)
                .inviter(inviter)
                .nickname(invitee.getNickname())
                .memberStatus(GroupMemberStatus.WAITING)
                .build();
    }

    public void changeNickname(String nickname) {
        this.nickname = nickname;
    }

    public void changeStatus(GroupMemberStatus status) {
        this.memberStatus = status;
    }
}
