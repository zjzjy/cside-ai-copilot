package com.cside.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "cside.knowledge.import-on-startup", havingValue = "true", matchIfMissing = false)
public class KnowledgeImportRunner implements CommandLineRunner {

    private final KnowledgeImportService knowledgeImportService;

    @Override
    public void run(String... args) {
        log.info("Auto-importing knowledge on startup...");
        int count = knowledgeImportService.importAll();
        log.info("Knowledge auto-import completed: {} records", count);
    }
}
