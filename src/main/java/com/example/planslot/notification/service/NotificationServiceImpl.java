package com.example.planslot.notification.service;

import com.example.planslot.group.entity.Group;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.entity.GroupMemberStatus;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.notification.dto.GroupNotificationSettingDTO;
import com.example.planslot.notification.dto.NotificationDTO;
import com.example.planslot.notification.dto.NotificationSettingDTO;
import com.example.planslot.notification.entity.GroupNotificationSetting;
import com.example.planslot.notification.entity.Notification;
import com.example.planslot.notification.entity.NotificationSetting;
import com.example.planslot.notification.entity.NotificationType;
import com.example.planslot.notification.repository.GroupNotificationSettingRepository;
import com.example.planslot.notification.repository.NotificationRepository;
import com.example.planslot.notification.repository.NotificationSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationSettingRepository notificationSettingRepository;
    private final GroupNotificationSettingRepository groupNotificationSettingRepository;
    private final MemberRepository memberRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final NotificationSseService notificationSseService;

    // 게시판 알림 전송
    @Override
    public void sendBoardMessage(Long receiverId, String title, String content, String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isBoardEnabled()) {
            return;
        }

        saveNotification(receiver, NotificationType.MESSAGE, title, content, targetType, targetId);
    }

    // 모임 알림 전송
    @Override
    public void sendGroupMessage(Long receiverId, Long groupId, String title, String content,
                                 String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isGroupEnabled()) {
            return;
        }

        if (!isGroupNotificationEnabled(groupId, receiverId)) {
            return;
        }

        saveNotification(receiver, NotificationType.MESSAGE, title, content, targetType, targetId);
    }

    // 모임 일정 알림 전송
    @Override
    public void sendScheduleMessage(Long receiverId, Long groupId, String title, String content,
                                    String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isScheduleEnabled()) {
            return;
        }

        if (!isGroupNotificationEnabled(groupId, receiverId)) {
            return;
        }

        saveNotification(receiver, NotificationType.MESSAGE, title, content, targetType, targetId);
    }

    // 개인 리마인더 알림 전송
    @Override
    public void sendReminderMessage(Long receiverId, String title, String content, String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isReminderEnabled()) {
            return;
        }

        saveNotification(receiver, NotificationType.MESSAGE, title, content, targetType, targetId);
    }

    // 모임 리마인더 알림 전송
    @Override
    public void sendGroupReminderMessage(Long receiverId, Long groupId, String title, String content,
                                         String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isReminderEnabled()) {
            return;
        }

        if (!isGroupNotificationEnabled(groupId, receiverId)) {
            return;
        }

        saveNotification(receiver, NotificationType.MESSAGE, title, content, targetType, targetId);
    }

    // 모임 초대 알림 전송
    @Override
    public void sendGroupInvitation(Long receiverId, String title, String content, String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isApplicationEnabled()) {
            return;
        }

        saveNotification(receiver, NotificationType.INVITATION, title, content, targetType, targetId);
    }

    // 모집 직접 초대 알림 전송
    @Override
    public void sendApplicationInvitation(Long receiverId, String title, String content,
                                          String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isApplicationEnabled()) {
            return;
        }

        saveNotification(receiver, NotificationType.INVITATION, title, content, targetType, targetId);
    }

    // 신청 발생 및 신청 처리 결과 알림 전송
    @Override
    public void sendApplicationNotification(Long receiverId, String title, String content,
                                            String targetType, Long targetId) {
        Member receiver = findReceiver(receiverId);
        NotificationSetting setting = getOrCreateNotificationSetting(receiver);

        if (!setting.isAllEnabled() || !setting.isApplicationEnabled()) {
            return;
        }

        saveNotification(receiver, NotificationType.APPLICATION, title, content, targetType, targetId);
    }

    // 내 알림 목록 조회 (showAll=false: 읽지 않은 것만, showAll=true: 전체)
    @Override
    @Transactional(readOnly = true)
    public List<NotificationDTO> getNotifications(Long memberId, boolean showAll) {
        findReceiver(memberId);

        List<Notification> notifications = showAll
                ? notificationRepository.findAllByReceiver_IdOrderByCreatedAtDesc(memberId)
                : notificationRepository.findAllByReceiver_IdAndIsReadFalseOrderByCreatedAtDesc(memberId);

        return notifications.stream()
                .map(this::toNotificationDTO)
                .toList();
    }

    // 전체 알림 페이지 조회
    @Override
    @Transactional(readOnly = true)
    public Page<NotificationDTO> getNotificationPage(Long memberId, String filter, Pageable pageable) {
        findReceiver(memberId);

        String normalizedFilter = filter == null ? "ALL" : filter.trim().toUpperCase();
        Page<Notification> notifications = switch (normalizedFilter) {
            case "ALL" -> notificationRepository.findAllByReceiver_Id(memberId, pageable);
            case "UNREAD" -> notificationRepository.findAllByReceiver_IdAndIsReadFalse(memberId, pageable);
            case "READ" -> notificationRepository.findAllByReceiver_IdAndIsReadTrue(memberId, pageable);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 필터 값이 올바르지 않습니다.");
        };

        return notifications.map(this::toNotificationDTO);
    }

    // 안 읽은 알림 개수 조회
    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(Long memberId) {
        findReceiver(memberId);

        return notificationRepository.countByReceiver_IdAndIsReadFalse(memberId);
    }

    // 알림 한 개 읽음 처리
    @Override
    public void readNotification(Long notificationId, Long memberId) {
        if (notificationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 ID가 필요합니다.");
        }

        findReceiver(memberId);

        Notification notification = notificationRepository.findByIdAndReceiver_Id(notificationId, memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "알림을 찾을 수 없습니다."));

        notification.read();
    }

    // 내 알림 전체 읽음 처리
    @Override
    public void readAllNotifications(Long memberId) {
        findReceiver(memberId);

        List<Notification> notifications = notificationRepository.findAllByReceiver_IdAndIsReadFalse(memberId);
        notifications.forEach(Notification::read);
    }

    // 전체 및 기능별 알림 설정 조회
    @Override
    public NotificationSettingDTO getNotificationSetting(Long memberId) {
        Member member = findReceiver(memberId);
        NotificationSetting setting = getOrCreateNotificationSetting(member);

        return toNotificationSettingDTO(setting);
    }

    // 전체 및 기능별 알림 설정 수정
    @Override
    public NotificationSettingDTO updateNotificationSetting(Long memberId, NotificationSettingDTO notificationSettingDTO) {
        if (notificationSettingDTO == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 설정 정보가 필요합니다.");
        }

        Member member = findReceiver(memberId);
        NotificationSetting setting = getOrCreateNotificationSetting(member);

        setting.update(
                notificationSettingDTO.isAllEnabled(),
                notificationSettingDTO.isGroupEnabled(),
                notificationSettingDTO.isScheduleEnabled(),
                notificationSettingDTO.isBoardEnabled(),
                notificationSettingDTO.isApplicationEnabled(),
                notificationSettingDTO.isReminderEnabled()
        );

        return toNotificationSettingDTO(setting);
    }

    // 참여 중인 모임별 알림 설정 조회
    @Override
    @Transactional(readOnly = true)
    public List<GroupNotificationSettingDTO> getGroupNotificationSettings(Long memberId) {
        findReceiver(memberId);

        List<GroupMember> groupMembers = groupMemberRepository
                .findByMember_IdAndMemberStatusIn(memberId, List.of(GroupMemberStatus.ACTIVE));

        return groupMembers.stream()
                .map(groupMember -> {
                    Group group = groupMember.getGroup();

                    boolean enabled = groupNotificationSettingRepository
                            .findByGroup_IdAndMember_Id(group.getId(), memberId)
                            .map(GroupNotificationSetting::isEnabled)
                            .orElse(true);

                    return GroupNotificationSettingDTO.builder()
                            .groupId(group.getId())
                            .groupName(group.getGroupName())
                            .enabled(enabled)
                            .build();
                })
                .toList();
    }

    // 모임별 알림 설정 수정
    @Override
    public GroupNotificationSettingDTO updateGroupNotificationSetting(Long memberId, Long groupId, boolean enabled) {
        if (groupId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임 ID가 필요합니다.");
        }

        Member member = findReceiver(memberId);

        GroupMember groupMember = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                .filter(savedGroupMember -> savedGroupMember.getMemberStatus() == GroupMemberStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN, "해당 모임의 알림 설정을 변경할 권한이 없습니다."));

        Group group = groupMember.getGroup();

        GroupNotificationSetting setting = groupNotificationSettingRepository
                .findByGroup_IdAndMember_Id(groupId, memberId)
                .orElseGet(() -> GroupNotificationSetting.builder()
                        .group(group)
                        .member(member)
                        .build());

        setting.update(enabled);
        GroupNotificationSetting savedSetting = groupNotificationSettingRepository.save(setting);

        return toGroupNotificationSettingDTO(savedSetting);
    }

    // 알림 수신 회원 조회
    private Member findReceiver(Long receiverId) {
        if (receiverId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 수신자 ID가 필요합니다.");
        }

        return memberRepository.findById(receiverId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "알림 수신자를 찾을 수 없습니다."));
    }

    // 회원의 알림 설정 조회 또는 기본 설정 생성
    private NotificationSetting getOrCreateNotificationSetting(Member member) {
        return notificationSettingRepository.findByMember_Id(member.getId())
                .orElseGet(() -> notificationSettingRepository.save(
                        NotificationSetting.builder()
                                .member(member)
                                .build()
                ));
    }

    // 모임원 상태와 모임별 알림 수신 여부 확인
    private boolean isGroupNotificationEnabled(Long groupId, Long memberId) {
        if (groupId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임 ID가 필요합니다.");
        }

        boolean activeMember = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                .map(groupMember -> groupMember.getMemberStatus() == GroupMemberStatus.ACTIVE)
                .orElse(false);

        if (!activeMember) {
            return false;
        }

        return groupNotificationSettingRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                .map(GroupNotificationSetting::isEnabled)
                .orElse(true);
    }

    // 알림 엔티티 생성 및 저장
    private void saveNotification(Member receiver, NotificationType notificationType,
                                  String title, String content, String targetType, Long targetId) {
        validateNotificationData(title, content);

        String normalizedTargetType = normalizeTargetType(targetType);

        Notification notification = Notification.builder()
                .receiver(receiver)
                .notificationType(notificationType)
                .title(title.trim())
                .content(content.trim())
                .targetType(normalizedTargetType)
                .targetId(targetId)
                .build();

        Notification savedNotification = notificationRepository.save(notification);
        notificationSseService.sendAfterCommit(receiver.getId(), toNotificationDTO(savedNotification));
    }

    // 알림 제목과 내용 검증
    private void validateNotificationData(String title, String content) {
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 제목이 필요합니다.");
        }

        if (title.trim().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 제목은 100자 이하로 입력해 주세요.");
        }

        if (content == null || content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 내용이 필요합니다.");
        }

        if (content.trim().length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 내용은 200자 이하로 입력해 주세요.");
        }
    }

    // 알림 이동 대상 타입 정리
    private String normalizeTargetType(String targetType) {
        if (targetType == null || targetType.isBlank()) {
            return null;
        }

        String normalizedTargetType = targetType.trim();

        if (normalizedTargetType.length() > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 이동 대상 타입은 30자 이하로 입력해 주세요.");
        }

        return normalizedTargetType;
    }

    // 알림 엔티티를 응답 DTO로 변환
    private NotificationDTO toNotificationDTO(Notification notification) {
        return NotificationDTO.builder()
                .notificationId(notification.getId())
                .notificationType(notification.getNotificationType())
                .title(notification.getTitle())
                .content(notification.getContent())
                .targetType(notification.getTargetType())
                .targetId(notification.getTargetId())
                .read(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .readAt(notification.getReadAt())
                .build();
    }

    // 전체 알림 설정을 응답 DTO로 변환
    private NotificationSettingDTO toNotificationSettingDTO(NotificationSetting setting) {
        return NotificationSettingDTO.builder()
                .allEnabled(setting.isAllEnabled())
                .groupEnabled(setting.isGroupEnabled())
                .scheduleEnabled(setting.isScheduleEnabled())
                .boardEnabled(setting.isBoardEnabled())
                .applicationEnabled(setting.isApplicationEnabled())
                .reminderEnabled(setting.isReminderEnabled())
                .build();
    }

    // 모임별 알림 설정을 응답 DTO로 변환
    private GroupNotificationSettingDTO toGroupNotificationSettingDTO(GroupNotificationSetting setting) {
        return GroupNotificationSettingDTO.builder()
                .groupId(setting.getGroup().getId())
                .groupName(setting.getGroup().getGroupName())
                .enabled(setting.isEnabled())
                .build();
    }
}
