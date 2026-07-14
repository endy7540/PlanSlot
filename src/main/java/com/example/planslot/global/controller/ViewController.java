package com.example.planslot.global.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    @GetMapping("/auth/login")
    public String loginPage() {
        return "global/auth";
    }

    @GetMapping("/auth/signup")
    public String signupPage() {
        return "global/auth";
    }

    @GetMapping("/home")
    public String home() {
        return "global/home";
    }
}

