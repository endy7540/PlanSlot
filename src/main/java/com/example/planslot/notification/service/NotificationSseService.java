package com.example.planslot.notification.service;

import com.example.planslot.notification.dto.NotificationDTO;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface NotificationSseService {

    // SSE 연결 생성
    SseEmitter subscribe(Long memberId);

    // 트랜잭션 커밋 후 실시간 알림 전송
    void sendAfterCommit(Long memberId, NotificationDTO notificationDTO);
}
