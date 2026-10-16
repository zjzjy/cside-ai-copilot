package com.cside.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollectionResponse {
    private Long id;
    private String stepType;
    private String content;
    private String customerMessage;
    private String brand;
    private String platform;
    private List<String> tags;
    private LocalDateTime createdAt;
}