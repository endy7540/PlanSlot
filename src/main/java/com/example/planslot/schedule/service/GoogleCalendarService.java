package com.example.planslot.schedule.service;

import com.example.planslot.member.entity.Member;
import com.example.planslot.schedule.entity.Schedule;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.calendar.model.Events;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Collections;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoogleCalendarService {

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final String APPLICATION_NAME = "PlanSlot";

    @Value("${spring.security.oauth2.client.registration.google.client-id}")
    private String clientId;

    @Value("${spring.security.oauth2.client.registration.google.client-secret}")
    private String clientSecret;

    private Calendar getCalendarService(Member member) throws Exception {
        if (member.getGoogleAccessToken() == null) {
            throw new IllegalArgumentException("구글 캘린더 연동이 되어 있지 않습니다.");
        }

        NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        
        // Refresh Token을 사용하여 만료시 자동 갱신되는 Credential 생성
        GoogleCredential credential = new GoogleCredential.Builder()
                .setTransport(httpTransport)
                .setJsonFactory(JSON_FACTORY)
                .setClientSecrets(clientId, clientSecret)
                .build()
                .setAccessToken(member.getGoogleAccessToken())
                .setRefreshToken(member.getGoogleRefreshToken());

        return new Calendar.Builder(httpTransport, JSON_FACTORY, credential)
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    public String insertEvent(Member member, Schedule schedule) {
        try {
            Calendar service = getCalendarService(member);
            Event event = createGoogleEventFromSchedule(schedule);
            
            Event createdEvent = service.events().insert("primary", event).execute();
            log.info("구글 캘린더 일정 추가 성공: {}", createdEvent.getId());
            return createdEvent.getId();
        } catch (Exception e) {
            log.error("구글 캘린더 일정 등록 실패", e);
            return null;
        }
    }
    
    public void updateEvent(Member member, Schedule schedule) {
        if (schedule.getGoogleEventId() == null) return;
        
        try {
            Calendar service = getCalendarService(member);
            Event event = createGoogleEventFromSchedule(schedule);
            service.events().update("primary", schedule.getGoogleEventId(), event).execute();
            log.info("구글 캘린더 일정 수정 성공: {}", schedule.getGoogleEventId());
        } catch (Exception e) {
            log.error("구글 캘린더 일정 수정 실패", e);
        }
    }

    public void deleteEvent(Member member, String googleEventId) {
        if (googleEventId == null) return;
        
        try {
            Calendar service = getCalendarService(member);
            service.events().delete("primary", googleEventId).execute();
            log.info("구글 캘린더 일정 삭제 성공: {}", googleEventId);
        } catch (Exception e) {
            log.error("구글 캘린더 일정 삭제 실패", e);
        }
    }

    private Event createGoogleEventFromSchedule(Schedule schedule) {
        Event event = new Event()
            .setSummary(schedule.getTitle())
            .setDescription(schedule.getDescription())
            .setLocation(schedule.getLocation());

        DateTime startDateTime = new DateTime(Date.from(schedule.getStartDate().atZone(ZoneId.systemDefault()).toInstant()));
        EventDateTime start = new EventDateTime()
            .setDateTime(startDateTime)
            .setTimeZone("Asia/Seoul");
        event.setStart(start);

        if (schedule.getEndDate() != null) {
            DateTime endDateTime = new DateTime(Date.from(schedule.getEndDate().atZone(ZoneId.systemDefault()).toInstant()));
            EventDateTime end = new EventDateTime()
                .setDateTime(endDateTime)
                .setTimeZone("Asia/Seoul");
            event.setEnd(end);
        } else {
            // 종료일이 없으면 시작일과 동일하게 설정
            EventDateTime end = new EventDateTime()
                .setDateTime(startDateTime)
                .setTimeZone("Asia/Seoul");
            event.setEnd(end);
        }

        return event;
    }

    public List<Event> fetchEvents(Member member) {
        try {
            Calendar calendar = getCalendarService(member);
            com.google.api.client.util.DateTime now = new com.google.api.client.util.DateTime(System.currentTimeMillis() - (1000L * 60 * 60 * 24 * 365)); // 1년 전부터
            Events events = calendar.events().list("primary")
                    .setMaxResults(2000)
                    .setTimeMin(now)
                    .setShowDeleted(true)
                    .setSingleEvents(true)
                    .execute();
            List<Event> items = events.getItems();
            return items != null ? items : Collections.emptyList();
        } catch (Exception e) {
            log.error("구글 캘린더 이벤트 페치 실패", e);
            throw new RuntimeException("구글 캘린더 이벤트 페치 실패: " + e.getMessage(), e);
        }
    }
}
