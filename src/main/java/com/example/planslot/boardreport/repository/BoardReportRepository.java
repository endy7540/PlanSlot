package com.example.planslot.boardreport.repository;

import com.example.planslot.boardreport.entity.BoardReport;
import com.example.planslot.boardreport.entity.BoardReportTargetType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardReportRepository extends JpaRepository<BoardReport, Long> {
    boolean existsByReporter_IdAndTargetTypeAndTargetId(Long reporterId, BoardReportTargetType targetType, Long targetId);
}
