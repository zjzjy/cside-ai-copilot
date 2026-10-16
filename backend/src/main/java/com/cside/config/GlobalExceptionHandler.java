package com.cside.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Object>> handleException(Exception e) {
        log.error("Unexpected error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.error(9999, e.getMessage()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Result<Object>> handleBadCredentialsException(BadCredentialsException e) {
        log.error("Bad credentials", e);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Result.error(1002, "密码错误"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Object>> handleValidationException(MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        e.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        log.warn("Validation failed: {}", errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(1001, "参数验证失败"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Result<Object>> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("Illegal argument: {}", e.getMessage());
        int code = extractCode(e.getMessage(), 1001);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(code, e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Result<Object>> handleIllegalStateException(IllegalStateException e) {
        log.error("Service error: {}", e.getMessage());
        int code = extractCode(e.getMessage(), 2001);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.error(code, e.getMessage()));
    }

    private int extractCode(String message, int defaultCode) {
        if (message == null) return defaultCode;
        int start = message.lastIndexOf('(');
        int end = message.lastIndexOf(')');
        if (start >= 0 && end > start) {
            try {
                return Integer.parseInt(message.substring(start + 1, end));
            } catch (NumberFormatException ignored) {
            }
        }
        return defaultCode;
    }
}