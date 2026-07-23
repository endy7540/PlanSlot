package com.example.planslot.member.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import java.time.LocalDateTime;

@Entity
@Table(name = "member")
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class Member {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id")
    private Long id;

    @Column(name = "login_id", length = 50, unique = true)
    private String loginId;

    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "nickname", nullable = false, unique = true, length = 50)
    private String nickname;

    @Column(name = "address", length = 255)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status;

    @CreatedDate
    @Column(name = "created_at", nullable = false, length = 20)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "profile_image_url", length = 255)
    private String profileImageUrl;

    @Column(name = "suspended_until")
    private LocalDateTime suspendedUntil;

    @Column(name = "allow_activity_noti", nullable = false)
    @Builder.Default
    private boolean allowActivityNoti = true;

    @Column(name = "allow_marketing_noti", nullable = false)
    @Builder.Default
    private boolean allowMarketingNoti = true;

    @Column(name = "google_access_token", length = 500)
    private String googleAccessToken;

    @Column(name = "google_refresh_token", length = 500)
    private String googleRefreshToken;

    @Column(name = "google_sync_token", length = 500)
    private String googleSyncToken;

    @Column(name = "is_google_sync_enabled", nullable = false)
    @Builder.Default
    private boolean isGoogleSyncEnabled = false;

    public void updateGoogleTokens(String accessToken, String refreshToken) {
        this.googleAccessToken = accessToken;
        if (refreshToken != null) {
            this.googleRefreshToken = refreshToken;
        }
    }

    public void updateGoogleSyncToken(String syncToken) {
        this.googleSyncToken = syncToken;
    }
    
    public void setGoogleSyncEnabled(boolean enabled) {
        this.isGoogleSyncEnabled = enabled;
    }

    public enum Role {
        MEMBER, ADMIN
    }

    public enum Status {
        ACTIVE, BANNED, SUSPENDED, WITHDRAWN
    }

    public void updateInfo(String nickname, String password, String address) {
        if (nickname != null && !nickname.trim().isEmpty()) {
            this.nickname = nickname;
        }
        if (password != null && !password.trim().isEmpty()) {
            this.password = password;
        }
        if (address != null) {
            this.address = address;
        }
    }

    public void updateNotification(boolean allowActivityNoti, boolean allowMarketingNoti) {
        this.allowActivityNoti = allowActivityNoti;
        this.allowMarketingNoti = allowMarketingNoti;
    }

    public void updateProfileImage(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public void withdraw() {
        this.password = ""; // 비밀번호 파기
        this.nickname = "탈퇴회원_" + this.id; // 닉네임 익명화 및 재사용 방지/허용 처리
        this.address = null; // 주소 파기
        this.deletedAt = LocalDateTime.now(); // 탈퇴 일시 기록
        
        // 제재 기록(BANNED, SUSPENDED)은 합법적 보관 사유(악용 방지)에 따라 유지하고, 정상 회원만 탈퇴 상태로 변경
        if (this.status == Status.ACTIVE) {
            this.status = Status.WITHDRAWN;
            // 정상 탈퇴 회원은 개인정보 보호법에 따라 즉시 이메일과 아이디를 파기(익명화)합니다. (재가입 허용)
            this.email = "withdrawn_" + this.id + "@deleted.com";
            this.loginId = "deleted_" + this.id;
        } else {
            // 제재된 회원은 악용(재가입 등)을 막기 위해 이메일과 아이디를 법적 보관 기간 동안 그대로 유지합니다.
        }
    }

    public void updateRole(Role role) {
        this.role = role;
    }

    public void updateStatus(Status status, Integer suspendDays) {
        this.status = status;
        
        if (status == Status.SUSPENDED && suspendDays != null) {
            this.suspendedUntil = LocalDateTime.now().plusDays(suspendDays);
        } else if (status != Status.SUSPENDED) {
            this.suspendedUntil = null; // 정지가 풀리거나 영구정지/탈퇴 시 초기화
        }
    }
}
