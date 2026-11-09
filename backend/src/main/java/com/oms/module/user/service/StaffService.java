package com.oms.module.user.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.util.SlugUtils;
import com.oms.module.user.dto.CreateStaffRequest;
import com.oms.module.user.dto.StaffDetailResponse;
import com.oms.module.user.dto.StaffResponse;
import com.oms.module.user.dto.StaffListResponse;
import com.oms.module.user.entity.User;
import com.oms.module.user.repository.UserRepository;
import com.oms.module.order.repository.OrderRepository;
import com.oms.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class StaffService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PermissionService permissionService;
    private final OrderRepository orderRepository;

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Transactional
    public StaffResponse createStaff(Long ownerId, CreateStaffRequest request) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (owner.getRole() != User.UserRole.OWNER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only OWNER can create staff");
        }

        if (owner.getShop() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Owner must complete shop setup before creating staff");
        }

        if (request.getEmail() != null && !request.getEmail().isBlank() && userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.USER_EMAIL_EXISTS);
        }

        String username = generateUniqueUsername(request.getEmail(), request.getFullName());
        String tempPassword = generateTempPassword();
        String email = (request.getEmail() != null && !request.getEmail().isBlank()) 
                ? request.getEmail() 
                : username + "@shop.local";

        User staff = User.builder()
                .shop(owner.getShop())
                .email(email)
                .username(username)
                .password(passwordEncoder.encode(tempPassword))
                .fullName(request.getFullName())
                .phone(normalizeOptionalField(request.getPhone()))
                .role(User.UserRole.STAFF)
                .forceChangePassword(true)
                .build();

        staff = userRepository.save(staff);

        // Grant default permissions to the new staff member
        permissionService.grantDefaultPermissions(staff, owner);

        return StaffResponse.builder()
                .id(staff.getId())
                .fullName(staff.getFullName())
                .email(staff.getEmail())
                .username(staff.getUsername())
                .phone(staff.getPhone())
                .temporaryPassword(tempPassword)
                .forceChangePassword(true)
                .build();
    }

    private String generateUniqueUsername(String email, String fullName) {
        String base = SlugUtils.toSlug(fullName);

        if (base.isBlank()) {
            base = (email != null && !email.isBlank()) ? email.split("@")[0].toLowerCase() : "staff";
        }

        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + suffix++;
        }

        return candidate;
    }

    private String generateTempPassword() {
        return "Oms@" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Transactional(readOnly = true)
    public PageResponse<StaffListResponse> getStaffList(Long ownerId, String search, Pageable pageable) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (owner.getShop() == null) {
            log.warn("Owner {} has no shop assigned, returning empty staff list", ownerId);
            return PageResponse.of(Page.empty(pageable));
        }

        Long shopId = owner.getShop().getId();
        log.debug("Fetching staff list for shop ID: {}, search: {}", shopId, search);

        Page<User> staffPage;
        if (search != null && !search.isBlank()) {
            staffPage = userRepository.findByShopIdAndRoleAndFullNameContainingIgnoreCase(shopId, User.UserRole.STAFF, search, pageable);
        } else {
            staffPage = userRepository.findByShopIdAndRole(shopId, User.UserRole.STAFF, pageable);
        }

        log.debug("Found {} staff members in database for shop {}", staffPage.getTotalElements(), shopId);

        List<Long> staffIds = staffPage.getContent().stream().map(User::getId).toList();
        OrderCounts orderCounts = getOrderCounts(shopId, staffIds);
        List<StaffListResponse> content = staffPage.getContent().stream()
                .map(user -> toStaffListResponse(
                        user,
                        orderCounts.today().getOrDefault(user.getId(), 0L),
                        orderCounts.thisMonth().getOrDefault(user.getId(), 0L)
                ))
                .collect(Collectors.toList());

        return PageResponse.of(staffPage, content);
    }

    @Transactional(readOnly = true)
    public StaffDetailResponse getStaffDetail(Long ownerId, Long staffId) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (owner.getShop() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Owner has no shop assigned");
        }

        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        validateStaffBelongsToOwnerShop(owner, staff);

        OrderCounts orderCounts = getOrderCounts(owner.getShop().getId(), List.of(staff.getId()));
        return toStaffDetailResponse(
                staff,
                orderCounts.today().getOrDefault(staff.getId(), 0L),
                orderCounts.thisMonth().getOrDefault(staff.getId(), 0L)
        );
    }

    private void validateStaffBelongsToOwnerShop(User owner, User staff) {
        if (staff.getRole() != User.UserRole.STAFF
                || staff.getShop() == null
                || !staff.getShop().getId().equals(owner.getShop().getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Staff member does not belong to your shop");
        }
    }

    private StaffListResponse toStaffListResponse(User user, long ordersToday, long ordersThisMonth) {
        return StaffListResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .username(user.getUsername())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .isActive(user.getIsActive())
                .forceChangePassword(user.getForceChangePassword())
                .createdAt(user.getCreatedAt())
                .lastLogin(user.getLastLogin())
                .ordersToday(Math.toIntExact(ordersToday))
                .ordersThisMonth(Math.toIntExact(ordersThisMonth))
                .build();
    }

    private StaffDetailResponse toStaffDetailResponse(User user, long ordersToday, long ordersThisMonth) {
        return StaffDetailResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .username(user.getUsername())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .isActive(user.getIsActive())
                .forceChangePassword(user.getForceChangePassword())
                .createdAt(user.getCreatedAt())
                .lastLogin(user.getLastLogin())
                .ordersToday(Math.toIntExact(ordersToday))
                .ordersThisMonth(Math.toIntExact(ordersThisMonth))
                .build();
    }

    private String normalizeOptionalField(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private OrderCounts getOrderCounts(Long shopId, List<Long> staffIds) {
        if (staffIds.isEmpty()) {
            return new OrderCounts(Map.of(), Map.of());
        }

        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime tomorrowStart = today.plusDays(1).atStartOfDay();
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime nextMonthStart = today.plusMonths(1).withDayOfMonth(1).atStartOfDay();

        return new OrderCounts(
                toOrderCountMap(orderRepository.countOrdersByStaff(
                        shopId, staffIds, todayStart, tomorrowStart)),
                toOrderCountMap(orderRepository.countOrdersByStaff(
                        shopId, staffIds, monthStart, nextMonthStart))
        );
    }

    private Map<Long, Long> toOrderCountMap(List<OrderRepository.StaffOrderCount> counts) {
        return counts.stream().collect(Collectors.toMap(
                OrderRepository.StaffOrderCount::getUserId,
                OrderRepository.StaffOrderCount::getOrderCount
        ));
    }

    private record OrderCounts(Map<Long, Long> today, Map<Long, Long> thisMonth) {
    }
}
