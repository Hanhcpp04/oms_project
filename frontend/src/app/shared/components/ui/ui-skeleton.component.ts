import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-secondary)]"
      [ngStyle]="{ width: width, height: height }"
    ></div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiSkeletonComponent {
  @Input() width = '100%';
  @Input() height = '20px';
}
