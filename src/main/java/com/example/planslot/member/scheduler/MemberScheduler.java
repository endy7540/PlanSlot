package com.example.planslot.member.scheduler;

import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class MemberScheduler {

    private final MemberRepository memberRepository;

    // 매 1시간마다 실행 (정각에 실행)
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void liftExpiredSuspensions() {
        int updatedCount = memberRepository.liftExpiredSuspensions(LocalDateTime.now());
        if (updatedCount > 0) {
            log.info("[Scheduler] 기간이 만료된 임시 정지 유저 {}명의 상태를 정상(ACTIVE)으로 복구했습니다.", updatedCount);
        }
    }
}
