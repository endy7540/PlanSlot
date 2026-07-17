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
            
            if (report.getTargetType() == BoardReportTargetType.POST) {
                targetContent = boardRepository.findById(report.getTargetId())
                        .map(b -> b.getTitle())
                        .orElse("(삭제된 게시글)");
            } else if (report.getTargetType() == BoardReportTargetType.COMMENT) {
                targetContent = boardCommentRepository.findById(report.getTargetId())
                        .map(c -> c.getContent())
                        .orElse("(삭제된 댓글)");
            }

            return AdminReportResponseDTO.fromEntity(report, targetContent);
        }).collect(Collectors.toList());
    }
}
