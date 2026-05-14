package com.oms.module.user.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.shop.entity.Shop;
import com.oms.module.user.dto.shift.CreateWorkShiftRequest;
import com.oms.module.user.dto.shift.ShiftStaffDto;
import com.oms.module.user.dto.shift.UpdateWorkShiftRequest;
import com.oms.module.user.dto.shift.WorkShiftResponse;
import com.oms.module.user.entity.User;
import com.oms.module.user.entity.WorkShift;
import com.oms.module.user.repository.UserRepository;
import com.oms.module.user.repository.WorkShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkShiftService {

    private final WorkShiftRepository workShiftRepository;
    private final UserRepository userRepository;

    @Transactional
    public WorkShiftResponse createShift(Long ownerId, CreateWorkShiftRequest request) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = owner.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Owner must complete shop setup");
        }

        if (request.getStartTime().isAfter(request.getEndTime()) || request.getStartTime().equals(request.getEndTime())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Start time must be before end time");
        }

        boolean hasOverlap = workShiftRepository.existsOverlappingShift(
                shop.getId(), request.getShiftDate(), request.getStartTime(), request.getEndTime(), null);

        if (hasOverlap) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Overlapping shift exists on this date");
        }

        WorkShift shift = WorkShift.builder()
                .shop(shop)
                .shiftDate(request.getShiftDate())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .name(request.getName())
                .build();

        assignStaffToShift(shift, shop.getId(), request.getStaffIds());

        WorkShift saved = workShiftRepository.save(shift);
        return mapToResponse(saved);
    }

    @Transactional
    public WorkShiftResponse updateShift(Long ownerId, Long shiftId, UpdateWorkShiftRequest request) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = owner.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Owner must complete shop setup");
        }

        WorkShift shift = workShiftRepository.findById(shiftId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Shift not found"));

        if (!shift.getShop().getId().equals(shop.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to update this shift");
        }

        if (request.getStartTime().isAfter(request.getEndTime()) || request.getStartTime().equals(request.getEndTime())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Start time must be before end time");
        }

        boolean hasOverlap = workShiftRepository.existsOverlappingShift(
                shop.getId(), request.getShiftDate(), request.getStartTime(), request.getEndTime(), shiftId);

        if (hasOverlap) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Overlapping shift exists on this date");
        }

        shift.setShiftDate(request.getShiftDate());
        shift.setStartTime(request.getStartTime());
        shift.setEndTime(request.getEndTime());
        shift.setName(request.getName());

        assignStaffToShift(shift, shop.getId(), request.getStaffIds());

        WorkShift saved = workShiftRepository.save(shift);
        return mapToResponse(saved);
    }

    @Transactional
    public void deleteShift(Long ownerId, Long shiftId) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = owner.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Owner must complete shop setup");
        }

        WorkShift shift = workShiftRepository.findById(shiftId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Shift not found"));

        if (!shift.getShop().getId().equals(shop.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to delete this shift");
        }

        workShiftRepository.delete(shift);
    }

    @Transactional(readOnly = true)
    public List<WorkShiftResponse> getShiftsByDateRange(Long userId, String role, LocalDate startDate, LocalDate endDate) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Shop shop = user.getShop();
        if (shop == null) {
            return List.of();
        }

        List<WorkShift> shifts = workShiftRepository.findByShopIdAndShiftDateBetweenOrderByShiftDateAscStartTimeAsc(
                shop.getId(), startDate, endDate);

        // STAFF can only see shifts they are assigned to
        if ("STAFF".equals(role)) {
            shifts = shifts.stream()
                    .filter(shift -> shift.getAssignedStaff().stream()
                            .anyMatch(s -> s.getId().equals(userId)))
                    .collect(Collectors.toList());
        }

        return shifts.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    private void assignStaffToShift(WorkShift shift, Long shopId, List<Long> staffIds) {
        if (staffIds == null || staffIds.isEmpty()) {
            shift.setAssignedStaff(new HashSet<>());
            return;
        }

        List<User> staffList = userRepository.findAllById(staffIds);
        for (User staff : staffList) {
            if (staff.getShop() == null || !staff.getShop().getId().equals(shopId)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Staff ID " + staff.getId() + " does not belong to this shop");
            }
            if (staff.getRole() != User.UserRole.STAFF) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "User ID " + staff.getId() + " is not a STAFF member");
            }
        }
        shift.setAssignedStaff(new HashSet<>(staffList));
    }

    private WorkShiftResponse mapToResponse(WorkShift shift) {
        List<ShiftStaffDto> staffDtos = shift.getAssignedStaff().stream()
                .map(u -> ShiftStaffDto.builder()
                        .id(u.getId())
                        .fullName(u.getFullName())
                        .username(u.getUsername())
                        .email(u.getEmail())
                        .build())
                .collect(Collectors.toList());

        return WorkShiftResponse.builder()
                .id(shift.getId())
                .shiftDate(shift.getShiftDate())
                .startTime(shift.getStartTime())
                .endTime(shift.getEndTime())
                .name(shift.getName())
                .assignedStaff(staffDtos)
                .build();
    }
}
