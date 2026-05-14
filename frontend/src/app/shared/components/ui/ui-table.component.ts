import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-table',
  standalone: true,
  templateUrl: './ui-table.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTableComponent {
  @Input() minWidthClass = 'min-w-[720px]';
  @Input() tableClassName = '';

  protected get tableClasses(): string {
    return [this.minWidthClass, 'w-full border-collapse', this.tableClassName].filter(Boolean).join(' ');
  }
}
