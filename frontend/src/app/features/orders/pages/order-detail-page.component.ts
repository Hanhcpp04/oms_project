import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, finalize, interval, switchMap, takeUntil } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import {
  formatVndCurrency,
  formatVndCurrencyInput,
  parseVndCurrencyInput
} from '../../../shared/utils/currency.util';
import { formatPhoneDisplay, normalizePhoneDigits } from '../../../shared/utils/phone-format.util';
import { ORDER_STATUS_OPTIONS } from '../data-access/constants/order-status.constants';
import { Order, OrderProduct, OrderStatus, OrderType, PaymentStatus, UpdateOrderInput } from '../data-access/models/order.model';
import { OrdersApiService } from '../data-access/orders-api.service';
import { OrdersStore } from '../state/orders.store';
import {
  CustomFieldDisplayEntry,
  getOrderCustomFieldDisplayEntries
} from '../utils/order-custom-fields.util';
import { OrderPrintModalComponent } from './order-print-modal.component';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiBadgeComponent, UiButtonComponent, OrderPrintModalComponent],
  templateUrl: './order-detail-page.component.html',
  styleUrl: './order-detail-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersApiService = inject(OrdersApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  readonly store = inject(OrdersStore);
  readonly statusOptions = ORDER_STATUS_OPTIONS;
  private readonly destroy$ = new Subject<void>();
  private readonly paymentRefreshIntervalMs = 10000;

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly isPrintModalOpen = signal(false);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly editForm = signal<UpdateOrderInput>({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerNote: '',
    sourceChannel: '',
    shippingMethod: '',
    shippingFee: 0,
    paymentStatus: 'UNPAID',
    paymentMethod: undefined
  });

  protected readonly paymentStatusOptions: ReadonlyArray<{ label: string; value: PaymentStatus }> = [
    { label: 'Chưa thanh toán', value: 'UNPAID' },
    { label: 'Đã đặt cọc', value: 'DEPOSITED' },
    { label: 'Đã thanh toán', value: 'PAID' }
  ];

  protected readonly paymentMethodOptions: ReadonlyArray<{ label: string; value: NonNullable<UpdateOrderInput['paymentMethod']> }> = [
    { label: 'COD', value: 'COD' },
    { label: 'Chuyển khoản ngân hàng', value: 'BANK_TRANSFER' },
    { label: 'VNPay', value: 'VNPAY' }
  ];

  private readonly orderStatusTransitions: Record<OrderType, Record<OrderStatus, OrderStatus[]>> = {
    SELL: {
      NEW: ['CONFIRMED', 'CANCELLED'],
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PACKING', 'CANCELLED'],
      PACKING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DONE'],
      DONE: [],
      CANCELLED: [],
      DEPOSITED: [],
      PAID: [],
      RENTING: [],
      OVERDUE: [],
      RETURNED: []
    },
    RENT: {
      NEW: ['CONFIRMED', 'CANCELLED'],
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['DEPOSITED', 'RENTING', 'CANCELLED'],
      DEPOSITED: ['RENTING', 'CANCELLED'],
      RENTING: ['OVERDUE', 'RETURNED', 'DONE', 'CANCELLED'],
      OVERDUE: ['RETURNED', 'DONE', 'CANCELLED'],
      RETURNED: [],
      DONE: [],
      CANCELLED: [],
      PACKING: [],
      SHIPPED: [],
      PAID: []
    }
  };

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');

    if (!orderId) {
      this.notFound.set(true);
      return;
    }

    this.resolveOrder(orderId);
    this.startPaymentAutoRefresh(orderId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected goBack(): void {
    const type = this.normalizeType(this.route.snapshot.queryParamMap.get('type'));
    this.router.navigate(['/app/orders', type]);
  }

  protected createNewOrder(): void {
    this.router.navigate(['/app/products']);
  }

  protected openPrintModal(): void {
    this.isPrintModalOpen.set(true);
  }

  protected closePrintModal(): void {
    this.isPrintModalOpen.set(false);
  }

  protected startEditing(order: Order): void {
    this.syncEditForm(order);
    this.editing.set(true);
  }

  protected cancelEditing(order: Order): void {
    this.syncEditForm(order);
    this.editing.set(false);
  }

  protected async saveOrderDetails(): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    if (!this.canUpdateOrderDetails()) {
      this.notificationService.error('Bạn không có quyền cập nhật thông tin đơn hàng.');
      return;
    }

    try {
      this.saving.set(true);
      const form = this.editForm();
      let updatedOrder = await this.store.updateOrder(currentOrder.id, {
        ...form,
        shippingFee: Number(form.shippingFee ?? 0)
      });

      if (this.hasPaymentChanges(currentOrder, form)) {
        updatedOrder = await this.store.updatePayment(currentOrder.id, {
          paymentStatus: form.paymentStatus,
          paymentMethod: form.paymentMethod
        });
      }

      this.applyResolvedOrder(updatedOrder);
      this.editing.set(false);
      this.notificationService.success('Đã cập nhật thông tin đơn hàng');
    } catch {
      this.notificationService.error('Có lỗi xảy ra khi cập nhật thông tin đơn hàng');
    } finally {
      this.saving.set(false);
    }
  }

  protected updateEditForm(patch: Partial<UpdateOrderInput>): void {
    this.editForm.update((form) => ({ ...form, ...patch }));
  }

  protected updateShippingFeeInput(value: string): void {
    this.updateEditForm({ shippingFee: parseVndCurrencyInput(value) ?? 0 });
  }


  protected getPageTitle(): string {
    return this.order()?.orderNumber
      ? `Chi tiết đơn hàng #${this.order()!.orderNumber}`
      : 'Chi tiết đơn hàng';
  }

  protected getDisplayOrderNumber(order: Order): string {
    return order.orderNumber || order.orderCode || order.id;
  }

  protected getPageDescription(): string {
    const currentOrder = this.order();
    if (!currentOrder) {
      return 'Xem thông tin khách hàng, sản phẩm, thanh toán và trạng thái đơn hàng.';
    }

    return currentOrder.orderType === 'RENT'
      ? 'Thông tin đơn thuê, lịch thuê, thanh toán và trạng thái trả hàng.'
      : 'Thông tin đơn bán, thanh toán, vận chuyển và trạng thái xử lý.';
  }

  protected goToQrHistory(productId: string | number | undefined): void {
    if (!productId) return;
    this.router.navigate(['/app/products', productId, 'qr-history']);
  }

  protected canShowStatusActions(order: Order): boolean {
    return this.canUpdateOrderStatus() && this.getActionButtons(order).length > 0;
  }

  protected canShowPaymentActions(order: Order): boolean {
    return this.canEditPayment(order);
  }


  protected getActionButtons(order: Order): Array<{ label: string; variant: 'primary' | 'secondary' | 'danger'; busy: boolean; disabled: boolean; onClick: () => Promise<void> }> {
    const actions: Array<{ label: string; variant: 'primary' | 'secondary' | 'danger'; busy: boolean; disabled: boolean; onClick: () => Promise<void> }> = [];
    const allowed = this.getAllowedStatuses(order);

    if (allowed.includes('CONFIRMED')) {
      actions.push({ label: 'Xác nhận', variant: 'primary', busy: false, disabled: false, onClick: () => this.confirmOrder() });
    }
    if (allowed.includes('PACKING')) {
      actions.push({ label: 'Đóng gói', variant: 'secondary', busy: false, disabled: false, onClick: () => this.markPacking() });
    }
    if (allowed.includes('SHIPPED')) {
      actions.push({ label: 'Giao hàng', variant: 'primary', busy: false, disabled: false, onClick: () => this.markShipped() });
    }
    if (allowed.includes('DONE')) {
      actions.push({ label: 'Hoàn thành', variant: 'primary', busy: false, disabled: false, onClick: () => this.markDone() });
    }
    if (allowed.includes('DEPOSITED')) {
      actions.push({ label: 'Đã cọc', variant: 'secondary', busy: false, disabled: false, onClick: () => this.markDeposited() });
    }
    if (allowed.includes('RENTING')) {
      actions.push({ label: 'Đang thuê', variant: 'secondary', busy: false, disabled: false, onClick: () => this.markRenting() });
    }
    if (allowed.includes('OVERDUE')) {
      actions.push({ label: 'Quá hạn', variant: 'danger', busy: false, disabled: false, onClick: () => this.markOverdue() });
    }
    if (allowed.includes('RETURNED')) {
      actions.push({ label: 'Đã trả hàng', variant: 'primary', busy: false, disabled: false, onClick: () => this.markReturned() });
    }
    if (allowed.includes('CANCELLED')) {
      actions.push({ label: 'Hủy', variant: 'danger', busy: false, disabled: false, onClick: () => this.cancelOrder() });
    }

    return actions;
  }

  protected async confirmOrder(): Promise<void> {
    await this.runStatusAction((id) => this.store.confirmOrder(id), 'Đã xác nhận đơn hàng');
  }

  protected async markPacking(): Promise<void> {
    await this.runStatusAction((id) => this.store.markPacking(id), 'Đã chuyển đơn sang đóng gói');
  }

  protected async markShipped(): Promise<void> {
    await this.runStatusAction((id) => this.store.markShipped(id), 'Đã chuyển đơn sang giao hàng');
  }

  protected async markDone(): Promise<void> {
    await this.runStatusAction((id) => this.store.markDone(id), 'Đã hoàn thành đơn hàng');
  }

  protected async markDeposited(): Promise<void> {
    await this.runStatusAction((id) => this.store.markDeposited(id), 'Đã cập nhật đơn thuê sang trạng thái đã cọc');
  }

  protected async markRenting(): Promise<void> {
    await this.runStatusAction((id) => this.store.markRenting(id), 'Đã cập nhật đơn thuê sang đang thuê');
  }

  protected async markOverdue(): Promise<void> {
    await this.runStatusAction((id) => this.store.markOverdue(id), 'Đã cập nhật đơn thuê sang quá hạn');
  }

  protected async markReturned(): Promise<void> {
    await this.runStatusAction((id) => this.store.markReturned(id), 'Đã cập nhật đơn thuê sang đã trả hàng');
  }

  protected async cancelOrder(): Promise<void> {
    await this.runStatusAction((id) => this.store.cancelOrder(id), 'Đã hủy đơn hàng');
  }

  protected getStatusVariant(status: string): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'NEW': return 'primary';
      case 'CONFIRMED': return 'info';
      case 'PACKING': return 'info';
      case 'SHIPPED': return 'info';
      case 'DONE': return 'success';
      case 'CANCELLED': return 'danger';
      case 'DEPOSITED': return 'warning';
      case 'PAID': return 'success';
      case 'RENTING': return 'info';
      case 'OVERDUE': return 'danger';
      case 'RETURNED': return 'success';
      default: return 'primary';
    }
  }

  protected getActionStateLabel(order: Order): string {
    return order.orderType === 'SELL' ? 'Hành động xử lý đơn bán' : 'Hành động xử lý đơn thuê';
  }

  protected getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'Chờ duyệt';
      case 'NEW': return 'Mới';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PACKING': return 'Đang đóng gói';
      case 'SHIPPED': return 'Đã giao hàng';
      case 'DONE': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'DEPOSITED': return 'Đã cọc';
      case 'PAID': return 'Đã thanh toán';
      case 'RENTING': return 'Đang thuê';
      case 'OVERDUE': return 'Quá hạn';
      case 'RETURNED': return 'Đã trả hàng';
      default: return status;
    }
  }

  protected getFulfillmentStatusLabel(status?: string): string {
    switch (status) {
      case 'PENDING_CONFIRMATION': return 'Chờ xác nhận';
      case 'READY_TO_PACK': return 'Sẵn sàng đóng gói';
      case 'READY_TO_RENT': return 'Sẵn sàng bàn giao';
      case 'PACKING': return 'Đang đóng gói';
      case 'SHIPPED': return 'Đang giao';
      case 'DONE': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'DEPOSITED': return 'Đã cọc';
      case 'RENTING': return 'Đang thuê';
      case 'OVERDUE': return 'Quá hạn';
      case 'RETURNED': return 'Đã trả';
      case 'PAID': return 'Đã thanh toán';
      default: return status || 'Chưa xác định';
    }
  }

  protected getAllowedStatuses(order: Order): OrderStatus[] {
    return this.orderStatusTransitions[order.orderType]?.[order.status] ?? [];
  }

  protected isAllowedTransition(order: Order, status: OrderStatus): boolean {
    return this.getAllowedStatuses(order).includes(status) || order.status === status;
  }

  protected async runStatusAction(action: (id: string) => Promise<Order>, successMessage: string): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    if (!this.canUpdateOrderStatus()) {
      this.notificationService.error('Bạn không có quyền cập nhật trạng thái đơn hàng.');
      return;
    }

    try {
      this.loading.set(true);
      const updatedOrder = await action(currentOrder.id);
      this.applyResolvedOrder(updatedOrder);
      this.notificationService.success(successMessage);
    } catch {
      this.notificationService.error('Có lỗi xảy ra khi cập nhật trạng thái');
    } finally {
      this.loading.set(false);
    }
  }

  protected getOrderTypeLabel(type: OrderType): string {
    return type === 'RENT' ? 'Cho thuê' : 'Bán';
  }

  protected getSourceMethodLabel(method?: Order['sourceMethod']): string {
    switch (method) {
      case 'AI_PARSE': return 'AI Parse';
      case 'PUBLIC_FORM': return 'Public Form';
      case 'MESSENGER': return 'Messenger';
      case 'MANUAL': return 'Thủ công';
      default: return 'Thủ công';
    }
  }

  protected getPaymentMethodLabel(method?: string): string {
    switch (method) {
      case 'COD': return 'Thanh toán khi nhận hàng (COD)';
      case 'BANK_TRANSFER': return 'Chuyển khoản ngân hàng';
      case 'VNPAY': return 'Thanh toán qua VNPay';
      default: return 'Chưa chọn';
    }
  }

  protected getPaymentStatusLabel(status?: string): string {
    switch (status) {
      case 'PAID': return 'Đã thanh toán';
      case 'DEPOSITED': return 'Đã đặt cọc';
      case 'UNPAID': return 'Chưa thanh toán';
      default: return 'Chưa thanh toán';
    }
  }

  protected getResolvedPaymentStatus(order: Order): PaymentStatus {
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'DEPOSITED') {
      return order.paymentStatus;
    }

    if (order.status === 'PAID' || order.fulfillmentStatus === 'PAID') {
      return 'PAID';
    }

    if (order.status === 'DEPOSITED' || order.fulfillmentStatus === 'DEPOSITED') {
      return 'DEPOSITED';
    }

    return 'UNPAID';
  }

  protected getPaymentStatusDotClass(status?: string): string {
    switch (status) {
      case 'PAID': return 'bg-[#059669]';
      case 'DEPOSITED': return 'bg-[#f59e0b]';
      default: return 'bg-[#f59e0b]';
    }
  }

  protected getPaymentStatusTextClass(status?: string): string {
    switch (status) {
      case 'PAID': return 'text-[#047857]';
      case 'DEPOSITED': return 'text-[#92400e]';
      default: return 'text-[#111827]';
    }
  }

  protected formatCurrency(value: number): string {
    return formatVndCurrency(value ?? 0);
  }

  protected formatCurrencyInput(value: number | undefined): string {
    return formatVndCurrencyInput(value ?? 0);
  }

  protected formatPhone(phone: string | undefined): string {
    if (!phone) return 'Chưa có';
    return formatPhoneDisplay(normalizePhoneDigits(phone));
  }

  protected formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  protected hasCustomFields(order: Order): boolean {
    return this.getCustomFieldEntries(order).length > 0;
  }

  protected getCustomFieldEntries(order: Order): CustomFieldDisplayEntry[] {
    return getOrderCustomFieldDisplayEntries(order);
  }

  protected getSubtotal(order: Order): number {
    return order.products.reduce((total, product) => total + this.getLineTotal(product), 0);
  }

  protected getShippingFee(order: Order): number {
    return order.shippingFee ?? 0;
  }

  protected getDiscountAmount(): number {
    return 0;
  }

  protected getLineTotal(product: OrderProduct): number {
    return product.lineTotal && product.lineTotal > 0
      ? product.lineTotal
      : product.unitPrice * product.quantity;
  }

  protected getProductName(product: OrderProduct): string {
    return product.productNameSnapshot || product.name || 'Sản phẩm';
  }

  protected getProductInitial(product: OrderProduct): string {
    return this.getProductName(product).trim().charAt(0).toUpperCase() || 'P';
  }

  protected getCustomerInitial(order: Order): string {
    return (order.customerName || 'Khách hàng').trim().charAt(0).toUpperCase() || 'K';
  }

  protected hasProductVariantMeta(product: OrderProduct): boolean {
    return Boolean(
      product.size ||
      product.variantSizeSnapshot ||
      product.variantColorSnapshot ||
      product.skuSnapshot
    );
  }

  protected getPrimaryProductImage(order: Order): string | undefined {
    return order.products.find((product) => product.productImageSnapshot)?.productImageSnapshot;
  }

  protected getTimelineItems(
    order: Order
  ): Array<{ title: string; time?: string; actor: string; active: boolean }> {
    const actor = order.createdByFullName || order.createdByUsername || 'Hệ thống';
    const items: Array<{ title: string; time?: string; actor: string; active: boolean }> = [
      {
        title: 'Đơn hàng được tạo',
        time: order.createdAt,
        actor,
        active: true
      }
    ];

    if (order.updatedAt && order.updatedAt !== order.createdAt) {
      items.push({
        title: `Cập nhật trạng thái: ${this.getStatusLabel(order.status)}`,
        time: order.updatedAt,
        actor: 'Hệ thống',
        active: false
      });
    }

    return items;
  }

  protected canUpdateOrderStatus(): boolean {
    return this.permissionService.hasPermission('ORDER_UPDATE_STATUS');
  }

  protected canUpdateOrderDetails(): boolean {
    return this.permissionService.hasPermission('ORDER_UPDATE_STATUS');
  }

  protected canEditPayment(order: Order): boolean {
    return this.canUpdateOrderDetails() && order.status !== 'CANCELLED' && order.status !== 'DONE';
  }

  protected canSetUnpaid(order: Order): boolean {
    return this.canEditPayment(order) && this.getResolvedPaymentStatus(order) !== 'UNPAID';
  }

  protected canSetDeposited(order: Order): boolean {
    return this.canEditPayment(order) && this.getResolvedPaymentStatus(order) !== 'DEPOSITED';
  }

  protected canSetPaid(order: Order): boolean {
    return this.canEditPayment(order) && this.getResolvedPaymentStatus(order) !== 'PAID';
  }

  protected async setPaymentStatus(paymentStatus: PaymentStatus): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    if (!this.canEditPayment(currentOrder)) {
      this.notificationService.error('Bạn không có quyền cập nhật thanh toán.');
      return;
    }

    try {
      this.loading.set(true);
      const updatedOrder = await this.store.updatePayment(currentOrder.id, {
        paymentStatus,
        paymentMethod: this.editForm().paymentMethod
      });
      this.applyResolvedOrder(updatedOrder);
      this.notificationService.success('Đã cập nhật thanh toán');
    } catch {
      this.notificationService.error('Có lỗi xảy ra khi cập nhật thanh toán');
    } finally {
      this.loading.set(false);
    }
  }

  private resolveOrder(orderId: string): void {
    const cachedOrder = this.findOrderFromStore(orderId);

    if (cachedOrder) {
      this.applyResolvedOrder(cachedOrder);
      this.refreshOrderFromApi(orderId, false);
      return;
    }

    this.refreshOrderFromApi(orderId, true);
  }

  private refreshOrderFromApi(orderId: string, showLoading: boolean): void {
    if (showLoading) {
      this.loading.set(true);
    }

    this.ordersApiService
      .getById(orderId)
      .pipe(finalize(() => {
        if (showLoading) {
          this.loading.set(false);
        }
      }))
      .subscribe({
        next: (order) => {
          this.applyResolvedOrder(order);
        },
        error: () => {
          if (!this.order()) {
            this.notFound.set(true);
          }
        }
      });
  }

  private startPaymentAutoRefresh(orderId: string): void {
    interval(this.paymentRefreshIntervalMs)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => {
          if (!this.shouldRefreshPaymentStatus()) {
            return EMPTY;
          }

          return this.ordersApiService.getById(orderId).pipe(catchError(() => EMPTY));
        })
      )
      .subscribe((order) => {
        this.applyResolvedOrder(order);
      });
  }

  private shouldRefreshPaymentStatus(): boolean {
    const currentOrder = this.order();
    if (!currentOrder) {
      return false;
    }

    if (currentOrder.status === 'CANCELLED' || currentOrder.status === 'RETURNED') {
      return false;
    }

    return this.isAsyncPaymentMethod(currentOrder.paymentMethod)
      && this.getResolvedPaymentStatus(currentOrder) !== 'PAID';
  }

  private isAsyncPaymentMethod(method: Order['paymentMethod']): boolean {
    return method === 'BANK_TRANSFER' || method === 'VNPAY';
  }

  private applyResolvedOrder(order: Order): void {
    this.order.set(order);
    if (!this.editing()) {
      this.syncEditForm(order);
    }
    this.notFound.set(false);
    this.store.selectOrder(order);
  }

  private hasPaymentChanges(order: Order, form: UpdateOrderInput): boolean {
    return form.paymentStatus !== this.getResolvedPaymentStatus(order)
      || form.paymentMethod !== order.paymentMethod;
  }

  private findOrderFromStore(orderId: string): Order | null {
    const selected = this.store.selectedOrder();

    if (selected?.id === orderId) {
      return selected;
    }

    return this.store.getOrderById(orderId);
  }

  private normalizeType(value: string | null): 'all' | 'rent' | 'sell' {
    if (value === 'rent' || value === 'sell' || value === 'all') {
      return value;
    }

    const orderType = this.order()?.orderType;

    if (orderType === 'RENT') {
      return 'rent';
    }

    if (orderType === 'SELL') {
      return 'sell';
    }

    return 'all';
  }

  private syncEditForm(order: Order): void {
    this.editForm.set({
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      customerAddress: order.customerAddress || '',
      customerNote: order.customerNote || '',
      sourceChannel: order.sourceChannel || '',
      shippingMethod: order.shippingMethod || '',
      shippingFee: order.shippingFee ?? 0,
      paymentStatus: this.getResolvedPaymentStatus(order),
      paymentMethod: order.paymentMethod
    });
  }
}
