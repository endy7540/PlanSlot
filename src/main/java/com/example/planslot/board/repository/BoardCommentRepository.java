package com.example.planslot.board.repository;

import com.example.planslot.board.entity.BoardComment;
import com.example.planslot.board.entity.BoardCommentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BoardCommentRepository extends JpaRepository<BoardComment, Long> {
    // 게시글의 부모 댓글 전체 조회
    @Query("""
            SELECT c
            FROM BoardComment c
            JOIN FETCH c.writer
            WHERE c.board.boardId = :boardId
              AND c.parentComment IS NULL
            ORDER BY c.createdAt ASC, c.commentId ASC
            """)
    List<BoardComment> findRootComments(@Param("boardId") Long boardId);

    // 부모 댓글에 작성된 활성 대댓글 조회
    @Query("""
            SELECT c
            FROM BoardComment c
            JOIN FETCH c.writer
            WHERE c.parentComment.commentId IN :parentCommentIds
              AND c.commentStatus = :commentStatus
            ORDER BY c.createdAt ASC, c.commentId ASC
            """)
    List<BoardComment> findActiveReplies(@Param("parentCommentIds") List<Long> parentCommentIds,
                                         @Param("commentStatus") BoardCommentStatus commentStatus);

    Optional<BoardComment> findByCommentIdAndCommentStatus(Long commentId, BoardCommentStatus commentStatus);

    // 여러 게시글의 활성 댓글 수를 게시글별로 한 번에 조회
    @Query("""
            SELECT c.board.boardId AS boardId, COUNT(c) AS commentCount
            FROM BoardComment c
            WHERE c.board.boardId IN :boardIds
              AND c.commentStatus = :commentStatus
            GROUP BY c.board.boardId
            """)
    List<BoardCommentCount> countByBoardIdsAndCommentStatus(@Param("boardIds") List<Long> boardIds,
                                                            @Param("commentStatus") BoardCommentStatus commentStatus);

    interface BoardCommentCount {
        Long getBoardId();

        long getCommentCount();
    }

    @Query("""
            SELECT COUNT(c)
            FROM BoardComment c
            WHERE c.board.boardId = :boardId
              AND c.commentStatus = :commentStatus
            """)
    long countByBoardIdAndCommentStatus(@Param("boardId") Long boardId,
                                        @Param("commentStatus") BoardCommentStatus commentStatus);
}