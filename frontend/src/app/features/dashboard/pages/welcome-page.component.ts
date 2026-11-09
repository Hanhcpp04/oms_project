import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { OrdersStore } from '../../orders/state/orders.store';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome-page.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WelcomePageComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly ordersStore = inject(OrdersStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly userName = computed(() => this.authStore.currentUser()?.fullName ?? 'ban');
  protected readonly shopName = computed(() => this.authStore.currentShop()?.name ?? 'shop cua ban');
  protected readonly onboarding = this.authStore.onboarding;
  protected readonly showGreeting = signal(true);
  protected readonly showRegisteredBanner = signal(false);

  protected readonly todayOrders = computed(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayPrefix = `${year}-${month}-${day}`;
    return this.ordersStore.orders().filter((o) => o.createdAt.startsWith(todayPrefix));
  });

  ngOnInit(): void {
    this.showRegisteredBanner.set(this.route.snapshot.queryParamMap.get('registered') === 'success');
    setTimeout(() => this.showGreeting.set(false), 2000);
  }

  protected formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }
}
