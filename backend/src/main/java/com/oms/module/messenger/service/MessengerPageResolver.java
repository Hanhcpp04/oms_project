package com.oms.module.messenger.service;

import com.oms.config.MessengerProperties;
import com.oms.module.messenger.entity.MessengerPage;
import com.oms.module.messenger.repository.MessengerPageRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerPageResolver {

    private final MessengerPageRepository messengerPageRepository;
    private final ShopRepository shopRepository;
    private final MessengerProperties messengerProperties;

    public Optional<Shop> resolveShop(String pageId) {
        Optional<MessengerPage> page = findPage(pageId);
        if (page.isPresent()) {
            return Optional.ofNullable(page.get().getShop());
        }

        Long defaultShopId = messengerProperties.getDefaultShopId();
        if (defaultShopId != null && defaultShopId > 0) {
            return shopRepository.findById(defaultShopId);
        }

        List<Shop> shops = shopRepository.findAll();
        if (shops.size() == 1) {
            log.debug("Resolved Messenger page {} to the only shop in the system: shopId={}",
                    pageId, shops.get(0).getId());
            return Optional.of(shops.get(0));
        }

        log.warn("Cannot resolve Messenger page to a shop. pageId={}, matchingPage=false, defaultShopId={}, shopCount={}",
                pageId, defaultShopId, shops.size());
        return Optional.empty();
    }

    public Optional<String> resolvePageAccessToken(String pageId) {
        Optional<MessengerPage> page = findPage(pageId);
        if (page.isPresent() && StringUtils.hasText(page.get().getPageAccessToken())) {
            return Optional.of(page.get().getPageAccessToken());
        }

        String configuredToken = messengerProperties.getPageAccessTokens().get(pageId);
        if (StringUtils.hasText(configuredToken)) {
            return Optional.of(configuredToken);
        }

        String defaultToken = messengerProperties.getDefaultPageAccessToken();
        return StringUtils.hasText(defaultToken) ? Optional.of(defaultToken) : Optional.empty();
    }

    private Optional<MessengerPage> findPage(String pageId) {
        if (!StringUtils.hasText(pageId)) {
            return Optional.empty();
        }
        return messengerPageRepository.findByPageIdAndEnabledTrue(pageId);
    }
}
