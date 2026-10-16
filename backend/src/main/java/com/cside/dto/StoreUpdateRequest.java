package com.cside.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StoreUpdateRequest {
    private String name;
    private String urlPattern;
    private Map<String, Object> config;
}
