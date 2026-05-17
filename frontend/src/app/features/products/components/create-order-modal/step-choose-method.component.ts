import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../data-access/models/product.model';
import { SelectedVariant } from './step-select-products.component';
import { OrderType } from '../../../orders/data-access/models/order.model';
import { TabManualFormComponent } from './tab-manual-form.component';
import { TabAiParseComponent } from './tab-ai-parse.component';
import { TabLinkFormComponent } from './tab-link-form.component';

export type CreateMethod = 'MANUAL' | 'AI_PARSE' | 'PUBLIC_FORM';

@Component({
  selector: 'app-step-choose-method',
  standalone: true,
  imports: [
    CommonModule, 
    TabManualFormComponent,
    TabAiParseComponent,
    TabLinkFormComponent
  ],
  template: `
    <div class="space-y-6">
      
      <!-- Method Tabs -->
      <div class="flex p-1 space-x-1 bg-[var(--color-surface-secondary)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
        <button
          *ngFor="let m of methods"
          (click)="method.set(m.id)"
          [class.bg-[var(--color-surface)]]="method() === m.id"
          [class.text-[var(--color-accent)]]="method() === m.id"
          [class.shadow-[var(--shadow-sm)]]="method() === m.id"
          [class.text-[var(--color-text-secondary)]]="method() !== m.id"
          [class.hover:text-[var(--color-text-primary)]]="method() !== m.id"
          [class.hover:bg-[var(--color-surface-hover)]]="method() !== m.id"
          class="w-full flex items-center justify-center gap-2 rounded-[var(--radius-sm)] py-2.5 text-sm font-medium leading-5 transition-all duration-200 outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
        >
          <i [class]="m.icon"></i>
          {{ m.name }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="mt-4">
        @if (method() === 'MANUAL') {
          <app-tab-manual-form
            [product]="product"
            [selectedOrderType]="selectedOrderType"
            [selectedVariants]="selectedVariants"
            (back)="back.emit()"
            (success)="success.emit($event)"
          />
        } @else if (method() === 'AI_PARSE') {
          <app-tab-ai-parse
            [product]="product"
            [selectedOrderType]="selectedOrderType"
            [selectedVariants]="selectedVariants"
            (back)="back.emit()"
            (success)="success.emit($event)"
          />
        } @else if (method() === 'PUBLIC_FORM') {
          <app-tab-link-form
            [product]="product"
            [selectedOrderType]="selectedOrderType"
            [selectedVariants]="selectedVariants"
            (back)="back.emit()"
          />
        }
      </div>

    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepChooseMethodComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) selectedOrderType: OrderType = 'SELL';
  @Input({ required: true }) selectedVariants: SelectedVariant[] = [];
  @Output() back = new EventEmitter<void>();
  @Output() success = new EventEmitter<string>();

  protected readonly method = signal<CreateMethod>('MANUAL');

  protected readonly methods: { id: CreateMethod, name: string, icon: string }[] = [
    { id: 'MANUAL', name: 'Nhập thủ công', icon: 'ri-keyboard-line' },
    { id: 'AI_PARSE', name: 'AI Parse Text', icon: 'ri-magic-line' },
    { id: 'PUBLIC_FORM', name: 'Tạo Link Form', icon: 'ri-links-line' }
  ];
}
