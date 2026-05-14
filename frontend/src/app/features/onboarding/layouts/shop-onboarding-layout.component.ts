import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';

type OnboardingStep = 'SHOP_PROFILE' | 'BUSINESS_TYPE' | 'CATEGORY';
type StepStatus = 'done' | 'current' | 'upcoming';

interface SetupStep {
  key: OnboardingStep;
  title: string;
  description: string;
  route: string;
}

@Component({
  selector: 'app-shop-onboarding-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './shop-onboarding-layout.component.html',
  host: { class: 'block min-h-screen bg-[var(--color-background)]' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [``]
})
export class ShopOnboardingLayoutComponent {
  private readonly authStore = inject(AuthStore);

  protected readonly userName = computed(() => this.authStore.currentUser()?.fullName ?? 'bạn');
  protected readonly shopName = computed(() => this.authStore.currentShop()?.name ?? 'shop của bạn');
  protected readonly onboarding = this.authStore.onboarding;

  protected readonly setupSteps: SetupStep[] = [
    {
      key: 'SHOP_PROFILE',
      title: 'Hồ sơ shop',
      description: 'Cập nhật tên shop, avatar, hotline, email và địa chỉ.',
      route: '/shop-setup/profile'
    },
    {
      key: 'BUSINESS_TYPE',
      title: 'Mô hình kinh doanh',
      description: 'Chọn mô hình bán hàng, cho thuê hoặc cả hai.',
      route: '/shop-setup/business-type'
    },
    {
      key: 'CATEGORY',
      title: 'Danh mục shop',
      description: 'Tạo danh mục sản phẩm ban đầu cho shop.',
      route: '/shop-setup/category'
    }
  ];

  protected readonly activeStepIndex = computed(() => {
    const onboarding = this.onboarding();

    if (onboarding?.completed) {
      return this.setupSteps.length;
    }

    const currentStep = this.normalizeStep(onboarding?.currentStep);
    const index = this.setupSteps.findIndex((step) => step.key === currentStep);

    return index >= 0 ? index : 0;
  });

  protected getStepStatus(index: number): StepStatus {
    const activeIndex = this.activeStepIndex();

    if (this.onboarding()?.completed || index < activeIndex) {
      return 'done';
    }

    if (index === activeIndex) {
      return 'current';
    }

    return 'upcoming';
  }

  private normalizeStep(step: string | undefined): OnboardingStep {
    switch ((step ?? '').trim().toUpperCase()) {
      case 'BUSINESS_TYPE': return 'BUSINESS_TYPE';
      case 'CATEGORY': return 'CATEGORY';
      default: return 'SHOP_PROFILE';
    }
  }
}
