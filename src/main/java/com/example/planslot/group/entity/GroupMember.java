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

    @Column(name = "unread_chat_count", nullable = false)
    private int unreadChatCount = 0;

    @Column(name = "is_favorite", nullable = false)
    private boolean isFavorite = false;

    @Column(name = "color", length = 7)
    private String color;

    @Builder
    private GroupMember(Group group, Member member, Member inviter, String nickname, GroupMemberStatus memberStatus) {
        this.group = group;
        this.member = member;
        this.inviter = inviter;
        this.nickname = nickname;
        this.memberStatus = memberStatus;
        this.joinedAt = LocalDateTime.now();
        this.unreadChatCount = 0;
        this.isFavorite = false;
        this.color = generateRandomColor();
    }

    private static String generateRandomColor() {
        String[] colors = {"#EF4444", "#F97316", "#F59E0B", "#10B981", "#6366F1", "#8B5CF6", "#D946EF", "#F43F5E", "#14B8A6", "#84CC16", "#059669", "#7C3AED"};
        return colors[(int) (Math.random() * colors.length)];
    }

    public static GroupMember createOwner(Group group, Member owner) {
        return GroupMember.builder()
                .group(group)
                .member(owner)
                .inviter(owner)
                .nickname(owner.getDisplayName())
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

    public void changeColor(String color) {
        this.color = color;
    }

    public void changeStatus(GroupMemberStatus status) {
        this.memberStatus = status;
    }

    public void incrementUnreadChatCount() {
        this.unreadChatCount++;
    }

    public void clearUnreadChatCount() {
        this.unreadChatCount = 0;
    }

    public void toggleFavorite() {
        this.isFavorite = !this.isFavorite;
    }

    public String getDisplayNickname() {
        if (this.memberStatus == GroupMemberStatus.WAITING) {
            return this.nickname;
        }
        if (this.nickname != null) {
            int hashIndex = this.nickname.lastIndexOf('#');
            if (hashIndex > 0 && hashIndex < this.nickname.length() - 1) {
                String tagPart = this.nickname.substring(hashIndex + 1);
                boolean isNumeric = true;
                for (int i = 0; i < tagPart.length(); i++) {
                    if (!Character.isDigit(tagPart.charAt(i))) {
                        isNumeric = false;
                        break;
                    }
                }
                if (isNumeric) {
                    return this.nickname.substring(0, hashIndex);
                }
            }
        }
        return this.nickname;
    }
}
