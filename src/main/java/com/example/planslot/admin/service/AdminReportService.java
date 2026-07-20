package com.example.planslot.admin.service;

import com.example.planslot.admin.dto.AdminReportResponseDTO;
import com.example.planslot.board.repository.BoardCommentRepository;
import com.example.planslot.board.repository.BoardRepository;
import com.example.planslot.boardreport.entity.BoardReportTargetType;
import com.example.planslot.boardreport.repository.BoardReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import com.example.planslot.boardreport.entity.BoardReport;

@Service
@RequiredArgsConstructor
public class AdminReportService {
    private final BoardReportRepository boardReportRepository;
    private final BoardRepository boardRepository;
    private final BoardCommentRepository boardCommentRepository;

    @Transactional(readOnly = true)
    public List<AdminReportResponseDTO> getAllReports() {
        return boardReportRepository.findAll().stream().map(report -> {
            String targetContent = "알 수 없는 대상입니다.";
            String targetBody = "";
            
            if (report.getTargetType() == BoardReportTargetType.POST) {
                targetContent = boardRepository.findById(report.getTargetId())
                        .map(b -> b.getTitle())
                        .orElse("(삭제된 게시글)");
                targetBody = boardRepository.findById(report.getTargetId())
                        .map(b -> b.getContent())
                        .orElse("");
            } else if (report.getTargetType() == BoardReportTargetType.COMMENT) {
                targetContent = boardCommentRepository.findById(report.getTargetId())
                        .map(c -> c.getContent())
                        .orElse("(삭제된 댓글)");
            }

            return AdminReportResponseDTO.fromEntity(report, targetContent, targetBody);
        }).collect(Collectors.toList());
    }

    @Transactional
    public void approveReport(Long reportId) {
        BoardReport report = boardReportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 신고입니다."));
        
        if (report.getStatus() != com.example.planslot.boardreport.entity.BoardReportStatus.WAITING) {
            throw new IllegalArgumentException("이미 처리된 신고입니다.");
        }

        if (report.getTargetType() == BoardReportTargetType.POST) {
            boardRepository.findById(report.getTargetId()).ifPresent(b -> b.delete());
        } else if (report.getTargetType() == BoardReportTargetType.COMMENT) {
            boardCommentRepository.findById(report.getTargetId()).ifPresent(c -> c.delete());
        }

        report.approve();
    }

    @Transactional
    public void rejectReport(Long reportId) {
        BoardReport report = boardReportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 신고입니다."));
        
        if (report.getStatus() != com.example.planslot.boardreport.entity.BoardReportStatus.WAITING) {
            throw new IllegalArgumentException("이미 처리된 신고입니다.");
        }

        report.reject();
    }
}
