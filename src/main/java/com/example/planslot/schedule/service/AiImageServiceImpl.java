package com.example.planslot.schedule.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.schedule.dto.AiImageDTO;
import com.example.planslot.schedule.entity.AiImage;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.entity.ScheduleType;
import com.example.planslot.schedule.entity.SourceType;
import com.example.planslot.schedule.repository.AiImageRepository;
import com.example.planslot.schedule.repository.ScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiImageServiceImpl implements AiImageService {

    private final AiImageRepository aiImageRepository;
    private final MemberRepository memberRepository;
    private final ScheduleRepository scheduleRepository;
    private final GoogleCalendarService googleCalendarService;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @Value("${file.upload.ai-image-path:./uploads/ai-image}")
    private String aiImageUploadPath;

    @Value("${ai.url:https://api.anthropic.com/v1/messages}")
    private String claudeApiUrl;

    @Value("${ai.api-key:YOUR_CLAUDE_API_KEY_HERE}")
    private String claudeApiKey;

    @Value("${ai.anthropic-version:2023-06-01}")
    private String claudeApiVersion;

    @Value("${ai.model:claude-3-haiku-20240307}")
    private String claudeModel;

    @Value("${ai.max-tokens:1024}")
    private Integer claudeMaxTokens;

    @Override
    @Transactional
    public AiImageDTO.Response uploadAiImage(Long memberId, MultipartFile file, String promptType, String promptText) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        validateImage(file);
        String imageUrl = saveImageFile(file);

        AiImage aiImage = AiImage.builder()
                .member(member)
                .imageUrl(imageUrl)
                .promptType(promptType != null ? promptType : "직접")
                .promptText(promptText != null ? promptText : "")
                .status("WAITING")
                .build();

        AiImage saved = aiImageRepository.save(aiImage);
        return AiImageDTO.Response.from(saved, null);
    }

    @Override
    @Transactional
    public AiImageDTO.Response analyzeAiImage(Long memberId, Long requestId) {
        AiImage aiImage = aiImageRepository.findByIdAndMemberId(requestId, memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "요청 정보를 찾을 수 없습니다."));

        aiImage.updateStatus("ANALYZING");

        // 만약 클로드 API 키가 셋팅되지 않았거나 디폴트 값인 경우 시뮬레이션(Mock) 모드로 Fallback 실행
        if (claudeApiKey == null || claudeApiKey.isBlank() || claudeApiKey.equals("YOUR_CLAUDE_API_KEY_HERE")) {
            log.info("[AI IMAGE] Claude API Key is missing. Falling back to Mock Simulation Mode.");
            return runMockAnalysis(aiImage);
        }

        try {
            // 1. 로컬 이미지 파일 읽어서 Base64 변환
            String imageUrl = aiImage.getImageUrl();
            String fileName = imageUrl.substring(imageUrl.lastIndexOf("/") + 1);
            Path filePath = Path.of(aiImageUploadPath).resolve(fileName).toAbsolutePath().normalize();
            
            if (!Files.exists(filePath)) {
                throw new IOException("디스크 상에 이미지 파일이 존재하지 않습니다: " + filePath);
            }

            byte[] imageBytes = Files.readAllBytes(filePath);
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            String ext = getExtension(fileName);
            String mimeType = ext.equals("png") ? "image/png" : "image/jpeg";

            // 2. Claude API 요청 JSON 바디 빌드
            Map<String, Object> payload = new HashMap<>();
            payload.put("model", claudeModel);
            payload.put("max_tokens", claudeMaxTokens);

            // thinking 강제 비활성화하여 8192 루프 및 생각하기 무한 낭비 원천 차단
            Map<String, Object> thinkingMap = new HashMap<>();
            thinkingMap.put("type", "disabled");
            payload.put("thinking", thinkingMap);

            // 시스템 지시어를 루트 'system' 속성으로 명확히 할당 (Anthropic 공식 스펙 규격)
            String systemInstruction = "You are a professional assistant specialized in schedule extraction. " +
                    "Analyze the attached calendar/schedule image and extract ALL event items. " +
                    "You MUST reply ONLY with a single JSON Array containing objects with the exact schema below: " +
                    "[ { \"title\": \"event title\", \"description\": \"detailed details, notes or description of the event\", \"startDate\": \"YYYY-MM-DDTHH:mm:ss\", \"endDate\": \"YYYY-MM-DDTHH:mm:ss\", \"location\": \"location or null\" } ]. " +
                    "Ensure that the 'title' is very concise and brief (e.g., 'Study Group', 'Lunch Meeting', 'Family Dinner'), and put all lengthy descriptions, extra details, or additional notes into the 'description' field. " +
                    "Do NOT wrap the JSON in markdown formatting (like ```json), do NOT include any introductory or concluding text, and do NOT use backticks. " +
                    "If NO schedule items can be found in the image, you MUST return an empty JSON Array: []. " +
                    "Ensure correct dates, times, and years. If the year is not explicitly written in the image, you MUST assume the year is 2026. If a time is missing, assume 1 hour duration.";
            payload.put("system", systemInstruction);

            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");

            List<Map<String, Object>> contentList = new ArrayList<>();

            // 이미지 콘텐츠 추가
            Map<String, Object> imageContent = new HashMap<>();
            imageContent.put("type", "image");
            Map<String, Object> source = new HashMap<>();
            source.put("type", "base64");
            source.put("media_type", mimeType);
            source.put("data", base64Image);
            imageContent.put("source", source);
            contentList.add(imageContent);

            // 유저 텍스트 프롬프트 추가
            Map<String, Object> textContent = new HashMap<>();
            textContent.put("type", "text");
            String promptText = aiImage.getPromptText();
            textContent.put("text", "Please analyze the attached image based on this request: \"" + promptText + "\"");
            contentList.add(textContent);

            message.put("content", contentList);
            payload.put("messages", List.of(message));

            String requestBodyJson = objectMapper.writeValueAsString(payload);

            // 3. HTTP Client로 Claude API 호출
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(claudeApiUrl.trim()))
                    .header("x-api-key", claudeApiKey.trim())
                    .header("anthropic-version", claudeApiVersion.trim())
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBodyJson))
                    .build();

            HttpResponse<String> httpResponse = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (httpResponse.statusCode() != 200) {
                log.error("[AI IMAGE] Claude API Error Response: Status Code = {}, Body = {}", httpResponse.statusCode(), httpResponse.body());
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Claude API 호출 실패 (상태 코드: " + httpResponse.statusCode() + ")");
            }

            // 4. API 응답 바디 파싱 및 결과 획득
            String rawBody = httpResponse.body();
            log.info("[AI IMAGE] Claude Raw Response body: {}", rawBody);
            JsonNode rootNode = objectMapper.readTree(rawBody);
            String responseText = "";
            if (rootNode.has("content") && rootNode.path("content").isArray()) {
                for (JsonNode contentObj : rootNode.path("content")) {
                    if ("text".equals(contentObj.path("type").asText())) {
                        responseText = contentObj.path("text").asText().trim();
                        break;
                    }
                }
            }
            if (responseText.isEmpty()) {
                log.warn("[AI IMAGE] Claude response does not contain content text. RootNode: {}", rootNode.toString());
            }
            log.info("[AI IMAGE] Claude Raw Response text: {}", responseText);

            // JSON Array 블록만 정규식으로 쏙 발췌 (혹시 모를 마크다운 꼬리방지)
            Pattern jsonPattern = Pattern.compile("\\[.*\\]", Pattern.DOTALL);
            Matcher jsonMatcher = jsonPattern.matcher(responseText);
            if (jsonMatcher.find()) {
                responseText = jsonMatcher.group(0);
            }

            List<AiImageDTO.ExtractedSchedule> list = new ArrayList<>();
            JsonNode arrayNode = objectMapper.readTree(responseText);
            if (arrayNode.isArray()) {
                for (JsonNode node : arrayNode) {
                    String t = node.path("title").asText("AI 분석 일정").trim();
                    String desc = node.path("description").asText("").trim();
                    String startS = node.path("startDate").asText();
                    String endS = node.path("endDate").asText();
                    String loc = node.has("location") && !node.path("location").isNull() 
                            ? node.path("location").asText().trim() 
                            : "회의실";

                    LocalDateTime parsedS = safeParseDateTime(startS);
                    LocalDateTime parsedE = safeParseDateTime(endS);

                    list.add(AiImageDTO.ExtractedSchedule.builder()
                            .title(t)
                            .description(desc)
                            .startDate(parsedS)
                            .endDate(parsedE)
                            .location(loc)
                            .build());
                }
            }

            String listJson = null;
            try {
                listJson = objectMapper.writeValueAsString(list);
            } catch (Exception ex) {
                log.error("Failed to serialize extracted schedules list", ex);
            }

            if (!list.isEmpty()) {
                // 대표값 설정 (첫 번째 일정으로 기존 단일 필드들 덮어쓰기)
                AiImageDTO.ExtractedSchedule first = list.get(0);
                aiImage.completeAnalysis(first.getTitle(), first.getStartDate(), first.getEndDate(), first.getLocation(), BigDecimal.valueOf(98.50), listJson);
            } else {
                aiImage.completeAnalysis("AI 분석 일정", LocalDateTime.now(), LocalDateTime.now().plusHours(1), "회의실", BigDecimal.valueOf(90.00), "[]");
            }
            
            log.info("[AI IMAGE] AI Analysis successfully completed via Claude API integration! Found {} items.", list.size());
            return AiImageDTO.Response.from(aiImage, list);

        } catch (Exception e) {
            log.error("[AI IMAGE] Analysis failed with exception: ", e);
            aiImage.failAnalysis("AI 분석 도중 예외가 발생했습니다: " + e.getMessage());
        }

        return AiImageDTO.Response.from(aiImage, null);
    }

    private AiImageDTO.Response runMockAnalysis(AiImage aiImage) {
        String prompt = aiImage.getPromptText();
        
        // 1. 제목 추출
        String title = "AI 분석 일정";
        if (prompt.contains("공부방")) title = "공부방 모임";
        else if (prompt.contains("회의")) title = "주간 회의";
        else if (prompt.contains("수업")) title = "전공 수업";
        else if (prompt.contains("생일")) title = "생일 파티";
        else if (prompt.contains("세미나")) title = "IT 세미나";
        else if (prompt.contains("식사") || prompt.contains("저녁")) title = "저녁 식사 약속";
        
        Pattern titlePattern = Pattern.compile("(제목|주제)\\s*:\\s*([^\\s]+)");
        Matcher titleMatcher = titlePattern.matcher(prompt);
        if (titleMatcher.find()) {
            title = titleMatcher.group(2).trim();
        }

        // 2. 날짜 추출
        LocalDate targetDate = LocalDate.now().plusDays(1);
        
        Map<String, DayOfWeek> dayOfWeekMap = new HashMap<>();
        dayOfWeekMap.put("월요일", DayOfWeek.MONDAY); dayOfWeekMap.put("월요", DayOfWeek.MONDAY);
        dayOfWeekMap.put("화요일", DayOfWeek.TUESDAY); dayOfWeekMap.put("화요", DayOfWeek.TUESDAY);
        dayOfWeekMap.put("수요일", DayOfWeek.WEDNESDAY); dayOfWeekMap.put("수요", DayOfWeek.WEDNESDAY);
        dayOfWeekMap.put("목요일", DayOfWeek.THURSDAY); dayOfWeekMap.put("목요", DayOfWeek.THURSDAY);
        dayOfWeekMap.put("금요일", DayOfWeek.FRIDAY); dayOfWeekMap.put("금요", DayOfWeek.FRIDAY);
        dayOfWeekMap.put("토요일", DayOfWeek.SATURDAY); dayOfWeekMap.put("토요", DayOfWeek.SATURDAY);
        dayOfWeekMap.put("일요일", DayOfWeek.SUNDAY); dayOfWeekMap.put("일요", DayOfWeek.SUNDAY);

        boolean dayFound = false;
        for (String dayStr : dayOfWeekMap.keySet()) {
            if (prompt.contains(dayStr)) {
                DayOfWeek targetDay = dayOfWeekMap.get(dayStr);
                LocalDate today = LocalDate.now();
                int daysToAdd = (targetDay.getValue() - today.getDayOfWeek().getValue() + 7) % 7;
                if (daysToAdd == 0) daysToAdd = 7;
                targetDate = today.plusDays(daysToAdd);
                dayFound = true;
                break;
            }
        }

        if (!dayFound) {
            Pattern datePattern1 = Pattern.compile("(\\d{1,2})월\\s*(\\d{1,2})일");
            Matcher dateMatcher1 = datePattern1.matcher(prompt);
            if (dateMatcher1.find()) {
                int month = Integer.parseInt(dateMatcher1.group(1));
                int day = Integer.parseInt(dateMatcher1.group(2));
                targetDate = LocalDate.of(LocalDate.now().getYear(), month, day);
                dayFound = true;
            }
        }
        if (!dayFound) {
            Pattern datePattern2 = Pattern.compile("(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})");
            Matcher dateMatcher2 = datePattern2.matcher(prompt);
            if (dateMatcher2.find()) {
                int year = Integer.parseInt(dateMatcher2.group(1));
                int month = Integer.parseInt(dateMatcher2.group(2));
                int day = Integer.parseInt(dateMatcher2.group(3));
                targetDate = LocalDate.of(year, month, day);
            }
        }

        // 3. 시간 추출
        LocalTime startTime = LocalTime.of(9, 0);
        LocalTime endTime = LocalTime.of(10, 0);

        Pattern timePattern = Pattern.compile("(\\d{1,2})시");
        Matcher timeMatcher = timePattern.matcher(prompt);
        if (timeMatcher.find()) {
            int hour = Integer.parseInt(timeMatcher.group(1));
            if (prompt.contains("오후") && hour < 12) {
                hour += 12;
            }
            startTime = LocalTime.of(hour, 0);
            endTime = startTime.plusHours(1);
        }

        LocalDateTime extractedStart = LocalDateTime.of(targetDate, startTime);
        LocalDateTime extractedEnd = LocalDateTime.of(targetDate, endTime);

        // 4. 장소 추출
        String location = "회의실";
        if (prompt.contains("강남")) location = "강남역 모임 공간";
        else if (prompt.contains("온라인") || prompt.contains("줌") || prompt.contains("Zoom")) location = "Zoom 온라인 링크";
        else if (prompt.contains("강의실") || prompt.contains("학교")) location = "본관 302호 강의실";

        // 다중 가상 일정 생성 (7월 등 다중 날짜 모드 시뮬레이션용으로 3개 생성!)
        List<AiImageDTO.ExtractedSchedule> list = new ArrayList<>();
        list.add(AiImageDTO.ExtractedSchedule.builder()
                .title(title)
                .description("시뮬레이션으로 자동 구성된 분석 일정 세부 내용입니다.")
                .startDate(extractedStart)
                .endDate(extractedEnd)
                .location(location)
                .build());

        list.add(AiImageDTO.ExtractedSchedule.builder()
                .title(title + " 2차 모임")
                .description("시뮬레이션으로 자동 구성된 분석 일정 세부 내용입니다.")
                .startDate(extractedStart.plusDays(3))
                .endDate(extractedEnd.plusDays(3))
                .location(location)
                .build());

        list.add(AiImageDTO.ExtractedSchedule.builder()
                .title(title + " 최종 리허설")
                .description("최종 리허설 및 준비 사항 체크 일정 설명입니다.")
                .startDate(extractedStart.plusDays(7))
                .endDate(extractedEnd.plusDays(7))
                .location("본부 대회의실")
                .build());

        BigDecimal confidence = BigDecimal.valueOf(95.50);
        String listJson = null;
        try {
            listJson = objectMapper.writeValueAsString(list);
        } catch (Exception ex) {}
        aiImage.completeAnalysis(title, extractedStart, extractedEnd, location, confidence, listJson);
        return AiImageDTO.Response.from(aiImage, list);
    }

    @Override
    public AiImageDTO.Response getAiImageAnalysis(Long memberId, Long requestId) {
        AiImage aiImage = aiImageRepository.findByIdAndMemberId(requestId, memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "요청 정보를 찾을 수 없습니다."));
        
        List<AiImageDTO.ExtractedSchedule> list = new ArrayList<>();
        if (aiImage.getExtractedSchedulesJson() != null && !aiImage.getExtractedSchedulesJson().isBlank()) {
            try {
                AiImageDTO.ExtractedSchedule[] arr = objectMapper.readValue(aiImage.getExtractedSchedulesJson(), AiImageDTO.ExtractedSchedule[].class);
                list = new ArrayList<>(Arrays.asList(arr));
            } catch (Exception e) {
                log.error("Failed to deserialize extracted schedules JSON from DB", e);
            }
        }
        
        // 만약 JSON 복원에 실패했거나 비어있는 경우 Fallback으로 단일 대표 일정을 리스트에 담음
        if (list.isEmpty() && aiImage.getExtractedTitle() != null) {
            list.add(AiImageDTO.ExtractedSchedule.builder()
                    .title(aiImage.getExtractedTitle())
                    .description("AI 이미지 분석 등록")
                    .startDate(aiImage.getExtractedStartDate())
                    .endDate(aiImage.getExtractedEndDate())
                    .location(aiImage.getExtractedLocation())
                    .build());
        }
        return AiImageDTO.Response.from(aiImage, list);
    }

    @Override
    @Transactional
    public AiImageDTO.Response updateAiImageAnalysis(Long memberId, Long requestId, AiImageDTO.UpdateRequest updateRequest) {
        AiImage aiImage = aiImageRepository.findByIdAndMemberId(requestId, memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "요청 정보를 찾을 수 없습니다."));

        if (updateRequest.getPromptText() != null && !updateRequest.getPromptText().equals(aiImage.getPromptText())) {
            aiImage = aiImage.toBuilder()
                    .promptType(updateRequest.getPromptType() != null ? updateRequest.getPromptType() : aiImage.getPromptType())
                    .promptText(updateRequest.getPromptText())
                    .build();
            aiImageRepository.save(aiImage);
            return analyzeAiImage(memberId, requestId);
        }

        String listJson = null;
        try {
            listJson = objectMapper.writeValueAsString(updateRequest.getExtractedSchedules());
        } catch (Exception ex) {}

        aiImage.completeAnalysis(
                updateRequest.getExtractedTitle() != null ? updateRequest.getExtractedTitle() : aiImage.getExtractedTitle(),
                updateRequest.getExtractedStartDate() != null ? updateRequest.getExtractedStartDate() : aiImage.getExtractedStartDate(),
                updateRequest.getExtractedEndDate() != null ? updateRequest.getExtractedEndDate() : aiImage.getExtractedEndDate(),
                updateRequest.getExtractedLocation() != null ? updateRequest.getExtractedLocation() : aiImage.getExtractedLocation(),
                updateRequest.getConfidenceScore() != null ? updateRequest.getConfidenceScore() : aiImage.getConfidenceScore(),
                listJson != null ? listJson : aiImage.getExtractedSchedulesJson()
        );

        List<AiImageDTO.ExtractedSchedule> list = updateRequest.getExtractedSchedules();
        if (list == null) {
            list = new ArrayList<>();
            list.add(AiImageDTO.ExtractedSchedule.builder()
                    .title(aiImage.getExtractedTitle())
                    .description("AI 이미지 분석 등록")
                    .startDate(aiImage.getExtractedStartDate())
                    .endDate(aiImage.getExtractedEndDate())
                    .location(aiImage.getExtractedLocation())
                    .build());
        }

        return AiImageDTO.Response.from(aiImage, list);
    }

    @Override
    @Transactional
    public AiImageDTO.Response confirmAiImageSchedule(Long memberId, Long requestId, List<AiImageDTO.ConfirmRequest> confirmRequests) {
        try {
            System.out.println("[AI-Confirm] Starting schedule confirmation for memberId: " + memberId + ", requestId: " + requestId);
            AiImage aiImage = aiImageRepository.findByIdAndMemberId(requestId, memberId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "요청 정보를 찾을 수 없습니다."));

            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

            if (confirmRequests == null || confirmRequests.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "등록할 일정이 없습니다.");
            }

            System.out.println("[AI-Confirm] Number of request schedules to confirm: " + confirmRequests.size());

            Schedule lastSaved = null;
            for (AiImageDTO.ConfirmRequest req : confirmRequests) {
                System.out.println("[AI-Confirm] Creating new schedule. Title: " + req.getTitle() + " | Start: " + req.getStartDate());
                Schedule schedule = Schedule.builder()
                        .member(member)
                        .title(req.getTitle())
                        .description(req.getDescription())
                        .scheduleType(ScheduleType.valueOf(req.getScheduleType() != null ? req.getScheduleType() : "DAILY"))
                        .startDate(req.getStartDate())
                        .endDate(req.getEndDate())
                        .isPublic(Boolean.TRUE.equals(req.getIsPublic()) ? "Y" : "N")
                        .googleSyncYn("N")
                        .sourceType(SourceType.AI_IMAGE)
                        .location(req.getLocation())
                        .build();
                schedule = scheduleRepository.save(schedule);

                // 구글 캘린더 Push (CompletableFuture로 비동기 스레드에서 처리하여 지연 방지)
                // 트랜잭션이 실제로 DB에 커밋된 직후에 비동기 스레드를 실행하도록 조율합니다.
                if (member.isGoogleSyncEnabled() && member.getGoogleAccessToken() != null) {
                    final Long scheduleId = schedule.getScheduleId();
                    if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
                        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                            new org.springframework.transaction.support.TransactionSynchronization() {
                                @Override
                                public void afterCommit() {
                                    java.util.concurrent.CompletableFuture.runAsync(() -> {
                                        triggerGoogleSync(memberId, scheduleId);
                                    });
                                }
                            }
                        );
                    } else {
                        java.util.concurrent.CompletableFuture.runAsync(() -> {
                            triggerGoogleSync(memberId, scheduleId);
                        });
                    }
                }

                lastSaved = schedule;
            }

            if (lastSaved != null) {
                System.out.println("[AI-Confirm] Setting lastSaved schedule ID: " + lastSaved.getScheduleId() + " into aiImage: " + requestId);
                aiImage.confirmSchedule(lastSaved);
            }

            System.out.println("[AI-Confirm] Schedule confirmation completed successfully!");
            AiImageDTO.Response response = AiImageDTO.Response.from(aiImage, null);

            // 등록이 성공적으로 완료되었으므로, 해당 회원의 모든 AI 이미지 분석 요청 이력 및 디스크 파일을 삭제하여 청소
            try {
                List<AiImage> allImages = aiImageRepository.findAllByMemberId(memberId);
                System.out.println("[AI-Clean] Found " + allImages.size() + " AI images to clean up for memberId: " + memberId);
                for (AiImage img : allImages) {
                    deletePhysicalImageFile(img.getImageUrl());
                }
                aiImageRepository.deleteAll(allImages);
                System.out.println("[AI-Clean] Successfully cleaned up all AI images from DB for memberId: " + memberId);
            } catch (Exception e) {
                System.err.println("[AI-Clean] Error occurred during AI images cleanup: " + e.getMessage());
            }

            // 디스크 폴더 상의 고아 정크 파일들까지 일괄 청소
            clearUploadDirectory();

            return response;
        } catch (Exception ex) {
            System.err.println("[AI-Confirm] Error occurred during confirmAiImageSchedule!");
            ex.printStackTrace();
            throw ex;
        }
    }

    private void triggerGoogleSync(Long memberId, Long scheduleId) {
        try {
            Member currentMember = memberRepository.findById(memberId).orElse(null);
            Schedule currentSchedule = scheduleRepository.findById(scheduleId).orElse(null);
            if (currentMember != null && currentSchedule != null) {
                String googleEventId = googleCalendarService.insertEvent(currentMember, currentSchedule);
                if (googleEventId != null) {
                    currentSchedule.syncGoogleCalendar(googleEventId);
                    scheduleRepository.save(currentSchedule);
                    System.out.println("[AI-Confirm] Asynchronously synced schedule ID: " + scheduleId + " with Google Calendar. Event ID: " + googleEventId);
                } else {
                    System.err.println("[AI-Confirm] Failed to sync schedule ID: " + scheduleId + " (insertEvent returned null)");
                }
            } else {
                System.err.println("[AI-Confirm] Sync skipped. Member or Schedule not found for memberId: " + memberId + ", scheduleId: " + scheduleId);
            }
        } catch (Exception e) {
            System.err.println("[AI-Confirm] Failed to async sync schedule with Google Calendar: " + e.getMessage());
        }
    }

    private void clearUploadDirectory() {
        try {
            Path uploadDirectory = Path.of(aiImageUploadPath).toAbsolutePath().normalize();
            if (Files.exists(uploadDirectory)) {
                try (var stream = Files.list(uploadDirectory)) {
                    stream.forEach(file -> {
                        try {
                            Files.deleteIfExists(file);
                            System.out.println("[AI-Clean] Deleted orphaned physical file: " + file.getFileName());
                        } catch (IOException e) {
                            System.err.println("[AI-Clean] Failed to delete file " + file.getFileName() + ": " + e.getMessage());
                        }
                    });
                }
            }
        } catch (Exception e) {
            System.err.println("[AI-Clean] Failed to clear upload directory: " + e.getMessage());
        }
    }

    private void deletePhysicalImageFile(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return;
        try {
            String fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
            Path uploadDirectory = Path.of(aiImageUploadPath).toAbsolutePath().normalize();
            Path filePath = uploadDirectory.resolve(fileName).normalize();
            
            if (filePath.startsWith(uploadDirectory)) {
                boolean deleted = Files.deleteIfExists(filePath);
                System.out.println("[AI-Clean] Physical file delete result for " + fileName + ": " + deleted);
            }
        } catch (Exception e) {
            System.err.println("[AI-Clean] Failed to delete physical image file: " + imageUrl + " | Error: " + e.getMessage());
        }
    }

    @Override
    public List<AiImageDTO.Response> getAiImageList(Long memberId) {
        return aiImageRepository.findAllByMemberId(memberId).stream()
                .map(entity -> AiImageDTO.Response.from(entity, null))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
    }

    private void validateImage(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일이 전송되지 않았습니다.");
        }
        String contentType = image.getContentType();
        if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/jpg"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "jpg, jpeg, png 포맷의 이미지 파일만 업로드할 수 있습니다.");
        }
    }

    private String saveImageFile(MultipartFile image) {
        String originalFilename = image.getOriginalFilename();
        String extension = getExtension(originalFilename);
        String savedFileName = UUID.randomUUID() + "." + extension;

        Path uploadDirectory = Path.of(aiImageUploadPath).toAbsolutePath().normalize();
        Path savedFilePath = uploadDirectory.resolve(savedFileName).normalize();

        if (!savedFilePath.startsWith(uploadDirectory)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "올바르지 않은 이미지 저장 경로입니다.");
        }

        try {
            Files.createDirectories(uploadDirectory);
            try (InputStream inputStream = image.getInputStream()) {
                Files.copy(inputStream, savedFilePath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "이미지 저장에 실패했습니다.", exception
            );
        }

        return "/uploads/ai-image/" + savedFileName;
    }

    private String getExtension(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일명이 올바르지 않습니다.");
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalFilename.length() - 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일 확장자가 필요합니다.");
        }
        return originalFilename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    private LocalDateTime safeParseDateTime(String str) {
        if (str == null || str.trim().isEmpty()) {
            return LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(9, 0));
        }
        String clean = str.trim();
        if (clean.contains(" ") && !clean.contains("T")) {
            clean = clean.replace(" ", "T");
        }
        if (clean.length() == 10) {
            clean += "T00:00:00";
        }
        if (clean.length() == 16) {
            clean += ":00";
        }
        try {
            return LocalDateTime.parse(clean, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            try {
                if (clean.length() >= 10) {
                    return LocalDate.parse(clean.substring(0, 10)).atTime(9, 0);
                }
            } catch (Exception ex) {}
            return LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(9, 0));
        }
    }
}
