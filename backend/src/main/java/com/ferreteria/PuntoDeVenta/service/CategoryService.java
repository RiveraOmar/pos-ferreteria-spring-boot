package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.CategoryDTO;
import com.ferreteria.PuntoDeVenta.exception.DuplicateResourceException;
import com.ferreteria.PuntoDeVenta.model.Category;
import com.ferreteria.PuntoDeVenta.repository.CategoryRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    private CategoryDTO toDTO(Category cat) {
        return new CategoryDTO(
                cat.getId(),
                cat.getName(),
                cat.getDescription(),
                cat.getSubCategories() != null && !cat.getSubCategories().isEmpty(),
                cat.isActive()
        );
    }

    @Transactional(readOnly = true)
    public List<CategoryDTO> getRootCategories() {
        return categoryRepository.findRootCategories().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CategoryDTO> getChildren(Long parentId) {
        if (!categoryRepository.existsById(parentId)) {
            throw new EntityNotFoundException("No se encontró la categoría con ID: " + parentId);
        }
        return categoryRepository.findChildrenByParentId(parentId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CategoryDTO> getAllActive() {
        return categoryRepository.findByActiveTrue().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CategoryDTO> searchByName(String name) {
        return categoryRepository.findByNameContainingIgnoreCase(name).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CategoryDTO findById(Long id) {
        Category cat = categoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Categoría no encontrada"));
        return toDTO(cat);
    }

   
    @Transactional(readOnly = true)
    public List<Long> getAllChildIds(Long parentId) {
        Category parent = categoryRepository.findById(parentId)
                .orElseThrow(() -> new EntityNotFoundException("Categoría no encontrada"));

        List<Long> ids = new ArrayList<>();
        ids.add(parentId);
        accumulateChildIds(parent, ids);
        return ids;
    }

    private void accumulateChildIds(Category parent, List<Long> ids) {
        if (parent.getSubCategories() != null) {
            for (Category child : parent.getSubCategories()) {
                if (child.isActive()) {
                    ids.add(child.getId());
                    accumulateChildIds(child, ids);
                }
            }
        }
    }

    @Transactional
    public Category saveCategory(Category category) {
        if (categoryRepository.existsByName(category.getName())) {
            throw new DuplicateResourceException("La categoría '" + category.getName() + "' ya existe.");
        }
        return categoryRepository.save(category);
    }

    @Transactional
    public Category saveSubcategory(Long parentId, Category subcategory) {
        Category parent = categoryRepository.findById(parentId)
                .orElseThrow(() -> new EntityNotFoundException("El padre con ID " + parentId + " no existe."));
        subcategory.setParent(parent);
        return categoryRepository.save(subcategory);
    }

    @Transactional
    public void updateStatus(Long id, boolean active) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Categoría no encontrada"));
        category.setActive(active);
        if (!active) {
            desactivarHijos(category);
        }
        categoryRepository.save(category);
    }

    private void desactivarHijos(Category parent) {
        if (parent.getSubCategories() != null) {
            for (Category child : parent.getSubCategories()) {
                child.setActive(false);
                desactivarHijos(child);
                categoryRepository.save(child);
            }
        }
    }
}