package com.cside.service;

import com.cside.dto.ConversationResponse;
import com.cside.dto.MessageDTO;
import com.cside.entity.Conversation;
import com.cside.entity.Message;
import com.cside.entity.User;
import com.cside.repository.ConversationRepository;
import com.cside.repository.MessageRepository;
import com.cside.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    public ConversationResponse getConversation(Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("对话不存在"));

        if (!conversation.getUserId().equals(user.getId())) {
            throw new IllegalArgumentException("无权访问该对话");
        }

        List<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(id);
        List<MessageDTO> messageDTOs = messages.stream()
                .map(this::toMessageDTO)
                .collect(Collectors.toList());

        return new ConversationResponse(
                conversation.getId(),
                conversation.getBrand(),
                conversation.getPlatform(),
                conversation.getStoreId(),
                messageDTOs,
                conversation.getCreatedAt()
        );
    }

    private MessageDTO toMessageDTO(Message message) {
        return new MessageDTO(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getMetadata(),
                message.getCreatedAt()
        );
    }
}