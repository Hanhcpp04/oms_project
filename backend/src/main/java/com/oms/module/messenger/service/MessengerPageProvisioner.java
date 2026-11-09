package com.oms.module.messenger.service;

import com.oms.config.MessengerProperties;
import com.oms.module.messenger.entity.MessengerPage;
import com.oms.module.messenger.repository.MessengerPageRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Objects;

@Component
@RequiredArgsConstructor
@Slf4j
public class MessengerPageProvisioner implements ApplicationRunner {

    private final MessengerProperties messengerProperties;
    private final MessengerPageRepository messengerPageRepository;
    private final ShopRepository shopRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String pageId = messengerProperties.getDefaultPageId();
        Long shopId = messengerProperties.getDefaultShopId();

        if (!StringUtils.hasText(pageId) || shopId == null || shopId <= 0) {
            return;
        }

        Shop shop = shopRepository.findById(shopId)
                .orElse(null);

        if (shop == null) {
            log.warn("Cannot provision Messenger page because configured shop does not exist. pageId={}, shopId={}",
                    pageId, shopId);
            return;
        }

        MessengerPage page = messengerPageRepository.findByPageId(pageId).orElse(null);
        boolean created = page == null;
        boolean changed = created;

        if (created) {
            page = MessengerPage.builder()
                    .pageId(pageId)
                    .pageName("Messenger Page " + pageId)
                    .build();
        } else if (!StringUtils.hasText(page.getPageName())) {
            page.setPageName("Messenger Page " + pageId);
            changed = true;
        }

        Long currentShopId = page.getShop() != null ? page.getShop().getId() : null;
        if (!Objects.equals(currentShopId, shopId)) {
            page.setShop(shop);
            changed = true;
        }

        if (!Boolean.TRUE.equals(page.getEnabled())) {
            page.setEnabled(true);
            changed = true;
        }

        String defaultPageAccessToken = messengerProperties.getDefaultPageAccessToken();
        if (StringUtils.hasText(defaultPageAccessToken)
                && !Objects.equals(defaultPageAccessToken, page.getPageAccessToken())) {
            page.setPageAccessToken(defaultPageAccessToken);
            changed = true;
        }

        if (!changed) {
            return;
        }

        MessengerPage saved = messengerPageRepository.save(page);
        log.info("{} Messenger page mapping: pageId={}, shopId={}, messengerPageId={}",
                created ? "Provisioned" : "Updated", saved.getPageId(), shopId, saved.getId());
    }
}
