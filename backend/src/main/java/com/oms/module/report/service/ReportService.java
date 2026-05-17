package com.oms.module.report.service;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.oms.module.order.entity.Order;
import com.oms.module.report.dto.*;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.user.entity.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private final CriteriaBuilderFactory cbf;
    private final EntityManager em;
    private final ShopRepository shopRepository;

    // ==================== Full Dashboard Summary ====================

    public DashboardSummaryResponse getSummary(Long shopId) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found"));

        List<DashboardMetricDto> metrics = buildMetrics(shop, shopId);
        List<RecentOrderDto> recentOrders = getRecentOrders(shopId, 10);
        List<OrderStatusGroupDto> orderStatusGroups = getOrderStatusGroups(shopId);
        List<RevenuePointDto> weeklyRevenue = getWeeklyRevenue(shopId);
        List<EmployeeStatDto> employeeStats = getEmployeeStats(shopId);
        List<GrowthPointDto> growthData = getMonthlyGrowth(shopId);

        long totalWeekOrders = weeklyRevenue.stream().mapToLong(RevenuePointDto::getOrders).sum();
        long totalWeekRevenue = weeklyRevenue.stream()
                .map(RevenuePointDto::getRevenue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .longValue();

        return DashboardSummaryResponse.builder()
                .metrics(metrics)
                .recentOrders(recentOrders)
                .orderStatusGroups(orderStatusGroups)
                .weeklyRevenue(weeklyRevenue)
                .employeeStats(employeeStats)
                .growthData(growthData)
                .totalWeekOrders(totalWeekOrders)
                .totalWeekRevenue(totalWeekRevenue)
                .build();
    }

    // ==================== KPI Metrics ====================

    private List<DashboardMetricDto> buildMetrics(Shop shop, Long shopId) {
        List<DashboardMetricDto> metrics = new ArrayList<>();

        if (Boolean.TRUE.equals(shop.getEnableSell()) && Boolean.TRUE.equals(shop.getEnableRent())) {
            addSplitMetrics(metrics, shopId);
        } else if (Boolean.TRUE.equals(shop.getEnableSell())) {
            addSellOnlyMetrics(metrics, shopId);
        } else if (Boolean.TRUE.equals(shop.getEnableRent())) {
            addRentOnlyMetrics(metrics, shopId);
        }

        // Active staff count
        long activeStaff = countActiveStaff(shopId);
        metrics.add(DashboardMetricDto.builder()
                .label("Nhân viên hoạt động")
                .value(String.valueOf(activeStaff))
                .trend("Đang hoạt động")
                .trendDirection("neutral")
                .icon("👥")
                .build());

        return metrics;
    }

    private void addSplitMetrics(List<DashboardMetricDto> metrics, Long shopId) {
        // SELL completed
        long completedSell = countOrdersByTypeAndStatus(shopId, Order.OrderType.SELL, Order.OrderStatus.DONE);
        BigDecimal revSell = sumRevenueByTypeAndStatus(shopId, Order.OrderType.SELL, Order.OrderStatus.DONE);
        long openSell = countOpenOrdersByType(shopId, Order.OrderType.SELL);

        metrics.add(DashboardMetricDto.builder()
                .label("Đơn bán hoàn thành").value(String.valueOf(completedSell))
                .trend("Tổng đơn bán").trendDirection("neutral").icon("📦").build());
        metrics.add(DashboardMetricDto.builder()
                .label("Doanh thu bán").value(formatCurrency(revSell))
                .trend("Từ đơn hoàn thành").trendDirection("up").icon("💰").build());

        // RENT completed
        long completedRent = countOrdersByTypeAndStatus(shopId, Order.OrderType.RENT, Order.OrderStatus.DONE);
        BigDecimal revRent = sumRevenueByTypeAndStatus(shopId, Order.OrderType.RENT, Order.OrderStatus.DONE);
        long openRent = countOpenOrdersByType(shopId, Order.OrderType.RENT);

        metrics.add(DashboardMetricDto.builder()
                .label("Đơn thuê hoàn thành").value(String.valueOf(completedRent))
                .trend("Tổng đơn thuê").trendDirection("neutral").icon("🕒").build());
        metrics.add(DashboardMetricDto.builder()
                .label("Doanh thu thuê").value(formatCurrency(revRent))
                .trend("Từ đơn hoàn thành").trendDirection("up").icon("💵").build());
        metrics.add(DashboardMetricDto.builder()
                .label("Đơn đang mở (Bán/Thuê)").value(openSell + " / " + openRent)
                .trend("Đang xử lý").trendDirection("neutral").icon("⏳").build());
    }

    private void addSellOnlyMetrics(List<DashboardMetricDto> metrics, Long shopId) {
        long completed = countOrdersByTypeAndStatus(shopId, Order.OrderType.SELL, Order.OrderStatus.DONE);
        BigDecimal rev = sumRevenueByTypeAndStatus(shopId, Order.OrderType.SELL, Order.OrderStatus.DONE);
        long open = countOpenOrdersByType(shopId, Order.OrderType.SELL);

        metrics.add(DashboardMetricDto.builder()
                .label("Đơn bán hoàn thành").value(String.valueOf(completed))
                .trend("Tổng đơn").trendDirection("up").icon("✅").build());
        metrics.add(DashboardMetricDto.builder()
                .label("Doanh thu bán").value(formatCurrency(rev))
                .trend("Từ đơn hoàn thành").trendDirection("up").icon("💰").build());
        metrics.add(DashboardMetricDto.builder()
                .label("Đơn đang mở").value(String.valueOf(open))
                .trend("Cần xử lý").trendDirection("neutral").icon("📦").build());
    }

    private void addRentOnlyMetrics(List<DashboardMetricDto> metrics, Long shopId) {
        long completed = countOrdersByTypeAndStatus(shopId, Order.OrderType.RENT, Order.OrderStatus.DONE);
        BigDecimal rev = sumRevenueByTypeAndStatus(shopId, Order.OrderType.RENT, Order.OrderStatus.DONE);
        long open = countOpenOrdersByType(shopId, Order.OrderType.RENT);

        metrics.add(DashboardMetricDto.builder()
                .label("Đơn thuê hoàn thành").value(String.valueOf(completed))
                .trend("Tổng đơn").trendDirection("up").icon("🕒").build());
        metrics.add(DashboardMetricDto.builder()
                .label("Doanh thu thuê").value(formatCurrency(rev))
                .trend("Từ đơn hoàn thành").trendDirection("up").icon("💵").build());
        metrics.add(DashboardMetricDto.builder()
                .label("Đơn đang mở").value(String.valueOf(open))
                .trend("Cần xử lý").trendDirection("neutral").icon("⌛").build());
    }

    // ==================== Blaze Persistence Queries ====================

    /**
     * COUNT orders by type and status using Blaze Persistence.
     */
    private long countOrdersByTypeAndStatus(Long shopId, Order.OrderType type, Order.OrderStatus status) {
        Long result = cbf.create(em, Long.class)
                .from(Order.class, "o")
                .select("COUNT(o)")
                .where("o.shop.id").eq(shopId)
                .where("o.orderType").eq(type)
                .where("o.status").eq(status)
                .getSingleResult();
        return result != null ? result : 0L;
    }

    /**
     * SUM revenue by type and status using Blaze Persistence.
     */
    private BigDecimal sumRevenueByTypeAndStatus(Long shopId, Order.OrderType type, Order.OrderStatus status) {
        BigDecimal result = cbf.create(em, BigDecimal.class)
                .from(Order.class, "o")
                .select("COALESCE(SUM(o.totalAmount), 0)")
                .where("o.shop.id").eq(shopId)
                .where("o.orderType").eq(type)
                .where("o.status").eq(status)
                .getSingleResult();
        return result != null ? result : BigDecimal.ZERO;
    }

    /**
     * COUNT open orders (not DONE, CANCELLED, RETURNED) by type.
     */
    private long countOpenOrdersByType(Long shopId, Order.OrderType type) {
        Long result = cbf.create(em, Long.class)
                .from(Order.class, "o")
                .select("COUNT(o)")
                .where("o.shop.id").eq(shopId)
                .where("o.orderType").eq(type)
                .where("o.status").notIn(Order.OrderStatus.DONE, Order.OrderStatus.CANCELLED, Order.OrderStatus.RETURNED)
                .getSingleResult();
        return result != null ? result : 0L;
    }

    /**
     * COUNT active staff in shop.
     */
    private long countActiveStaff(Long shopId) {
        Long result = cbf.create(em, Long.class)
                .from(com.oms.module.user.entity.User.class, "u")
                .select("COUNT(u)")
                .where("u.shop.id").eq(shopId)
                .where("u.isActive").eq(true)
                .where("u.role").eq(com.oms.module.user.entity.User.UserRole.STAFF)
                .getSingleResult();
        return result != null ? result : 0L;
    }

    /**
     * Recent orders - last N orders for the shop, sorted by createdAt DESC.
     */
    private List<RecentOrderDto> getRecentOrders(Long shopId, int limit) {
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");

        List<Tuple> results = cbf.create(em, Tuple.class)
                .from(Order.class, "o")
                .select("o.id")
                .select("o.orderCode")
                .select("o.customerName")
                .select("o.status")
                .select("o.totalAmount")
                .select("o.createdAt")
                .select("o.orderType")
                .select("o.sourceMethod")
                .select("o.paymentStatus")
                .where("o.shop.id").eq(shopId)
                .orderByDesc("o.createdAt")
                .setMaxResults(limit)
                .getResultList();

        return results.stream().map(t -> {
            LocalDateTime createdAt = t.get(5, LocalDateTime.class);
            String createdAtStr = createdAt != null ? createdAt.format(timeFormatter) : "";

            return RecentOrderDto.builder()
                    .id(t.get(0, Long.class))
                    .orderNumber(t.get(1, String.class))
                    .customerName(t.get(2, String.class))
                    .status(t.get(3, Order.OrderStatus.class).name())
                    .total(t.get(4, BigDecimal.class))
                    .createdAt(createdAtStr)
                    .orderType(t.get(6, Order.OrderType.class).name())
                    .sourceMethod(t.get(7, Order.SourceMethod.class).name())
                    .paymentStatus(t.get(8, Order.PaymentStatus.class).name())
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * Order status distribution - count orders per status for the shop.
     */
    private List<OrderStatusGroupDto> getOrderStatusGroups(Long shopId) {
        List<Tuple> results = cbf.create(em, Tuple.class)
                .from(Order.class, "o")
                .select("o.status")
                .select("COUNT(o)")
                .where("o.shop.id").eq(shopId)
                .groupBy("o.status")
                .orderByDesc("COUNT(o)")
                .getResultList();

        long totalOrders = results.stream().mapToLong(t -> t.get(1, Long.class)).sum();

        Map<String, String> statusLabels = Map.ofEntries(
                Map.entry("PENDING", "Chờ duyệt"),
                Map.entry("NEW", "Mới"),
                Map.entry("CONFIRMED", "Đã xác nhận"),
                Map.entry("PACKING", "Đang đóng gói"),
                Map.entry("SHIPPED", "Đang giao"),
                Map.entry("DONE", "Hoàn thành"),
                Map.entry("CANCELLED", "Đã hủy"),
                Map.entry("DEPOSITED", "Đã cọc"),
                Map.entry("PAID", "Đã thanh toán"),
                Map.entry("RENTING", "Đang thuê"),
                Map.entry("OVERDUE", "Quá hạn"),
                Map.entry("RETURNED", "Đã trả")
        );

        Map<String, String> statusColors = Map.ofEntries(
                Map.entry("PENDING", "#9ca3af"),
                Map.entry("NEW", "#3b82f6"),
                Map.entry("CONFIRMED", "#8b5cf6"),
                Map.entry("PACKING", "#f59e0b"),
                Map.entry("SHIPPED", "#10b981"),
                Map.entry("DONE", "#059669"),
                Map.entry("CANCELLED", "#ef4444"),
                Map.entry("DEPOSITED", "#d97706"),
                Map.entry("PAID", "#16a34a"),
                Map.entry("RENTING", "#06b6d4"),
                Map.entry("OVERDUE", "#dc2626"),
                Map.entry("RETURNED", "#6b7280")
        );

        return results.stream().map(t -> {
            String statusName = t.get(0, Order.OrderStatus.class).name();
            long count = t.get(1, Long.class);
            double percentage = totalOrders > 0
                    ? BigDecimal.valueOf(count * 100.0 / totalOrders).setScale(1, RoundingMode.HALF_UP).doubleValue()
                    : 0;

            return OrderStatusGroupDto.builder()
                    .status(statusName)
                    .label(statusLabels.getOrDefault(statusName, statusName))
                    .count(count)
                    .percentage(percentage)
                    .color(statusColors.getOrDefault(statusName, "#6b7280"))
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * Weekly revenue: revenue and order count per day of the current week (Mon-Sun).
     */
    private List<RevenuePointDto> getWeeklyRevenue(Long shopId) {
        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate sunday = monday.plusDays(6);

        LocalDateTime weekStart = monday.atStartOfDay();
        LocalDateTime weekEnd = sunday.atTime(LocalTime.MAX);

        List<Tuple> results = cbf.create(em, Tuple.class)
                .from(Order.class, "o")
                .select("FUNCTION('DAYOFWEEK', o.createdAt)")  // MySQL: 1=Sun,2=Mon,...,7=Sat
                .select("COALESCE(SUM(o.totalAmount), 0)")
                .select("COUNT(o)")
                .where("o.shop.id").eq(shopId)
                .where("o.createdAt").ge(weekStart)
                .where("o.createdAt").le(weekEnd)
                .groupBy("FUNCTION('DAYOFWEEK', o.createdAt)")
                .orderByAsc("FUNCTION('DAYOFWEEK', o.createdAt)")
                .getResultList();

        // Build map: MySQL DAYOFWEEK -> data
        Map<Integer, Tuple> dayMap = new HashMap<>();
        for (Tuple t : results) {
            int dow = ((Number) t.get(0)).intValue();
            dayMap.put(dow, t);
        }

        // MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ... 7=Saturday
        // We want Mon-Sun order: 2,3,4,5,6,7,1
        int[] mysqlDays = {2, 3, 4, 5, 6, 7, 1};
        String[] dayLabels = {"T2", "T3", "T4", "T5", "T6", "T7", "CN"};

        List<RevenuePointDto> weeklyData = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            Tuple t = dayMap.get(mysqlDays[i]);
            BigDecimal revenue = t != null ? (BigDecimal) t.get(1) : BigDecimal.ZERO;
            long orders = t != null ? ((Number) t.get(2)).longValue() : 0L;

            weeklyData.add(RevenuePointDto.builder()
                    .label(dayLabels[i])
                    .revenue(revenue)
                    .orders(orders)
                    .build());
        }

        return weeklyData;
    }

    /**
     * Employee stats for all staff in the shop.
     *
     * Orders are aggregated separately and merged into the staff list so employees
     * with no orders still appear with zero totals.
     */
    private List<EmployeeStatDto> getEmployeeStats(Long shopId) {
        List<Tuple> staffRows = cbf.create(em, Tuple.class)
                .from(User.class, "u")
                .select("u.id")
                .select("u.fullName")
                .where("u.shop.id").eq(shopId)
                .where("u.role").eq(User.UserRole.STAFF)
                .orderByAsc("u.fullName")
                .getResultList();

        if (staffRows.isEmpty()) {
            return List.of();
        }

        List<Tuple> aggregateRows = cbf.create(em, Tuple.class)
                .from(Order.class, "o")
                .select("o.createdBy.id")
                .select("COUNT(o)")
                .select("COALESCE(SUM(o.totalAmount), 0)")
                .where("o.shop.id").eq(shopId)
                .where("o.createdBy.id").isNotNull()
                .where("o.createdBy.role").eq(User.UserRole.STAFF)
                .where("o.status").notIn(Order.OrderStatus.CANCELLED)
                .groupBy("o.createdBy.id")
                .getResultList();

        Map<Long, Tuple> aggregateByStaffId = aggregateRows.stream()
                .collect(Collectors.toMap(t -> t.get(0, Long.class), t -> t));

        return staffRows.stream().map(t -> {
            Long staffId = t.get(0, Long.class);
            String fullName = t.get(1, String.class);
            String initials = buildInitials(fullName);
            Tuple aggregate = aggregateByStaffId.get(staffId);
            long ordersHandled = aggregate != null ? ((Number) aggregate.get(1)).longValue() : 0L;
            BigDecimal revenue = aggregate != null ? (BigDecimal) aggregate.get(2) : BigDecimal.ZERO;

            return EmployeeStatDto.builder()
                    .id(staffId)
                    .name(fullName)
                    .avatarInitials(initials)
                    .ordersHandled(ordersHandled)
                    .revenue(revenue)
                    .build();
        })
                .sorted(Comparator
                        .comparing(EmployeeStatDto::getRevenue, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(EmployeeStatDto::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .collect(Collectors.toList());
    }

    /**
     * Monthly growth data: last 12 months of revenue and order count.
     */
    private List<GrowthPointDto> getMonthlyGrowth(Long shopId) {
        LocalDate now = LocalDate.now();
        LocalDate startDate = now.minusMonths(11).withDayOfMonth(1);
        LocalDateTime startDateTime = startDate.atStartOfDay();

        List<Tuple> results = cbf.create(em, Tuple.class)
                .from(Order.class, "o")
                .select("FUNCTION('YEAR', o.createdAt)")
                .select("FUNCTION('MONTH', o.createdAt)")
                .select("COALESCE(SUM(o.totalAmount), 0)")
                .select("COUNT(o)")
                .where("o.shop.id").eq(shopId)
                .where("o.createdAt").ge(startDateTime)
                .where("o.status").notIn(Order.OrderStatus.CANCELLED)
                .groupBy("FUNCTION('YEAR', o.createdAt)", "FUNCTION('MONTH', o.createdAt)")
                .orderByAsc("FUNCTION('YEAR', o.createdAt)")
                .orderByAsc("FUNCTION('MONTH', o.createdAt)")
                .getResultList();

        // Build a complete 12-month timeline with zeros for missing months
        Map<String, Tuple> monthMap = new HashMap<>();
        for (Tuple t : results) {
            int year = ((Number) t.get(0)).intValue();
            int month = ((Number) t.get(1)).intValue();
            monthMap.put(year + "-" + month, t);
        }

        List<GrowthPointDto> growthData = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            LocalDate monthDate = startDate.plusMonths(i);
            String key = monthDate.getYear() + "-" + monthDate.getMonthValue();
            Tuple t = monthMap.get(key);

            BigDecimal revenue = t != null ? (BigDecimal) t.get(2) : BigDecimal.ZERO;
            long orders = t != null ? ((Number) t.get(3)).longValue() : 0L;

            growthData.add(GrowthPointDto.builder()
                    .month("T" + monthDate.getMonthValue())
                    .revenue(revenue)
                    .orders(orders)
                    .build());
        }

        return growthData;
    }

    // ==================== Helpers ====================

    private String formatCurrency(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) == 0) return "0 ₫";
        NumberFormat formatter = NumberFormat.getCurrencyInstance(new Locale("vi", "VN"));
        return formatter.format(amount);
    }

    private String buildInitials(String fullName) {
        if (fullName == null || fullName.isBlank()) return "??";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
        return (parts[0].charAt(0) + "" + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
}
