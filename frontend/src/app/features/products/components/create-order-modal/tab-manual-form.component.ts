import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../../core/auth/auth.store';
import { Product } from '../../data-access/models/product.model';
import { SelectedVariant } from './step-select-products.component';
import { UiButtonComponent } from '../../../../shared/components/ui/ui-button.component';
import { UiInputComponent } from '../../../../shared/components/ui/ui-input.component';
import { UiSelectComponent } from '../../../../shared/components/ui/ui-select.component';
import { OrdersStore } from '../../../orders/state/orders.store';
import { AutoOrderDraft, CreateOrderInput, OrderCustomFieldValue, OrderType } from '../../../orders/data-access/models/order.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { OrderFormTemplateService } from '../../../../core/services/order-form-template.service';
import { OrderFormTemplateField, OrderFormTemplateType } from '../../../../core/models/order-form-template.model';
import { parseOptionalPositiveNumber } from '../../utils/order-create-modal.util';
import { FileApiService } from '../../../../core/services/file-api.service';
import { ShippingMethodService, ShippingMethodDto } from '../../../../core/services/shipping-method.service';
import { OrderSourceService, OrderSourceDto } from '../../../../core/services/order-source.service';
import { InternationalPhoneInputComponent } from '../../../../shared/components/form/international-phone-input.component';
import { FIXED_RENTAL_VERIFICATION_FIELDS } from '../../../orders/utils/rental-verification-fields.util';

@Component({
  selector: 'app-tab-manual-form',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiInputComponent, UiSelectComponent, InternationalPhoneInputComponent],
  templateUrl: './tab-manual-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabManualFormComponent implements OnInit {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) selectedOrderType: OrderType = 'SELL';
  @Input({ required: true }) selectedVariants: SelectedVariant[] = [];
  @Input() set prefilledDraft(draft: AutoOrderDraft | undefined) {
    if (draft) {
      this.latestPrefilledDraft.set(draft);
      this.applyDraft(draft);
    }
  }
  @Input() sourceMethod: 'MANUAL' | 'AI_PARSE' = 'MANUAL';

  @Output() back = new EventEmitter<void>();
  @Output() success = new EventEmitter<string>();

  private readonly templateService = inject(OrderFormTemplateService);
  private readonly store = inject(OrdersStore);
  private readonly notificationService = inject(NotificationService);
  private readonly fileService = inject(FileApiService);
  private readonly shippingService = inject(ShippingMethodService);
  private readonly sourceService = inject(OrderSourceService);
  private readonly authStore = inject(AuthStore);
  protected readonly Number = Number;
  protected readonly rentalVerificationFields = FIXED_RENTAL_VERIFICATION_FIELDS;
  private readonly latestPrefilledDraft = signal<AutoOrderDraft | undefined>(undefined);
  
  protected formatVND(value: string | number | null | undefined): string {
    if (!value) return '0 VNĐ';
    const num = typeof value === 'string' ? parseInt(value.replace(/\D/g, '')) : value;
    if (isNaN(num)) return '0 VNĐ';
    return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
  }

  protected onPhoneInputWithValidation(value: string): void {
    this.customerPhone.set(value);
    this.customerPhoneError.set('');
  }

  protected onCustomerNameChange(value: string): void {
    this.customerName.set(value);
    this.customerNameError.set(value.trim() ? '' : 'Vui lòng nhập tên khách hàng.');
  }

  protected onRentFromChange(value: string): void {
    this.rentFrom.set(value);
    this.rentFromError.set(value.trim() ? '' : 'Vui lòng chọn ngày nhận.');
    // Cross-validate with rentTo
    if (value && this.rentTo()) {
      const fromTime = new Date(value).getTime();
      const toTime = new Date(this.rentTo()).getTime();
      if (!isNaN(fromTime) && !isNaN(toTime) && fromTime > toTime) {
        this.rentFromError.set('Ngày nhận không được sau ngày trả.');
      }
    }
  }

  protected onRentToChange(value: string): void {
    this.rentTo.set(value);
    this.rentToError.set(value.trim() ? '' : 'Vui lòng chọn ngày trả.');
    // Cross-validate with rentFrom
    if (value && this.rentFrom()) {
      const fromTime = new Date(this.rentFrom()).getTime();
      const toTime = new Date(value).getTime();
      if (!isNaN(fromTime) && !isNaN(toTime) && fromTime > toTime) {
        this.rentToError.set('Ngày trả không được trước ngày nhận.');
      }
    }
  }

  protected onMoneyInput(value: string, setter: (val: string) => void): void {
    const cleaned = value.replace(/\D/g, '');
    setter(cleaned);
  }

  readonly submitting = signal(false);

  // Inline validation error signals
  protected readonly customerNameError = signal('');
  protected readonly customerPhoneError = signal('');
  protected readonly rentFromError = signal('');
  protected readonly rentToError = signal('');

  protected readonly customerName = signal('');
  protected readonly customerPhone = signal('');
  protected readonly customerAddress = signal('');
  protected readonly customerNote = signal('');
  protected readonly sourceChannel = signal('');

  protected readonly rentFrom = signal('');
  protected readonly rentTo = signal('');
  protected readonly depositPaid = signal('');

  protected readonly shippingMethods = signal<ShippingMethodDto[]>([]);
  protected readonly selectedShippingMethodId = signal<number | null>(null);
  protected readonly orderSources = signal<OrderSourceDto[]>([]);
  protected readonly selectedSourceChannelId = signal<number | null>(null);

  protected readonly shippingMethodOptions = computed(() =>
    this.shippingMethods().map(m => ({ label: m.name, value: m.id?.toString() || '' }))
  );

  protected readonly orderSourceOptions = computed(() =>
    this.orderSources().map(s => ({ label: s.name, value: s.id.toString() }))
  );
  protected readonly shippingMethod = signal('');
  protected readonly shippingFee = signal('');

  // Use computed for active template from OrderFormTemplateService
  protected readonly activeTemplate = computed(() => {
    const type: OrderFormTemplateType = this.selectedOrderType === 'RENT' ? 'RENT' : 'SELL';
    return this.templateService.templates().find(t => t.templateType === type) || null;
  });

  // Custom fields from the shop config
  protected readonly customFields = computed(() => {
    return this.activeTemplate()?.fields || [];
  });

  protected readonly customFieldValues = signal<Record<string, string | string[]>>({});
  protected readonly customFieldErrors = signal<Record<string, string>>({});
  protected readonly rentalVerificationValues = signal<Record<string, string>>({});
  protected readonly rentalVerificationErrors = signal<Record<string, string>>({});
  private readonly syncPrefilledDraftEffect = effect(() => {
    const draft = this.latestPrefilledDraft();
    if (draft && this.customFields().length > 0) {
      this.applyDraft(draft);
    }
  }, { allowSignalWrites: true });

  ngOnInit() {
    const type: OrderFormTemplateType = this.selectedOrderType === 'RENT' ? 'RENT' : 'SELL';
    this.templateService.loadConfig(type);

    this.shippingService.getAllMethods().subscribe(methods => {
      this.shippingMethods.set(methods.filter(m => m.active));
      this.syncSelectedShippingMethodFromName();
    });

    this.sourceService.getAllSources().subscribe(sources => {
      this.orderSources.set(sources.filter(s => s.active));
      this.syncSelectedSourceChannelFromName();
    });
  }

  protected onSourceChannelChange(sourceIdStr: string) {
    if (!sourceIdStr) {
      this.selectedSourceChannelId.set(null);
      this.sourceChannel.set('');
      return;
    }

    const sourceId = Number(sourceIdStr);
    this.selectedSourceChannelId.set(sourceId);

    const source = this.orderSources().find(item => item.id === sourceId);
    this.sourceChannel.set(source?.name ?? '');
  }

  protected onShippingMethodChange(methodIdStr: string) {
    if (!methodIdStr) {
      this.selectedShippingMethodId.set(null);
      this.shippingMethod.set('');
      this.shippingFee.set('');
      return;
    }
    const methodId = Number(methodIdStr);
    this.selectedShippingMethodId.set(methodId);

    const method = this.shippingMethods().find(m => m.id === methodId);
    if (method) {
      this.shippingMethod.set(method.name);
      if (method.feePolicy === 'FIXED_FEE') {
        this.shippingFee.set(String(method.defaultFee || 0));
      } else {
        this.shippingFee.set('0');
      }
    }
  }
  // --- Template helpers ---
  protected isRentOrder(): boolean {
    return this.selectedOrderType === 'RENT';
  }

  protected shouldShowRentalVerificationFields(): boolean {
    return this.isRentOrder() && Boolean(this.authStore.currentShop()?.rentalIdentityVerificationEnabled);
  }

  protected getCategoryLabel(): string {
    return this.isRentOrder() ? 'cho thuê' : 'bán';
  }

  protected getCustomFieldValue(fieldId: string): string {
    const value = this.customFieldValues()[fieldId];
    return typeof value === 'string' ? value : '';
  }

  protected updateCustomFieldValue(fieldId: string, value: string): void {
    this.customFieldValues.update(prev => ({ ...prev, [fieldId]: value }));
    this.clearCustomFieldError(fieldId);
  }

  protected setCustomSingleChoiceValue(fieldId: string, value: string): void {
    this.customFieldValues.update(prev => ({ ...prev, [fieldId]: value }));
    this.clearCustomFieldError(fieldId);
  }

  protected toggleCustomMultiChoiceValue(fieldId: string, value: string, checked: boolean): void {
    this.customFieldValues.update(prev => {
      const current = prev[fieldId];
      const previousValues = Array.isArray(current) ? current : [];
      const nextValues = checked
        ? Array.from(new Set([...previousValues, value]))
        : previousValues.filter((entry) => entry !== value);
      return { ...prev, [fieldId]: nextValues };
    });
    this.clearCustomFieldError(fieldId);
  }

  protected isCustomMultiChoiceSelected(fieldId: string, value: string): boolean {
    const current = this.customFieldValues()[fieldId];
    return Array.isArray(current) ? current.includes(value) : false;
  }

  protected getCustomFieldError(fieldId: string): string {
    return this.customFieldErrors()[fieldId] ?? '';
  }

  protected getRentalVerificationImageUrl(fieldKey: string): string {
    return this.rentalVerificationValues()[fieldKey] ?? '';
  }

  protected getRentalVerificationError(fieldKey: string): string {
    return this.rentalVerificationErrors()[fieldKey] ?? '';
  }

  protected isCustomTextAreaField(field: OrderFormTemplateField): boolean { return field.type === 'textarea'; }
  protected isCustomSingleChoiceField(field: OrderFormTemplateField): boolean { return field.type === 'single_choice'; }
  protected isCustomMultiChoiceField(field: OrderFormTemplateField): boolean { return field.type === 'multi_choice'; }
  protected isCustomDropdownField(field: OrderFormTemplateField): boolean { return field.type === 'dropdown'; }
  protected isCustomImageField(field: OrderFormTemplateField): boolean { return field.type === 'image'; }

  protected resolveCustomInputType(field: OrderFormTemplateField): 'text' | 'email' | 'tel' | 'number' | 'date' | 'time' {
    switch (field.type) {
      case 'email': return 'email';
      case 'phone': return 'tel';
      case 'number': return 'number';
      case 'date': return 'date';
      case 'time': return 'time';
      default: return 'text';
    }
  }

  protected onCustomFileChange(fieldId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.notificationService.info('Đang tải ảnh lên...');

      this.fileService.upload(file).subscribe({
        next: (url) => {
          this.updateCustomFieldValue(fieldId, url);
          this.notificationService.success('Tải ảnh lên thành công!');
        },
        error: (err) => {
          console.error('File upload error:', err);
          this.notificationService.error('Lỗi khi tải ảnh lên.');
        }
      });
    }
  }

  protected onRentalVerificationFileChange(fieldKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];
    this.notificationService.info('Đang tải ảnh giấy tờ lên...');

    this.fileService.upload(file).subscribe({
      next: (url) => {
        this.rentalVerificationValues.update(prev => ({ ...prev, [fieldKey]: url }));
        this.clearRentalVerificationError(fieldKey);
        this.notificationService.success('Tải ảnh giấy tờ thành công.');
      },
      error: (err) => {
        console.error('Rental verification upload error:', err);
        this.notificationService.error('Lỗi khi tải ảnh giấy tờ lên.');
      }
    });
  }

  private clearCustomFieldError(fieldId: string): void {
    if (this.customFieldErrors()[fieldId]) {
      this.customFieldErrors.update(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  }

  private clearRentalVerificationError(fieldKey: string): void {
    if (this.rentalVerificationErrors()[fieldKey]) {
      this.rentalVerificationErrors.update(prev => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  }

  private resolveBackendFieldId(fieldId: string | number | null | undefined): number | null {
    if (typeof fieldId === 'number' && Number.isFinite(fieldId)) {
      return fieldId;
    }

    if (typeof fieldId === 'string' && fieldId.trim()) {
      const parsed = Number(fieldId);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private applyDraft(draft: AutoOrderDraft): void {
    if (draft.customerName) this.customerName.set(draft.customerName);
    if (draft.customerPhone) this.customerPhone.set(draft.customerPhone);
    if (draft.customerAddress) this.customerAddress.set(draft.customerAddress);
    if (draft.customerNote) this.customerNote.set(draft.customerNote);
    if (draft.sourceChannel) {
      this.sourceChannel.set(draft.sourceChannel);
      this.syncSelectedSourceChannelFromName();
    }
    if (draft.shippingMethod) {
      this.shippingMethod.set(draft.shippingMethod);
      this.syncSelectedShippingMethodFromName();
    }
    if (typeof draft.shippingFee === 'number' && Number.isFinite(draft.shippingFee)) {
      this.shippingFee.set(String(Math.max(0, Math.round(draft.shippingFee))));
    }
    if (draft.rentFrom) this.rentFrom.set(draft.rentFrom);
    if (draft.rentTo) this.rentTo.set(draft.rentTo);
    if (typeof draft.depositPaid === 'number' && Number.isFinite(draft.depositPaid)) {
      this.depositPaid.set(String(Math.max(0, Math.round(draft.depositPaid))));
    }
    if (draft.customFields) {
      const nextValues = { ...this.customFieldValues() };

      // Build a normalized lookup map for draft custom fields
      const draftLookup: Record<string, any> = {};
      Object.entries(draft.customFields).forEach(([k, v]) => {
        draftLookup[k.toLowerCase().replace(/\s+/g, '_')] = v;
        draftLookup[k.toLowerCase()] = v;
        draftLookup[k] = v;
      });

      this.customFields().forEach(field => {
        // Try to match by fieldId, then fieldKey, then label (various formats)
        const rawValue = draft.customFields![field.id]
          ?? draft.customFields![field.fieldKey]
          ?? draftLookup[field.fieldKey.toLowerCase()]
          ?? draftLookup[field.label.toLowerCase()]
          ?? draftLookup[field.label.toLowerCase().replace(/\s+/g, '_')];

        if (rawValue !== undefined && rawValue !== null) {
          if (field.type === 'multi_choice') {
            if (Array.isArray(rawValue)) nextValues[field.id] = rawValue.map(String);
            else if (typeof rawValue === 'string') {
              try {
                const parsed = JSON.parse(rawValue);
                if (Array.isArray(parsed)) nextValues[field.id] = parsed.map(String);
                else nextValues[field.id] = [rawValue];
              } catch {
                nextValues[field.id] = [rawValue];
              }
            }
          } else {
            nextValues[field.id] = String(rawValue);
          }
        }
      });
      this.customFieldValues.set(nextValues);
    }
  }

  private buildCustomFieldsPayload(): OrderCustomFieldValue[] | null {
    const errors: Record<string, string> = {};
    const values: OrderCustomFieldValue[] = [];
    const currentValues = this.customFieldValues();

    this.customFields().forEach(field => {
      const value = currentValues[field.id];
      const rules = field.validationRules || {};

      if (field.type === 'multi_choice') {
        const selectedValues = Array.isArray(value) ? value : [];
        if (field.required && selectedValues.length === 0) {
          errors[field.id] = 'Trường này bắt buộc chọn ít nhất một giá trị.';
          return;
        }
        if (selectedValues.length > 0) {
          values.push({
            fieldId: this.resolveBackendFieldId(field.id), fieldKeySnapshot: field.fieldKey, labelSnapshot: field.label,
            formTypeSnapshot: field.type, valueJson: JSON.stringify(selectedValues),
            showInListSnapshot: field.showInOrderList, showInDetailSnapshot: field.showInOrderDetail, sortOrderSnapshot: field.sortOrder
          });
        }
      } else {
        const stringValue = typeof value === 'string' ? value.trim() : '';

        // Required check
        if (field.required && !stringValue) {
          errors[field.id] = 'Trường này bắt buộc nhập.';
          return;
        }

        // Additional validation
        if (stringValue) {
          if (field.type === 'number') {
            const num = Number(stringValue);
            if (isNaN(num)) {
              errors[field.id] = 'Vui lòng nhập số hợp lệ.';
              return;
            }
            if (rules['min'] !== undefined && num < Number(rules['min'])) {
              errors[field.id] = `Giá trị tối thiểu là ${rules['min']}.`;
              return;
            }
            if (rules['max'] !== undefined && num > Number(rules['max'])) {
              errors[field.id] = `Giá trị tối đa là ${rules['max']}.`;
              return;
            }
          }

          if (field.type === 'phone') {
            if (!/^[0-9]{10,11}$/.test(stringValue)) {
              errors[field.id] = 'Số điện thoại không hợp lệ (10-11 chữ số).';
              return;
            }
          }

          if (field.type === 'email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
              errors[field.id] = 'Email không hợp lệ.';
              return;
            }
          }

          values.push({
            fieldId: this.resolveBackendFieldId(field.id), fieldKeySnapshot: field.fieldKey, labelSnapshot: field.label,
            formTypeSnapshot: field.type, valueJson: JSON.stringify(stringValue),
            showInListSnapshot: field.showInOrderList, showInDetailSnapshot: field.showInOrderDetail, sortOrderSnapshot: field.sortOrder
          });
        }
      }
    });
    this.customFieldErrors.set(errors);
    return Object.keys(errors).length > 0 ? null : values;
  }

  private buildRentalVerificationFieldsPayload(): OrderCustomFieldValue[] | null {
    if (!this.shouldShowRentalVerificationFields()) {
      this.rentalVerificationErrors.set({});
      return [];
    }

    const errors: Record<string, string> = {};
    const values: OrderCustomFieldValue[] = [];
    const currentValues = this.rentalVerificationValues();

    this.rentalVerificationFields.forEach(field => {
      const value = currentValues[field.key]?.trim() ?? '';
      if (!value) {
        errors[field.key] = 'Trường này bắt buộc tải ảnh lên.';
        return;
      }

      values.push({
        fieldId: null,
        fieldKeySnapshot: field.key,
        labelSnapshot: field.label,
        formTypeSnapshot: 'image',
        valueJson: JSON.stringify(value),
        showInListSnapshot: false,
        showInDetailSnapshot: true,
        sortOrderSnapshot: field.sortOrder
      });
    });

    this.rentalVerificationErrors.set(errors);
    return Object.keys(errors).length > 0 ? null : values;
  }

  private buildOrderCustomFieldPayload(): OrderCustomFieldValue[] | null {
    const customFields = this.buildCustomFieldsPayload();
    if (!customFields) {
      return null;
    }

    const rentalVerificationFields = this.buildRentalVerificationFieldsPayload();
    if (!rentalVerificationFields) {
      return null;
    }

    return [...customFields, ...rentalVerificationFields];
  }

  async submit() {
    if (this.selectedVariants.length === 0) {
      this.notificationService.error('Không có sản phẩm nào được chọn.');
      return;
    }

    const cName = this.customerName().trim();
    const cPhone = this.customerPhone().trim();
    const cAddress = this.customerAddress().trim();
    const cNote = this.customerNote().trim();
    const sChannel = this.sourceChannel().trim();

    // Inline validation for required fields
    let hasFieldError = false;

    if (!cName) {
      this.customerNameError.set('Vui lòng nhập tên khách hàng.');
      hasFieldError = true;
    } else {
      this.customerNameError.set('');
    }

    if (!cPhone || !/^\+\d{7,15}$/.test(cPhone)) {
      this.customerPhoneError.set(cPhone ? 'Số điện thoại không hợp lệ.' : 'Vui lòng nhập số điện thoại.');
      hasFieldError = true;
    } else {
      this.customerPhoneError.set('');
    }

    const customFields = this.buildOrderCustomFieldPayload();
    if (!customFields) {
      this.notificationService.error('Vui lòng hoàn tất các trường bắt buộc của đơn hàng.');
      return;
    }

    let rentF = this.rentFrom().trim();
    let rentT = this.rentTo().trim();
    const depositP = parseOptionalPositiveNumber(this.depositPaid());
    const sMethod = this.shippingMethod().trim();
    const sFee = parseOptionalPositiveNumber(this.shippingFee());

    if (this.isRentOrder()) {
      if (!rentF) {
        this.rentFromError.set('Vui lòng chọn ngày nhận.');
        hasFieldError = true;
      } else {
        this.rentFromError.set('');
      }
      if (!rentT) {
        this.rentToError.set('Vui lòng chọn ngày trả.');
        hasFieldError = true;
      } else {
        this.rentToError.set('');
      }

      if (hasFieldError) return;

      const fallbackDate = new Date().toISOString().slice(0, 10);
      rentF = rentF || fallbackDate;
      rentT = rentT || rentF;

      const rentFromTime = new Date(rentF).getTime();
      const rentToTime = new Date(rentT).getTime();

      if (Number.isNaN(rentFromTime) || Number.isNaN(rentToTime)) {
        this.rentFromError.set('Định dạng ngày không hợp lệ.');
        return;
      }
      if (rentFromTime > rentToTime) {
        this.rentFromError.set('Ngày nhận không được sau ngày trả.');
        return;
      }
    }

    if (hasFieldError) return;

    this.submitting.set(true);

    try {
      const input: CreateOrderInput = {
        orderType: this.selectedOrderType,
        customerName: cName,
        customerPhone: cPhone,
        customerAddress: cAddress,
        customerNote: cNote,
        sourceChannel: sChannel || undefined,
        sourceChannelId: this.selectedSourceChannelId() || undefined,
        sourceMethod: this.sourceMethod,
        shippingMethod: sMethod || undefined,
        products: this.selectedVariants.map(sv => ({
          variantId: sv.variantId, name: sv.name, size: sv.size, quantity: sv.quantity, unitPrice: sv.unitPrice
        })),
        customFieldValues: customFields,
        ...(this.isRentOrder() && {
          rentFrom: rentF,
          rentTo: rentT,
          depositPaid: depositP
        }),
        shippingMethodId: this.selectedShippingMethodId() || undefined,
        shippingFee: sFee
      };

      const order = await this.store.createOrder(input);
      this.notificationService.success('Tạo đơn hàng thành công!');
      this.success.emit(order.id);
    } catch (error) {
      this.notificationService.error('Lỗi khi tạo đơn hàng');
      console.error(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private syncSelectedSourceChannelFromName(): void {
    if (this.selectedSourceChannelId() || !this.sourceChannel().trim()) {
      return;
    }

    const matchedSource = this.orderSources().find(source =>
      this.normalizeLookupValue(source.name) === this.normalizeLookupValue(this.sourceChannel())
    );

    if (matchedSource) {
      this.selectedSourceChannelId.set(matchedSource.id);
      this.sourceChannel.set(matchedSource.name);
    }
  }

  private syncSelectedShippingMethodFromName(): void {
    if (this.selectedShippingMethodId() || !this.shippingMethod().trim()) {
      return;
    }

    const matchedMethod = this.shippingMethods().find(method =>
      this.normalizeLookupValue(method.name) === this.normalizeLookupValue(this.shippingMethod())
    );

    if (!matchedMethod?.id) {
      return;
    }

    this.selectedShippingMethodId.set(matchedMethod.id);
    this.shippingMethod.set(matchedMethod.name);

    if (!this.shippingFee().trim()) {
      if (matchedMethod.feePolicy === 'FIXED_FEE') {
        this.shippingFee.set(String(matchedMethod.defaultFee || 0));
      } else {
        this.shippingFee.set('0');
      }
    }
  }

  private normalizeLookupValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}

