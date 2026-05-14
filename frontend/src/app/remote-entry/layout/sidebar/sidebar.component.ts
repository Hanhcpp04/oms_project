import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutNavItem, LayoutNavChildItem } from '../layout.model';
import { AuthStore } from '../../../core/auth/auth.store';
import { ShopSetupStatusService, ShopSetupStepKey } from '../../../core/services/shop-setup-status.service';

type SetupAwareNavItem = LayoutNavItem | LayoutNavChildItem;
type SetupVisualState = 'missing' | null;

interface SetupReminderCard {
  key: ShopSetupStepKey;
  title: string;
  description: string;
  route: string;
}

@Component({
  selector: 'app-oms-sidebar',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  private static readonly HOME_ROUTE = '/app';

  @Input({ required: true }) menuItems: LayoutNavItem[] = [];
  @Input() collapsed = false;
  @Input() mobileOpen = false;

  @Output() closeMobile = new EventEmitter<void>();

  protected readonly expandedGroups = new Set<string>();
  protected readonly collapsedGroups = new Set<string>();

  private readonly authStore = inject(AuthStore);
  private readonly shopSetupStatusService = inject(ShopSetupStatusService);
  private lastSetupShopId: string | null = null;

  private readonly stepMeta: Record<ShopSetupStepKey, Omit<SetupReminderCard, 'key' | 'route'>> = {
    BASIC_INFO: {
      title: 'Bạn cần thiết lập thông tin shop',
      description: 'Bổ sung tên, email, số điện thoại và logo của shop.'
    },
    BUSINESS_TYPE: {
      title: 'Bạn cần chọn loại hình kinh doanh',
      description: 'Xác định shop bán hàng, cho thuê hoặc kết hợp cả hai.'
    },
    CATEGORY: {
      title: 'Bạn cần chọn danh mục sản phẩm',
      description: 'Chọn ngành hàng chính để cấu hình sản phẩm và storefront.'
    },
    ADDRESS: {
      title: 'Bạn cần thêm địa chỉ shop',
      description: 'Thiết lập địa chỉ lấy hàng và địa chỉ trả hàng nếu có thuê đồ.'
    },
    ORDER_CONFIG: {
      title: 'Bạn cần cấu hình form đơn hàng',
      description: 'Thiết lập các trường thông tin khách cần cung cấp khi đặt đơn.'
    },
    OPERATION_CONFIG: {
      title: 'Bạn cần cấu hình vận hành',
      description: 'Kiểm tra tự động nhận đơn, hiển thị tồn kho và thông báo.'
    },
    SUPPORT_CONTACT: {
      title: 'Bạn cần thêm liên hệ hỗ trợ',
      description: 'Bổ sung email và số điện thoại hỗ trợ để khách dễ liên hệ.'
    }
  };

  private readonly stepLabels: Record<ShopSetupStepKey, string> = {
    BASIC_INFO: 'Thông tin cơ bản',
    BUSINESS_TYPE: 'Loại hình kinh doanh',
    CATEGORY: 'Danh mục sản phẩm',
    ADDRESS: 'Địa chỉ shop',
    ORDER_CONFIG: 'Form đơn hàng',
    OPERATION_CONFIG: 'Cấu hình vận hành',
    SUPPORT_CONTACT: 'Liên hệ hỗ trợ'
  };

  protected readonly setupReminderCards = computed<SetupReminderCard[]>(() => {
    const status = this.shopSetupStatusService.status();

    if (!status || this.authStore.currentRole() !== 'SHOP_OWNER' || !this.authStore.currentShop()) {
      return [];
    }

    return status.missingSteps.map((key) => ({
      key,
      ...this.stepMeta[key],
      route: this.resolveSetupRoute(key)
    }));
  });

  protected readonly missingSetupCount = computed(() => this.setupReminderCards().length);

  protected readonly firstSetupReminderRoute = computed(() => this.setupReminderCards()[0]?.route ?? '/app/shop-settings/profile');

  protected readonly setupProgressLabel = computed(() => {
    const status = this.shopSetupStatusService.status();
    return status ? `${status.completedCount}/${status.totalSteps}` : '';
  });

  constructor(private readonly router: Router) {
    effect(() => {
      const shop = this.authStore.currentShop();
      const shouldLoad = this.authStore.currentRole() === 'SHOP_OWNER' && Boolean(shop);

      if (!shouldLoad) {
        this.lastSetupShopId = null;
        this.shopSetupStatusService.clear();
        return;
      }

      if (shop?.id && shop.id !== this.lastSetupShopId) {
        this.lastSetupShopId = shop.id;
        this.shopSetupStatusService.refresh();
      }
    });
  }

  protected hasChildren(item: LayoutNavItem): boolean {
    return (item.children?.length ?? 0) > 0;
  }

  protected isLocked(item: LayoutNavItem | LayoutNavChildItem): boolean {
    if (!item.allowedRoles || item.allowedRoles.length === 0) {
      return false;
    }
    return !this.authStore.hasAnyRole(item.allowedRoles);
  }

  protected isExpanded(item: LayoutNavItem): boolean {
    if (this.collapsedGroups.has(item.label)) {
      return false;
    }

    return this.expandedGroups.has(item.label) || this.isParentRouteActive(item);
  }

  protected toggleGroup(item: LayoutNavItem): void {
    if (!this.hasChildren(item)) {
      return;
    }

    if (this.collapsed) {
      const fallbackRoute = item.children?.[0]?.route;
      if (fallbackRoute) {
        this.collapsedGroups.delete(item.label);
        void this.router.navigateByUrl(fallbackRoute);
        this.onNavigate();
      }
      return;
    }

    if (this.isExpanded(item)) {
      this.expandedGroups.delete(item.label);
      this.collapsedGroups.add(item.label);

      if (!this.hasAnyExpandedGroup()) {
        void this.router.navigateByUrl(SidebarComponent.HOME_ROUTE);
        this.onNavigate();
      }

      return;
    }

    this.collapsedGroups.delete(item.label);
    this.expandedGroups.add(item.label);
  }

  protected onLogoClick(): void {
    this.expandedGroups.clear();
    this.collapsedGroups.clear();
    void this.router.navigateByUrl(SidebarComponent.HOME_ROUTE);
    this.onNavigate();
  }

  private hasAnyExpandedGroup(): boolean {
    return this.menuItems.some((item) => this.hasChildren(item) && this.isExpanded(item));
  }

  protected isParentRouteActive(item: LayoutNavItem): boolean {
    return item.children?.some((child) => this.router.isActive(child.route, false)) ?? false;
  }

  protected isChildRouteActive(child: LayoutNavChildItem): boolean {
    return this.router.isActive(child.route, { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' });
  }

  protected setupVisualState(item: SetupAwareNavItem): SetupVisualState {
    const keys = item.setupStepKeys ?? [];
    const status = this.shopSetupStatusService.status();

    if (!keys.length || !status || this.authStore.currentRole() !== 'SHOP_OWNER' || !this.authStore.currentShop()) {
      return null;
    }

    if (keys.some((key) => status.missingSteps.includes(key))) {
      return 'missing';
    }

    return null;
  }

  protected setupBadgeLabel(item: SetupAwareNavItem): string {
    const keys = item.setupStepKeys ?? [];
    const status = this.shopSetupStatusService.status();

    if (!keys.length || !status) {
      return '';
    }

    const completedCount = keys.filter((key) => status.completedSteps.includes(key)).length;
    return keys.length > 1 ? `${completedCount}/${keys.length}` : '';
  }

  protected setupTitle(item: SetupAwareNavItem): string {
    const visualState = this.setupVisualState(item);

    if (visualState !== 'missing') {
      return item.label;
    }

    const status = this.shopSetupStatusService.status();
    const missingLabels = (item.setupStepKeys ?? [])
      .filter((key) => status?.missingSteps.includes(key))
      .map((key) => this.stepLabels[key]);

    return missingLabels.length
      ? `${item.label} - còn thiếu: ${missingLabels.join(', ')}`
      : item.label;
  }

  private resolveSetupRoute(step: ShopSetupStepKey): string {
    if (step === 'BUSINESS_TYPE') {
      return '/app/shop-settings/business-type';
    }

    if (step === 'CATEGORY') {
      return '/app/shop-settings/category';
    }

    if (step === 'ORDER_CONFIG') {
      const shop = this.authStore.currentShop();
      return shop?.enableRent && !shop.enableSell ? '/app/form-config/rent' : '/app/form-config/sell';
    }

    return '/app/shop-settings/profile';
  }

  protected onNavigate(): void {
    this.closeMobile.emit();
  }
}
