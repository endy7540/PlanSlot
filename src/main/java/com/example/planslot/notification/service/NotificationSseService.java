package com.example.planslot.notification.service;

import com.example.planslot.notification.dto.NotificationDTO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NotificationSseService {
    private static final long SSE_TIMEOUT = 30 * 60 * 1000L;
    private final Map<Long, Map<String, SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long memberId) {
        String connectionId = UUID.randomUUID().toString();
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        emitters.computeIfAbsent(memberId, key -> new ConcurrentHashMap<>()).put(connectionId, emitter);
        emitter.onCompletion(() -> removeEmitter(memberId, connectionId));
        emitter.onTimeout(() -> removeEmitter(memberId, connectionId));
        emitter.onError(exception -> removeEmitter(memberId, connectionId));

        try {
            emitter.send(SseEmitter.event().name("connected").data("connected"));
        } catch (IOException exception) {
            removeEmitter(memberId, connectionId);
            emitter.completeWithError(exception);
        }

        return emitter;
    }

    public void sendAfterCommit(Long memberId, NotificationDTO notificationDTO) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(memberId, notificationDTO);
                }
            });
            return;
        }

        send(memberId, notificationDTO);
    }

    private void send(Long memberId, NotificationDTO notificationDTO) {
        Map<String, SseEmitter> memberEmitters = emitters.get(memberId);
        if (memberEmitters == null) return;

        memberEmitters.forEach((connectionId, emitter) -> {
            try {
                emitter.send(SseEmitter.event().name("notification").data(notificationDTO));
            } catch (IOException | IllegalStateException exception) {
                removeEmitter(memberId, connectionId);
            }
        });
    }

    private void removeEmitter(Long memberId, String connectionId) {
        Map<String, SseEmitter> memberEmitters = emitters.get(memberId);
        if (memberEmitters == null) return;

        memberEmitters.remove(connectionId);
        if (memberEmitters.isEmpty()) emitters.remove(memberId, memberEmitters);
    }
}
