package com.oms.module.auth.service;

import com.oms.module.auth.dto.AuthOnboardingDto;
import com.oms.module.auth.dto.AuthSessionResponse;
import com.oms.module.auth.dto.AuthShopDto;
import com.oms.module.auth.dto.AuthUserDto;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopOnboardingState;
import com.oms.module.shop.repository.ShopAddressRepository;
import com.oms.module.shop.repository.ShopCategoryRepository;
import com.oms.module.shop.repository.ShopOnboardingStateRepository;
import com.oms.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps User entity (with shop/onboarding) to AuthSessionResponse DTO.
 * Extracted from AuthService to keep session building logic separate from auth flow.
 */
@Component
@RequiredArgsConstructor
public class SessionMapper {

    private static final String TOKEN_TYPE = "Bearer";
    private static final String DEFAULT_ONBOARDING_STEP = "SHOP_PROFILE";

    private final ShopOnboardingStateRepository onboardingStateRepository;
    private final ShopAddressRepository shopAddressRepository;
    private final ShopCategoryRepository shopCategoryRepository;

    /**
     * Build a full session response with tokens.
     */
    public AuthSessionResponse toSessionResponse(User user, TokenService.TokenPair tokens) {
        return buildResponse(user, tokens.accessToken(), tokens.refreshToken());
    }

    /**
     * Build a session response without tokens (e.g. for GET /me endpoint).
     */
    public AuthSessionResponse toSessionResponse(User user) {
        return buildResponse(user, null, null);
    }

    private AuthSessionResponse buildResponse(User user, String accessToken, String refreshToken) {
        Shop shop = user.getShop();
        ShopOnboardingState onboardingState = shop != null
                ? onboardingStateRepository.findFirstByShopOrderByIdDesc(shop).orElse(null)
                : null;

        return AuthSessionResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType(accessToken != null ? TOKEN_TYPE : null)
                .user(mapUser(user))
                .shop(shop != null ? mapShop(shop) : null)
                .onboarding(mapOnboarding(onboardingState))
                .build();
    }

    private AuthUserDto mapUser(User user) {
        return AuthUserDto.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .forceChangePassword(Boolean.TRUE.equals(user.getForceChangePassword()))
                .build();
    }

    private AuthShopDto mapShop(Shop shop) {
        return AuthShopDto.builder()
                .id(shop.getId())
                .name(shop.getName())
                .slug(shop.getSlug())
                .avatarUrl(shop.getLogoUrl())
                .email(shop.getEmail())
                .phone(shop.getPhone())
                .supportEmail(shop.getSupportEmail())
                .supportPhone(shop.getSupportPhone())
                .businessMode(resolveBusinessMode(shop))
                .status(shop.getStatus().name())
                .enableSell(shop.getEnableSell())
                .enableRent(shop.getEnableRent())
                .autoAcceptOrders(shop.getAutoAcceptOrders())
                .maintenanceMode(shop.getMaintenanceMode())
                .showInventoryOnStorefront(shop.getShowInventoryOnStorefront())
                .notificationsEnabled(shop.getNotificationsEnabled())
                .rentalIdentityVerificationEnabled(shop.getRentalIdentityVerificationEnabled())
                .categories(shopCategoryRepository.findAllByShopId(shop.getId()).stream()
                        .map(cat -> cat.getName())
                        .toList())
                .addresses(shopAddressRepository.findByShopOrderByIsDefaultDescIdAsc(shop).stream()
                        .map(addr -> AuthShopDto.ShopAddressDto.builder()
                                .id(addr.getId())
                                .label(addr.getLabel())
                                .addressLine(addr.getAddressLine())
                                .ward(addr.getWard())
                                .district(addr.getDistrict())
                                .province(addr.getProvince())
                                .isDefault(addr.getIsDefault())
                                .build())
                        .toList())
                .build();
    }

    private String resolveBusinessMode(Shop shop) {
        boolean enableSell = Boolean.TRUE.equals(shop.getEnableSell());
        boolean enableRent = Boolean.TRUE.equals(shop.getEnableRent());

        if (enableSell && enableRent) {
            return "BOTH";
        }

        return enableSell ? "SELL" : "RENT";
    }

    private AuthOnboardingDto mapOnboarding(ShopOnboardingState state) {
        return AuthOnboardingDto.builder()
                .completed(state != null && Boolean.TRUE.equals(state.getIsCompleted()))
                .currentStep(state != null ? state.getCurrentStep() : DEFAULT_ONBOARDING_STEP)
                .build();
    }
}
