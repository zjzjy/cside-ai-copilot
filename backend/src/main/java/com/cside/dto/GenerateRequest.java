package com.cside.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenerateRequest {

    @NotBlank(message = "客户消息不能为空")
    @Size(max = 500, message = "客户消息不能超过500字")
    private String customerMessage;

    private Long conversationId;

    @NotBlank(message = "品牌不能为空")
    private String brand;

    private String platform;

    private String storeId;
}
