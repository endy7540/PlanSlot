package com.example.planslot.member.servcie;

import com.example.planslot.member.dto.MemberRequestDTO;

public interface MemberService {
    Long signUp(MemberRequestDTO.SignUp request);
    boolean checkDuplicateId(String loginId);
    
    com.example.planslot.member.dto.MemberResponseDTO.MyPage getMyPage(String email);
    void updateMyInfo(String email, MemberRequestDTO.UpdateInfo request);
    void updateNotification(String email, MemberRequestDTO.UpdateNotification request);
    void updateProfileImage(String email, String imageUrl);
    void withdraw(String email);
    
    void updateGoogleSyncEnabled(String email, boolean enabled);
    com.example.planslot.member.entity.Member getMember(String email);
}
