import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { AppNotificationService } from '../../../core/services/app-notification.service';

import { HeaderComponent } from '../header/header.component';
import { LayoutNavItem } from '../layout.model';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './main-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly appNotificationService = inject(AppNotificationService);

  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileSidebarOpen = signal(false);
  protected readonly currentUserName = computed(() => this.authStore.currentUser()?.fullName ?? 'OMS User');
  protected readonly currentShopName = computed(() => this.authStore.currentShop()?.name ?? 'OMS Shop');

  protected readonly menuItems = computed<LayoutNavItem[]>(() => this.filterMenuItemsByShopMode(this.baseMenuItems));

  private readonly baseMenuItems: LayoutNavItem[] = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      requiredPermissions: ['REPORT_REVENUE'],
      children: [
        { label: 'Thống kê tất cả', route: '/app/dashboard/all' },
        { label: 'Thống kê nhân viên', route: '/app/dashboard/employees' },
        { label: 'Theo ngày', route: '/app/dashboard/day' },
        { label: 'Theo tháng', route: '/app/dashboard/month' },
        { label: 'Theo năm', route: '/app/dashboard/year' },
        { label: 'Từ ngày đến ngày', route: '/app/dashboard/range' }
      ]
    },
    {
      label: 'Đơn hàng',
      icon: 'orders',
      allowedRoles: ['SHOP_OWNER', 'STAFF'],
      requiredPermissions: ['ORDER_VIEW'],
      children: [
        { label: 'Tất cả đơn hàng', route: '/app/orders/all' },
        { label: 'Đơn cho thuê', route: '/app/orders/rent' },
        { label: 'Đơn bán', route: '/app/orders/sell' }
      ]
    },
    {
      label: 'Sản phẩm',
      icon: 'products',
      requiredPermissions: ['PRODUCT_VIEW'],
      children: [
        { label: 'Tất cả sản phẩm', route: '/app/products/all' },
        { label: 'Sản phẩm cho thuê', route: '/app/products/rent' },
        { label: 'Sản phẩm bán', route: '/app/products/sell' }
      ]
    },
    {
      label: 'Cấu hình form đơn hàng',
      icon: 'form-config',
      allowedRoles: ['SHOP_OWNER'],
      setupStepKeys: ['ORDER_CONFIG'],
      children: [
        { label: 'Form đơn cho thuê', route: '/app/form-config/rent' },
        { label: 'Form đơn bán', route: '/app/form-config/sell' }
      ]
    },
    {
      label: 'Thiết lập shop',
      icon: 'shop-settings',
      allowedRoles: ['SHOP_OWNER'],
      setupStepKeys: ['BASIC_INFO', 'BUSINESS_TYPE', 'CATEGORY', 'ADDRESS', 'OPERATION_CONFIG', 'SUPPORT_CONTACT'],
      children: [
        { label: 'Hồ sơ shop', route: '/app/shop-settings/profile', setupStepKeys: ['BASIC_INFO', 'ADDRESS', 'OPERATION_CONFIG', 'SUPPORT_CONTACT'] },
        { label: 'Danh mục shop', route: '/app/shop-settings/category', setupStepKeys: ['CATEGORY'] },
        { label: 'Nhân viên', route: '/app/shop-settings/staff' },
        { label: 'Phân quyền', route: '/app/shop-settings/permissions' },
        { label: 'Loại hình kinh doanh', route: '/app/shop-settings/business-type', setupStepKeys: ['BUSINESS_TYPE'] },
        { label: 'Form tạo sản phẩm', route: '/app/shop-settings/product-form' },
        { label: 'Phương thức vận chuyển', route: '/app/shop-settings/shipping-methods' },
        { label: 'Nguồn đơn hàng', route: '/app/shop-settings/order-sources' },
        { label: 'Cấu hình thanh toán', route: '/app/shop-settings/payment-config' }
      ]
    }
  ];

  ngOnInit(): void {
    this.appNotificationService.loadLatest();
    this.appNotificationService.loadUnreadCount();
    this.appNotificationService.connect();
  }

  ngOnDestroy(): void {
    this.appNotificationService.disconnect();
  }

  protected onToggleSidebar(): void {
    this.sidebarCollapsed.update((state) => !state);
  }

  protected onToggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((state) => !state);
  }

  protected closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  protected onLogout(): void {
    this.authStore.logout();
  }

  private filterMenuItemsByShopMode(items: LayoutNavItem[]): LayoutNavItem[] {
    return items
      .filter((item) => this.isRouteVisibleForShopMode(item.route))
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => this.isRouteVisibleForShopMode(child.route))
      }))
      .filter((item) => !item.children || item.children.length > 0);
  }

  private isRouteVisibleForShopMode(route: string | undefined): boolean {
    if (!route) {
      return true;
    }

    const shop = this.authStore.currentShop();
    if (!shop) {
      return true;
    }

    if (route.endsWith('/rent') || route.endsWith('/dashboard/rent')) {
      return shop.enableRent;
    }

    if (route.endsWith('/sell') || route.endsWith('/dashboard/sell')) {
      return shop.enableSell;
    }

    return true;
  }
}
