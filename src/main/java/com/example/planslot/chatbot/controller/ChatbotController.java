package com.example.planslot.chatbot.controller;

import com.example.planslot.chatbot.dto.ChatbotRequestDTO;
import com.example.planslot.chatbot.dto.ChatbotResponseDTO;
import com.example.planslot.chatbot.exception.ChatbotException;
import com.example.planslot.chatbot.service.ChatbotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService chatbotService;

    @PostMapping("/message")
    public ResponseEntity<ChatbotResponseDTO> sendMessage(Authentication authentication, @RequestBody ChatbotRequestDTO request) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ChatbotResponseDTO.error("CHATBOT_UNAUTHORIZED", "로그인이 만료되었어요. 다시 로그인해 주세요."));
        }

        try {
            return ResponseEntity.ok(chatbotService.ask(authentication.getName(), request));
        } catch (ChatbotException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(ChatbotResponseDTO.error(e.getErrorCode(), e.getUserMessage()));
        } catch (Exception e) {
            log.error("[CHATBOT] Unexpected controller error. errorType={}", e.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ChatbotResponseDTO.error("CHATBOT_INTERNAL_ERROR", "현재 답변을 불러올 수 없어요. 잠시 후 다시 질문해 주세요."));
        }
    }
}
