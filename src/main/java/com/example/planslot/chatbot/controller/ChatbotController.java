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
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestHeader(value = "X-Chatbot-Client-Id", required = false) String clientId,
            @RequestBody ChatbotRequestDTO request) {
        try {
            String requesterKey = resolveRequesterKey(authentication, httpRequest, authorizationHeader, clientId);
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

    private String resolveRequesterKey(Authentication authentication, HttpServletRequest request, String authorizationHeader, String clientId) {
        boolean hasAuthorizationHeader = authorizationHeader != null && !authorizationHeader.isBlank();
        boolean bearerRequest = hasAuthorizationHeader && authorizationHeader.startsWith("Bearer ")
                && !authorizationHeader.substring(7).isBlank();

        if (hasAuthorizationHeader && !bearerRequest) {
            throw new ChatbotException(HttpStatus.UNAUTHORIZED, "CHATBOT_INVALID_TOKEN", "로그인 정보가 올바르지 않아요. 다시 로그인해 주세요.");
        }
        if (bearerRequest) {
            if (authentication == null || !authentication.isAuthenticated()
                    || authentication instanceof AnonymousAuthenticationToken
                    || authentication.getName() == null || authentication.getName().isBlank()
                    || "anonymousUser".equals(authentication.getName())) {
                throw new ChatbotException(HttpStatus.UNAUTHORIZED, "CHATBOT_INVALID_TOKEN", "로그인 정보가 만료되었어요. 다시 로그인해 주세요.");
            }
            return "member:" + authentication.getName();
        }

        String normalizedClientId = clientId == null ? "" : clientId.trim();
        if (!CLIENT_ID_PATTERN.matcher(normalizedClientId).matches()) {
            throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_INVALID_CLIENT_ID", "비로그인 사용자 정보를 확인할 수 없어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
        }

        String remoteAddress = request.getRemoteAddr();
        if (remoteAddress == null || remoteAddress.isBlank()) remoteAddress = "unknown";
        return "guest:" + remoteAddress + ":" + normalizedClientId;
    }
}
