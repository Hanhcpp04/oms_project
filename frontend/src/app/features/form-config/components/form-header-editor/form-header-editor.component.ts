import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  OrderFormTemplateStatus,
  OrderFormTemplateType
} from '../../../../core/models/order-form-template.model';
import { formTypeLabel } from '../../models/form-config-ui.model';

export type FormConfigMode = 'edit' | 'preview';

@Component({
  selector: 'app-form-header-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="form-header-card">
      <div class="form-header-card__accent"></div>
      <div class="form-header-card__content">
        <div class="form-header-card__main">
          <div class="form-header-card__eyebrow">
            <span>{{ formTypeLabel(formType) }}</span>
            <span>{{ status === 'ACTIVE' ? 'Đang hoạt động' : 'Lưu trữ' }}</span>
            <span>{{ fieldCount }} field</span>
            @if (hasUnsavedChanges) {
              <span class="form-header-card__dirty">Chưa lưu</span>
            }
          </div>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>

        <div class="form-header-card__actions">
          <div class="form-header-card__mode">
            <button
              type="button"
              [class.is-active]="mode === 'edit'"
              (click)="modeChange.emit('edit')"
            >
              Chỉnh sửa
            </button>
            <button
              type="button"
              [class.is-active]="mode === 'preview'"
              (click)="modeChange.emit('preview')"
            >
              Xem trước
            </button>
          </div>

          <button type="button" class="form-header-card__preview" (click)="modeChange.emit('preview')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview
          </button>

          <button
            type="button"
            class="form-header-card__save"
            [disabled]="isSaving || isInvalid || !hasUnsavedChanges"
            (click)="save.emit()"
          >
            @if (isSaving) {
              <span class="form-header-card__spinner"></span>
              Đang lưu
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="M17 21v-8H7v8M7 3v5h8" />
              </svg>
              Lưu cấu hình
            }
          </button>
        </div>
      </div>
    </header>
  `,
  styleUrls: ['./form-header-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormHeaderEditorComponent {
  @Input() title = 'Cấu hình form';
  @Input() description = '';
  @Input() formType: OrderFormTemplateType = 'SELL';
  @Input() status: OrderFormTemplateStatus = 'ACTIVE';
  @Input() fieldCount = 0;
  @Input() mode: FormConfigMode = 'edit';
  @Input() hasUnsavedChanges = false;
  @Input() isSaving = false;
  @Input() isInvalid = false;

  @Output() modeChange = new EventEmitter<FormConfigMode>();
  @Output() save = new EventEmitter<void>();

  protected readonly formTypeLabel = formTypeLabel;
}
