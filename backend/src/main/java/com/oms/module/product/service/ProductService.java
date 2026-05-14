package com.oms.module.product.service;

import com.oms.common.dto.PageResponse;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.product.dto.ProductRequest;
import com.oms.module.product.dto.ProductResponse;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductImage;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.mapper.ProductMapper;
import com.oms.module.product.repository.ProductRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopCategory;
import com.oms.module.shop.repository.ShopCategoryRepository;
import com.oms.module.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final ShopRepository shopRepository;
    private final ShopCategoryRepository shopCategoryRepository;
    private final ProductMapper productMapper;
    private final com.oms.module.productform.service.ProductFormValidator productFormValidator;
    private final com.oms.module.productform.repository.ProductFormCustomFieldRepository fieldRepository;


    /**
     * Get paginated product list for a shop.
     */
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> getProducts(Long shopId, String keyword,
                                                      ProductType type, Pageable pageable) {
        Page<Product> page = productRepository.searchProducts(shopId, keyword, type, pageable);
        return PageResponse.of(page, productMapper.toResponseList(page.getContent()));
    }

    /**
     * Get single product by ID, scoped to shop.
     */
    @Transactional(readOnly = true)
    public ProductResponse getProduct(Long shopId, Long id) {
        Product product = productRepository.findByIdAndShopId(id, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
        return productMapper.toResponse(product);
    }

    /**
     * Create new product with variants, images and custom attributes.
     */
    @Transactional
    public ProductResponse createProduct(Long shopId, ProductRequest request) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));

        Product product = Product.builder()
                .shop(shop)
                .name(request.getName())
                .description(request.getDescription())
                .productType(request.getProductType())
                .build();

        if (request.getCategoryName() != null && !request.getCategoryName().trim().isEmpty()) {
            shopCategoryRepository.findFirstByShopIdAndName(shopId, request.getCategoryName().trim())
                    .ifPresent(product::setCategory);
        }

        // Add variants
        if (request.getVariants() != null) {
            for (ProductRequest.VariantRequest vr : request.getVariants()) {
                validateVariantRequest(product.getProductType(), vr);
                java.math.BigDecimal priceSell = resolveSellPrice(product.getProductType(), vr.getPriceSell());
                java.math.BigDecimal priceRentPerDay = resolveRentPrice(product.getProductType(), vr.getPriceRentPerDay());
                java.math.BigDecimal depositAmount = resolveDepositAmount(product.getProductType(), vr.getDepositAmount());

                ProductVariant variant = ProductVariant.builder()
                        .size(vr.getSize())
                        .color(vr.getColor())
                        .stockQty(vr.getStockQty() != null ? vr.getStockQty() : 0)
                        .priceSell(priceSell)
                        .priceRentPerDay(priceRentPerDay)
                        .depositAmount(depositAmount)
                        .build();
                product.addVariant(variant);
            }
        }

        // Add images
        if (request.getImageUrls() != null) {
            int order = 0;
            for (String url : request.getImageUrls()) {
                ProductImage image = ProductImage.builder()
                        .url(url)
                        .sortOrder(order++)
                        .build();
                product.addImage(image);
            }
        }

        // Add custom attributes
        if (request.getCustomAttributes() != null) {
            for (ProductRequest.CustomAttributeRequest ar : request.getCustomAttributes()) {
                com.oms.module.productform.entity.ProductFormCustomField field = fieldRepository.findById(ar.getFieldId())
                        .orElseThrow(() -> new ResourceNotFoundException("CustomField", ar.getFieldId()));
                
                // Validate value
                productFormValidator.validate(ar.getValue(), field);

                com.oms.module.product.entity.ProductCustomAttributeValue attrValue = com.oms.module.product.entity.ProductCustomAttributeValue.builder()
                        .product(product)
                        .field(field)
                        .fieldKeySnapshot(field.getFieldKey())
                        .labelSnapshot(field.getLabel())
                        .formTypeSnapshot(field.getConfig().getFormType().name())
                        .valueJson(ar.getValue())
                        .build();
                product.addCustomAttributeValue(attrValue);
            }
        }

        product = productRepository.save(product);
        return productMapper.toResponse(product);
    }

    /**
     * Lấy danh sách sản phẩm active cho public order form (không cần auth).
     */
    @Transactional(readOnly = true)
    public List<ProductResponse> getActiveProductsForPublicForm(Long shopId) {
        List<Product> products = productRepository.findAllByShopIdAndIsActiveTrue(shopId);
        return productMapper.toResponseList(products);
    }

    /**
     * Delete (soft) product, scoped to shop.
     */
    @Transactional
    public void deleteProduct(Long shopId, Long id) {
        Product product = productRepository.findByIdAndShopId(id, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
        product.setIsActive(false);
        productRepository.save(product);
    }

    /**
     * Update product with variants, images and custom attributes.
     */
    @Transactional
    public ProductResponse updateProduct(Long shopId, Long id, ProductRequest request) {
        Product product = productRepository.findByIdAndShopId(id, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));

        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setProductType(request.getProductType());

        if (request.getCategoryName() != null && !request.getCategoryName().trim().isEmpty()) {
            shopCategoryRepository.findFirstByShopIdAndName(shopId, request.getCategoryName().trim())
                    .ifPresent(product::setCategory);
        } else {
            product.setCategory(null);
        }

        // Update variants
        if (request.getVariants() != null) {
            // Remove variants not in request
            product.getVariants().removeIf(existing -> 
                request.getVariants().stream().noneMatch(vr -> vr.getId() != null && vr.getId().equals(existing.getId())));

            for (ProductRequest.VariantRequest vr : request.getVariants()) {
                validateVariantRequest(product.getProductType(), vr);
                java.math.BigDecimal priceSell = resolveSellPrice(product.getProductType(), vr.getPriceSell());
                java.math.BigDecimal priceRentPerDay = resolveRentPrice(product.getProductType(), vr.getPriceRentPerDay());
                java.math.BigDecimal depositAmount = resolveDepositAmount(product.getProductType(), vr.getDepositAmount());

                if (vr.getId() != null) {
                    // Update existing
                    ProductVariant variant = product.getVariants().stream()
                        .filter(v -> v.getId().equals(vr.getId()))
                        .findFirst()
                        .orElseThrow(() -> new ResourceNotFoundException("ProductVariant", vr.getId()));
                    
                    variant.setSize(vr.getSize());
                    variant.setColor(vr.getColor());
                    variant.setStockQty(vr.getStockQty() != null ? vr.getStockQty() : 0);
                    variant.setPriceSell(priceSell);
                    variant.setPriceRentPerDay(priceRentPerDay);
                    variant.setDepositAmount(depositAmount);
                } else {
                    // Add new
                    ProductVariant variant = ProductVariant.builder()
                            .size(vr.getSize())
                            .color(vr.getColor())
                            .stockQty(vr.getStockQty() != null ? vr.getStockQty() : 0)
                            .priceSell(priceSell)
                            .priceRentPerDay(priceRentPerDay)
                            .depositAmount(depositAmount)
                            .build();
                    product.addVariant(variant);
                }
            }
        }

        // Update images
        product.getImages().clear();
        if (request.getImageUrls() != null) {
            int order = 0;
            for (String url : request.getImageUrls()) {
                ProductImage image = ProductImage.builder()
                        .url(url)
                        .sortOrder(order++)
                        .build();
                product.addImage(image);
            }
        }

        // Update custom attributes
        product.getCustomAttributeValues().clear();
        if (request.getCustomAttributes() != null) {
            for (ProductRequest.CustomAttributeRequest ar : request.getCustomAttributes()) {
                com.oms.module.productform.entity.ProductFormCustomField field = fieldRepository.findById(ar.getFieldId())
                        .orElseThrow(() -> new ResourceNotFoundException("CustomField", ar.getFieldId()));
                
                productFormValidator.validate(ar.getValue(), field);

                com.oms.module.product.entity.ProductCustomAttributeValue attrValue = com.oms.module.product.entity.ProductCustomAttributeValue.builder()
                        .product(product)
                        .field(field)
                        .fieldKeySnapshot(field.getFieldKey())
                        .labelSnapshot(field.getLabel())
                        .formTypeSnapshot(field.getConfig().getFormType().name())
                        .valueJson(ar.getValue())
                        .build();
                product.addCustomAttributeValue(attrValue);
            }
        }

        product = productRepository.save(product);
        return productMapper.toResponse(product);
    }

    private void validateVariantRequest(ProductType productType, ProductRequest.VariantRequest variant) {
        int stockQty = variant.getStockQty() != null ? variant.getStockQty() : 0;
        if (stockQty < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Stock quantity must be greater than or equal to 0");
        }

        if ((productType == ProductType.SELL || productType == ProductType.SELL_RENT)
                && !isPositive(variant.getPriceSell())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Sell price is required");
        }

        if ((productType == ProductType.RENT || productType == ProductType.SELL_RENT)
                && !isPositive(variant.getPriceRentPerDay())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rent price per day is required");
        }

        if (variant.getDepositAmount() != null && variant.getDepositAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Deposit amount must be greater than or equal to 0");
        }
    }

    private boolean isPositive(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0;
    }

    private BigDecimal resolveSellPrice(ProductType productType, BigDecimal priceSell) {
        return productType == ProductType.RENT ? null : priceSell;
    }

    private BigDecimal resolveRentPrice(ProductType productType, BigDecimal priceRentPerDay) {
        return productType == ProductType.SELL ? null : priceRentPerDay;
    }

    private BigDecimal resolveDepositAmount(ProductType productType, BigDecimal depositAmount) {
        return productType == ProductType.SELL ? null : depositAmount;
    }
}
