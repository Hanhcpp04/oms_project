import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-product-detail-skeleton',
  standalone: true,
  template: `
    <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
      <div class="grid gap-3">
        <div class="aspect-square max-h-[560px] animate-pulse rounded-sm bg-[#e5e7eb]"></div>
        <div class="flex gap-2">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="h-20 w-20 animate-pulse rounded-sm bg-[#e5e7eb]"></div>
          }
        </div>
      </div>
      <div class="grid gap-4 rounded-sm border border-[#e5e7eb] bg-white p-5">
        <div class="h-8 w-40 animate-pulse rounded-full bg-[#e5e7eb]"></div>
        <div class="h-8 w-4/5 animate-pulse rounded bg-[#e5e7eb]"></div>
        <div class="h-20 animate-pulse rounded-sm bg-[#f3f4f6]"></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="h-20 animate-pulse rounded-sm bg-[#f3f4f6]"></div>
          <div class="h-20 animate-pulse rounded-sm bg-[#f3f4f6]"></div>
          <div class="h-20 animate-pulse rounded-sm bg-[#f3f4f6]"></div>
          <div class="h-20 animate-pulse rounded-sm bg-[#f3f4f6]"></div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailSkeletonComponent {}
