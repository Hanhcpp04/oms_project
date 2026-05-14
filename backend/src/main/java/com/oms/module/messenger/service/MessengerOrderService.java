package com.oms.module.messenger.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.MessengerOrder;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.enums.MessengerOrderStatus;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.messenger.repository.MessengerOrderRepository;
import com.oms.module.messenger.repository.OrderDraftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerOrderService {

    private final MessengerOrderRepository messengerOrderRepository;
    private final OrderDraftRepository orderDraftRepository;

    @Transactional
    public Optional<MessengerOrder> confirmLatestWaitingOrder(Conversation conversation) {
        return orderDraftRepository.findTopByConversationIdAndStatusOrderByCreatedAtDesc(
                        conversation.getId(),
                        OrderDraftStatus.WAITING_CONFIRM
                )
                .map(this::createOrderFromDraft);
    }

    @Transactional
    public MessengerOrder confirmDraftManually(Long draftId) {
        OrderDraft draft = orderDraftRepository.findById(draftId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderDraft", draftId));
        return createOrderFromDraft(draft);
    }

    @Transactional(readOnly = true)
    public Page<MessengerOrder> getOrders(Pageable pageable) {
        return messengerOrderRepository.findAll(pageable);
    }

    private MessengerOrder createOrderFromDraft(OrderDraft draft) {
        Optional<MessengerOrder> existingOrder = messengerOrderRepository.findByOrderDraftId(draft.getId());
        if (existingOrder.isPresent()) {
            draft.setStatus(OrderDraftStatus.CONFIRMED);
            orderDraftRepository.save(draft);
            return existingOrder.get();
        }

        if (draft.getStatus() == OrderDraftStatus.CANCELLED || draft.getStatus() == OrderDraftStatus.EXPIRED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Cannot confirm an order draft with status " + draft.getStatus());
        }

        MessengerOrder order = MessengerOrder.builder()
                .orderDraft(draft)
                .conversation(draft.getConversation())
                .customerName(draft.getCustomerName())
                .phone(draft.getPhone())
                .address(draft.getAddress())
                .productName(draft.getProductName())
                .productCode(draft.getProductCode())
                .quantity(draft.getQuantity())
                .color(draft.getColor())
                .size(draft.getSize())
                .price(draft.getPrice())
                .note(draft.getNote())
                .status(MessengerOrderStatus.NEW)
                .build();

        draft.setStatus(OrderDraftStatus.CONFIRMED);
        MessengerOrder saved = messengerOrderRepository.save(order);
        orderDraftRepository.save(draft);

        log.info("Confirmed Messenger order draft into order: draftId={}, orderId={}",
                draft.getId(), saved.getId());
        return saved;
    }
}
