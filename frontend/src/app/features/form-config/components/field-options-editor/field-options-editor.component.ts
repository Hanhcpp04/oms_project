import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  OrderFormFieldOption,
  OrderFormTemplateField
} from '../../../../core/models/order-form-template.model';

@Component({
  selector: 'app-field-options-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="options-editor">
      @if (field.type === 'dropdown') {
        <label class="options-editor__placeholder">
          <span>Placeholder</span>
          <input
            type="text"
            [value]="field.placeholder"
            placeholder="Chọn một lựa chọn"
            (input)="placeholderChange.emit($any($event.target).value)"
          />
        </label>
      }

      <div class="options-editor__list">
        @for (option of field.options; track option.id; let index = $index) {
          <div class="option-row">
            <span
              class="option-row__marker"
              [class.option-row__marker--checkbox]="field.type === 'multi_choice'"
              [class.option-row__marker--dropdown]="field.type === 'dropdown'"
            >
              @if (field.type === 'dropdown') {
                {{ index + 1 }}
              }
            </span>
            <input
              type="text"
              [value]="option.label"
              placeholder="Nhập lựa chọn"
              (input)="updateOption(option, $any($event.target).value)"
            />
            <button type="button" title="Xóa lựa chọn" (click)="removeOption(option.id)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        }
      </div>

      <button type="button" class="options-editor__add" (click)="addOption()">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Thêm lựa chọn
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .options-editor {
        display: grid;
        gap: 14px;
      }

      .options-editor__placeholder {
        display: grid;
        gap: 6px;
      }

      .options-editor__placeholder span {
        color: var(--color-text-tertiary);
        font-size: 11px;
        font-weight: 700;
      }

      .options-editor__placeholder input,
      .option-row input {
        min-width: 0;
        border: 0;
        border-bottom: 1px solid transparent;
        background: transparent;
        color: var(--color-text-primary);
        font-size: 14px;
        outline: none;
        padding: 7px 0;
        transition: border-color 160ms ease;
      }

      .options-editor__placeholder input {
        border-color: var(--color-border);
      }

      .options-editor__placeholder input:focus,
      .option-row input:focus {
        border-bottom-color: var(--color-accent);
      }

      .options-editor__list {
        display: grid;
        gap: 8px;
      }

      .option-row {
        display: grid;
        grid-template-columns: 26px minmax(0, 1fr) 34px;
        align-items: center;
        gap: 10px;
      }

      .option-row__marker {
        display: inline-flex;
        width: 18px;
        height: 18px;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--color-border-hover);
        border-radius: 999px;
        color: var(--color-text-tertiary);
        font-size: 11px;
        font-weight: 700;
      }

      .option-row__marker--checkbox {
        border-radius: 4px;
      }

      .option-row__marker--dropdown {
        width: 24px;
        border: 0;
      }

      .option-row button,
      .options-editor__add {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        background: transparent;
        color: var(--color-text-tertiary);
        cursor: pointer;
        transition:
          background 160ms ease,
          color 160ms ease;
      }

      .option-row button {
        width: 34px;
        height: 34px;
        border-radius: 999px;
      }

      .option-row button:hover {
        background: var(--color-surface-hover);
        color: var(--color-danger);
      }

      svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2;
      }

      .options-editor__add {
        justify-self: start;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 10px;
        color: var(--color-accent);
        font-size: 13px;
        font-weight: 700;
      }

      .options-editor__add:hover {
        background: var(--color-accent-soft);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FieldOptionsEditorComponent {
  @Input({ required: true }) field!: OrderFormTemplateField;

  @Output() optionsChange = new EventEmitter<OrderFormFieldOption[]>();
  @Output() placeholderChange = new EventEmitter<string>();

  protected addOption(): void {
    const nextNumber = this.field.options.length + 1;
    this.optionsChange.emit([
      ...this.field.options,
      {
        id: `temp-opt-${Date.now()}-${nextNumber}`,
        label: `Lựa chọn ${nextNumber}`,
        value: `Lựa chọn ${nextNumber}`,
        sortOrder: nextNumber,
        active: true
      }
    ]);
  }

  protected updateOption(option: OrderFormFieldOption, label: string): void {
    this.optionsChange.emit(
      this.field.options.map((item) =>
        item.id === option.id ? { ...item, label, value: label } : item
      )
    );
  }

  protected removeOption(optionId: string): void {
    this.optionsChange.emit(this.field.options.filter((option) => option.id !== optionId));
  }
}
