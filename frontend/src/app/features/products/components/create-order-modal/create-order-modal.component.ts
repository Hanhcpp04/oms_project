import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiModalComponent } from '../../../../shared/components/ui/ui-modal.component';
import { Product } from '../../data-access/models/product.model';
import { OrderType } from '../../../orders/data-access/models/order.model';
import { StepSelectProductsComponent } from './step-select-products.component';
import { StepChooseMethodComponent } from './step-choose-method.component';

export type CreateOrderStep = 'SELECT_PRODUCTS' | 'CHOOSE_METHOD';

@Component({
  selector: 'app-create-order-modal',
  standalone: true,
  imports: [
    CommonModule,
    UiModalComponent,
    StepSelectProductsComponent,
    StepChooseMethodComponent
  ],
  template: `
    @if (isOpen) {
      <app-ui-modal
        [title]="step() === 'SELECT_PRODUCTS' ? 'Chọn biến thể & Số lượng' : 'Phương thức tạo đơn'"
        maxWidthClass="max-w-4xl"
        (closed)="close.emit()"
      >
        <div class="p-6">
          @if (step() === 'SELECT_PRODUCTS') {
          <app-step-select-products
            [product]="product"
            [selectedOrderType]="selectedOrderType()"
            [selectedVariants]="selectedVariants()"
            (selectionChange)="selectedVariants.set($event)"
            (orderTypeChange)="onOrderTypeChange($event)"
            (next)="goToMethodStep()"
          />
        } @else {
          <app-step-choose-method
            [product]="product"
            [selectedOrderType]="selectedOrderType()"
            [selectedVariants]="selectedVariants()"
            (back)="step.set('SELECT_PRODUCTS')"
            (success)="handleSuccess($event)"
          />
          }
        </div>
      </app-ui-modal>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateOrderModalComponent implements OnChanges {
  @Input({ required: true }) isOpen = false;
  @Input({ required: true }) product!: Product;
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<string>(); // returns orderId

  protected readonly step = signal<CreateOrderStep>('SELECT_PRODUCTS');
  protected readonly selectedVariants = signal<Array<{ variantId: string | number, name: string, size: string, quantity: number, unitPrice: number }>>([]);
  protected readonly selectedOrderType = signal<OrderType>('SELL');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.selectedOrderType.set(this.getDefaultOrderType());
      this.selectedVariants.set([]);
      this.step.set('SELECT_PRODUCTS');
    }
  }

  goToMethodStep(): void {
    if (this.selectedVariants().length > 0) {
      this.step.set('CHOOSE_METHOD');
    }
  }

  handleSuccess(orderId: string): void {
    this.created.emit(orderId);
    this.close.emit();
  }

  onOrderTypeChange(orderType: OrderType): void {
    this.selectedOrderType.set(orderType);
  }

  private getDefaultOrderType(): OrderType {
    return this.product?.productType === 'RENT' ? 'RENT' : 'SELL';
  }
}
