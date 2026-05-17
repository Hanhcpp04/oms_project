import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  OrderFormFieldType,
  OrderFormTemplateField
} from '../../../../core/models/order-form-template.model';
import { UiToggleComponent } from '../../../../shared/components/ui/ui-toggle.component';
import { FieldOptionsEditorComponent } from '../field-options-editor/field-options-editor.component';
import { FieldTypeSelectorComponent } from '../field-type-selector/field-type-selector.component';
import {
  FIELD_TYPE_OPTIONS,
  defaultPlaceholderForType,
  fieldTypeLabel,
  inputTypeForField,
  isChoiceField
} from '../../models/form-config-ui.model';

@Component({
  selector: 'app-form-field-card',
  standalone: true,
  imports: [CommonModule, UiToggleComponent, FieldTypeSelectorComponent, FieldOptionsEditorComponent],
  template: `
    <article
      class="field-card"
      [class.field-card--active]="isActive"
      [class.field-card--invalid]="fieldErrors.length > 0"
      (click)="activated.emit(field.id)"
    >
      @if (isActive) {
        <div class="field-card__active-top">
          <button type="button" class="field-card__drag" title="Kéo để sắp xếp">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
            </svg>
          </button>

          <div class="field-card__question">
            <input
              class="field-card__title-input"
              type="text"
              [value]="field.label"
              placeholder="Tên field"
              (input)="patch({ label: $any($event.target).value })"
            />
            <input
              class="field-card__helper-input"
              type="text"
              [value]="field.helperText"
              placeholder="Mô tả field (không bắt buộc)"
              (input)="patch({ helperText: $any($event.target).value })"
            />
          </div>

          <app-field-type-selector
            class="field-card__type"
            [value]="field.type"
            [options]="fieldTypeOptions"
            (valueChange)="updateType($event)"
          />
        </div>

        <div class="field-card__body">
          @if (isChoiceField(field.type)) {
            <app-field-options-editor
              [field]="field"
              (placeholderChange)="patch({ placeholder: $event })"
              (optionsChange)="patch({ options: $event })"
            />
          } @else if (field.type === 'textarea') {
            <textarea
              rows="2"
              [placeholder]="field.placeholder || defaultPlaceholderForType(field.type)"
              disabled
            ></textarea>
          } @else if (field.type === 'image') {
            <div
              class="inline-flex min-h-20 w-full max-w-[360px] items-center justify-center gap-2 rounded-sm border border-dashed border-[var(--color-border-hover)] bg-[var(--color-surface-secondary)] px-4 py-3 text-sm font-bold text-[var(--color-text-tertiary)]"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
              </svg>
              <span>{{ field.placeholder || 'File/Image upload' }}</span>
            </div>
          } @else {
            <input
              [type]="inputTypeForField(field.type)"
              [placeholder]="field.placeholder || defaultPlaceholderForType(field.type)"
              disabled
            />
          }
        </div>

        <div class="field-card__meta-grid">
          @if (!isChoiceField(field.type)) {
            <label class="field-card__text-control">
              <span>Placeholder</span>
              <input
                type="text"
                [value]="field.placeholder"
                [placeholder]="defaultPlaceholderForType(field.type)"
                (input)="patch({ placeholder: $any($event.target).value })"
              />
            </label>
          }

          <div class="field-card__visibility">
            <span>Loại đơn</span>
            <strong>{{ formTypeLabel }}</strong>
          </div>
        </div>

        @if (fieldErrors.length > 0) {
          <div class="field-card__errors">
            @for (error of fieldErrors; track error) {
              <span>{{ error }}</span>
            }
          </div>
        }

        <footer class="field-card__footer">
          <div class="field-card__reorder">
            <button type="button" title="Di chuyển lên" [disabled]="isFirst" (click)="moveUp.emit(field.id)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
            <button type="button" title="Di chuyển xuống" [disabled]="isLast" (click)="moveDown.emit(field.id)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          <div class="field-card__actions">
            <button type="button" title="Duplicate field" (click)="duplicate.emit(field)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button type="button" title="Xóa field" (click)="delete.emit(field)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
              </svg>
            </button>

            <label class="field-card__toggle">
              <span>Bắt buộc</span>
              <app-ui-toggle
                [checked]="field.required"
                ariaLabel="Bắt buộc"
                (toggled)="patch({ required: $event })"
              />
            </label>
            <label class="field-card__toggle">
              <span>Hiển thị public</span>
              <app-ui-toggle
                [checked]="field.active"
                ariaLabel="Hiển thị public form"
                (toggled)="patch({ active: $event })"
              />
            </label>
            <label class="field-card__toggle">
              <span>Danh sách đơn</span>
              <app-ui-toggle
                [checked]="field.showInOrderList"
                ariaLabel="Hiển thị trong danh sách đơn"
                (toggled)="patch({ showInOrderList: $event })"
              />
            </label>
            <label class="field-card__toggle">
              <span>Chi tiết đơn</span>
              <app-ui-toggle
                [checked]="field.showInOrderDetail"
                ariaLabel="Hiển thị trong chi tiết đơn"
                (toggled)="patch({ showInOrderDetail: $event })"
              />
            </label>
          </div>
        </footer>
      } @else {
        <div class="field-card__summary">
          <div>
            <h3>
              {{ field.label || 'Tên field đang trống' }}
              @if (field.required) {
                <span>*</span>
              }
            </h3>
            @if (field.helperText) {
              <p>{{ field.helperText }}</p>
            }
          </div>
          <span class="field-card__type-badge">{{ fieldTypeLabel(field.type) }}</span>
        </div>

        <div class="field-card__compact-preview">
          @if (isChoiceField(field.type)) {
            <div class="field-card__choice-preview">
              @for (option of field.options.slice(0, 3); track option.id) {
                <span>
                  <i [class.field-card__checkbox-dot]="field.type === 'multi_choice'"></i>
                  {{ option.label || 'Lựa chọn' }}
                </span>
              }
              @if (field.options.length === 0) {
                <span>Chưa có lựa chọn</span>
              }
            </div>
          } @else if (field.type === 'textarea') {
            <div class="field-card__line field-card__line--wide"></div>
          } @else if (field.type === 'image') {
            <div
              class="inline-flex min-h-14 w-full max-w-[260px] items-center justify-center rounded-sm border border-dashed border-[var(--color-border-hover)] bg-[var(--color-surface-secondary)] text-sm font-bold text-[var(--color-text-tertiary)]"
            >
              File/Image upload
            </div>
          } @else {
            <div class="field-card__line"></div>
          }
        </div>

        @if (fieldErrors.length > 0) {
          <div class="field-card__errors field-card__errors--compact">
            @for (error of fieldErrors; track error) {
              <span>{{ error }}</span>
            }
          </div>
        }
      }
    </article>
  `,
  styleUrls: ['./form-field-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormFieldCardComponent {
  @Input({ required: true }) field!: OrderFormTemplateField;
  @Input() isActive = false;
  @Input() isFirst = false;
  @Input() isLast = false;
  @Input() fieldErrors: string[] = [];
  @Input() formTypeLabel = '';
  @Input() fieldTypeOptions = FIELD_TYPE_OPTIONS;

  @Output() activated = new EventEmitter<string>();
  @Output() fieldChange = new EventEmitter<OrderFormTemplateField>();
  @Output() duplicate = new EventEmitter<OrderFormTemplateField>();
  @Output() delete = new EventEmitter<OrderFormTemplateField>();
  @Output() moveUp = new EventEmitter<string>();
  @Output() moveDown = new EventEmitter<string>();

  protected readonly isChoiceField = isChoiceField;
  protected readonly fieldTypeLabel = fieldTypeLabel;
  protected readonly inputTypeForField = inputTypeForField;
  protected readonly defaultPlaceholderForType = defaultPlaceholderForType;

  protected patch(patch: Partial<OrderFormTemplateField>): void {
    this.fieldChange.emit({ ...this.field, ...patch });
  }

  protected updateType(type: OrderFormFieldType): void {
    const nextOptions =
      isChoiceField(type) && this.field.options.length === 0
        ? [
            {
              id: `temp-opt-${Date.now()}`,
              label: 'Lựa chọn 1',
              value: 'Lựa chọn 1',
              sortOrder: 1,
              active: true
            }
          ]
        : this.field.options;

    this.patch({
      type,
      placeholder: this.field.placeholder || defaultPlaceholderForType(type),
      options: nextOptions
    });
  }
}
