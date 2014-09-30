package com.shopstuffs.repository;

import com.shopstuffs.domain.Image;
        import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data JPA repository for the Image entity.
 */
public interface ImageRepository extends JpaRepository<Image, Long> {

}
