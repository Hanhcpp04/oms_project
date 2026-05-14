import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  selector: 'app-shop-onboarding-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shop-onboarding-page.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes fade-in-up {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .animate-fade-in-up {
      animation: fade-in-up 0.6s ease-out;
    }
  `]
})
export class ShopOnboardingPageComponent {
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly userName = computed(() => this.authStore.currentUser()?.fullName ?? 'bạn');
  protected readonly shopName = computed(() => this.authStore.currentShop()?.name ?? 'shop của bạn');
  protected readonly onboarding = this.authStore.onboarding;

  protected readonly showRegisteredBanner = computed(() => this.route.snapshot.queryParamMap.get('registered') === 'success');

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

  protected readonly progressPercent = computed(() =>
    Math.round((this.activeStepIndex() / this.setupSteps.length) * 100)
  );

  protected readonly nextStep = computed(() => {
    const index = Math.min(this.activeStepIndex(), this.setupSteps.length - 1);
    return this.setupSteps[index];
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

  protected getStepStatusLabel(index: number): string {
    const status = this.getStepStatus(index);

    if (status === 'done') {
      return 'Đã hoàn thành';
    }

    if (status === 'current') {
      return 'Đang thực hiện';
    }

    return 'Chờ bước này';
  }

  private normalizeStep(step: string | undefined): OnboardingStep {
    switch ((step ?? '').trim().toUpperCase()) {
      case 'BUSINESS_TYPE':
        return 'BUSINESS_TYPE';
      case 'CATEGORY':
        return 'CATEGORY';
      default:
        return 'SHOP_PROFILE';
    }
  }
}
