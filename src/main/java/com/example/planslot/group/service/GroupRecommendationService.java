package com.example.planslot.group.service;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.repository.ScheduleRepository;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.group.entity.GroupMemberStatus;
import com.example.planslot.group.entity.GroupRecommendation;
import com.example.planslot.group.repository.GroupRecommendationRepository;
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
    private final com.example.planslot.group.repository.GroupRepository groupRepository;
    private final GroupRecommendationRepository groupRecommendationRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

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
    public GroupDTO.AiResponse getRecommendations(Long groupId, Long memberId, String type, String startDateStr, String endDateStr) {
        List<GroupMember> groupMembers = groupMemberRepository.findByGroup_Id(groupId);
        boolean isMember = groupMembers.stream()
                .anyMatch(gm -> gm.getMember().getId().equals(memberId) && gm.getMemberStatus() == GroupMemberStatus.ACTIVE);
        if (!isMember) {
            throw new IllegalArgumentException("모임원이 아닙니다.");
        }

        LocalDate today = LocalDate.now();
        LocalDate fromDate = (startDateStr != null && !startDateStr.trim().isEmpty()) ? LocalDate.parse(startDateStr) : today;
        LocalDate toDate = (endDateStr != null && !endDateStr.trim().isEmpty()) ? LocalDate.parse(endDateStr) : today.plusDays(6);
        
        if (toDate.isBefore(fromDate)) {
            toDate = fromDate; // fallback
        }
        
        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime end = toDate.atTime(23, 59, 59);
        
        long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(fromDate, toDate);
        
        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("We need to find a common free time for our group meeting in the next ").append(daysBetween + 1).append(" days (").append(fromDate).append(" to ").append(toDate).append(").\n");
        promptBuilder.append("Here are the schedules of each member:\n");
        
        List<String> memberNames = new ArrayList<>();

        for (GroupMember gm : groupMembers) {
            if (gm.getMemberStatus() == GroupMemberStatus.ACTIVE) {
                String nickname = gm.getMember().getDisplayName();
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

        promptBuilder.append("\nBased on this, ").append("You MUST return ONLY a JSON object with this exact structure:\n")
                    .append("{\n")
                    .append("  \"heat\": [\n")
                    .append("    { \"name\": \"Member1\", \"row\": [\"free\", \"busy\", \"mid\", ...] },\n")
                    .append("    ... \n")
                    .append("    // For each member, \"row\" array length MUST match the number of days exactly (").append(daysBetween + 1).append(" elements)\n")
                    .append("  ],\n")
                    .append("  \"recs\": [\n");
        promptBuilder.append("    { \"rank\": 1, \"label\": \"날짜 (요일) 시작시간-종료시간\", \"sub\": \"이유 및 겹치는 일정 안내\", \"tag\": \"전원 가능\", \"date\": \"YYYY-MM-DD\", \"time\": \"HH:mm\", \"title\": \"모임 일정: 오전 ?시 - 오후 ?시\" }\n");
        promptBuilder.append("  ]\n");
        promptBuilder.append("}\n");
        promptBuilder.append("The 'row' array in 'heat' should have exactly ").append(daysBetween + 1).append(" elements, representing ").append(fromDate).append(" to ").append(toDate).append(".\n");
        promptBuilder.append("EACH element in the 'row' array MUST be EXACTLY the string literal \"free\", \"busy\", or \"mid\". Absolutely NO expressions (like \"a\"==\"b\").\n");
        promptBuilder.append("If someone has a schedule on a day, mark 'busy'. If no schedule, 'free'. If somewhat free, 'mid'.\n");
        promptBuilder.append("Provide up to 3 recommendations in 'recs'.\n");
        promptBuilder.append("Each 'label' MUST include both start and end time (e.g. '7월 25일 (토) 오후 2시 - 오후 4시').\n");
        promptBuilder.append("IMPORTANT TIME RANGE RULE: If the user selects multiple adjacent time periods (e.g., '오후' + '저녁' or '저녁' + '새벽'), you MUST treat them as a SINGLE CONTINUOUS time window. Specifically, if '저녁(18~24시)' and '새벽(00~06시)' are BOTH selected, you MUST be able to recommend a time slot that spans past midnight (e.g., Today 22:00 to Tomorrow 02:00).\n");
        promptBuilder.append("IMPORTANT MULTI-DAY RULE: If the user's preference includes '하루종일' (All day) or multi-day durations like '1박 2일' (1 Night 2 Days) or '2박 3일' (2 Nights 3 Days), you MUST find completely free, full, and consecutive days where EVERYONE is marked 'free'. For example, '1박 2일' requires 2 consecutive completely free days. In this case, ignore the time-of-day constraints and return a recommendation that covers the entire span (e.g. '8월 1일 (금) - 8월 2일 (토)').\n");

        String typeInstruction = "User's meeting preference - " + type;
        promptBuilder.append(typeInstruction).append("\n");

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
            requestBody.put("max_tokens", 8192);

            // Removed thinking and output_config to save tokens and prevent truncation

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
                        rNode.path("tag").asText(),
                        rNode.has("date") ? rNode.path("date").asText() : today.toString(),
                        rNode.has("time") ? rNode.path("time").asText() : "12:00",
                        rNode.has("title") ? rNode.path("title").asText() : "모임 일정"
                ));
            }
            
            if (heat.isEmpty()) {
                System.out.println("Claude returned empty heat array! Falling back to generated free heatmap.");
                for (String name : memberNames) {
                    heat.add(new GroupDTO.HeatInfo(name, List.of("free", "free", "free", "free", "free", "free", "free")));
                }
            }
            if (recs.isEmpty() && memberNames.size() > 0) {
                recs.add(new GroupDTO.RecInfo(1, "추천 시간이 없습니다", "모두 일정이 등록되지 않아 전체 일정이 비어있거나, 적당한 시간이 없습니다.", "전원 가능", today.toString(), "12:00", "모임 일정"));
            }
            
            return new GroupDTO.AiResponse(heat, recs);
        } catch (Exception e) {
            System.err.println("[AI Recommendation] API 호출 실패: " + e.getMessage());
            // API 호출 실패 시 더미 데이터 반환
            return generateMockResponse(memberNames);
        }
    }

    private GroupDTO.AiResponse generateMockResponse(List<String> memberNames) {
        LocalDate today = LocalDate.now();
        List<GroupDTO.HeatInfo> heat = new ArrayList<>();
        for (String name : memberNames) {
            heat.add(new GroupDTO.HeatInfo(name, List.of("free", "free", "free", "free", "free", "free", "free")));
        }
        List<GroupDTO.RecInfo> recs = new ArrayList<>();
        recs.add(new GroupDTO.RecInfo(1, "내일 오후 2시", "API 키가 올바르게 설정되지 않았거나 호출에 실패했습니다.", "임시 결과", today.plusDays(1).toString(), "14:00", "모임 일정: 오후 2시 - 오후 4시"));
        return new GroupDTO.AiResponse(heat, recs);
    }

    @Transactional
    public void bookmarkRecommendation(Long groupId, Long memberId, GroupDTO.RecInfo rec) {
        com.example.planslot.group.entity.Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 모임입니다."));
        com.example.planslot.member.entity.Member member = groupMemberRepository.findByGroup_Id(groupId).stream()
                .filter(gm -> gm.getMember().getId().equals(memberId) && gm.getMemberStatus() == GroupMemberStatus.ACTIVE)
                .map(GroupMember::getMember)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("모임원이 아닙니다."));

        GroupRecommendation recommendation = GroupRecommendation.builder()
                .group(group)
                .requestedBy(member)
                .rank(rec.rank())
                .label(rec.label())
                .sub(rec.sub())
                .tag(rec.tag())
                .date(rec.date())
                .time(rec.time())
                .title(rec.title())
                .build();

        groupRecommendationRepository.save(recommendation);
    }

    @Transactional(readOnly = true)
    public List<GroupRecommendation> getBookmarkedRecommendations(Long groupId, Long memberId) {
        List<GroupMember> groupMembers = groupMemberRepository.findByGroup_Id(groupId);
        boolean isMember = groupMembers.stream()
                .anyMatch(gm -> gm.getMember().getId().equals(memberId) && gm.getMemberStatus() == GroupMemberStatus.ACTIVE);
        if (!isMember) {
            throw new IllegalArgumentException("모임원이 아닙니다.");
        }
        return groupRecommendationRepository.findAllByGroup_IdAndRequestedBy_IdOrderByBookmarkedAtDesc(groupId, memberId);
    }
}
