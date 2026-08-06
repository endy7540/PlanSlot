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

import java.time.LocalDate;

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

    public String startSummarizeChatJob(Long groupId, int offset) {
        String jobId = UUID.randomUUID().toString();
        ChatAiJob job = new ChatAiJob();
        job.status = "PROCESSING";
        job.groupId = groupId;
        jobs.put(jobId, job);

        CompletableFuture.runAsync(() -> {
            try {
                GroupChatAiDTO.Response res = summarizeChat(groupId, offset);
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

    private GroupChatAiDTO.Response summarizeChat(Long groupId, int offset) {
        // 최근 메시지를 불러옵니다 (모든 내역 혹은 최근 일정량)
        List<ChatMessageDTO> chatHistory = groupChatService.getChatHistory(groupId);
        if (chatHistory == null || chatHistory.isEmpty()) {
            throw new IllegalArgumentException("요약할 대화 기록이 없습니다.");
        }

        int maxMessages = 100;
        int endIdx = Math.max(0, chatHistory.size() - offset);
        if (endIdx == 0) {
            throw new IllegalArgumentException("더 이상 분석할 이전 대화 기록이 없습니다.");
        }
        int startIdx = Math.max(0, endIdx - maxMessages);
        List<ChatMessageDTO> recentChats = chatHistory.subList(startIdx, endIdx);


        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("다음은 모임 채팅방의 최근 대화 기록입니다:\n\n");
        for (ChatMessageDTO msg : recentChats) {
            promptBuilder.append("[").append(msg.getCreatedAt()).append("] ")
                         .append(msg.getSenderName()).append(": ")
                         .append(msg.getContent()).append("\n");
        }

        LocalDate today = LocalDate.now();
        
        promptBuilder.append("\n현재 날짜는 ").append(today).append(" 입니다. (이후 일정 계산 시 참고하세요)\n");
        promptBuilder.append("위 대화 기록을 바탕으로 다음 두 가지를 수행해 주세요.\n");
        promptBuilder.append("1. 'summary': 전체 대화를 단순 요약하지 말고, '향후 일정 추천이나 제안'과 관련된 대화만 중점적으로 요약해 주세요.\n");
        promptBuilder.append("   - 새로운 일정 제안으로 이어지지 않는 단순 과거 일정에 대한 잡담이나 무관한 대화는 요약에서 제외하여 텍스트 길이를 최소화하세요.\n");
        promptBuilder.append("   - 단, 일정 제안이나 추천의 맥락이 되는 대화(일정 수립과 관련된 가벼운 잡담 포함)는 요약에 포함하여 자연스럽게 흐름을 알 수 있게 하세요.\n");
        promptBuilder.append("2. 'proposedSchedules': 대화 중 제안되거나 언급된 **모든** 모임 일정들을 배열 형태로 추출해 주세요.\n");
        promptBuilder.append("   - 가장 마지막 일정 하나만 추출하지 말고, 대화에 나온 모든 유효한 일정 후보를 전부 추출하세요. (없으면 빈 배열)\n");
        promptBuilder.append("   - 단, 오늘 날짜를 기준으로 이미 완전히 지나간 과거 일정은 철저히 제외하세요.\n");
        promptBuilder.append("   - 만약 시작일이 과거이더라도 종료일이 오늘이거나 미래로 이어지는 '기간 일정'인 경우에는 시작일과 종료일을 온전하게 포함하여 추출하세요.\n");
        promptBuilder.append("   - '지난주부터 다음주까지', '다음주까지 작성해' 와 같이 마감이 정해진 작업이나 기간이 언급된 경우, 마감일만 단일 날짜(하루 일정)로 잡지 말고, 시작 시점(과거 포함)부터 마감일(미래)까지를 '기간 일정(date와 endDate가 다른 상태)'으로 명확히 추출하세요.\n");
        promptBuilder.append("   - 날짜가 명확하지 않은 추상적인 시점(예: '지난 주', '다음 주')은 현재 날짜(").append(today).append(")를 기준으로 합리적인 날짜로 환산하여 YYYY-MM-DD 형식으로 기록하세요.\n");
        promptBuilder.append("   - [중요]: '오늘', '내일', '이번 주말' 등의 상대적 날짜는 전체의 '현재 날짜'가 아닌, 해당 텍스트가 적힌 각 메시지 앞에 있는 타임스탬프(작성일)를 기준으로 환산하세요!\n");
        promptBuilder.append("결과는 반드시 아래 JSON 형식으로만 응답해야 합니다. 다른 텍스트는 절대 포함하지 마세요.\n");
        promptBuilder.append("{\n");
        promptBuilder.append("  \"summary\": \"요약된 텍스트\",\n");
        promptBuilder.append("  \"proposedSchedules\": [\n");
        promptBuilder.append("    {\n");
        promptBuilder.append("      \"title\": \"일정 제목 (예: 팀 회식)\",\n");
        promptBuilder.append("      \"date\": \"YYYY-MM-DD (단일 날짜 또는 시작일)\",\n");
        promptBuilder.append("      \"endDate\": \"YYYY-MM-DD (하루 이상인 경우 종료일, 단일이면 생략 또는 동일하게)\",\n");
        promptBuilder.append("      \"time\": \"HH:mm (시작 시간)\",\n");
        promptBuilder.append("      \"endTime\": \"HH:mm (종료 시간, 모를 경우 생략)\"\n");
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

            int jsonStartIdx = aiJsonStr.indexOf('{');
            int jsonEndIdx = aiJsonStr.lastIndexOf('}');
            if(jsonStartIdx >= 0 && jsonEndIdx >= jsonStartIdx) {
                aiJsonStr = aiJsonStr.substring(jsonStartIdx, jsonEndIdx + 1);
            }

            return objectMapper.readValue(aiJsonStr, GroupChatAiDTO.Response.class);

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("AI 요약 요청 중 오류가 발생했습니다: " + e.getMessage());
        }
    }
}
