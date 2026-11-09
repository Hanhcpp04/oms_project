import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-product-empty-state',
  standalone: true,
  template: `
    <div
      class="grid min-h-[420px] place-items-center rounded-sm border border-dashed border-[#d1d5db] bg-white px-6 py-12 text-center"
    >
      <div class="grid max-w-sm place-items-center gap-4">
        <div class="grid h-14 w-14 place-items-center rounded-sm bg-[#f3f4f6] text-[#6b7280]">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m21 8-9-5-9 5 9 5 9-5Z" />
            <path d="m3 8 9 5 9-5" />
            <path d="M3 8v8l9 5 9-5V8" />
            <path d="M12 13v8" />
          </svg>
        </div>
        <div class="grid gap-1">
          <h2 class="m-0 text-lg font-bold text-[#111827]">Chưa có sản phẩm nào</h2>
          <p class="m-0 text-sm leading-6 text-[#6b7280]">
            Hãy thêm sản phẩm đầu tiên để bắt đầu quản lý kho.
          </p>
        </div>
        @if (canCreateProduct) {
          <button
            type="button"
            class="inline-flex h-11 items-center gap-2 rounded-sm bg-[#111827] px-4 text-sm font-semibold text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
            (click)="createProduct.emit()"
          >
            <span class="text-lg leading-none">+</span>
            Thêm sản phẩm
          </button>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductEmptyStateComponent {
  @Input() canCreateProduct = false;
  @Output() createProduct = new EventEmitter<void>();
}
