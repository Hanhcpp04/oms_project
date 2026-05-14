package com.oms.module.messenger.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.messenger.dto.CreateOrderDraftResponse;
import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.messenger.repository.OrderDraftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderDraftService {

    private static final int MAX_CONTEXT_MESSAGES = 200;

    private final OrderDraftRepository orderDraftRepository;
    private final ConversationService conversationService;
    private final MessageService messageService;
    private final OrderExtractionService orderExtractionService;
    private final MessengerSendService messengerSendService;
    private final MessengerDtoMapper mapper;

    @Transactional
    public CreateOrderDraftResponse createOrderDraftFromConversation(Long conversationId) {
        return createOrderDraftFromConversation(conversationId, null);
    }

    @Transactional
    public CreateOrderDraftResponse createOrderDraftFromConversation(Long conversationId, Long shopId) {
        Conversation conversation = conversationService.getById(conversationId);
        List<Message> contextMessages = messageService.getDraftContextMessages(conversation, MAX_CONTEXT_MESSAGES);
        OrderInfoExtractedDto extracted = orderExtractionService.extractOrderInfo(contextMessages, shopId);

        OrderDraft draft = OrderDraft.builder()
                .conversation(conversation)
                .customerName(extracted.getCustomerName())
                .phone(extracted.getPhone())
                .address(extracted.getAddress())
                .productName(extracted.getProductName())
                .productCode(extracted.getProductCode())
                .quantity(extracted.getQuantity())
                .color(extracted.getColor())
                .size(extracted.getSize())
                .price(extracted.getPrice())
                .note(extracted.getNote())
                .missingFields(extracted.getMissingFields() != null ? extracted.getMissingFields() : new ArrayList<>())
                .status(OrderDraftStatus.WAITING_CONFIRM)
                .build();
        draft.setConfirmMessage(buildConfirmMessage(draft));

        OrderDraft saved = orderDraftRepository.save(draft);
        conversationService.updateLastOrderMarkerTime(conversation, LocalDateTime.now());
        boolean messengerSent = messengerSendService.sendMessage(
                conversation.getPageId(),
                conversation.getSenderId(),
                saved.getConfirmMessage()
        );

        log.info("Created Messenger order draft: draftId={}, conversationId={}, contextMessageCount={}",
                saved.getId(), conversationId, contextMessages.size());

        return CreateOrderDraftResponse.builder()
                .orderDraft(mapper.toOrderDraftResponse(saved))
                .confirmMessage(saved.getConfirmMessage())
                .messengerSent(messengerSent)
                .build();
    }

    @Transactional(readOnly = true)
    public Optional<OrderDraft> findLatestWaitingConfirm(Long conversationId) {
        return orderDraftRepository.findTopByConversationIdAndStatusOrderByCreatedAtDesc(
                conversationId,
                OrderDraftStatus.WAITING_CONFIRM
        );
    }

    @Transactional
    public Optional<OrderDraft> applyCustomerUpdate(Conversation conversation, String updateContent) {
        return applyCustomerUpdate(conversation, updateContent, null);
    }

    @Transactional
    public Optional<OrderDraft> applyCustomerUpdate(Conversation conversation, String updateContent, Long shopId) {
        Optional<OrderDraft> optionalDraft = findLatestWaitingConfirm(conversation.getId());
        if (optionalDraft.isEmpty()) {
            log.info("Customer update ignored because no WAITING_CONFIRM draft exists. conversationId={}",
                    conversation.getId());
            return Optional.empty();
        }

        OrderDraft draft = optionalDraft.get();
        String normalizedUpdate = StringUtils.hasText(updateContent) ? updateContent.trim() : "";
        OrderInfoExtractedDto extracted = orderExtractionService.extractOrderInfo(
                List.of(Message.builder()
                        .conversation(conversation)
                        .senderType(MessageSenderType.CUSTOMER)
                        .senderId(conversation.getSenderId())
                        .text(normalizedUpdate)
                        .messageTime(LocalDateTime.now())
                        .build()),
                shopId
        );
        applyExtractedUpdate(draft, extracted);

        String updateNote = "Khách cập nhật: " + normalizedUpdate;
        draft.setNote(appendNote(draft.getNote(), updateNote));
        draft.setMissingFields(findMissingFields(draft));
        draft.setConfirmMessage(buildConfirmMessage(draft));

        OrderDraft saved = orderDraftRepository.save(draft);
        messengerSendService.sendMessage(conversation.getPageId(), conversation.getSenderId(), saved.getConfirmMessage());

        log.info("Updated Messenger order draft from customer message: draftId={}, conversationId={}",
                saved.getId(), conversation.getId());
        return Optional.of(saved);
    }

    @Transactional(readOnly = true)
    public Page<OrderDraft> getOrderDrafts(Pageable pageable) {
        return orderDraftRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public OrderDraft getById(Long draftId) {
        return orderDraftRepository.findById(draftId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderDraft", draftId));
    }

    @Transactional
    public OrderDraft cancel(Long draftId) {
        OrderDraft draft = getById(draftId);
        if (draft.getStatus() == OrderDraftStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cannot cancel a confirmed order draft");
        }

        draft.setStatus(OrderDraftStatus.CANCELLED);
        OrderDraft saved = orderDraftRepository.save(draft);
        log.info("Cancelled Messenger order draft: draftId={}", draftId);
        return saved;
    }

    public String buildConfirmMessage(OrderDraft draft) {
        return "Bạn vui lòng xác nhận giúp mình thông tin đơn hàng sau ạ:\n"
                + "- Sản phẩm: " + valueOrPlaceholder(draft.getProductName()) + "\n"
                + "- Màu sắc: " + valueOrPlaceholder(draft.getColor()) + "\n"
                + "- Size: " + valueOrPlaceholder(draft.getSize()) + "\n"
                + "- Số lượng: " + valueOrPlaceholder(draft.getQuantity()) + "\n"
                + "- Số điện thoại: " + valueOrPlaceholder(draft.getPhone()) + "\n"
                + "- Địa chỉ nhận hàng: " + valueOrPlaceholder(draft.getAddress()) + "\n"
                + "Nếu thông tin đã đúng, bạn vui lòng nhắn: Xác nhận đơn hàng.\n"
                + "Nếu cần sửa, bạn có thể nhắn: Cập nhật lại: ...";
    }

    private String valueOrPlaceholder(Object value) {
        if (value == null) {
            return "Chưa rõ";
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.stripTrailingZeros().toPlainString();
        }
        String text = String.valueOf(value).trim();
        return StringUtils.hasText(text) ? text : "Chưa rõ";
    }

    private String appendNote(String currentNote, String updateNote) {
        if (!StringUtils.hasText(currentNote)) {
            return updateNote;
        }
        return currentNote + "\n" + updateNote;
    }

    private void applyExtractedUpdate(OrderDraft draft, OrderInfoExtractedDto extracted) {
        if (extracted == null) {
            return;
        }

        if (StringUtils.hasText(extracted.getCustomerName())) {
            draft.setCustomerName(extracted.getCustomerName());
        }
        if (StringUtils.hasText(extracted.getPhone())) {
            draft.setPhone(extracted.getPhone());
        }
        if (StringUtils.hasText(extracted.getAddress())) {
            draft.setAddress(extracted.getAddress());
        }
        if (StringUtils.hasText(extracted.getProductName())) {
            draft.setProductName(extracted.getProductName());
        }
        if (StringUtils.hasText(extracted.getProductCode())) {
            draft.setProductCode(extracted.getProductCode());
        }
        if (extracted.getQuantity() != null) {
            draft.setQuantity(extracted.getQuantity());
        }
        if (StringUtils.hasText(extracted.getColor())) {
            draft.setColor(extracted.getColor());
        }
        if (StringUtils.hasText(extracted.getSize())) {
            draft.setSize(extracted.getSize());
        }
        if (extracted.getPrice() != null) {
            draft.setPrice(extracted.getPrice());
        }
    }

    private List<String> findMissingFields(OrderDraft draft) {
        List<String> missingFields = new ArrayList<>();
        if (!StringUtils.hasText(draft.getProductName())) {
            missingFields.add("productName");
        }
        if (draft.getQuantity() == null) {
            missingFields.add("quantity");
        }
        if (!StringUtils.hasText(draft.getPhone())) {
            missingFields.add("phone");
        }
        if (!StringUtils.hasText(draft.getAddress())) {
            missingFields.add("address");
        }
        return missingFields;
    }
}
