package com.cside.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StoreResponse {
    private Long id;
    private String name;
    private Long brandId;
    private String brandName;
    private String platform;
    private String urlPattern;
    private Map<String, Object> config;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
