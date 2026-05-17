package com.oms.module.shop.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.util.SlugUtils;
import com.oms.module.auth.dto.AuthSessionResponse;
import com.oms.module.auth.service.SessionMapper;
import com.oms.module.auth.service.TokenService;
import com.oms.module.orderform.repository.OrderFormConfigRepository;
import com.oms.module.product.entity.ProductType;
import com.oms.module.shop.dto.CreateShopAddressRequest;
import com.oms.module.shop.dto.ShopBusinessTypeRequest;
import com.oms.module.shop.dto.ShopCategoriesRequest;
import com.oms.module.shop.dto.ShopOperationalSettingsRequest;
import com.oms.module.shop.dto.ShopProfileRequest;
import com.oms.module.shop.dto.ShopSetupStatusResponse;
import com.oms.module.shop.dto.UpdateShopProfileRequest;
import com.oms.module.shop.dto.UpdateShopAddressRequest;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopAddress;
import com.oms.module.shop.entity.ShopCategory;
import com.oms.module.shop.entity.ShopOnboardingState;
import com.oms.module.shop.repository.ShopAddressRepository;
import com.oms.module.shop.repository.ShopCategoryRepository;
import com.oms.module.shop.repository.ShopOnboardingStateRepository;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.user.entity.User;
import com.oms.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopRepository shopRepository;
    private final ShopOnboardingStateRepository onboardingStateRepository;
    private final ShopCategoryRepository shopCategoryRepository;
    private final ShopAddressRepository shopAddressRepository;
    private final OrderFormConfigRepository orderFormConfigRepository;
    private final UserRepository userRepository;
    private final TokenService tokenService;
    private final SessionMapper sessionMapper;

    private static final String DEFAULT_ONBOARDING_STEP = "SHOP_PROFILE";

    @Transactional
    public AuthSessionResponse createShopForOwner(Long userId, ShopProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (user.getRole() != User.UserRole.OWNER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only OWNER can create a shop");
        }

        if (user.getShop() != null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "User already has a shop");
        }

        // Normalize blank strings to null to avoid unique constraint issues
        String email = (request.getEmail() != null && !request.getEmail().isBlank())
                ? request.getEmail().trim() : null;
        String phone = (request.getPhone() != null && !request.getPhone().isBlank())
                ? request.getPhone().trim() : null;
        String logoUrl = (request.getLogoUrl() != null && !request.getLogoUrl().isBlank())
                ? request.getLogoUrl().trim() : null;

        Shop shop = Shop.builder()
                .name(request.getShopName().trim())
                .slug(generateUniqueSlug(request.getShopName()))
                .email(email)
                .phone(phone)
                .logoUrl(logoUrl)
                .businessMode("BOTH")
                .status(Shop.ShopStatus.ACTIVE)
                .build();

        shop = shopRepository.save(shop);

        user.setShop(shop);
        userRepository.save(user);

        ShopOnboardingState state = ShopOnboardingState.builder()
                .shop(shop)
                .currentStep("BUSINESS_TYPE") // Advance to next step
                .isCompleted(false)
                .build();

        onboardingStateRepository.save(state);

        // Regenerate session tokens because shopId changed
        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse updateBusinessType(Long userId, ShopBusinessTypeRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = user.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);
        }

        boolean enableSell = Boolean.TRUE.equals(request.getEnableSell());
        boolean enableRent = Boolean.TRUE.equals(request.getEnableRent());
        if (!enableSell && !enableRent) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Shop must enable at least sell or rent mode");
        }

        shop.setEnableSell(enableSell);
        shop.setEnableRent(enableRent);
        shop.setBusinessMode(resolveBusinessMode(enableSell, enableRent));
        shopRepository.save(shop);

        ShopOnboardingState state = onboardingStateRepository.findFirstByShopOrderByIdDesc(shop)
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Onboarding state not found"));
        state.setCurrentStep("CATEGORY");
        onboardingStateRepository.save(state);

        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse saveCategories(Long userId, ShopCategoriesRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = user.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);
        }

        // Clear existing categories for this shop
        shopCategoryRepository.deleteAllByShopId(shop.getId());

        // Add new categories
        List<ShopCategory> categories = request.getCategories().stream()
                .map(name -> ShopCategory.builder()
                        .shop(shop)
                        .name(name)
                        .slug(SlugUtils.toSlug(name))
                        .isActive(true)
                        .build())
                .toList();

        shopCategoryRepository.saveAll(categories);

        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse completeOnboarding(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = user.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);
        }

        ShopOnboardingState state = onboardingStateRepository.findFirstByShopOrderByIdDesc(shop)
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Onboarding state not found"));
        state.setIsCompleted(true);
        state.setCompletedAt(LocalDateTime.now());
        onboardingStateRepository.save(state);

        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse updateCategoriesSettings(Long userId, ShopCategoriesRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = user.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);
        }

        // Clear existing categories for this shop
        shopCategoryRepository.deleteAllByShopId(shop.getId());

        // Add new categories
        List<ShopCategory> categories = request.getCategories().stream()
                .map(name -> ShopCategory.builder()
                        .shop(shop)
                        .name(name)
                        .slug(SlugUtils.toSlug(name))
                        .isActive(true)
                        .build())
                .toList();

        shopCategoryRepository.saveAll(categories);

        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse updateBasicInfo(Long userId, String name, String email, String phone) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        if (name != null) shop.setName(name);
        if (email != null) shop.setEmail(email);
        if (phone != null) shop.setPhone(phone);

        shopRepository.save(shop);
        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse updateSupportInfo(Long userId, String supportEmail, String supportPhone) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        if (supportEmail != null) shop.setSupportEmail(supportEmail);
        if (supportPhone != null) shop.setSupportPhone(supportPhone);

        shopRepository.save(shop);
        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse updateLogo(Long userId, String logoUrl) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        shop.setLogoUrl(logoUrl);
        shopRepository.save(shop);
        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse updateAddresses(Long userId, List<UpdateShopProfileRequest.ShopAddressDto> addresses) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        shopAddressRepository.deleteByShop(shop);
        for (UpdateShopProfileRequest.ShopAddressDto addrDto : addresses) {
            ShopAddress addr = ShopAddress.builder()
                    .shop(shop)
                    .label(addrDto.getLabel())
                    .addressLine(addrDto.getAddressLine())
                    .ward(addrDto.getWard())
                    .district(addrDto.getDistrict())
                    .province(addrDto.getProvince())
                    .isDefault(Boolean.TRUE.equals(addrDto.getIsDefault()))
                    .build();
            shopAddressRepository.save(addr);
        }

        return issueSessionForUser(user);
    }

    @Transactional
    public AuthSessionResponse updateOperationalSettings(Long userId, ShopOperationalSettingsRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = user.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);
        }

        if (request.getAutoAcceptOrders() != null) shop.setAutoAcceptOrders(request.getAutoAcceptOrders());
        if (request.getMaintenanceMode() != null) shop.setMaintenanceMode(request.getMaintenanceMode());
        if (request.getShowInventoryOnStorefront() != null) shop.setShowInventoryOnStorefront(request.getShowInventoryOnStorefront());
        if (request.getNotificationsEnabled() != null) shop.setNotificationsEnabled(request.getNotificationsEnabled());
        if (request.getRentalIdentityVerificationEnabled() != null) {
            shop.setRentalIdentityVerificationEnabled(request.getRentalIdentityVerificationEnabled());
        }

        shopRepository.save(shop);
        return issueSessionForUser(user);
    }

    @Transactional(readOnly = true)
    public ShopSetupStatusResponse getSetupStatus(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = user.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);
        }

        ShopOnboardingState onboardingState = onboardingStateRepository.findFirstByShopOrderByIdDesc(shop)
                .orElse(null);
        boolean businessTypeSelected = (Boolean.TRUE.equals(shop.getEnableSell())
                || Boolean.TRUE.equals(shop.getEnableRent()))
                && hasPassedBusinessTypeStep(onboardingState);

        List<ShopSetupStatusResponse.StepStatus> steps = new ArrayList<>();
        addStep(steps, "BASIC_INFO", hasText(shop.getName())
                && hasText(shop.getEmail())
                && hasText(shop.getPhone())
                && hasText(shop.getLogoUrl()));
        addStep(steps, "BUSINESS_TYPE", businessTypeSelected);
        addStep(steps, "CATEGORY", !shopCategoryRepository.findAllByShopId(shop.getId()).isEmpty());
        addStep(steps, "ADDRESS", !shopAddressRepository.findByShop(shop).isEmpty());
        addStep(steps, "ORDER_CONFIG", hasRequiredOrderConfigs(shop));
        addStep(steps, "OPERATION_CONFIG", shop.getAutoAcceptOrders() != null
                && shop.getShowInventoryOnStorefront() != null
                && shop.getNotificationsEnabled() != null
                && shop.getMaintenanceMode() != null);
        addStep(steps, "SUPPORT_CONTACT", hasText(shop.getSupportEmail())
                && hasText(shop.getSupportPhone()));

        int totalSteps = steps.size();
        int completedCount = (int) steps.stream()
                .filter(step -> Boolean.TRUE.equals(step.getCompleted()))
                .count();
        int progress = totalSteps == 0 ? 100 : Math.round((completedCount * 100f) / totalSteps);

        List<String> completedSteps = steps.stream()
                .filter(step -> Boolean.TRUE.equals(step.getCompleted()))
                .map(ShopSetupStatusResponse.StepStatus::getKey)
                .toList();
        List<String> missingSteps = steps.stream()
                .filter(step -> !Boolean.TRUE.equals(step.getCompleted()))
                .map(ShopSetupStatusResponse.StepStatus::getKey)
                .toList();

        return ShopSetupStatusResponse.builder()
                .setupCompleted(completedCount == totalSteps)
                .progress(progress)
                .completedCount(completedCount)
                .totalSteps(totalSteps)
                .completedSteps(completedSteps)
                .missingSteps(missingSteps)
                .steps(steps)
                .build();
    }

    // ==================== Address Management (Individual CRUD) ====================

    @Transactional
    public ShopAddress createAddress(Long userId, CreateShopAddressRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        // If this is the first address or marked as default, set it as default and unset others
        List<ShopAddress> existingAddresses = shopAddressRepository.findByShop(shop);
        boolean shouldBeDefault = request.getIsDefault() || existingAddresses.isEmpty();

        if (shouldBeDefault) {
            // Unset default for all other addresses
            existingAddresses.stream()
                    .filter(ShopAddress::getIsDefault)
                    .forEach(addr -> {
                        addr.setIsDefault(false);
                        shopAddressRepository.save(addr);
                    });
        }

        ShopAddress newAddress = ShopAddress.builder()
                .shop(shop)
                .label(request.getLabel())
                .addressLine(request.getAddressLine())
                .ward(request.getWard())
                .district(request.getDistrict())
                .province(request.getProvince())
                .isDefault(shouldBeDefault)
                .build();

        return shopAddressRepository.save(newAddress);
    }

    @Transactional(readOnly = true)
    public List<ShopAddress> getAddresses(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        return shopAddressRepository.findByShopOrderByIsDefaultDescIdAsc(shop);
    }

    @Transactional
    public ShopAddress updateAddress(Long userId, Long addressId, UpdateShopAddressRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        ShopAddress address = shopAddressRepository.findByIdAndShop(addressId, shop)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Địa chỉ không tồn tại"));

        address.setLabel(request.getLabel());
        address.setAddressLine(request.getAddressLine());
        address.setWard(request.getWard());
        address.setDistrict(request.getDistrict());
        address.setProvince(request.getProvince());

        // Handle default address change
        if (Boolean.TRUE.equals(request.getIsDefault()) && !address.getIsDefault()) {
            // Unset default for all other addresses
            List<ShopAddress> otherAddresses = shopAddressRepository.findByShopOrderByIsDefaultDescIdAsc(shop);
            otherAddresses.stream()
                    .filter(addr -> !addr.getId().equals(addressId) && addr.getIsDefault())
                    .forEach(addr -> {
                        addr.setIsDefault(false);
                        shopAddressRepository.save(addr);
                    });
            address.setIsDefault(true);
        }

        return shopAddressRepository.save(address);
    }

    @Transactional
    public void deleteAddress(Long userId, Long addressId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        ShopAddress address = shopAddressRepository.findByIdAndShop(addressId, shop)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Địa chỉ không tồn tại"));

        // If deleting the default address, set the first remaining address as default
        if (address.getIsDefault()) {
            List<ShopAddress> otherAddresses = shopAddressRepository.findByShopOrderByIsDefaultDescIdAsc(shop);
            ShopAddress nextDefault = otherAddresses.stream()
                    .filter(addr -> !addr.getId().equals(addressId))
                    .findFirst()
                    .orElse(null);

            if (nextDefault != null) {
                nextDefault.setIsDefault(true);
                shopAddressRepository.save(nextDefault);
            }
        }

        shopAddressRepository.delete(address);
    }

    @Transactional
    public ShopAddress setDefaultAddress(Long userId, Long addressId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Shop shop = user.getShop();
        if (shop == null) throw new BusinessException(ErrorCode.SHOP_NOT_FOUND);

        ShopAddress address = shopAddressRepository.findByIdAndShop(addressId, shop)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Địa chỉ không tồn tại"));

        // Unset default for all other addresses
        List<ShopAddress> otherAddresses = shopAddressRepository.findByShopOrderByIsDefaultDescIdAsc(shop);
        otherAddresses.stream()
                .filter(addr -> !addr.getId().equals(addressId) && addr.getIsDefault())
                .forEach(addr -> {
                    addr.setIsDefault(false);
                    shopAddressRepository.save(addr);
                });

        address.setIsDefault(true);
        return shopAddressRepository.save(address);
    }

    // ==================== Private Helpers ====================

    /**
     * Issues a fresh session (new tokens + full session DTO) for the user.
     * Used after shop data changes that affect the session response.
     */
    private AuthSessionResponse issueSessionForUser(User user) {
        TokenService.TokenPair tokens = tokenService.issueTokens(user);
        return sessionMapper.toSessionResponse(user, tokens);
    }

    private void addStep(List<ShopSetupStatusResponse.StepStatus> steps, String key, boolean completed) {
        steps.add(ShopSetupStatusResponse.StepStatus.builder()
                .key(key)
                .completed(completed)
                .required(true)
                .build());
    }

    private boolean hasPassedBusinessTypeStep(ShopOnboardingState onboardingState) {
        if (onboardingState == null || Boolean.TRUE.equals(onboardingState.getIsCompleted())) {
            return true;
        }

        String currentStep = onboardingState.getCurrentStep();
        return "CATEGORY".equals(currentStep) || "COMPLETED".equals(currentStep);
    }

    private boolean hasRequiredOrderConfigs(Shop shop) {
        boolean sellEnabled = Boolean.TRUE.equals(shop.getEnableSell());
        boolean rentEnabled = Boolean.TRUE.equals(shop.getEnableRent());

        if (!sellEnabled && !rentEnabled) {
            return false;
        }

        if (sellEnabled && !hasOrderConfig(shop.getId(), ProductType.SELL)) {
            return false;
        }

        return !rentEnabled || hasOrderConfig(shop.getId(), ProductType.RENT);
    }

    private boolean hasOrderConfig(Long shopId, ProductType productType) {
        return !orderFormConfigRepository.findAllByShopIdAndFormType(shopId, productType).isEmpty();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String resolveBusinessMode(boolean enableSell, boolean enableRent) {
        if (enableSell && enableRent) {
            return "BOTH";
        }

        return enableSell ? "SELL" : "RENT";
    }

    private String generateUniqueSlug(String shopName) {
        String baseSlug = SlugUtils.toSlug(shopName);
        String candidate = baseSlug;
        int suffix = 1;

        while (candidate.isBlank() || shopRepository.existsBySlug(candidate)) {
            candidate = baseSlug + "-" + suffix++;
        }

        return candidate;
    }
}
