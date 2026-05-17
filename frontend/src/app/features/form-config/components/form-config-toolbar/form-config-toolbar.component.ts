import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { OrderFormFieldType } from '../../../../core/models/order-form-template.model';

@Component({
  selector: 'app-form-config-toolbar',
  standalone: true,
  template: `
    <nav class="form-toolbar" aria-label="Form config toolbar">
      <button type="button" title="Thêm trường mới" (click)="addField.emit('text')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" title="Thêm tiêu đề/section" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h10M4 17h7" />
        </svg>
      </button>
      <button type="button" title="Thêm mô tả" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </button>
      <button type="button" title="Thêm ảnh" (click)="addField.emit('image')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
        </svg>
      </button>
      <button type="button" title="Preview form" (click)="preview.emit()">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button type="button" title="Duplicate section" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </nav>
  `,
  styleUrls: ['./form-config-toolbar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormConfigToolbarComponent {
  @Output() addField = new EventEmitter<OrderFormFieldType>();
  @Output() preview = new EventEmitter<void>();
}
