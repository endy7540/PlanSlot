package com.example.planslot.notification.entity;

// 알림 타입은 표시 형태만 구분하며 수신 거부 여부는 알림 설정 값으로 판단한다.
public enum NotificationType {
    MESSAGE,      // 일반 메시지 알림
    INVITATION,   // 초대 관련 표시용 알림
    APPLICATION   // 신청 관련 표시용 알림
}
