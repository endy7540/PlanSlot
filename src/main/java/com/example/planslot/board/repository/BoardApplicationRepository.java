package com.example.planslot.board.repository;

import com.example.planslot.board.entity.BoardApplication;
import com.example.planslot.board.entity.BoardApplicationStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BoardApplicationRepository extends JpaRepository<BoardApplication, Long> {

    Optional<BoardApplication> findByBoard_BoardIdAndApplicant_Id(Long boardId, Long applicantId);

    boolean existsByBoard_BoardIdAndApplicant_Id(Long boardId, Long applicantId);

    @EntityGraph(attributePaths = {"applicant"})
    List<BoardApplication> findByBoard_BoardIdAndApplicationStatusOrderByCreatedAtAsc(
            Long boardId, BoardApplicationStatus applicationStatus
    );

    @EntityGraph(attributePaths = {"applicant"})
    List<BoardApplication> findByBoard_BoardId(Long boardId);
}
