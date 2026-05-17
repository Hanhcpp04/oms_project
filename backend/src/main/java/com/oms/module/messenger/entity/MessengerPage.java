package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.shop.entity.Shop;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity(name = "MessengerPage")
@Table(
        name = "messenger_pages",
        indexes = {
                @Index(name = "ux_messenger_page_id", columnList = "page_id", unique = true),
                @Index(name = "idx_messenger_page_shop_id", columnList = "shop_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessengerPage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "page_name", length = 255)
    private String pageName;

    @Lob
    @Column(name = "page_access_token", columnDefinition = "TEXT")
    private String pageAccessToken;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;
}
