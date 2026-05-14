import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormFieldOption, FormFieldType, FormTemplateField } from '../../../../core/models/form-template.model';
import { FormTemplateService } from '../../../../core/services/form-template.service';

@Component({
  selector: 'app-form-config-field-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-config-field-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormConfigFieldCardComponent {
  private readonly formTemplateService = inject(FormTemplateService);

  @Input({ required: true }) field!: FormTemplateField;
  @Input({ required: true }) templateId!: string;
  @Input() isActive = false;
  @Input() fieldTypeOptions: ReadonlyArray<{ label: string; value: FormFieldType }> = [];

  @Output() activated = new EventEmitter<string>();

  protected activateField(): void {
    if (!this.isActive) {
      this.activated.emit(this.field.id);
    }
  }

  protected duplicateField(): void {
    this.formTemplateService.addField(this.templateId, {
      label: `${this.field.label} (ban sao)`,
      type: this.field.type,
      semanticKey: this.field.semanticKey,
      placeholder: this.field.placeholder,
      helperText: this.field.helperText,
      defaultValue: this.field.defaultValue,
      required: this.field.required,
      showInOrderList: this.field.showInOrderList,
      showInOrderDetail: this.field.showInOrderDetail
    }, this.field.id).subscribe({
      next: (field) => this.activated.emit(field.id)
    });
  }

  protected toggleRequired(): void {
    this.patchField({ required: !this.field.required });
  }

  protected updateFieldLabel(value: string): void {
    this.patchField({ label: value });
  }

  protected updateFieldHelperText(value: string): void {
    this.patchField({ helperText: value });
  }

  protected updateFieldType(value: string): void {
    this.patchField({ type: value as FormFieldType });
  }

  protected updateOptionLabel(option: FormFieldOption, value: string): void {
    this.formTemplateService.updateFieldOption(this.templateId, this.field.id, option.id, value).subscribe();
  }

  protected moveFieldUp(): void {
    this.formTemplateService.moveField(this.templateId, this.field.id, 'up').subscribe();
  }

  protected moveFieldDown(): void {
    this.formTemplateService.moveField(this.templateId, this.field.id, 'down').subscribe();
  }

  protected removeField(): void {
    this.formTemplateService.removeField(this.templateId, this.field.id).subscribe();
  }

  protected addOption(): void {
    this.formTemplateService.addFieldOption(this.templateId, this.field.id).subscribe();
  }

  protected removeOption(option: FormFieldOption): void {
    this.formTemplateService.removeFieldOption(this.templateId, this.field.id, option.id).subscribe();
  }

  protected isChoiceField(type: FormFieldType): boolean {
    return type === 'single_choice' || type === 'multi_choice' || type === 'dropdown';
  }

  protected isImageField(type: FormFieldType): boolean {
    return type === 'image';
  }

  protected isTextAreaField(type: FormFieldType): boolean {
    return type === 'textarea';
  }

  protected isDropdownField(type: FormFieldType): boolean {
    return type === 'dropdown';
  }

  protected resolvePreviewInputType(field: FormTemplateField): 'text' | 'email' | 'tel' | 'number' | 'date' | 'time' {
    switch (field.type) {
      case 'email':
        return 'email';
      case 'phone':
        return 'tel';
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'time':
        return 'time';
      default:
        return 'text';
    }
  }

  private patchField(patch: Partial<FormTemplateField>): void {
    this.formTemplateService.updateField(this.templateId, this.field.id, patch).subscribe();
  }
}
