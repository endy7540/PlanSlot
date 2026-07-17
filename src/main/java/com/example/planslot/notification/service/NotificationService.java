package com.example.planslot.notification.service;

import com.example.planslot.notification.dto.GroupNotificationSettingDTO;
import com.example.planslot.notification.dto.NotificationDTO;
import com.example.planslot.notification.dto.NotificationSettingDTO;

import java.util.List;

// 다른 기능은 알림 데이터를 전달해 메서드 하나만 호출하며,
// 전체·기능별·모임별 수신 설정 확인과 저장은 구현체에서 처리한다.
public interface NotificationService {

    // 게시판 댓글 등 일반 게시판 알림
    void sendBoardMessage(Long receiverId, String title, String content,
                          String targetType, Long targetId);

    // 모임 정보 변경 등 일반 모임 알림
    void sendGroupMessage(Long receiverId, Long groupId, String title,
                          String content, String targetType, Long targetId);

    // 공유 캘린더 일정 등록 및 수정 알림
    void sendScheduleMessage(Long receiverId, Long groupId, String title,
                             String content, String targetType, Long targetId);

    // 개인 일정 시작 전 또는 마감 임박 알림
    void sendReminderMessage(Long receiverId, String title, String content,
                             String targetType, Long targetId);

    // 특정 모임 일정의 시작 전 알림
    void sendGroupReminderMessage(Long receiverId, Long groupId, String title,
                                  String content, String targetType, Long targetId);

    // 공유 캘린더 또는 모임 초대 알림
    void sendGroupInvitation(Long receiverId, String title, String content,
                             String targetType, Long targetId);

    // 모집 게시글을 통한 사용자 초대 알림
    void sendApplicationInvitation(Long receiverId, String title, String content,
                                   String targetType, Long targetId);

    // 게시글 신청, 수락 및 거절 결과 알림
    void sendApplicationNotification(Long receiverId, String title, String content,
                                     String targetType, Long targetId);

    // 내 알림 목록 조회 (showAll=false: 읽지 않은 것만, showAll=true: 전체)
    List<NotificationDTO> getNotifications(Long memberId, boolean showAll);

    // 안 읽은 알림 개수 조회
    long getUnreadCount(Long memberId);

    // 알림 한 개 읽음 처리
    void readNotification(Long notificationId, Long memberId);

    // 내 알림 전체 읽음 처리
    void readAllNotifications(Long memberId);

    // 전체 및 기능별 알림 설정 조회
    NotificationSettingDTO getNotificationSetting(Long memberId);

    // 전체 및 기능별 알림 설정 수정
    NotificationSettingDTO updateNotificationSetting(Long memberId, NotificationSettingDTO notificationSettingDTO);

    // 내가 가입한 모임별 알림 설정 조회
    List<GroupNotificationSettingDTO> getGroupNotificationSettings(Long memberId);

    // 특정 모임 알림 설정 수정
    GroupNotificationSettingDTO updateGroupNotificationSetting(Long memberId, Long groupId, boolean enabled);
}