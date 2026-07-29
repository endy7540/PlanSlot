package com.example.planslot.chatbot.service;

import com.example.planslot.chatbot.dto.ChatbotRequestDTO;
import com.example.planslot.chatbot.dto.ChatbotResponseDTO;
import com.example.planslot.chatbot.exception.ChatbotException;
import com.example.planslot.chatbot.prompt.ChatbotPrompt;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Slf4j
@Service
public class ChatbotServiceImpl implements ChatbotService {
    private static final String GENERAL_ERROR_MESSAGE = "현재 답변을 불러올 수 없어요. 잠시 후 다시 질문해 주세요.";
    private static final String TIMEOUT_MESSAGE = "답변이 예상보다 오래 걸리고 있어요. 잠시 후 다시 질문해 주세요.";
    private static final String REQUEST_IN_PROGRESS_MESSAGE = "답변을 준비 중이에요. 잠시만 기다려 주세요.";
    private static final int MAX_HISTORY_ASSISTANT_LENGTH = 1200;
    private static final Pattern EMOJI_PATTERN = Pattern.compile("[\\x{1F300}-\\x{1FAFF}\\x{2600}-\\x{27BF}\\x{FE0F}]", Pattern.UNICODE_CHARACTER_CLASS);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Object rateLimitLock = new Object();
    private final Set<String> activeRequests = ConcurrentHashMap.newKeySet();
    private final Map<String, Deque<Instant>> requesterRequestHistory = new HashMap<>();
    private final Map<String, Instant> lastCompletedAt = new HashMap<>();
    private HttpClient httpClient;

    @Value("${ai.url:https://api.anthropic.com/v1/messages}")
    private String claudeApiUrl;

    @Value("${ai.api-key:}")
    private String claudeApiKey;

    @Value("${ai.anthropic-version:2023-06-01}")
    private String claudeApiVersion;

    @Value("${ai.model:claude-3-haiku-20240307}")
    private String claudeModel;

    @Value("${chatbot.max-tokens:1000}")
    private int maxTokens;

    @Value("${chatbot.timeout-seconds:15}")
    private int timeoutSeconds;

    @Value("${chatbot.max-question-length:100}")
    private int maxQuestionLength;

    @Value("${chatbot.history-rounds:5}")
    private int historyRounds;

    @Value("${chatbot.cooldown-seconds:3}")
    private int cooldownSeconds;

    @Value("${chatbot.guest-request-limit:5}")
    private int guestRequestLimit;

    @Value("${chatbot.member-request-limit:10}")
    private int memberRequestLimit;

    @Value("${chatbot.request-limit-minutes:10}")
    private int requestLimitMinutes;

    @PostConstruct
    private void initializeHttpClient() {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.min(timeoutSeconds, 10)))
                .build();
    }

    @Override
    public ChatbotResponseDTO ask(String memberKey, ChatbotRequestDTO request) {
        if (memberKey == null || memberKey.isBlank()) {
            throw new ChatbotException(HttpStatus.INTERNAL_SERVER_ERROR, "CHATBOT_REQUESTER_ERROR", GENERAL_ERROR_MESSAGE);
        }

        String message = validateAndNormalizeRequest(request);
        if (!activeRequests.add(memberKey)) {
            throw new ChatbotException(HttpStatus.TOO_MANY_REQUESTS, "CHATBOT_REQUEST_IN_PROGRESS", REQUEST_IN_PROGRESS_MESSAGE);
        }

        boolean countedRequest = false;
        try {
            enforceAndRegisterRateLimit(memberKey);
            countedRequest = true;
            boolean loggedIn = memberKey.startsWith("member:");
            return ChatbotResponseDTO.success(callClaude(message, request.getHistory(), loggedIn));
        } finally {
            if (countedRequest) recordCompletion(memberKey);
            activeRequests.remove(memberKey);
        }
    }

    private String validateAndNormalizeRequest(ChatbotRequestDTO request) {
        if (request == null || request.getMessage() == null) {
            throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_INVALID_MESSAGE", "질문을 입력해 주세요.");
        }

        String message = request.getMessage().trim();
        int length = message.codePointCount(0, message.length());
        if (message.isBlank()) {
            throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_EMPTY_MESSAGE", "질문을 입력해 주세요.");
        }
        if (length > maxQuestionLength) {
            throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_MESSAGE_TOO_LONG", "질문은 " + maxQuestionLength + "자 이내로 입력해 주세요.");
        }

        List<ChatbotRequestDTO.HistoryMessage> history = request.getHistory();
        if (history == null) {
            request.setHistory(new ArrayList<>());
            return message;
        }

        int maxHistoryMessages = historyRounds * 2;
        if (history.size() > maxHistoryMessages || history.size() % 2 != 0) {
            throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_INVALID_HISTORY", "대화 기록 형식이 올바르지 않아요.");
        }

        for (int i = 0; i < history.size(); i++) {
            ChatbotRequestDTO.HistoryMessage historyMessage = history.get(i);
            String expectedRole = i % 2 == 0 ? "user" : "assistant";
            if (historyMessage == null || !expectedRole.equals(historyMessage.getRole()) || historyMessage.getContent() == null) {
                throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_INVALID_HISTORY", "대화 기록 형식이 올바르지 않아요.");
            }

            String content = historyMessage.getContent().trim();
            if (content.isBlank()) {
                throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_INVALID_HISTORY", "대화 기록 형식이 올바르지 않아요.");
            }

            int contentLength = content.codePointCount(0, content.length());
            if ("user".equals(expectedRole) && contentLength > maxQuestionLength) {
                throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_INVALID_HISTORY", "대화 기록 형식이 올바르지 않아요.");
            }
            if ("assistant".equals(expectedRole) && contentLength > MAX_HISTORY_ASSISTANT_LENGTH) {
                throw new ChatbotException(HttpStatus.BAD_REQUEST, "CHATBOT_INVALID_HISTORY", "대화 기록 형식이 올바르지 않아요.");
            }
            historyMessage.setContent(content);
        }
        return message;
    }

    private void enforceAndRegisterRateLimit(String requesterKey) {
        Instant now = Instant.now();
        boolean guest = requesterKey.startsWith("guest:");
        int requesterLimit = guest ? guestRequestLimit : memberRequestLimit;

        synchronized (rateLimitLock) {
            Instant completedAt = lastCompletedAt.get(requesterKey);
            if (completedAt != null && now.isBefore(completedAt.plusSeconds(cooldownSeconds))) {
                throw new ChatbotException(HttpStatus.TOO_MANY_REQUESTS, "CHATBOT_COOLDOWN",
                        "질문을 연속으로 보낼 수 없어요. " + cooldownSeconds + "초 후 다시 시도해 주세요.");
            }

            Instant requesterWindowStart = now.minus(Duration.ofMinutes(requestLimitMinutes));
            Deque<Instant> requesterHistory = requesterRequestHistory.get(requesterKey);
            if (requesterHistory == null) requesterHistory = new ArrayDeque<>();
            trimExpired(requesterHistory, requesterWindowStart);
            if (requesterHistory.size() >= requesterLimit) {
                String userType = guest ? "비로그인 사용자는" : "로그인 사용자는";
                throw new ChatbotException(HttpStatus.TOO_MANY_REQUESTS, "CHATBOT_RATE_LIMIT",
                        userType + " AI 도우미를 " + requestLimitMinutes + "분 동안 최대 " + requesterLimit + "회 이용할 수 있습니다. 잠시 후 다시 시도해 주세요.");
            }

            requesterHistory.addLast(now);
            requesterRequestHistory.put(requesterKey, requesterHistory);
        }
    }

    private void recordCompletion(String requesterKey) {
        synchronized (rateLimitLock) {
            lastCompletedAt.put(requesterKey, Instant.now());
        }
    }

    private void trimExpired(Deque<Instant> history, Instant windowStart) {
        while (!history.isEmpty() && !history.peekFirst().isAfter(windowStart)) history.pollFirst();
    }

    @Scheduled(fixedDelayString = "${chatbot.cleanup-interval-millis:600000}")
    public void cleanupRateLimitState() {
        Instant now = Instant.now();
        Instant requesterWindowStart = now.minus(Duration.ofMinutes(requestLimitMinutes));

        synchronized (rateLimitLock) {
            requesterRequestHistory.entrySet().removeIf(entry -> {
                trimExpired(entry.getValue(), requesterWindowStart);
                return entry.getValue().isEmpty();
            });
            lastCompletedAt.entrySet().removeIf(entry -> !entry.getValue().plusSeconds(cooldownSeconds).isAfter(now));
        }
    }

    private String callClaude(String message, List<ChatbotRequestDTO.HistoryMessage> history, boolean loggedIn) {
        if (claudeApiKey == null || claudeApiKey.isBlank()) {
            log.error("[CHATBOT] Claude API key is missing");
            throw new ChatbotException(HttpStatus.SERVICE_UNAVAILABLE, "CHATBOT_CONFIGURATION_ERROR", GENERAL_ERROR_MESSAGE);
        }

        try {
            List<Map<String, String>> messages = new ArrayList<>();
            if (history != null) {
                for (ChatbotRequestDTO.HistoryMessage historyMessage : history) {
                    messages.add(Map.of("role", historyMessage.getRole(), "content", historyMessage.getContent()));
                }
            }
            messages.add(Map.of("role", "user", "content", message));

            Map<String, Object> payload = new HashMap<>();
            payload.put("model", claudeModel);
            payload.put("max_tokens", maxTokens);
            String previousUserMessage = findPreviousUserMessage(history);
            String systemPrompt = ChatbotPrompt.buildSystemPrompt(message, previousUserMessage, loggedIn);
            payload.put("system", systemPrompt);
            payload.put("messages", messages);

            String requestBody = objectMapper.writeValueAsString(payload);
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(claudeApiUrl.trim()))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("x-api-key", claudeApiKey.trim())
                    .header("anthropic-version", claudeApiVersion.trim())
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            long startedAt = System.nanoTime();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            long elapsedMillis = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();

            if (response.statusCode() != HttpStatus.OK.value()) {
                log.warn("[CHATBOT] Claude request failed. status={}, elapsedMs={}", response.statusCode(), elapsedMillis);
                throw new ChatbotException(HttpStatus.BAD_GATEWAY, "CHATBOT_CLAUDE_ERROR", GENERAL_ERROR_MESSAGE);
            }

            String answer = extractAnswer(response.body());
            log.info("[CHATBOT] Claude request succeeded. elapsedMs={}", elapsedMillis);
            return answer;
        } catch (java.net.http.HttpTimeoutException e) {
            log.warn("[CHATBOT] Claude request timed out");
            throw new ChatbotException(HttpStatus.GATEWAY_TIMEOUT, "CHATBOT_TIMEOUT", TIMEOUT_MESSAGE);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[CHATBOT] Claude request was interrupted");
            throw new ChatbotException(HttpStatus.SERVICE_UNAVAILABLE, "CHATBOT_INTERRUPTED", GENERAL_ERROR_MESSAGE);
        } catch (ChatbotException e) {
            throw e;
        } catch (Exception e) {
            log.error("[CHATBOT] Claude request failed. errorType={}", e.getClass().getSimpleName());
            throw new ChatbotException(HttpStatus.BAD_GATEWAY, "CHATBOT_CLAUDE_ERROR", GENERAL_ERROR_MESSAGE);
        }
    }

    private String findPreviousUserMessage(List<ChatbotRequestDTO.HistoryMessage> history) {
        if (history == null) return null;
        for (int i = history.size() - 1; i >= 0; i--) {
            ChatbotRequestDTO.HistoryMessage historyMessage = history.get(i);
            if (historyMessage != null && "user".equals(historyMessage.getRole())) {
                return historyMessage.getContent();
            }
        }
        return null;
    }

    private String extractAnswer(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        if (root.path("content").isArray()) {
            for (JsonNode content : root.path("content")) {
                if ("text".equals(content.path("type").asText())) {
                    String answer = content.path("text").asText("").trim();
                    answer = EMOJI_PATTERN.matcher(answer).replaceAll("").replace("```", "").trim();
                    if (!answer.isBlank()) {
                        return answer;
                    }
                }
            }
        }
        throw new ChatbotException(HttpStatus.BAD_GATEWAY, "CHATBOT_EMPTY_RESPONSE", GENERAL_ERROR_MESSAGE);
    }
}
