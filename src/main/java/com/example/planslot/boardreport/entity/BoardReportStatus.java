package com.example.planslot.boardreport.entity;

public enum BoardReportStatus {
    WAITING,
    APPROVED, // 신고 승인 (게시물 삭제됨)
    REJECTED  // 신고 반려 (게시물 유지)
}
