import { computed, inject, Injectable, signal } from '@angular/core';
import { CreateOrderInput, Order, OrderStatus, OrderType, OrdersQuery } from '../data-access/models/order.model';
import { OrdersApiService } from '../data-access/orders-api.service';

@Injectable({ providedIn: 'root' })
export class OrdersStore {
  private readonly api = inject(OrdersApiService);

  private readonly ordersState = signal<Order[]>([]);
  private readonly loadingState = signal(false);
  private readonly selectedOrderState = signal<Order | null>(null);
  private readonly queryState = signal<OrdersQuery>({ page: 0, size: 20 });
  private readonly totalElementsState = signal(0);

  readonly orders = this.ordersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly selectedOrder = this.selectedOrderState.asReadonly();
  readonly orderCount = this.totalElementsState.asReadonly();

  loadOrders(partialQuery: Partial<OrdersQuery> = {}): void {
    const query = { ...this.queryState(), ...partialQuery };
    this.queryState.set(query);
    this.loadingState.set(true);

    this.api.list(query).subscribe({
      next: (res) => {
        this.ordersState.set(res.content);
        this.totalElementsState.set(res.totalElements);
        this.loadingState.set(false);
      },
      error: () => {
        this.loadingState.set(false);
      }
    });
  }

  selectOrder(order: Order | null): void {
    this.selectedOrderState.set(order);
  }

  // Returns a promise so the UI can await the creation
  createOrder(input: CreateOrderInput): Promise<Order> {
    return new Promise((resolve, reject) => {
      this.loadingState.set(true);
      this.api.create(input).subscribe({
        next: (created) => {
          this.loadingState.set(false);
          this.refresh();
          resolve(created);
        },
        error: (err) => {
          this.loadingState.set(false);
          reject(err);
        }
      });
    });
  }

  getOrderById(orderId: string): Order | null {
    // We don't have a sync way to get by ID from API here, so we return from state if available
    return this.ordersState().find((order) => order.id === orderId) ?? null;
  }

  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    return new Promise((resolve, reject) => {
      this.loadingState.set(true);
      this.api.updateStatus(orderId, status).subscribe({
        next: (updatedOrder) => {
          // Update order in list
          this.ordersState.update(orders => 
            orders.map(o => o.id === orderId ? updatedOrder : o)
          );
          // Update selected order if it's the current one
          if (this.selectedOrderState()?.id === orderId) {
            this.selectedOrderState.set(updatedOrder);
          }
          this.loadingState.set(false);
          resolve(updatedOrder);
        },
        error: (err) => {
          this.loadingState.set(false);
          reject(err);
        }
      });
    });
  }

  refresh(): void {
    this.loadOrders(this.queryState());
  }
}

