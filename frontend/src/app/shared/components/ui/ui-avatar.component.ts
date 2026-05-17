import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-avatar',
  standalone: true,
  template: `
    <div
      [class]="avatarClasses"
      [style.background-color]="bgColor"
      [attr.aria-label]="name"
    >
      {{ initials }}
    </div>
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiAvatarComponent {
  @Input() name = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  protected get initials(): string {
    return this.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  protected get bgColor(): string {
    let hash = 0;
    for (let i = 0; i < this.name.length; i++) {
      hash = this.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 55%, 55%)`;
  }

  protected get avatarClasses(): string {
    const base =
      'inline-flex items-center justify-center rounded-[var(--radius-xs)] font-bold text-white select-none';
    const sizes: Record<string, string> = {
      sm: 'h-8 w-8 text-[11px]',
      md: 'h-10 w-10 text-xs',
      lg: 'h-12 w-12 text-sm'
    };
    return `${base} ${sizes[this.size]}`;
  }
}
