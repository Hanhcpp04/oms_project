import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '../../../core/constants/app.constants';
import { HttpService } from '../../../core/http/http.service';
import { FormTemplate, FormTemplateField } from '../../../core/models/form-template.model';
import { NotificationService } from '../../../core/services/notification.service';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import {
  ProductContextInfo,
  applyProductContextPrefill,
  readProductContextFromQuery
} from '../utils/public-form.util';
import { ApiEnvelope, asString, unwrapApiResponse } from '../../../core/utils/api-response.util';
import {
  formatVndCurrency,
  formatVndCurrencyInput,
  isCurrencyFieldLike,
  normalizeVndCurrencyInput
} from '../../../shared/utils/currency.util';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneDigits } from '../../../shared/utils/phone-format.util';

interface PublicFormApi {
  id?: string | number;
  name?: string;
  description?: string;
  fields?: PublicFieldApi[];
}

interface PublicFieldApi {
  id?: string | number;
  fieldKey?: string;
  label?: string;
  fieldType?: string;
  isRequired?: boolean;
  sortOrder?: number;
  placeholder?: string;
  helperText?: string;
  defaultValue?: string;
  options?: Array<{
    id?: string | number;
    label?: string;
    value?: string;
    sortOrder?: number;
    isActive?: boolean;
  }>;
}

@Component({
  selector: 'app-public-form-page',
  standalone: true,
  imports: [CommonModule, RouterLink, UiButtonComponent, UiCardComponent],
  templateUrl: './public-form-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly httpService = inject(HttpService);
  private readonly notificationService = inject(NotificationService);

  protected readonly templateState = signal<FormTemplate | null>(null);
  protected readonly valuesState = signal<Record<string, string | string[]>>({});
  protected readonly imageNameState = signal<Record<string, string>>({});
  protected readonly errorsState = signal<Record<string, string>>({});
  protected readonly submittedPayloadState = signal<Record<string, unknown> | null>(null);
  protected readonly productContextState = signal<ProductContextInfo | null>(null);

  protected readonly template = this.templateState.asReadonly();
  protected readonly submittedPayload = this.submittedPayloadState.asReadonly();
  protected readonly productContext = this.productContextState.asReadonly();
  protected readonly fieldCount = computed(() => this.templateState()?.fields.length ?? 0);

  ngOnInit(): void {
    const templateId = this.route.snapshot.paramMap.get('templateId');

    if (!templateId) {
      this.templateState.set(null);
      return;
    }

    this.httpService
      .get<PublicFormApi | ApiEnvelope<PublicFormApi>>(`${API_ENDPOINTS.publicForms}/${templateId}`)
      .subscribe({
        next: (response) => {
          const template = normalizePublicTemplate(unwrapApiResponse(response));
          this.templateState.set(template);

          const defaultValues = template.fields.reduce<Record<string, string | string[]>>((accumulator, field) => {
            accumulator[field.id] = field.type === 'multi_choice' ? [] : field.defaultValue?.trim() || '';
            return accumulator;
          }, {});

          const productContext = this.readProductContextFromQuery();
          this.productContextState.set(productContext);
          this.valuesState.set(this.applyProductContextPrefill(template, defaultValues, productContext));
        },
        error: () => {
          this.templateState.set(null);
          this.notificationService.error('Khong the tai form cong khai.');
        }
      });
  }

  protected formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }

  protected updateFieldValue(fieldId: string, value: string): void {
    this.valuesState.update((state) => ({
      ...state,
      [fieldId]: value
    }));

    this.clearFieldError(fieldId);
  }

  protected onImageSelected(fieldId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.imageNameState.update((state) => ({
      ...state,
      [fieldId]: file?.name ?? ''
    }));

    this.valuesState.update((state) => ({
      ...state,
      [fieldId]: file?.name ?? ''
    }));

    this.clearFieldError(fieldId);
  }

  protected setSingleChoiceValue(fieldId: string, value: string): void {
    this.valuesState.update((state) => ({
      ...state,
      [fieldId]: value
    }));

    this.clearFieldError(fieldId);
  }

  protected toggleMultiChoiceValue(fieldId: string, value: string, checked: boolean): void {
    this.valuesState.update((state) => {
      const previous = state[fieldId];
      const previousValues = Array.isArray(previous) ? previous : [];
      const nextValues = checked
        ? Array.from(new Set([...previousValues, value]))
        : previousValues.filter((entry) => entry !== value);

      return {
        ...state,
        [fieldId]: nextValues
      };
    });

    this.clearFieldError(fieldId);
  }

  protected isMultiChoiceSelected(fieldId: string, value: string): boolean {
    const current = this.valuesState()[fieldId];
    return Array.isArray(current) ? current.includes(value) : false;
  }

  protected getFieldValue(fieldId: string): string {
    const value = this.valuesState()[fieldId];
    return typeof value === 'string' ? value : '';
  }

  protected getFieldDisplayValue(field: FormTemplateField): string {
    const value = this.getFieldValue(field.id);
    if (this.isCurrencyField(field)) {
      return formatVndCurrencyInput(value);
    }

    if (field.type === 'phone') {
      return formatPhoneDisplay(normalizePhoneDigits(value));
    }

    return value;
  }

  protected onFieldInput(field: FormTemplateField, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.isCurrencyField(field)) {
      this.updateFieldValue(field.id, normalizeVndCurrencyInput(input.value));
      return;
    }

    if (field.type === 'phone') {
      const formatted = formatPhoneInput(input.value);
      if (input.value !== formatted.display) {
        input.value = formatted.display;
      }
      this.updateFieldValue(field.id, formatted.raw);
      return;
    }

    this.updateFieldValue(field.id, input.value);
  }

  protected getSelectedImageName(fieldId: string): string {
    return this.imageNameState()[fieldId] ?? '';
  }

  protected getFieldError(fieldId: string): string {
    return this.errorsState()[fieldId] ?? '';
  }

  protected isImageField(field: FormTemplateField): boolean {
    return field.type === 'image';
  }

  protected isTextAreaField(field: FormTemplateField): boolean {
    return field.type === 'textarea';
  }

  protected isSingleChoiceField(field: FormTemplateField): boolean {
    return field.type === 'single_choice';
  }

  protected isMultiChoiceField(field: FormTemplateField): boolean {
    return field.type === 'multi_choice';
  }

  protected isDropdownField(field: FormTemplateField): boolean {
    return field.type === 'dropdown';
  }

  protected resolveInputType(field: FormTemplateField): 'text' | 'email' | 'tel' | 'number' | 'date' | 'time' {
    if (this.isCurrencyField(field)) {
      return 'text';
    }

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

  protected isCurrencyField(field: FormTemplateField): boolean {
    return field.type === 'number' && isCurrencyFieldLike(field);
  }

  protected submitForm(): void {
    const template = this.templateState();

    if (!template) {
      return;
    }

    const errors: Record<string, string> = {};
    const data: Record<string, unknown> = {};

    template.fields.forEach((field) => {
      if (field.type === 'image') {
        const imageName = this.imageNameState()[field.id] ?? '';

        if (field.required && !imageName) {
          errors[field.id] = 'Truong nay bat buoc tai anh.';
          return;
        }

        data[field.label] = imageName;
        return;
      }

      if (field.type === 'multi_choice') {
        const value = this.valuesState()[field.id];
        const selectedValues = Array.isArray(value) ? value : [];

        if (field.required && selectedValues.length === 0) {
          errors[field.id] = 'Truong nay bat buoc chon it nhat mot dap an.';
          return;
        }

        data[field.label] = selectedValues;
        return;
      }

      const rawValue = this.valuesState()[field.id];
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';

      if (field.required && !value) {
        errors[field.id] = 'Truong nay bat buoc nhap.';
        return;
      }

      data[field.label] = value;
    });

    this.errorsState.set(errors);

    if (Object.keys(errors).length > 0) {
      this.notificationService.error('Vui long nhap day du cac truong bat buoc.');
      return;
    }

    this.submittedPayloadState.set({
      templateId: template.id,
      templateName: template.name,
      submittedAt: new Date().toISOString(),
      values: data
    });

    this.notificationService.success('Da gui form thanh cong.');
  }

  private clearFieldError(fieldId: string): void {
    if (!this.errorsState()[fieldId]) {
      return;
    }

    this.errorsState.update((state) => {
      const { [fieldId]: _, ...rest } = state;
      return rest;
    });
  }

  private readProductContextFromQuery(): ProductContextInfo | null {
    const queryParams = this.route.snapshot.queryParamMap;
    return readProductContextFromQuery((key) => queryParams.get(key));
  }

  private applyProductContextPrefill(
    template: FormTemplate,
    currentValues: Record<string, string | string[]>,
    productContext: ProductContextInfo | null
  ): Record<string, string | string[]> {
    return applyProductContextPrefill(template, currentValues, productContext, (val) => this.formatCurrency(val));
  }
}

function normalizePublicTemplate(value: PublicFormApi): FormTemplate {
  const id = asString(value.id);

  return {
    id,
    name: value.name?.trim() || 'Form cong khai',
    description: value.description?.trim() || '',
    category: 'sell',
    formType: 'PUBLIC',
    status: 'PUBLISHED',
    isPublic: true,
    publicSlug: undefined,
    versionNo: 1,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sharing: {
      defaultPermission: 'view',
      memberPermissions: []
    },
    fields: (value.fields ?? []).map((field) => ({
      id: asString(field.id),
      templateId: id,
      fieldKey: field.fieldKey?.trim() || '',
      label: field.label?.trim() || 'Truong moi',
      type: normalizeFieldType(field.fieldType),
      placeholder: field.placeholder?.trim() || '',
      helperText: field.helperText?.trim() || '',
      defaultValue: field.defaultValue?.trim() || '',
      required: Boolean(field.isRequired ?? false),
      active: true,
      showInOrderList: false,
      showInOrderDetail: true,
      sortOrder: typeof field.sortOrder === 'number' ? field.sortOrder : 0,
      validationRules: undefined,
      options: (field.options ?? []).map((option) => ({
        id: asString(option.id),
        label: option.label?.trim() || '',
        value: option.value?.trim() || option.label?.trim() || '',
        sortOrder: typeof option.sortOrder === 'number' ? option.sortOrder : 0,
        active: option.isActive !== false
      }))
    }))
  };
}

function normalizeFieldType(value: unknown): FormTemplateField['type'] {
  switch (value) {
    case 'email':
    case 'phone':
    case 'textarea':
    case 'number':
    case 'date':
    case 'time':
    case 'single_choice':
    case 'multi_choice':
    case 'dropdown':
    case 'image':
      return value;
    default:
      return 'text';
  }
}
