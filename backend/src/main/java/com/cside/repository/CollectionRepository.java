package com.cside.repository;

import com.cside.entity.Collection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CollectionRepository extends JpaRepository<Collection, Long> {
    Page<Collection> findByUserId(Long userId, Pageable pageable);
    Page<Collection> findByUserIdAndBrand(Long userId, String brand, Pageable pageable);
    Page<Collection> findByUserIdAndStepType(Long userId, String stepType, Pageable pageable);
    Page<Collection> findByUserIdAndBrandAndStepType(Long userId, String brand, String stepType, Pageable pageable);
    List<Collection> findByUserId(Long userId);
}