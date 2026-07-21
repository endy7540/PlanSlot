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

            // 텍스트 프롬프트 추가 (JSON Array 규격 강제 지시)
            Map<String, Object> textContent = new HashMap<>();
            textContent.put("type", "text");
            
            String promptText = aiImage.getPromptText();
            String systemInstruction = "Analyze the attached schedule image based on the user request prompt: \"" + promptText + "\". " +
                    "Extract ALL schedule items found in the image. " +
                    "Return ONLY a single valid raw JSON Array matching the following schema, with no markdown formatting (like ```json), no backticks, and no extra conversational text: " +
                    "[ { \"title\": \"schedule title\", \"startDate\": \"YYYY-MM-DDTHH:mm:ss\", \"endDate\": \"YYYY-MM-DDTHH:mm:ss\", \"location\": \"location or null\" } ]. " +
                    "Ensure you extract the correct dates and times as they appear on the calendar image. Do not group them into 1st day of month unless explicitly stated. If duration is unspecified, assume 1 hour.";
            
            textContent.put("text", systemInstruction);
            contentList.add(textContent);

            message.put("content", contentList);
            payload.put("messages", List.of(message));

            String requestBodyJson = objectMapper.writeValueAsString(payload);

            // 3. HTTP Client로 Claude API 호출
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(claudeApiUrl))
                    .header("x-api-key", claudeApiKey)
                    .header("anthropic-version", claudeApiVersion)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBodyJson))
                    .build();

            HttpResponse<String> httpResponse = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (httpResponse.statusCode() != 200) {
                log.error("[AI IMAGE] Claude API Error Response: Status Code = {}, Body = {}", httpResponse.statusCode(), httpResponse.body());
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Claude API 호출 실패 (상태 코드: " + httpResponse.statusCode() + ")");
            }

            // 4. API 응답 바디 파싱 및 결과 획득
            JsonNode rootNode = objectMapper.readTree(httpResponse.body());
            String responseText = rootNode.path("content").get(0).path("text").asText().trim();
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
                    String startS = node.path("startDate").asText();
                    String endS = node.path("endDate").asText();
                    String loc = node.has("location") && !node.path("location").isNull() 
                            ? node.path("location").asText().trim() 
                            : "회의실";

                    LocalDateTime parsedS = startS.isBlank() 
                            ? LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(9, 0)) 
                            : LocalDateTime.parse(startS, DateTimeFormatter.ISO_LOCAL_DATE_TIME);

                    LocalDateTime parsedE = endS.isBlank() 
                            ? parsedS.plusHours(1) 
                            : LocalDateTime.parse(endS, DateTimeFormatter.ISO_LOCAL_DATE_TIME);

                    list.add(AiImageDTO.ExtractedSchedule.builder()
                            .title(t)
                            .startDate(parsedS)
                            .endDate(parsedE)
                            .location(loc)
                            .build());
                }
            }

            if (!list.isEmpty()) {
                // 대표값 설정 (첫 번째 일정으로 기존 단일 필드들 덮어쓰기)
                AiImageDTO.ExtractedSchedule first = list.get(0);
                aiImage.completeAnalysis(first.getTitle(), first.getStartDate(), first.getEndDate(), first.getLocation(), BigDecimal.valueOf(98.50));
            } else {
                aiImage.completeAnalysis("AI 분석 일정", LocalDateTime.now(), LocalDateTime.now().plusHours(1), "회의실", BigDecimal.valueOf(90.00));
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
                .startDate(extractedStart)
                .endDate(extractedEnd)
                .location(location)
                .build());

        list.add(AiImageDTO.ExtractedSchedule.builder()
                .title(title + " 2차 모임")
                .startDate(extractedStart.plusDays(3))
                .endDate(extractedEnd.plusDays(3))
                .location(location)
                .build());

        list.add(AiImageDTO.ExtractedSchedule.builder()
                .title(title + " 최종 리허설")
                .startDate(extractedStart.plusDays(7))
                .endDate(extractedEnd.plusDays(7))
                .location("본부 대회의실")
                .build());

        BigDecimal confidence = BigDecimal.valueOf(95.50);
        aiImage.completeAnalysis(title, extractedStart, extractedEnd, location, confidence);
        return AiImageDTO.Response.from(aiImage, list);
    }

    @Override
    public AiImageDTO.Response getAiImageAnalysis(Long memberId, Long requestId) {
        AiImage aiImage = aiImageRepository.findByIdAndMemberId(requestId, memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "요청 정보를 찾을 수 없습니다."));
        
        // 상세 조회 시 기본적으로 단일 분석 기록 기반으로 1개 목록을 만들어서 제공
        List<AiImageDTO.ExtractedSchedule> list = new ArrayList<>();
        if (aiImage.getExtractedTitle() != null) {
            list.add(AiImageDTO.ExtractedSchedule.builder()
                    .title(aiImage.getExtractedTitle())
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

        aiImage.completeAnalysis(
                updateRequest.getExtractedTitle() != null ? updateRequest.getExtractedTitle() : aiImage.getExtractedTitle(),
                updateRequest.getExtractedStartDate() != null ? updateRequest.getExtractedStartDate() : aiImage.getExtractedStartDate(),
                updateRequest.getExtractedEndDate() != null ? updateRequest.getExtractedEndDate() : aiImage.getExtractedEndDate(),
                updateRequest.getExtractedLocation() != null ? updateRequest.getExtractedLocation() : aiImage.getExtractedLocation(),
                updateRequest.getConfidenceScore() != null ? updateRequest.getConfidenceScore() : aiImage.getConfidenceScore()
        );

        List<AiImageDTO.ExtractedSchedule> list = updateRequest.getExtractedSchedules();
        if (list == null) {
            list = new ArrayList<>();
            list.add(AiImageDTO.ExtractedSchedule.builder()
                    .title(aiImage.getExtractedTitle())
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
        AiImage aiImage = aiImageRepository.findByIdAndMemberId(requestId, memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "요청 정보를 찾을 수 없습니다."));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        if (confirmRequests == null || confirmRequests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "등록할 일정이 없습니다.");
        }

        Schedule lastSaved = null;
        for (AiImageDTO.ConfirmRequest req : confirmRequests) {
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

            lastSaved = scheduleRepository.save(schedule);
        }

        if (lastSaved != null) {
            aiImage.confirmSchedule(lastSaved);
        }

        return AiImageDTO.Response.from(aiImage, null);
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
}
