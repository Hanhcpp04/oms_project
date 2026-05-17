package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.order.entity.Order;
import com.oms.module.shop.entity.Shop;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity(name = "MessengerOrderDraft")
@Table(
        name = "messenger_order_drafts",
        indexes = {
                @Index(name = "ux_messenger_order_draft_code", columnList = "draft_code", unique = true),
                @Index(name = "ux_messenger_order_draft_source_mid", columnList = "source_message_mid", unique = true),
                @Index(name = "idx_messenger_order_draft_conversation_status", columnList = "conversation_id,status"),
                @Index(name = "idx_messenger_order_draft_page_customer_status", columnList = "page_id,customer_psid,status"),
                @Index(name = "idx_messenger_order_draft_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderDraft extends BaseEntity {

    @Column(name = "draft_code", length = 30)
    private String draftCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id")
    private Shop shop;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Column(name = "page_id", length = 100)
    private String pageId;

    @Column(name = "customer_psid", length = 100)
    private String customerPsid;

    @Column(name = "source_message_mid", length = 255)
    private String sourceMessageMid;

    @Lob
    @Column(name = "raw_seller_message", columnDefinition = "TEXT")
    private String rawSellerMessage;

    @Lob
    @Column(name = "ai_parsed_json", columnDefinition = "LONGTEXT")
    private String aiParsedJson;

    @Column(name = "customer_name", length = 150)
    private String customerName;

    @Column(name = "phone", length = 30)
    private String phone;

    @Lob
    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", length = 20, columnDefinition = "enum('RENT','SELL')")
    private Order.OrderType orderType;

    @Column(name = "product_name", length = 255)
    private String productName;

    @Column(name = "product_code", length = 100)
    private String productCode;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "color", length = 80)
    private String color;

    @Column(name = "product_size", length = 50)
    private String size;

    @Column(name = "price", precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "deposit_amount", precision = 15, scale = 2)
    private BigDecimal depositAmount;

    @Column(name = "subtotal", precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "rental_days")
    private Integer rentalDays;

    @Column(name = "delivery_date")
    private LocalDate deliveryDate;

    @Column(name = "rent_from")
    private LocalDate rentFrom;

    @Column(name = "rent_to")
    private LocalDate rentTo;

    @Column(name = "confidence")
    private Double confidence;

    @Lob
    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Convert(converter = StringListJsonConverter.class)
    @Column(name = "missing_fields", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> missingFields = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40, columnDefinition = "enum('CANCELLED','CONFIRMED','CONVERTED_TO_ORDER','DRAFT','EXPIRED','NEED_MORE_INFO','PENDING_CUSTOMER_CONFIRMATION','WAITING_CONFIRM')")
    @Builder.Default
    private OrderDraftStatus status = OrderDraftStatus.DRAFT;

    @Lob
    @Column(name = "confirm_message", columnDefinition = "TEXT")
    private String confirmMessage;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "converted_order_id")
    private Order convertedOrder;

    @OneToMany(mappedBy = "draft", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderDraftItem> items = new ArrayList<>();

    public void addItem(OrderDraftItem item) {
        items.add(item);
        item.setDraft(this);
    }
}
