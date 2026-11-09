import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-empty-state',
  standalone: true,
  template: `
    <div class="grid place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center">
      <div class="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-secondary)] text-2xl text-[var(--color-text-muted)]">
        {{ icon }}
      </div>
      <h3 class="m-0 text-base font-semibold text-[var(--color-text-primary)]">{{ title }}</h3>
      @if (description) {
        <p class="m-0 mt-2 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">{{ description }}</p>
      }
      <div class="mt-5">
        <ng-content />
      </div>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiEmptyStateComponent {
  @Input() icon = '•';
  @Input() title = 'Không có dữ liệu';
  @Input() description = '';
}
