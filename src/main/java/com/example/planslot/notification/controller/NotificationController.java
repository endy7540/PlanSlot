package com.example.planslot.notification.controller;

import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.notification.dto.GroupNotificationSettingDTO;
import com.example.planslot.notification.dto.NotificationDTO;
import com.example.planslot.notification.dto.NotificationSettingDTO;
import com.example.planslot.notification.service.NotificationService;
import com.example.planslot.notification.service.NotificationSseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;
import java.util.List;

@Controller
@RequestMapping("/notification")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationSseService notificationSseService;
    private final MemberRepository memberRepository;

    // 로그인 사용자의 실시간 알림 연결
    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ResponseBody
    public SseEmitter subscribe(Principal principal, jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("X-Accel-Buffering", "no");
        return notificationSseService.subscribe(getLoginMemberId(principal));
    }

    // 내 알림 목록 조회 (showAll=false: 읽지 않은 것만 / showAll=true: 전체 목록)
    @GetMapping
    public ResponseEntity<List<NotificationDTO>> getNotifications(
            @RequestParam(defaultValue = "false") boolean showAll,
            Principal principal) {

        Long memberId = getLoginMemberId(principal);

        return ResponseEntity.ok(
                notificationService.getNotifications(memberId, showAll)
        );
    }

    // 전체 알림 페이지 조회 (ALL, UNREAD, READ)
    @GetMapping("/page")
    public ResponseEntity<Page<NotificationDTO>> getNotificationPage(
            @RequestParam(defaultValue = "ALL") String filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Principal principal) {

        if (page < 0 || size < 1 || size > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "페이지 요청 값이 올바르지 않습니다.");
        }

        Long memberId = getLoginMemberId(principal);
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        return ResponseEntity.ok(notificationService.getNotificationPage(memberId, filter, pageable));
    }

    // 안 읽은 알림 개수 조회
    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount(
            Principal principal) {

        Long memberId = getLoginMemberId(principal);

        return ResponseEntity.ok(
                notificationService.getUnreadCount(memberId)
        );
    }

    // 알림 한 개 읽음 처리
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> readNotification(
            @PathVariable Long notificationId,
            Principal principal) {

        Long memberId = getLoginMemberId(principal);

        notificationService.readNotification(
                notificationId,
                memberId
        );

        return ResponseEntity.noContent().build();
    }

    // 내 알림 전체 읽음 처리
    @PatchMapping("/read-all")
    public ResponseEntity<Void> readAllNotifications(
            Principal principal) {

        Long memberId = getLoginMemberId(principal);

        notificationService.readAllNotifications(memberId);

        return ResponseEntity.noContent().build();
    }

    // 알림 전체 목록 화면 이동
    @GetMapping("/list")
    public String notificationList() {
        return "notification/notification-list";
    }

    // 전체 및 기능별 알림 설정 조회
    @GetMapping("/setting")
    public ResponseEntity<NotificationSettingDTO> getNotificationSetting(
            Principal principal) {

        Long memberId = getLoginMemberId(principal);

        return ResponseEntity.ok(
                notificationService.getNotificationSetting(memberId)
        );
    }

    // 전체 및 기능별 알림 설정 수정
    @PutMapping("/setting")
    public ResponseEntity<NotificationSettingDTO> updateNotificationSetting(
            Principal principal,
            @RequestBody NotificationSettingDTO notificationSettingDTO) {

        Long memberId = getLoginMemberId(principal);

        return ResponseEntity.ok(
                notificationService.updateNotificationSetting(
                        memberId,
                        notificationSettingDTO
                )
        );
    }

    // 내가 참여 중인 모임별 알림 설정 조회
    @GetMapping("/group-settings")
    public ResponseEntity<List<GroupNotificationSettingDTO>>
    getGroupNotificationSettings(Principal principal) {

        Long memberId = getLoginMemberId(principal);

        return ResponseEntity.ok(
                notificationService.getGroupNotificationSettings(memberId)
        );
    }

    // 특정 모임 알림 설정 수정
    @PatchMapping("/group-settings/{groupId}")
    public ResponseEntity<GroupNotificationSettingDTO>
    updateGroupNotificationSetting(
            @PathVariable Long groupId,
            @RequestParam boolean enabled,
            Principal principal) {

        Long memberId = getLoginMemberId(principal);

        return ResponseEntity.ok(
                notificationService.updateGroupNotificationSetting(
                        memberId,
                        groupId,
                        enabled
                )
        );
    }

    // JWT 인증 정보에 저장된 이메일로 로그인 회원 ID 조회
    private Long getLoginMemberId(Principal principal) {
        if (principal == null
                || principal.getName() == null
                || principal.getName().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "로그인이 필요합니다."
            );
        }

        return memberRepository.findByEmail(principal.getName())
                .map(member -> member.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "로그인 회원을 찾을 수 없습니다."
                ));
    }
}
