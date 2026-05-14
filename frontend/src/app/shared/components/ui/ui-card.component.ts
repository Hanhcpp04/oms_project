import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type UiCardTone = 'default' | 'soft' | 'muted';
export type UiCardPadding = 'none' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-ui-card',
  standalone: true,
  templateUrl: './ui-card.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiCardComponent {
  @Input() tone: UiCardTone = 'default';
  @Input() padding: UiCardPadding = 'md';
  @Input() interactive = false;
  @Input() selected = false;
  @Input() rounded = true;
  @Input() className = '';

  protected get cardClasses(): string {
    const baseClass = `w-full border transition-colors duration-200 ${this.rounded ? 'rounded-[20px]' : 'rounded-none'}`;

    const toneClasses: Record<UiCardTone, string> = {
      default: 'border-[#E5E5E5] bg-white',
      soft: 'border-[#E5E5E5] bg-white',
      muted: 'border-[#E5E5E5] bg-[#FAFAFA]'
    };

    const paddingClasses: Record<UiCardPadding, string> = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-5'
    };

    const interactiveClass = this.interactive
      ? 'cursor-pointer hover:border-[#CACACB]'
      : '';

    const selectedClass = this.selected
      ? 'border-[#111111]! ring-2 ring-[#111111]/10'
      : '';

    return [
      baseClass,
      toneClasses[this.tone],
      paddingClasses[this.padding],
      interactiveClass,
      selectedClass,
      this.className
    ]
      .filter(Boolean)
      .join(' ');
  }
}
