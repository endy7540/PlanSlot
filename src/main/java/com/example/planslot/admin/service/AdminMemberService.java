package com.example.planslot.admin.service;

import com.example.planslot.admin.dto.AdminMemberResponseDTO;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.Comparator;

import com.example.planslot.admin.dto.AdminReportResponseDTO;

@Service
@RequiredArgsConstructor
public class AdminMemberService {

    private final MemberRepository memberRepository;
    private final AdminReportService adminReportService;

    @Transactional(readOnly = true)
    public List<AdminMemberResponseDTO> getAllMembers() {
        // 승인(삭제 처리)된 신고 내역만 필터링하여 제재 횟수로 카운트
        Map<String, Long> penaltyCounts = adminReportService.getAllReports().stream()
                .filter(report -> "APPROVED".equals(report.getStatus()))
                .collect(Collectors.groupingBy(AdminReportResponseDTO::getReportedNickname, Collectors.counting()));

        return memberRepository.findAll().stream()
                .map(member -> {
                    int count = penaltyCounts.getOrDefault(member.getNickname(), 0L).intValue();
                    return AdminMemberResponseDTO.fromEntity(member, count);
                })
                // 제재 횟수 내림차순 -> 가입일 내림차순 정렬
                .sorted(Comparator.<AdminMemberResponseDTO>comparingInt(AdminMemberResponseDTO::getReportedCount).reversed()
                        .thenComparing(Comparator.comparing(AdminMemberResponseDTO::getCreatedAt).reversed()))
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateMemberRole(Long memberId, String roleStr) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        
        try {
            Member.Role role = Member.Role.valueOf(roleStr);
            member.updateRole(role);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("유효하지 않은 권한입니다.");
        }
    }

    @Transactional
    public void updateMemberStatus(Long memberId, String statusStr, Integer suspendDays) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));

        try {
            Member.Status status = Member.Status.valueOf(statusStr);
            member.updateStatus(status, suspendDays);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("유효하지 않은 상태입니다.");
        }
    }
}
