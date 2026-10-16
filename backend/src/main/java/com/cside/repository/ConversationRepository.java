package com.cside.repository;

import com.cside.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByUserId(Long userId);
    List<Conversation> findByUserIdAndBrand(Long userId, String brand);
    List<Conversation> findByUserIdAndStatus(Long userId, String status);
}