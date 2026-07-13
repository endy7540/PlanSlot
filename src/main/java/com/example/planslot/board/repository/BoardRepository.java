package com.example.planslot.board.repository;

import com.example.planslot.board.entity.Board;
import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.entity.BoardType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface BoardRepository extends JpaRepository<Board, Long> {

    Page<Board> findByBoardTypeAndBoardStatus(
            BoardType boardType,
            BoardStatus boardStatus,
            Pageable pageable
    );

    @Query("""
        SELECT b
        FROM Board b
        WHERE b.boardType = :boardType
          AND b.boardStatus = :boardStatus
          AND (
                LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(b.content) LIKE LOWER(CONCAT('%', :keyword, '%'))
          )
        """)
    Page<Board> searchBoards(
            @Param("boardType") BoardType boardType,
            @Param("boardStatus") BoardStatus boardStatus,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Board b
            SET b.viewCount = b.viewCount + 1
            WHERE b.boardId = :boardId
              AND b.boardStatus = :boardStatus
            """)
    int increaseViewCount(
            @Param("boardId") Long boardId,
            @Param("boardStatus") BoardStatus boardStatus
    );

    Optional<Board> findByBoardIdAndBoardStatus(
            Long boardId,
            BoardStatus boardStatus
    );
}
