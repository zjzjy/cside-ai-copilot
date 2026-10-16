package com.cside.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversationResponse {
    private Long id;
    private String brand;
    private String platform;
    private Long storeId;
    private List<MessageDTO> messages;
    private LocalDateTime createdAt;
}