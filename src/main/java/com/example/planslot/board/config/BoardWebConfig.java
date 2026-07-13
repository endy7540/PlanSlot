package com.example.planslot.board.config;

import jakarta.servlet.MultipartConfigElement;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class BoardWebConfig implements WebMvcConfigurer {

    @Value("${file.upload.board-path:./uploads/board}")
    private String boardUploadPath;

    // 저장된 게시글 이미지를 /uploads/board/** 주소로 조회할 수 있도록 연결
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadDirectory = Path.of(boardUploadPath)
                .toAbsolutePath()
                .normalize();

        String resourceLocation = uploadDirectory.toUri().toString();

        if (!resourceLocation.endsWith("/")) {
            resourceLocation += "/";
        }

        registry.addResourceHandler("/uploads/board/**")
                .addResourceLocations(resourceLocation);
    }

    // 게시글 이미지 업로드 크기 제한
    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        factory.setMaxFileSize(DataSize.ofMegabytes(10));
        factory.setMaxRequestSize(DataSize.ofMegabytes(11));

        return factory.createMultipartConfig();
    }
}
