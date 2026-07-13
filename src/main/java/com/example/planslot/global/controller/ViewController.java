package com.example.planslot.global.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    @GetMapping("/auth")
    public String authPage() {
        return "auth";
    }

    @GetMapping("/home")
    public String home() {
        return "home";
    }
}
