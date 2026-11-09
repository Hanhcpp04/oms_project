import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'app-ui-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span [class]="badgeClasses"><ng-content /></span>`,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiBadgeComponent {
  @Input() variant: BadgeVariant = 'default';
  @Input() size: BadgeSize = 'sm';
  @Input() dot = false;

  protected get badgeClasses(): string {
    const base = 'inline-flex items-center font-medium rounded-none whitespace-nowrap';

    const sizes: Record<BadgeSize, string> = {
      sm: 'px-2 py-0.5 text-[11px]',
      md: 'px-2.5 py-1 text-xs'
    };

    const variants: Record<BadgeVariant, string> = {
      default: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
      primary: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]',
      success: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
      warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
      danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
      info: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]'
    };

    return [base, sizes[this.size], variants[this.variant]].join(' ');
  }
}
