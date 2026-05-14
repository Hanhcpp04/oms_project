import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { UiToggleComponent } from '../ui/ui-toggle.component';
import { UiModalComponent } from '../ui/ui-modal.component';
import { formatPhoneInput } from '../../utils/phone-format.util';

export type DynamicFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'single_choice'
  | 'multi_choice'
  | 'dropdown'
  | 'image';

export interface DynamicFieldOption {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
  active: boolean;
}

export interface DynamicFormField {
  id: string;
  label: string;
  type: DynamicFieldType;
  placeholder: string;
  helperText: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  options: DynamicFieldOption[];
  validationRules?: Record<string, any>;
  [key: string]: any; // Allow for extra properties like fieldKey, semanticKey, etc.
}

@Component({
  selector: 'app-dynamic-form-field-manager',
  standalone: true,
  imports: [CommonModule, UiToggleComponent, UiModalComponent],
  templateUrl: './dynamic-form-field-manager.component.html',
  styleUrls: ['./dynamic-form-field-manager.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DynamicFormFieldManagerComponent {
  @Input({ required: true }) fields: DynamicFormField[] = [];
  @Input() title = 'Thông tin bổ sung';
  @Input() addButtonLabel = 'Thêm trường mới';
  @Input() emptyStateLabel = 'Chưa có trường tùy chỉnh nào';
  @Input() emptyStateHint = 'Nhấn để thêm trường mới';
  @Input() isOrderForm = false;
  @Input() isSaving = false; // Trạng thái đang lưu từ phía cha
  
  @Output() fieldsChanged = new EventEmitter<DynamicFormField[]>();
  @Output() saveField = new EventEmitter<DynamicFormField>();
  @Output() deleteField = new EventEmitter<DynamicFormField>();

  readonly isModalOpen = signal(false);
  readonly activeFieldId = signal<string | null>(null);

  readonly fieldTypeOptions: ReadonlyArray<{ label: string; value: DynamicFieldType; icon: string }> = [
    { label: 'Văn bản ngắn', value: 'text', icon: 'i-lucide-type' },
    { label: 'Văn bản dài', value: 'textarea', icon: 'i-lucide-align-left' },
    { label: 'Số', value: 'number', icon: 'i-lucide-hash' },
    { label: 'Email', value: 'email', icon: 'i-lucide-mail' },
    { label: 'Số điện thoại', value: 'phone', icon: 'i-lucide-phone' },
    { label: 'Ngày tháng', value: 'date', icon: 'i-lucide-calendar' },
    { label: 'Menu thả xuống', value: 'dropdown', icon: 'i-lucide-chevron-down' },
    { label: 'Trắc nghiệm', value: 'single_choice', icon: 'i-lucide-circle-dot' },
    { label: 'Hình ảnh', value: 'image', icon: 'i-lucide-image' }
  ];

  protected editField(fieldId: string): void {
    this.activeFieldId.set(fieldId);
    this.isModalOpen.set(true);
  }

  protected clearActiveField(): void {
    this.activeFieldId.set(null);
    this.isModalOpen.set(false);
    this.fieldsChanged.emit([...this.fields]);
  }

  protected addField(type: DynamicFieldType = 'text'): void {
    const newId = `temp-${Date.now()}`;
    const newField: DynamicFormField = {
      id: newId,
      label: 'Trường mới',
      type: type,
      placeholder: '',
      helperText: '',
      required: false,
      active: true,
      sortOrder: this.fields.length + 1,
      options: []
    };

    this.fields = [...this.fields, newField];
    this.activeFieldId.set(newId);
    this.isModalOpen.set(true);
  }

  protected patchField(field: DynamicFormField, patch: Partial<DynamicFormField>): void {
    this.fields = this.fields.map(f => f.id === field.id ? { ...f, ...patch } : f);
    // Don't emit yet, wait for modal close or blur
  }

  protected removeField(fieldId: string): void {
    if (!confirm('Xóa trường này?')) return;
    const field = this.fields.find(f => f.id === fieldId);
    if (field) {
      this.deleteField.emit(field);
    }
  }

  protected triggerSave(field: DynamicFormField): void {
    this.saveField.emit(field);
  }

  public closeAfterSave(): void {
    this.activeFieldId.set(null);
    this.isModalOpen.set(false);
  }

  protected addOption(fieldId: string): void {
    this.fields = this.fields.map(f => {
      if (f.id !== fieldId) return f;
      const newOption: DynamicFieldOption = {
        id: `temp-opt-${Date.now()}`,
        label: 'Lựa chọn mới',
        value: '',
        sortOrder: f.options.length + 1,
        active: true
      };
      return { ...f, options: [...f.options, newOption] };
    });
  }

  protected updateOption(fieldId: string, optionId: string, label: string): void {
    this.fields = this.fields.map(f => {
      if (f.id !== fieldId) return f;
      return {
        ...f,
        options: f.options.map(o => o.id === optionId ? { ...o, label, value: label } : o)
      };
    });
  }

  protected removeOption(fieldId: string, optionId: string): void {
    this.fields = this.fields.map(f => {
      if (f.id !== fieldId) return f;
      return { ...f, options: f.options.filter(o => o.id !== optionId) };
    });
  }

  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPhoneInput(input.value);
    if (input.value !== formatted.display) {
      input.value = formatted.display;
    }
  }

  protected updateValidationRule(fieldId: string, key: string, value: any): void {
    this.fields = this.fields.map(f => {
      if (f.id !== fieldId) return f;
      return {
        ...f,
        validationRules: {
          ...(f.validationRules || {}),
          [key]: value
        }
      };
    });
  }

  protected isChoiceField(type: DynamicFieldType): boolean {
    return type === 'dropdown' || type === 'single_choice' || type === 'multi_choice';
  }
}
