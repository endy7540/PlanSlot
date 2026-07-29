package com.example.planslot.member.servcie;

import com.example.planslot.member.dto.MemberRequestDTO;

import com.example.planslot.member.dto.MemberResponseDTO;
import com.example.planslot.member.entity.Member;

public interface MemberService {
    Long signUp(MemberRequestDTO.SignUp request);
    boolean checkDuplicateId(String loginId);
    
    MemberResponseDTO.MyPage getMyPage(String email);
    void updateMyInfo(String email, MemberRequestDTO.UpdateInfo request);
    void updateNotification(String email, MemberRequestDTO.UpdateNotification request);
    void updateProfileImage(String email, String imageUrl);
    void withdraw(String email);
    
    void updateGoogleSyncEnabled(String email, boolean enabled);
    Member getMember(String email);
}
