package com.example.planslot.boardreport.dto;

import com.example.planslot.boardreport.entity.BoardReportReasonCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class BoardReportRequestDTO {
    private BoardReportReasonCode reasonCode;
    private String reasonDetail;
}
