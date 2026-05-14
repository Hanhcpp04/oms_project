import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UiButtonComponent } from './ui-button.component';

@Component({
  selector: 'app-page-title',
  standalone: true,
  imports: [CommonModule, UiButtonComponent],
  templateUrl: './page-title.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageTitleComponent {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() actionLabel = '';

  @Output() action = new EventEmitter<void>();
}