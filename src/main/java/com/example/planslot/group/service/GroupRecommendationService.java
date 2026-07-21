package com.example.planslot.group.service;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.repository.ScheduleRepository;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.group.entity.GroupMemberStatus;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GroupRecommendationService {

    private final GroupMemberRepository groupMemberRepository;
    private final ScheduleRepository scheduleRepository;
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

    @Value("${ai.max-tokens:8192}")
    private int maxTokens;

    @Transactional(readOnly = true)
    public GroupDTO.AiResponse getRecommendations(Long groupId, Long memberId) {
        List<GroupMember> groupMembers = groupMemberRepository.findByGroup_Id(groupId);
        boolean isMember = groupMembers.stream()
                .anyMatch(gm -> gm.getMember().getId().equals(memberId) && gm.getMemberStatus() == GroupMemberStatus.ACTIVE);
        if (!isMember) {
            throw new IllegalArgumentException("모임원이 아닙니다.");
        }

        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(6).atTime(23, 59, 59);
        
        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("We need to find a common free time for our group meeting in the next 7 days (").append(today).append(" to ").append(today.plusDays(6)).append(").\n");
        promptBuilder.append("Here are the schedules of each member:\n");
        
        List<String> memberNames = new ArrayList<>();

        for (GroupMember gm : groupMembers) {
            if (gm.getMemberStatus() == GroupMemberStatus.ACTIVE) {
                String nickname = gm.getMember().getNickname();
                memberNames.add(nickname);
                promptBuilder.append("Member '").append(nickname).append("':\n");
                
                List<Schedule> schedules = scheduleRepository.findAllByMemberIdAndPeriodCandidate(gm.getMember().getId(), start, end);
                boolean hasSchedule = false;
                for (Schedule s : schedules) {
                    if (s.getScheduleType() == null || s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.DAILY) {
                        LocalDateTime schedEnd = s.getEndDate() != null ? s.getEndDate() : s.getStartDate();
                        if (s.getStartDate() != null && !s.getStartDate().isAfter(end) && !schedEnd.isBefore(start)) {
                            promptBuilder.append("- ").append(s.getStartDate()).append(" to ").append(schedEnd).append("\n");
                            hasSchedule = true;
                        }
                    } else {
                        LocalDate limitStart = s.getStartDate().toLocalDate();
                        LocalDate limitEnd = s.getRecurrenceEndDate();
                        for (LocalDate date = start.toLocalDate(); !date.isAfter(end.toLocalDate()); date = date.plusDays(1)) {
                            if (date.isBefore(limitStart)) continue;
                            if (limitEnd != null && date.isAfter(limitEnd)) continue;
                            
                            boolean matches = false;
                            if (s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.WEEKLY && date.getDayOfWeek() == limitStart.getDayOfWeek()) matches = true;
                            if (s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.MONTHLY && date.getDayOfMonth() == Math.min(limitStart.getDayOfMonth(), date.lengthOfMonth())) matches = true;
                            if (s.getScheduleType() == com.example.planslot.schedule.entity.ScheduleType.YEARLY && date.getMonthValue() == limitStart.getMonthValue() && date.getDayOfMonth() == limitStart.getDayOfMonth()) matches = true;
                            
                            if (matches) {
                                promptBuilder.append("- ").append(date.atTime(s.getStartDate().toLocalTime())).append("\n");
                                hasSchedule = true;
                            }
                        }
                    }
                }
                if (!hasSchedule) {
                    promptBuilder.append("- No schedules (completely free)\n");
                }
            }
        }
        
        System.out.println("====== CLAUDE PROMPT ======");
        System.out.println(promptBuilder.toString());
        System.out.println("===========================");
        
        promptBuilder.append("\nBased on this, generate a JSON response exactly in this format without markdown code blocks:\n");
        promptBuilder.append("{\n");
        promptBuilder.append("  \"heat\": [\n");
        promptBuilder.append("    { \"name\": \"memberName\", \"row\": [\"free\", \"busy\", \"mid\", \"free\", \"free\", \"free\", \"free\"] }\n");
        promptBuilder.append("  ],\n");
        promptBuilder.append("  \"recs\": [\n");
        promptBuilder.append("    { \"rank\": 1, \"label\": \"7월 25일 (토) 오후 2시\", \"sub\": \"이유 설명\", \"tag\": \"전원 가능\" }\n");
        promptBuilder.append("  ]\n");
        promptBuilder.append("}\n");
        promptBuilder.append("The 'row' array in 'heat' should have exactly 7 elements, representing today to today+6.\n");
        promptBuilder.append("If someone has a schedule on a day, mark 'busy'. If no schedule, 'free'. If somewhat free, 'mid'.\n");
        promptBuilder.append("Provide up to 3 recommendations in 'recs'. The values for 'label', 'sub', and 'tag' MUST be in Korean (한국어).\n");
        promptBuilder.append("For each recommendation, 'label' MUST include both a start time AND an end time (e.g. '7월 25일 (토) 오후 2시 - 오후 4시'), assuming a reasonable meeting duration of 1-2 hours that fits within the members' free time.\n");
        promptBuilder.append("Check carefully whether any member has an existing schedule that overlaps with part of this recommended time range, even if they are marked 'free' for that day overall (a day can have both free and busy hours).\n");
        promptBuilder.append("If any member has a partial conflict during the recommended window, mention their name and which part of the time overlaps in the 'sub' field. If everyone is fully free for the whole window, state that clearly in 'sub' instead.\n");

        if (apiKey == null || apiKey.trim().isEmpty() || "your-api-key-here".equals(apiKey)) {
            return generateMockResponse(memberNames);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", apiKey);
            headers.set("anthropic-version", apiVersion);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", aiModel);
            requestBody.put("max_tokens", maxTokens);

            Map<String, Object> thinking = new HashMap<>();
            thinking.put("type", "adaptive");
            requestBody.put("thinking", thinking);

            Map<String, Object> outputConfig = new HashMap<>();
            outputConfig.put("effort", "low");
            requestBody.put("output_config", outputConfig);

            requestBody.put("system", "You are an AI that finds common free time for meetings. " +
                    "Output strictly valid JSON and nothing else. " +
                    "All text values in the JSON (such as 'label', 'sub', 'tag') must be written in Korean. " +
                    "IMPORTANT: If members have no schedules, you MUST still output their names in the 'heat' array with all 'free'. " +
                    "Never return an empty 'heat' array.");
            
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
                throw new IllegalStateException("Claude 응답에 text 블록이 없습니다: " + response.getBody());
            }

            int startIdx = aiJsonStr.indexOf('{');
            int endIdx = aiJsonStr.lastIndexOf('}');
            if(startIdx >= 0 && endIdx >= startIdx) {
                aiJsonStr = aiJsonStr.substring(startIdx, endIdx + 1);
            }
            System.out.println("====== CLAUDE RESPONSE ======");
            System.out.println(aiJsonStr);
            System.out.println("=============================");
            
            JsonNode aiJson = objectMapper.readTree(aiJsonStr);
            List<GroupDTO.HeatInfo> heat = new ArrayList<>();
            for (JsonNode hNode : aiJson.path("heat")) {
                List<String> row = new ArrayList<>();
                hNode.path("row").forEach(n -> row.add(n.asText()));
                heat.add(new GroupDTO.HeatInfo(hNode.path("name").asText(), row));
            }
            
            List<GroupDTO.RecInfo> recs = new ArrayList<>();
            for (JsonNode rNode : aiJson.path("recs")) {
                recs.add(new GroupDTO.RecInfo(
                        rNode.path("rank").asInt(),
                        rNode.path("label").asText(),
                        rNode.path("sub").asText(),
                        rNode.path("tag").asText()
                ));
            }
            
            if (heat.isEmpty()) {
                System.out.println("Claude returned empty heat array! Falling back to generated free heatmap.");
                for (String name : memberNames) {
                    heat.add(new GroupDTO.HeatInfo(name, List.of("free", "free", "free", "free", "free", "free", "free")));
                }
            }
            if (recs.isEmpty() && memberNames.size() > 0) {
                recs.add(new GroupDTO.RecInfo(1, "추천 시간이 없습니다", "모두 일정이 등록되지 않아 전체 일정이 비어있거나, 적당한 시간이 없습니다.", "전원 가능"));
            }
            
            return new GroupDTO.AiResponse(heat, recs);
        } catch (Exception e) {
            System.err.println("[AI Recommendation] API 호출 실패: " + e.getMessage());
            // API 호출 실패 시 더미 데이터 반환
            return generateMockResponse(memberNames);
        }
    }

    private GroupDTO.AiResponse generateMockResponse(List<String> memberNames) {
        List<GroupDTO.HeatInfo> heat = new ArrayList<>();
        for (String name : memberNames) {
            heat.add(new GroupDTO.HeatInfo(name, List.of("free", "free", "free", "free", "free", "free", "free")));
        }
        List<GroupDTO.RecInfo> recs = new ArrayList<>();
        recs.add(new GroupDTO.RecInfo(1, "내일 오후 2시", "API 키가 올바르게 설정되지 않았거나 호출에 실패했습니다.", "임시 결과"));
        return new GroupDTO.AiResponse(heat, recs);
    }
}
