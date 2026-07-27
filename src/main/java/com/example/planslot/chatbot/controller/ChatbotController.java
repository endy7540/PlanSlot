package com.example.planslot.chatbot.controller;

import com.example.planslot.chatbot.dto.ChatbotRequestDTO;
import com.example.planslot.chatbot.dto.ChatbotResponseDTO;
import com.example.planslot.chatbot.exception.ChatbotException;
import com.example.planslot.chatbot.service.ChatbotService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private static final Pattern CLIENT_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{16,80}$");

    private final ChatbotService chatbotService;

    @PostMapping("/message")
    public ResponseEntity<ChatbotResponseDTO> sendMessage(
            Authentication authentication,
            HttpServletRequest httpRequest,
            @RequestHeader(value = "X-Chatbot-Client-Id", required = false) String clientId,
            @RequestBody ChatbotRequestDTO request) {
        try {
            String requesterKey = resolveRequesterKey(authentication, httpRequest, clientId);
            return ResponseEntity.ok(chatbotService.ask(requesterKey, request));
        } catch (ChatbotException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(ChatbotResponseDTO.error(e.getErrorCode(), e.getUserMessage()));
        } catch (Exception e) {
            log.error("[CHATBOT] Unexpected controller error. errorType={}", e.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ChatbotResponseDTO.error("CHATBOT_INTERNAL_ERROR", "현재 답변을 불러올 수 없어요. 잠시 후 다시 질문해 주세요."));
        }
    }

    private String resolveRequesterKey(Authentication authentication, HttpServletRequest request, String clientId) {
        if (authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.getName() != null
                && !authentication.getName().isBlank()
                && !"anonymousUser".equals(authentication.getName())) {
            return "member:" + authentication.getName();
        }

        String normalizedClientId = clientId == null ? "" : clientId.trim();
        if (!CLIENT_ID_PATTERN.matcher(normalizedClientId).matches()) {
            normalizedClientId = "anonymous-browser";
        }

        String remoteAddress = request.getRemoteAddr();
        if (remoteAddress == null || remoteAddress.isBlank()) {
            remoteAddress = "unknown";
        }
        return "guest:" + remoteAddress + ":" + normalizedClientId;
    }
}
