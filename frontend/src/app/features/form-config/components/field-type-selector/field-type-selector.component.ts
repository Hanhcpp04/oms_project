import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { OrderFormFieldType } from '../../../../core/models/order-form-template.model';
import { FIELD_TYPE_OPTIONS, FieldTypeOption } from '../../models/form-config-ui.model';

@Component({
  selector: 'app-field-type-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="form-config-control">
      <span>Loại trường</span>
      <select
        [value]="value"
        [disabled]="disabled"
        (change)="onChange($any($event.target).value)"
      >
        @for (option of options; track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>
    </label>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .form-config-control {
        display: grid;
        gap: 6px;
      }

      .form-config-control span {
        color: var(--color-text-tertiary);
        font-size: 11px;
        font-weight: 700;
      }

      select {
        width: 100%;
        min-height: 42px;
        border: 1px solid var(--color-border);
        border-radius: 12px;
        background: var(--color-surface-secondary);
        color: var(--color-text-primary);
        font-size: 13px;
        font-weight: 600;
        outline: none;
        padding: 0 12px;
        transition:
          border-color 160ms ease,
          background 160ms ease;
      }

      select:focus {
        border-color: var(--color-accent);
        background: var(--color-surface);
      }

      select:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FieldTypeSelectorComponent {
  @Input() value: OrderFormFieldType = 'text';
  @Input() disabled = false;
  @Input() options: ReadonlyArray<FieldTypeOption> = FIELD_TYPE_OPTIONS;

  @Output() valueChange = new EventEmitter<OrderFormFieldType>();

  protected onChange(value: string): void {
    this.valueChange.emit(value as OrderFormFieldType);
  }
}
