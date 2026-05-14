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
    const base = 'inline-flex items-center font-medium rounded-[30px] whitespace-nowrap';

    const sizes: Record<BadgeSize, string> = {
      sm: 'px-2 py-0.5 text-[11px]',
      md: 'px-2.5 py-1 text-xs'
    };

    const variants: Record<BadgeVariant, string> = {
      default: 'bg-[#F5F5F5] text-[#707072]',
      primary: 'bg-[#F5F5F5] text-[#111111]',
      success: 'bg-[#d1fae5] text-[#007D48]',
      warning: 'bg-[#fef3c7] text-[#92400e]',
      danger: 'bg-[#FFE5E5] text-[#D30005]',
      info: 'bg-[#D6EEFF] text-[#1151FF]'
    };

    return [base, sizes[this.size], variants[this.variant]].join(' ');
  }
}
