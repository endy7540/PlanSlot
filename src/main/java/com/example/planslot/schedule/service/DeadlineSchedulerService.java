package com.example.planslot.schedule.service;

import com.example.planslot.notification.service.NotificationService;
import com.example.planslot.schedule.entity.Deadline;
import com.example.planslot.schedule.repository.DeadlineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeadlineSchedulerService {

    private final DeadlineRepository deadlineRepository;
    private final NotificationService notificationService;

    // 매일 오전 9시 정각에 데드라인 알림 일괄 체크 및 발송
    @Scheduled(cron = "0 0 9 * * *")
    @Transactional(readOnly = true)
    public void checkAndSendDeadlineNotifications() {
        LocalDate today = LocalDate.now();
        log.info("데드라인 알림 스케줄러 기동 - 기준일: {}", today);

        // 1. D-Day (당일) 마감 알림 발송
        try {
            List<Deadline> ddayList = deadlineRepository.findAllByDeadlineDate(today);
            for (Deadline d : ddayList) {
                try {
                    String title = "⏰ [데드라인 당일] 일정 마감일입니다.";
                    String content = String.format("일정 '%s'의 데드라인 마감일이 오늘(%s) 도래했습니다. 늦지 않게 확인해 주세요!", 
                            d.getSchedule().getTitle(), d.getDeadlineDate().toString());
                    
                    notificationService.sendReminderMessage(
                            d.getSchedule().getMember().getId(),
                            title,
                            content,
                            "SCHEDULE",
                            d.getSchedule().getScheduleId()
                    );
                    log.info("D-Day 데드라인 알림 발송 성공 - 일정: {}, 회원: {}", d.getSchedule().getTitle(), d.getSchedule().getMember().getId());
                } catch (Exception e) {
                    log.error("D-Day 데드라인 알림 발송 실패 - 일정 ID: {}", d.getSchedule().getScheduleId(), e);
                }
            }
        } catch (Exception e) {
            log.error("D-Day 목록 조회 중 에러 발생", e);
        }

        // 2. D-N일 (마감 N일 전) 사전 알림 발송
        try {
            List<Deadline> notifyBeforeList = deadlineRepository.findAllWithNotifyDaysBefore();
            for (Deadline d : notifyBeforeList) {
                try {
                    LocalDate alarmDate = d.getDeadlineDate().minusDays(d.getNotifyDaysBefore());
                    if (alarmDate.equals(today)) {
                        String title = String.format("⚠️ [데드라인 %d일 전] 일정 마감 임박 알림", d.getNotifyDaysBefore());
                        String content = String.format("일정 '%s'의 데드라인 마감일(%s)이 %d일 남았습니다.", 
                                d.getSchedule().getTitle(), d.getDeadlineDate().toString(), d.getNotifyDaysBefore());
                        
                        notificationService.sendReminderMessage(
                                d.getSchedule().getMember().getId(),
                                title,
                                content,
                                "SCHEDULE",
                                d.getSchedule().getScheduleId()
                        );
                        log.info("D-{} 데드라인 사전 알림 발송 성공 - 일정: {}, 회원: {}", d.getNotifyDaysBefore(), d.getSchedule().getTitle(), d.getSchedule().getMember().getId());
                    }
                } catch (Exception e) {
                    log.error("D-N일 데드라인 알림 발송 실패 - 일정 ID: {}", d.getSchedule().getScheduleId(), e);
                }
            }
        } catch (Exception e) {
            log.error("D-N일 목록 조회 중 에러 발생", e);
        }
    }
}
