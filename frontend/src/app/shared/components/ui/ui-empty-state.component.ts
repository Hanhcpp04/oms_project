import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-empty-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
      <span class="text-3xl">{{ icon }}</span>
      <h3 class="m-0 mt-3 text-base font-bold text-[var(--color-text-primary)]">{{ title }}</h3>
      @if (description) {
        <p class="m-0 mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">{{ description }}</p>
      }
      <div class="mt-4">
        <ng-content />
      </div>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiEmptyStateComponent {
  @Input() icon = '📋';
  @Input() title = 'Không có dữ liệu';
  @Input() description = '';
}
