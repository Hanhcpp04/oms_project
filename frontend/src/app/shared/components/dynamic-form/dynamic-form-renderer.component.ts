import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { isCurrencyFieldLike, parseVndCurrencyInput } from '../../utils/currency.util';
import { DynamicFormFieldComponent } from './dynamic-form-field.component';
import {
  DynamicFieldValue,
  DynamicFormContext,
  DynamicFormMode,
  DynamicFormVariant,
  DynamicFieldValidationState,
  DynamicRenderField,
  normalizeDynamicFields
} from './dynamic-form.types';

@Component({
  selector: 'app-dynamic-form-renderer',
  standalone: true,
  imports: [CommonModule, DynamicFormFieldComponent],
  template: `
    <div [class]="gridClasses">
      <app-dynamic-form-field
        *ngFor="let field of normalizedFields; trackBy: trackByFieldId"
        [field]="field"
        [value]="values[field.id]"
        [mode]="mode"
        [variant]="resolvedVariant"
        [readonly]="isReadonly"
        [context]="context"
        [errors]="fieldErrors(field.id)"
        (valueChange)="onFieldValueChange(field, $event)"
        (fileSelected)="fileSelected.emit({ field, file: $event })"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DynamicFormRendererComponent implements OnChanges {
  @Input() fields: readonly unknown[] = [];
  @Input() values: Record<string, DynamicFieldValue> = {};
  @Input() mode: DynamicFormMode = 'create';
  @Input() variant: DynamicFormVariant | null = null;
  @Input('readonly') isReadonly = false;
  @Input() context: DynamicFormContext = 'order';
  @Input() errors: Record<string, string | string[]> = {};
  @Input() compact = false;

  @Output() valuesChange = new EventEmitter<Record<string, DynamicFieldValue>>();
  @Output() validityChange = new EventEmitter<DynamicFieldValidationState>();
  @Output() fileSelected = new EventEmitter<{ field: DynamicRenderField; file: File }>();

  protected normalizedFields: DynamicRenderField[] = [];
  private localErrors: Record<string, string[]> = {};
  private touchedFields = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.normalizedFields = normalizeDynamicFields(this.fields);
      this.touchedFields.clear();
    }

    this.emitValidity();
  }

  protected get gridClasses(): string {
    if (this.resolvedVariant === 'public') {
      return this.compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-4 sm:gap-5';
    }

    if (this.context === 'product') {
      return this.compact ? 'grid gap-4 md:grid-cols-2' : 'grid gap-5 md:grid-cols-2';
    }

    return this.compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-4 sm:grid-cols-2';
  }

  protected get resolvedVariant(): DynamicFormVariant {
    if (this.variant) {
      return this.variant;
    }

    if (this.mode === 'preview') {
      return 'preview';
    }

    return this.context === 'public' ? 'public' : 'internal';
  }

  protected trackByFieldId(_: number, field: DynamicRenderField): string {
    return field.id;
  }

  protected fieldErrors(fieldId: string): string[] {
    const external = this.errors[fieldId];
    if (Array.isArray(external)) {
      return external;
    }

    if (typeof external === 'string' && external.trim()) {
      return [external];
    }

    return this.touchedFields.has(fieldId) ? this.localErrors[fieldId] ?? [] : [];
  }

  protected onFieldValueChange(field: DynamicRenderField, value: DynamicFieldValue): void {
    this.touchedFields.add(field.id);
    const nextValues = { ...this.values, [field.id]: value };
    this.validate(nextValues);
    this.valuesChange.emit(nextValues);
    this.emitCurrentValidity();
  }

  private validate(values: Record<string, DynamicFieldValue>): void {
    const errors: Record<string, string[]> = {};

    for (const field of this.normalizedFields) {
      const fieldErrors = this.validateField(field, values[field.id]);
      if (fieldErrors.length > 0) {
        errors[field.id] = fieldErrors;
      }
    }

    this.localErrors = errors;
  }

  private emitValidity(): void {
    this.validate(this.values ?? {});
    this.emitCurrentValidity();
  }

  private emitCurrentValidity(): void {
    this.validityChange.emit({
      valid: Object.keys(this.localErrors).length === 0,
      errors: this.localErrors
    });
  }

  private validateField(field: DynamicRenderField, value: DynamicFieldValue): string[] {
    const errors: string[] = [];
    const stringValue = typeof value === 'string' ? value.trim() : '';
    const arrayValue = Array.isArray(value) ? value : [];

    if (field.required) {
      if (field.type === 'checkbox') {
        if (arrayValue.length === 0) {
          errors.push('Trường này bắt buộc chọn ít nhất một giá trị.');
        }
      } else if (!stringValue) {
        errors.push('Trường này bắt buộc nhập.');
      }
    }

    if (!stringValue || field.type === 'checkbox') {
      return errors;
    }

    if (field.type === 'number') {
      const num = isCurrencyFieldLike(field) ? parseVndCurrencyInput(stringValue) : Number(stringValue);
      if (num === undefined || Number.isNaN(num)) {
        errors.push('Vui lòng nhập số hợp lệ.');
        return errors;
      }

      const min = field.validationRules['min'];
      const max = field.validationRules['max'];
      if (min !== undefined && num < Number(min)) {
        errors.push(`Giá trị tối thiểu là ${min}.`);
      }
      if (max !== undefined && num > Number(max)) {
        errors.push(`Giá trị tối đa là ${max}.`);
      }
    }

    if (field.type === 'phone' && this.context !== 'product' && !/^[0-9]{10,11}$/.test(stringValue)) {
      errors.push('Số điện thoại không hợp lệ (10-11 chữ số).');
    }

    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
      errors.push('Email không hợp lệ.');
    }

    return errors;
  }
}
