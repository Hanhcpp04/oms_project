import { inject, Injectable, signal } from '@angular/core';
import { CreateOrderInput, Order, OrderStatus, OrderType, OrdersQuery, UpdateOrderInput } from '../data-access/models/order.model';
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
          this.syncOrder(updatedOrder);
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

  confirmOrder(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.confirm(id));
  }

  markPacking(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.markPacking(id));
  }

  markShipped(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.markShipped(id));
  }

  markDone(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.markDone(id));
  }

  markDeposited(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.markDeposited(id));
  }

  markRenting(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.markRenting(id));
  }

  markOverdue(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.markOverdue(id));
  }

  markReturned(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.markReturned(id));
  }

  cancelOrder(orderId: string): Promise<Order> {
    return this.invokeStatusAction(orderId, (id) => this.api.cancel(id));
  }

  updateOrder(orderId: string, input: UpdateOrderInput): Promise<Order> {
    return new Promise((resolve, reject) => {
      this.loadingState.set(true);
      this.api.update(orderId, input).subscribe({
        next: (updatedOrder) => {
          this.syncOrder(updatedOrder);
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

  updatePayment(orderId: string, input: { paymentStatus?: Order['paymentStatus']; paymentMethod?: Order['paymentMethod'] }): Promise<Order> {
    return new Promise((resolve, reject) => {
      this.loadingState.set(true);
      this.api.updatePayment(orderId, input).subscribe({
        next: (updatedOrder) => {
          this.syncOrder(updatedOrder);
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

  private invokeStatusAction(orderId: string, action: (id: string) => import('rxjs').Observable<Order>): Promise<Order> {
    return new Promise((resolve, reject) => {
      this.loadingState.set(true);
      action(orderId).subscribe({
        next: (updatedOrder) => {
          this.syncOrder(updatedOrder);
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

  private syncOrder(updatedOrder: Order): void {
    this.ordersState.update((orders) => orders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    if (this.selectedOrderState()?.id === updatedOrder.id) {
      this.selectedOrderState.set(updatedOrder);
    }
  }
}

