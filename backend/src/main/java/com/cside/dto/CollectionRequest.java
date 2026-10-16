package com.cside.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollectionRequest {

    @NotBlank(message = "步骤类型不能为空")
    private String stepType;

    @NotBlank(message = "内容不能为空")
    private String content;

    private Long conversationId;

    private String customerMessage;

    private List<String> tags;
}