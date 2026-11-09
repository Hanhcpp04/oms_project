import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-product-skeleton-grid',
  standalone: true,
  host: { class: 'contents' },
  template: `
    @for (item of skeletonItems; track item) {
      <div class="flex h-[380px] flex-col overflow-hidden rounded-sm border border-gray-200 bg-white">
        <div class="h-[220px] w-full animate-pulse bg-gray-100"></div>
        <div class="flex flex-1 flex-col gap-3 p-3.5">
          <div class="flex flex-col gap-1.5">
            <div class="h-4 w-4/5 animate-pulse rounded bg-gray-200"></div>
            <div class="h-3 w-2/3 animate-pulse rounded bg-gray-100"></div>
          </div>
          <div class="flex items-center justify-between pt-1">
            <div class="flex flex-col gap-1.5">
              <div class="h-2 w-10 animate-pulse rounded bg-gray-100"></div>
              <div class="h-4 w-20 animate-pulse rounded bg-gray-200"></div>
            </div>
            <div class="flex flex-col items-end gap-1.5">
              <div class="h-2 w-14 animate-pulse rounded bg-gray-100"></div>
              <div class="h-4 w-12 animate-pulse rounded bg-gray-200"></div>
            </div>
          </div>
          <div class="mt-auto flex items-center gap-2 pt-1">
            <div class="h-8 flex-1 animate-pulse rounded-sm bg-gray-200"></div>
            <div class="h-8 flex-1 animate-pulse rounded-sm bg-gray-100"></div>
            <div class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-100"></div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductSkeletonGridComponent {
  protected readonly skeletonItems = Array.from({ length: 12 }, (_, index) => index);
}
