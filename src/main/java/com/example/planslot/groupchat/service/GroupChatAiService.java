package com.example.planslot.groupchat.service;

import com.example.planslot.groupchat.dto.ChatMessageDTO;
import com.example.planslot.groupchat.dto.GroupChatAiDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GroupChatAiService {

    private final GroupChatService groupChatService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.url:https://api.anthropic.com/v1/messages}")
    private String apiUrl;

    @Value("${ai.anthropic-version:2023-06-01}")
    private String apiVersion;

    @Value("${ai.model:claude-sonnet-5}")
    private String aiModel;

    public static class ChatAiJob {
        public String status;
        public GroupChatAiDTO.Response result;
        public String error;
        public Long groupId;
    }

    private final Map<String, ChatAiJob> jobs = new ConcurrentHashMap<>();

    public String startSummarizeChatJob(Long groupId) {
        String jobId = UUID.randomUUID().toString();
        ChatAiJob job = new ChatAiJob();
        job.status = "PROCESSING";
        job.groupId = groupId;
        jobs.put(jobId, job);

        CompletableFuture.runAsync(() -> {
            try {
                GroupChatAiDTO.Response res = summarizeChat(groupId);
                job.result = res;
                job.status = "COMPLETED";
            } catch (Exception e) {
                job.error = e.getMessage();
                job.status = "FAILED";
            }
        });

        return jobId;
    }

    public ChatAiJob getJobStatus(String jobId) {
        return jobs.get(jobId);
    }

    private GroupChatAiDTO.Response summarizeChat(Long groupId) {
        // 최근 메시지를 불러옵니다 (모든 내역 혹은 최근 일정량)
        List<ChatMessageDTO> chatHistory = groupChatService.getChatHistory(groupId);
        if (chatHistory == null || chatHistory.isEmpty()) {
            throw new IllegalArgumentException("요약할 대화 기록이 없습니다.");
        }

        // 최대 100건 정도만 전송하도록 자르기
        int maxMessages = 100;
        int startIndex = Math.max(0, chatHistory.size() - maxMessages);
        List<ChatMessageDTO> recentChats = chatHistory.subList(startIndex, chatHistory.size());

        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("다음은 모임 채팅방의 최근 대화 기록입니다:\n\n");
        for (ChatMessageDTO msg : recentChats) {
            promptBuilder.append("[").append(msg.getCreatedAt()).append("] ")
                         .append(msg.getSenderName()).append(": ")
                         .append(msg.getContent()).append("\n");
        }

        promptBuilder.append("\n위 대화 기록을 바탕으로 다음 두 가지를 수행해 주세요.\n");
        promptBuilder.append("1. 'summary': 대화의 핵심 내용과 흐름을 요약해 주세요.\n");
        promptBuilder.append("2. 'proposedSchedules': 대화 중 모임 일정을 잡거나 제안하는 내용이 있다면, 이를 배열 형태로 추출해 주세요. (없으면 빈 배열)\n");
        promptBuilder.append("결과는 반드시 아래 JSON 형식으로만 응답해야 합니다. 다른 텍스트는 절대 포함하지 마세요.\n");
        promptBuilder.append("{\n");
        promptBuilder.append("  \"summary\": \"요약된 텍스트\",\n");
        promptBuilder.append("  \"proposedSchedules\": [\n");
        promptBuilder.append("    {\n");
        promptBuilder.append("      \"title\": \"일정 제목 (예: 팀 회식)\",\n");
        promptBuilder.append("      \"date\": \"YYYY-MM-DD\",\n");
        promptBuilder.append("      \"time\": \"HH:mm\"\n");
        promptBuilder.append("    }\n");
        promptBuilder.append("  ]\n");
        promptBuilder.append("}\n");

        if (apiKey == null || apiKey.trim().isEmpty() || "your-api-key-here".equals(apiKey)) {
            throw new IllegalStateException("AI API Key가 설정되지 않았습니다.");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", apiKey);
            headers.set("anthropic-version", apiVersion);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", aiModel);
            requestBody.put("max_tokens", 4096);
            requestBody.put("system", "You are a helpful AI assistant that summarizes chat logs and extracts schedules. Always reply in strictly valid JSON.");
            
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "user", "content", promptBuilder.toString()));
            requestBody.put("messages", messages);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(apiUrl, HttpMethod.POST, entity, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            String aiJsonStr = null;
            for (JsonNode block : root.path("content")) {
                if ("text".equals(block.path("type").asText())) {
                    aiJsonStr = block.path("text").asText();
                    break;
                }
            }
            if (aiJsonStr == null) {
                throw new IllegalStateException("AI 응답을 파싱할 수 없습니다.");
            }

            int startIdx = aiJsonStr.indexOf('{');
            int endIdx = aiJsonStr.lastIndexOf('}');
            if(startIdx >= 0 && endIdx >= startIdx) {
                aiJsonStr = aiJsonStr.substring(startIdx, endIdx + 1);
            }

            return objectMapper.readValue(aiJsonStr, GroupChatAiDTO.Response.class);

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("AI 요약 요청 중 오류가 발생했습니다: " + e.getMessage());
        }
    }
}
