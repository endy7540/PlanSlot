package com.example.planslot.notification.controller;

import com.example.planslot.notification.dto.NotificationDTO;
import com.example.planslot.notification.dto.NotificationSettingDTO;
import com.example.planslot.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
@RequestMapping("/notification")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    // 내 알림 목록 조회
    @GetMapping
    public ResponseEntity<List<NotificationDTO>> getNotifications(@RequestParam Long memberId) {
        return ResponseEntity.ok(notificationService.getNotifications(memberId));
    }

    // 안 읽은 알림 개수 조회
    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount(@RequestParam Long memberId) {
        return ResponseEntity.ok(notificationService.getUnreadCount(memberId));
    }

    // 알림 한 개 읽음 처리
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> readNotification(@PathVariable Long notificationId,
                                                 @RequestParam Long memberId) {
        notificationService.readNotification(notificationId, memberId);

        return ResponseEntity.noContent().build();
    }

    // 내 알림 전체 읽음 처리
    @PatchMapping("/read-all")
    public ResponseEntity<Void> readAllNotifications(@RequestParam Long memberId) {
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
    public ResponseEntity<NotificationSettingDTO> getNotificationSetting(@RequestParam Long memberId) {
        return ResponseEntity.ok(notificationService.getNotificationSetting(memberId));
    }

    // 전체 및 기능별 알림 설정 수정
    @PutMapping("/setting")
    public ResponseEntity<NotificationSettingDTO> updateNotificationSetting(
            @RequestParam Long memberId,
            @RequestBody NotificationSettingDTO notificationSettingDTO) {
        return ResponseEntity.ok(
                notificationService.updateNotificationSetting(memberId, notificationSettingDTO)
        );
    }
}
