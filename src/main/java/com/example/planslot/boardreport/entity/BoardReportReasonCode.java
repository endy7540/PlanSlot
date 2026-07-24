package com.example.planslot.boardreport.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum BoardReportReasonCode {
    SPAM("스팸/도배"),
    ABUSE("욕설/비하"),
    INAPPROPRIATE("음란물/부적절"),
    PERSONAL_INFORMATION("개인정보 노출"),
    OTHER("기타");

    private final String description;
}
