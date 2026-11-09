package com.oms.module.messenger.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.common.dto.PageResponse;
import com.oms.module.messenger.dto.ConversationResponse;
import com.oms.module.messenger.dto.CreateOrderDraftResponse;
import com.oms.module.messenger.dto.MessageResponse;
import com.oms.module.messenger.dto.MessengerOrderResponse;
import com.oms.module.messenger.dto.OrderDraftResponse;
import com.oms.module.messenger.entity.MessengerOrder;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.service.ConversationService;
import com.oms.module.messenger.service.MessageService;
import com.oms.module.messenger.service.MessengerDtoMapper;
import com.oms.module.messenger.service.MessengerOrderService;
import com.oms.module.messenger.service.OrderDraftService;
import com.oms.module.order.dto.OrderResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.mapper.OrderMapper;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@Tag(name = "Messenger Staff", description = "Staff APIs for Messenger conversations and order drafts")
public class MessengerStaffController {

    private final ConversationService conversationService;
    private final MessageService messageService;
    private final OrderDraftService orderDraftService;
    private final MessengerOrderService messengerOrderService;
    private final MessengerDtoMapper mapper;
    private final OrderMapper orderMapper;

    @GetMapping("/conversations")
    @Operation(summary = "Get latest Messenger conversations")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<PageResponse<ConversationResponse>>> getConversations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        var pageable = PageRequest.of(page, size, Sort.by("updatedAt").descending());
        var result = conversationService.getConversations(user.getShopId(), pageable);
        var mappedContent = result.getContent().stream()
                .map(mapper::toConversationResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.of(result, mappedContent)));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    @Operation(summary = "Get Messenger conversation messages")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<List<MessageResponse>>> getMessages(
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "200") int limit,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        conversationService.getByIdForShop(conversationId, user.getShopId());
        List<MessageResponse> messages = messageService.getRecentMessagesAsc(conversationId, limit).stream()
                .map(mapper::toMessageResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(messages));
    }

    @PostMapping("/conversations/{conversationId}/create-order-draft")
    @Operation(summary = "Create an order draft from Messenger conversation context")
    @RequirePermission(PermissionCode.ORDER_CREATE)
    public ResponseEntity<ApiResponse<CreateOrderDraftResponse>> createOrderDraft(
            @PathVariable Long conversationId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        CreateOrderDraftResponse response = orderDraftService.createOrderDraftFromConversation(
                conversationId,
                user != null ? user.getShopId() : null
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @GetMapping("/order-drafts")
    @Operation(summary = "Get Messenger order drafts")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<PageResponse<OrderDraftResponse>>> getOrderDrafts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        var result = orderDraftService.getOrderDrafts(user.getShopId(), pageable);
        var mappedContent = result.getContent().stream()
                .map(mapper::toOrderDraftResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.of(result, mappedContent)));
    }

    @GetMapping("/orders")
    @Operation(summary = "Get confirmed Messenger orders")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<PageResponse<MessengerOrderResponse>>> getOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        var result = messengerOrderService.getOrders(user.getShopId(), pageable);
        var mappedContent = result.getContent().stream()
                .map(mapper::toMessengerOrderResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.of(result, mappedContent)));
    }

    @PostMapping("/order-drafts/{draftId}/confirm-manually")
    @Operation(summary = "Manually confirm a Messenger order draft")
    @RequirePermission(PermissionCode.ORDER_UPDATE_STATUS)
    public ResponseEntity<ApiResponse<OrderResponse>> confirmManually(
            @PathVariable Long draftId,
            @AuthenticationPrincipal CustomUserDetails user) {
        Order order = messengerOrderService.confirmDraftManually(user.getShopId(), draftId);
        return ResponseEntity.ok(ApiResponse.ok("Order draft confirmed", orderMapper.toResponse(order)));
    }

    @PostMapping("/order-drafts/{draftId}/cancel")
    @Operation(summary = "Cancel a Messenger order draft")
    @RequirePermission(PermissionCode.ORDER_UPDATE_STATUS)
    public ResponseEntity<ApiResponse<OrderDraftResponse>> cancel(
            @PathVariable Long draftId,
            @AuthenticationPrincipal CustomUserDetails user) {
        OrderDraft draft = orderDraftService.cancelForShop(draftId, user.getShopId());
        return ResponseEntity.ok(ApiResponse.ok("Order draft cancelled", mapper.toOrderDraftResponse(draft)));
    }
}
