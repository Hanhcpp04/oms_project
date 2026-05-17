import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { HttpService } from '../../../core/http/http.service';
import { FileApiService } from '../../../core/services/file-api.service';
import { Product } from '../../products/data-access/models/product.model';
import { NotificationService } from '../../../core/services/notification.service';
import { OrderFormTemplate, OrderFormTemplateField } from '../../../core/models/order-form-template.model';
import { OrderCustomFieldValue, OrderType } from '../../orders/data-access/models/order.model';
import { ApiEnvelope, isRecord, unwrapApiResponse } from '../../../core/utils/api-response.util';
import { PublicPaymentConfig } from '../../../core/services/payment-config.service';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneDigits } from '../../../shared/utils/phone-format.util';
import { FIXED_RENTAL_VERIFICATION_FIELDS } from '../../orders/utils/rental-verification-fields.util';
import { RentalAvailabilityApiService, RentalAvailabilityBlock } from '../../../core/services/rental-availability-api.service';
import { InternationalPhoneInputComponent } from '../../../shared/components/form/international-phone-input.component';
import { DynamicFormRendererComponent } from '../../../shared/components/dynamic-form/dynamic-form-renderer.component';
import { DynamicFieldValue, DynamicRenderField } from '../../../shared/components/dynamic-form/dynamic-form.types';
import { formatVndCurrency } from '../../../shared/utils/currency.util';

export type PaymentMethodType = 'COD' | 'BANK_TRANSFER' | 'VNPAY';

interface OrderFormCustomFieldDto {
  id: string | number;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  showInOrderList: boolean;
  showInOrderDetail: boolean;
  placeholder: string;
  helperText: string;
  validationRulesJson?: string;
  options: any[];
}

interface OrderFormConfigDto {
  id: string | number;
  formType: string;
  customFields: OrderFormCustomFieldDto[];
}

interface FormConfigResponse {
  shopName: string;
  shopSlug: string;
  logoUrl?: string;
  shopPhone?: string;
  shopEmail?: string;
  businessMode: string;
  showInventoryOnStorefront?: boolean;
  rentalIdentityVerificationEnabled?: boolean;
  products: Product[];
  sellConfig?: OrderFormConfigDto;
  rentConfig?: OrderFormConfigDto;
  shippingMethods?: any[];
  orderSources?: any[];
  paymentConfig?: PublicPaymentConfig;
}

interface PublicFormErrorState {
  title: string;
  message: string;
}

interface PaymentCheckout {
  provider?: string;
  method?: string;
  status?: string;
  providerOrderCode?: number;
  providerPaymentLinkId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  checkoutUrl?: string;
  qrCode?: string;
  qrImageUrl?: string;
}

interface PublicOrderSubmitResponse {
  id?: number;
  orderCode?: string;
  paymentStatus?: string;
  trackingToken?: string;
  payment?: PaymentCheckout;
}

interface PublicOrderTrackingResponse {
  paymentStatus?: string;
}

@Component({
  selector: 'app-public-order-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DynamicFormRendererComponent],
  templateUrl: './public-order-form-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicOrderFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpService);
  private readonly fileApiService = inject(FileApiService);
  private readonly rentalAvailabilityApi = inject(RentalAvailabilityApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);
  protected readonly Number = Number;
  protected readonly rentalVerificationFields = FIXED_RENTAL_VERIFICATION_FIELDS;

  protected formatVND(value: string | number | null | undefined): string {
    return formatVndCurrency(value, '0 ₫');
  }


  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPhoneInput(input.value);
    if (input.value !== formatted.display) {
      input.value = formatted.display;
    }
    this.form.patchValue({ customerPhone: formatted.raw });
  }

  readonly loading = signal(true);
  readonly error = signal<PublicFormErrorState | null>(null);
  readonly config = signal<FormConfigResponse | null>(null);
  readonly success = signal(false);
  readonly submitting = signal(false);

  readonly selectedProduct = signal<Product | null>(null);
  readonly selectedVariant = signal<any | null>(null);
  readonly selectedOrderType = signal<OrderType>('SELL');
  readonly quantity = signal(1);
  readonly selectedShippingMethodId = signal<number | null>(null);
  readonly selectedSourceChannelId = signal<number | null>(null);
  readonly isPaymentStep = signal(false);
  readonly selectedPaymentMethod = signal<PaymentMethodType | null>(null);
  readonly successQrUrl = signal<string | null>(null);
  readonly paymentCheckout = signal<PaymentCheckout | null>(null);
  readonly trackingToken = signal<string | null>(null);
  readonly paymentNotice = signal<string | null>(null);
  readonly checkingPayment = signal(false);
  readonly rentalVerificationValues = signal<Record<string, string>>({});
  readonly rentalVerificationErrors = signal<Record<string, string>>({});
  readonly rentalAvailabilityLoading = signal(false);
  readonly rentalAvailabilityBlocks = signal<RentalAvailabilityBlock[]>([]);
  readonly rentalDateError = signal<string | null>(null);
  readonly rentalCalendarDays = signal(this.buildRentalCalendarDays());

  protected readonly shippingMethodOptions = computed(() =>
    this.config()?.shippingMethods?.map(m => ({ label: m.name, value: m.id?.toString() || '' })) || []
  );

  protected readonly orderSourceOptions = computed(() =>
    this.config()?.orderSources?.map(s => ({ label: s.name, value: s.id.toString() })) || []
  );

  protected readonly availablePaymentMethods = computed(() => {
    const cfg = this.config()?.paymentConfig;
    if (!cfg) return [];
    const methods: { value: PaymentMethodType; label: string; desc: string; icon: string }[] = [];
    if (cfg.codEnabled) methods.push({ value: 'COD', label: 'Thanh toán khi nhận hàng (COD)', desc: 'Trả tiền mặt khi nhận hàng', icon: '💵' });
    if (cfg.bankTransferEnabled) methods.push({ value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng', desc: 'Quét mã QR để chuyển khoản', icon: '🏦' });
    if (cfg.vnpayEnabled) methods.push({ value: 'VNPAY', label: 'Thanh toán qua VNPay', desc: 'Cổng thanh toán trực tuyến an toàn', icon: '💳' });
    return methods;
  });

  protected readonly previewQrUrl = computed(() => {
    const cfg = this.config()?.paymentConfig;
    if (!cfg?.bankTransferEnabled || !cfg.bankCode || !cfg.bankAccountNumber) return null;
    const name = encodeURIComponent((cfg.bankAccountName ?? '').toUpperCase());
    const amount = this.totalAmount();
    const addInfo = encodeURIComponent('Thanh toan don hang');
    const amountParam = amount > 0 ? `&amount=${Math.round(amount)}` : '';
    return `https://img.vietqr.io/image/${cfg.bankCode}-${cfg.bankAccountNumber}-compact.png?accountName=${name}${amountParam}&addInfo=${addInfo}`;
  });

  readonly form = this.fb.group({
    customerName: ['', Validators.required],
    customerPhone: ['', Validators.required],
    customerAddress: ['', Validators.required],
    customerNote: [''],
    rentFrom: [''],
    rentTo: ['']
  });

  readonly customFieldValues = signal<Record<string, string | string[]>>({});
  readonly customFieldErrors = signal<Record<string, string>>({});

  readonly customFields = computed(() => {
    const product = this.selectedProduct();
    if (!product) return [];

    const isRent = this.isRentProduct(product);

    const config = isRent
      ? this.config()?.rentConfig
      : this.config()?.sellConfig;

    return config?.customFields || [];
  });
  readonly renderableCustomFields = computed(() =>
    this.customFields().filter(field => field.fieldType !== 'image')
  );
  readonly imageCustomFields = computed(() =>
    this.customFields().filter(field => field.fieldType === 'image')
  );
  readonly availableVariants = computed(() => {
    return this.selectedProduct()?.variants || [];
  });

  readonly totalAmount = computed(() => {
    const variant = this.selectedVariant();
    if (!variant) return 0;
    const price = this.getVariantPrice(variant);
    let total = price * this.quantity();

    // Add shipping fee if FIXED_FEE
    const methodId = this.selectedShippingMethodId();
    if (methodId && this.config()?.shippingMethods) {
      const method = this.config()?.shippingMethods?.find(m => m.id === methodId);
      if (method && method.feePolicy === 'FIXED_FEE') {
        total += (method.defaultFee || 0);
      }
    }

    return total;
  });

  private shopSlug = '';

  ngOnInit() {
    this.shopSlug = this.route.snapshot.paramMap.get('shopSlug') || '';
    const productId = this.route.snapshot.queryParamMap.get('p');
    const variantIds = this.route.snapshot.queryParamMap.get('v')?.split(',') || [];
    const requestedOrderType = this.normalizeOrderType(this.route.snapshot.queryParamMap.get('orderType'));

    if (!this.shopSlug) {
      this.error.set({
        title: 'Không thể tải form',
        message: 'Thiếu thông tin shop trong đường dẫn.'
      });
      this.loading.set(false);
      return;
    }

    this.http.get<FormConfigResponse | ApiEnvelope<FormConfigResponse>>(`/public/shops/${this.shopSlug}/form`)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          const res = unwrapApiResponse(response);
          // Normalize products to ensure 'active' and 'id' properties are correct
          if (res.products) {
            res.products = res.products.map(p => ({
              ...p,
              id: p.id?.toString(),
              active: (p as any).isActive ?? p.active,
              variants: p.variants?.map(v => ({
                ...v,
                id: v.id?.toString(),
                active: (v as any).isActive ?? (v as any).active
              }))
            }));
          }
          this.config.set(res);
          if (res.shippingMethods?.length) {
            this.selectedShippingMethodId.set(res.shippingMethods[0].id);
          }
          // Pre-select first available payment method
          const pmethods: PaymentMethodType[] = [];
          if (res.paymentConfig?.codEnabled) pmethods.push('COD');
          if (res.paymentConfig?.bankTransferEnabled) pmethods.push('BANK_TRANSFER');
          if (res.paymentConfig?.vnpayEnabled) pmethods.push('VNPAY');
          if (pmethods.length > 0) this.selectedPaymentMethod.set(pmethods[0]);

          if (productId) {
            const prod = res.products?.find(p => p.id === productId || p.id?.toString() === productId);
            if (prod) {
              this.selectedOrderType.set(this.resolveProductOrderType(prod, requestedOrderType));
              this.selectedProduct.set(prod);

              if (this.isRentProduct(prod)) {
                this.form.controls.rentFrom.setValidators(Validators.required);
                this.form.controls.rentTo.setValidators(Validators.required);
                this.form.controls.rentFrom.updateValueAndValidity();
                this.form.controls.rentTo.updateValueAndValidity();
              }

              if (variantIds.length > 0 && prod.variants) {
                const variant = prod.variants.find(v => variantIds.includes(v.id?.toString() || ''));
                if (variant) {
                  this.selectVariant(variant);
                } else {
                  this.selectVariant(prod.variants[0]);
                }
              } else if (prod.variants?.length) {
                this.selectVariant(prod.variants[0]);
              }
            }
          }
        },
        error: (err: unknown) => {
          this.error.set(this.resolveFormLoadError(err));
        }
      });
  }

  private resolveFormLoadError(error: unknown): PublicFormErrorState {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.extractBackendMessage(error).toLowerCase();
      const backendCode = this.extractBackendCode(error);

      if (backendCode === 'E203' || backendMessage.includes('maintenance mode')) {
        return {
          title: 'Shop đang bảo trì',
          message: 'Shop hiện đang ở chế độ bảo trì. Vui lòng quay lại sau.'
        };
      }

      if (backendCode === 'E202' || backendMessage.includes('shop is not active') || backendMessage.includes('suspended')) {
        return {
          title: 'Shop tạm ngừng hoạt động',
          message: 'Shop hiện không nhận đơn qua form công khai. Vui lòng liên hệ shop để biết thêm thông tin.'
        };
      }

      if (error.status === 404 || backendCode === 'E002' || backendMessage.includes('not found')) {
        return {
          title: 'Không tìm thấy Form',
          message: 'Link form không hợp lệ hoặc shop không tồn tại.'
        };
      }
    }

    return {
      title: 'Không thể tải form',
      message: 'Đã có lỗi khi tải form. Vui lòng thử lại sau.'
    };
  }

  private extractBackendMessage(error: HttpErrorResponse): string {
    if (typeof error.error === 'string') {
      return error.error;
    }

    if (isRecord(error.error) && typeof error.error['message'] === 'string') {
      return error.error['message'];
    }

    return error.message;
  }

  private extractBackendCode(error: HttpErrorResponse): string {
    if (isRecord(error.error) && typeof error.error['error'] === 'string') {
      return error.error['error'];
    }

    return '';
  }

  selectVariant(variant: any) {
    this.selectedVariant.set(variant);
    this.form.patchValue({ rentFrom: '', rentTo: '' });
    this.rentalDateError.set(null);
    if (this.isRentOrderSelected()) {
      this.loadRentalAvailability();
    } else {
      this.rentalAvailabilityBlocks.set([]);
    }
  }

  updateQuantity(delta: number) {
    const maxQty = Math.max(this.selectedVariant()?.stockQty || 1, 1);
    const newQty = Math.min(maxQty, Math.max(1, this.quantity() + delta));
    this.quantity.set(newQty);
  }

  getVariantPrice(variant: any): number {
    const isRent = this.isRentProduct(this.selectedProduct());
    return isRent ? (variant.priceRentPerDay || 0) : (variant.priceSell || 0);
  }

  formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }

  // --- Custom fields helpers (inspired by TabManualFormComponent) ---
  protected getCustomFieldValue(fieldId: string | number): string {
    const value = this.customFieldValues()[String(fieldId)];
    return typeof value === 'string' ? value : '';
  }

  protected updateCustomFieldValue(fieldId: string | number, value: string): void {
    this.customFieldValues.update(prev => ({ ...prev, [String(fieldId)]: value }));
    this.clearCustomFieldError(String(fieldId));
  }

  protected onCustomValuesChange(values: Record<string, DynamicFieldValue>): void {
    const nextValues: Record<string, string | string[]> = {};
    Object.entries(values).forEach(([fieldId, value]) => {
      if (Array.isArray(value) || typeof value === 'string') {
        nextValues[fieldId] = value;
      }
    });

    this.customFieldValues.set(nextValues);
    this.customFieldErrors.update((errors) => {
      const next = { ...errors };
      Object.keys(values).forEach((fieldId) => delete next[fieldId]);
      return next;
    });
  }

  private onCustomFileUpload(fieldId: string | number, file: File): void {
    this.fileApiService.upload(file).subscribe({
      next: (url) => this.updateCustomFieldValue(fieldId, url),
      error: () => this.toast.error('Không thể tải ảnh lên. Vui lòng thử lại!')
    });
  }

  protected getCustomFieldDisplayValue(field: OrderFormCustomFieldDto): string {
    const value = this.getCustomFieldValue(field.id);
    if (field.fieldType !== 'phone') {
      return value;
    }

    return formatPhoneDisplay(normalizePhoneDigits(value));
  }

  protected onCustomFieldInput(field: OrderFormCustomFieldDto, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (field.fieldType === 'phone') {
      const formatted = formatPhoneInput(input.value);
      if (input.value !== formatted.display) {
        input.value = formatted.display;
      }
      this.updateCustomFieldValue(field.id, formatted.raw);
      return;
    }

    this.updateCustomFieldValue(field.id, input.value);
  }

  protected onCustomFileChange(fieldId: string | number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.fileApiService.upload(file).subscribe({
        next: (url) => {
          this.updateCustomFieldValue(fieldId, url);
        },
        error: () => this.toast.error('Không thể tải ảnh lên. Vui lòng thử lại!')
      });
    }
  }

  protected onCustomRendererFileSelected(event: { field: DynamicRenderField; file: File }): void {
    this.fileApiService.upload(event.file).subscribe({
      next: (url) => this.updateCustomFieldValue(event.field.id, url),
      error: () => this.toast.error('Không thể tải ảnh lên. Vui lòng thử lại!')
    });
  }

  protected handleFileSelected(event: { field: DynamicRenderField; file: File }): void {
    this.onCustomRendererFileSelected(event);
  }

  protected isRentOrderSelected(): boolean {
    return this.isRentProduct(this.selectedProduct());
  }

  protected selectRentalDate(day: string): void {
    if (this.isRentalDayBlocked(day)) {
      return;
    }

    const currentStart = this.form.controls.rentFrom.value || '';
    const currentEnd = this.form.controls.rentTo.value || '';

    if (!currentStart || currentEnd || day < currentStart) {
      this.form.patchValue({ rentFrom: day, rentTo: '' });
      this.rentalDateError.set('Vui lòng chọn ngày kết thúc thuê.');
      return;
    }

    if (!this.isRentalRangeAvailable(currentStart, day)) {
      this.rentalDateError.set('Khoảng ngày đã chọn có ngày không còn trống. Vui lòng chọn khoảng khác.');
      return;
    }

    this.form.patchValue({ rentTo: day });
    this.rentalDateError.set(null);
  }

  protected isRentalDateRangeValid(): boolean {
    const start = this.form.controls.rentFrom.value || '';
    const end = this.form.controls.rentTo.value || '';
    return Boolean(start && end && start <= end && this.isRentalRangeAvailable(start, end));
  }

  protected isRentalDayDisabled(day: string): boolean {
    if (this.isRentalDayBlocked(day)) {
      return true;
    }

    const currentStart = this.form.controls.rentFrom.value || '';
    const currentEnd = this.form.controls.rentTo.value || '';
    return Boolean(currentStart && !currentEnd && day >= currentStart && !this.isRentalRangeAvailable(currentStart, day));
  }

  protected getRentalDayClass(day: string): string {
    if (this.isRentalDayBlocked(day)) {
      return 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]';
    }

    if (this.isRentalDaySelected(day)) {
      return 'border-[#111111] bg-[#111111] text-white';
    }

    if (this.isRentalDayInSelectedRange(day)) {
      return 'border-[#A3A3A3] bg-[#E5E5E5] text-[#111111]';
    }

    return 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] hover:border-[#111111]';
  }

  protected getRentalDayTitle(day: string): string {
    if (this.isRentalDayBlocked(day)) {
      return 'Đã có khách giữ lịch';
    }

    if (this.isRentalDayDisabled(day)) {
      return 'Khoảng chọn đi qua ngày đã giữ lịch';
    }

    return 'Còn trống';
  }

  protected formatRentalDayLabel(day: string): string {
    return new Date(`${day}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  protected shouldShowRentalVerificationFields(): boolean {
    return this.isRentOrderSelected() && Boolean(this.config()?.rentalIdentityVerificationEnabled);
  }

  protected shouldShowInventory(): boolean {
    return Boolean(this.config()?.showInventoryOnStorefront);
  }

  protected getRentalVerificationImageUrl(fieldKey: string): string {
    return this.rentalVerificationValues()[fieldKey] ?? '';
  }

  protected getRentalVerificationError(fieldKey: string): string {
    return this.rentalVerificationErrors()[fieldKey] ?? '';
  }

  protected onRentalVerificationFileChange(fieldKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];
    this.fileApiService.upload(file).subscribe({
      next: (url) => {
        this.rentalVerificationValues.update(prev => ({ ...prev, [fieldKey]: url }));
        this.clearRentalVerificationError(fieldKey);
      },
      error: () => this.toast.error('Không thể tải ảnh giấy tờ lên. Vui lòng thử lại!')
    });
  }

  protected setCustomSingleChoiceValue(fieldId: string | number, value: string): void {
    this.customFieldValues.update(prev => ({ ...prev, [String(fieldId)]: value }));
    this.clearCustomFieldError(String(fieldId));
  }

  protected toggleCustomMultiChoiceValue(fieldId: string | number, value: string, checked: boolean): void {
    this.customFieldValues.update(prev => {
      const current = prev[String(fieldId)];
      const previousValues = Array.isArray(current) ? current : [];
      const nextValues = checked
        ? Array.from(new Set([...previousValues, value]))
        : previousValues.filter((entry) => entry !== value);
      return { ...prev, [String(fieldId)]: nextValues };
    });
    this.clearCustomFieldError(String(fieldId));
  }

  protected isCustomMultiChoiceSelected(fieldId: string | number, value: string): boolean {
    const current = this.customFieldValues()[String(fieldId)];
    return Array.isArray(current) ? current.includes(value) : false;
  }

  protected getCustomFieldError(fieldId: string | number): string {
    return this.customFieldErrors()[String(fieldId)] ?? '';
  }

  protected isCustomTextAreaField(field: OrderFormCustomFieldDto): boolean { return field.fieldType === 'textarea'; }
  protected isCustomSingleChoiceField(field: OrderFormCustomFieldDto): boolean { return field.fieldType === 'single_choice'; }
  protected isCustomMultiChoiceField(field: OrderFormCustomFieldDto): boolean { return field.fieldType === 'multi_choice'; }
  protected isCustomDropdownField(field: OrderFormCustomFieldDto): boolean { return field.fieldType === 'dropdown'; }
  protected isCustomImageField(field: OrderFormCustomFieldDto): boolean { return field.fieldType === 'image'; }

  protected resolveCustomInputType(field: OrderFormCustomFieldDto): string {
    switch (field.fieldType) {
      case 'email': return 'email';
      case 'phone': return 'tel';
      case 'number': return 'number';
      case 'date': return 'date';
      case 'time': return 'time';
      default: return 'text';
    }
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

  private buildCustomFieldsPayload(): OrderCustomFieldValue[] | null {
    const errors: Record<string, string> = {};
    const values: OrderCustomFieldValue[] = [];
    const currentValues = this.customFieldValues();

    this.customFields().forEach((field: OrderFormCustomFieldDto) => {
      const value = currentValues[String(field.id)];

      let validationRules: any = {};
      if (field.validationRulesJson) {
        try {
          validationRules = JSON.parse(field.validationRulesJson);
        } catch (e) { }
      }

      if (field.fieldType === 'multi_choice') {
        const selectedValues = Array.isArray(value) ? value : [];
        if (field.isRequired && selectedValues.length === 0) {
          errors[String(field.id)] = 'Trường này bắt buộc chọn ít nhất một giá trị.';
          return;
        }
        if (selectedValues.length > 0) {
          values.push({
            fieldId: this.resolveBackendFieldId(field.id), fieldKeySnapshot: field.fieldKey, labelSnapshot: field.label,
            formTypeSnapshot: field.fieldType, valueJson: JSON.stringify(selectedValues),
            showInListSnapshot: field.showInOrderList, showInDetailSnapshot: field.showInOrderDetail, sortOrderSnapshot: field.sortOrder
          });
        }
      } else {
        const stringValue = typeof value === 'string' ? value.trim() : '';

        // Required check
        if (field.isRequired && !stringValue) {
          errors[String(field.id)] = 'Trường này bắt buộc nhập.';
          return;
        }

        // Additional validation logic
        if (stringValue) {
          if (field.fieldType === 'number') {
            const num = Number(stringValue);
            if (isNaN(num)) {
              errors[String(field.id)] = 'Vui lòng nhập số hợp lệ.';
              return;
            }
            if (validationRules.min !== undefined && num < Number(validationRules.min)) {
              errors[String(field.id)] = `Giá trị tối thiểu là ${validationRules.min}.`;
              return;
            }
            if (validationRules.max !== undefined && num > Number(validationRules.max)) {
              errors[String(field.id)] = `Giá trị tối đa là ${validationRules.max}.`;
              return;
            }
          }

          if (field.fieldType === 'phone') {
            if (!/^[0-9]{10,11}$/.test(stringValue)) {
              errors[String(field.id)] = 'Số điện thoại không hợp lệ (10-11 chữ số).';
              return;
            }
          }

          if (field.fieldType === 'email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
              errors[String(field.id)] = 'Email không hợp lệ.';
              return;
            }
          }

          values.push({
            fieldId: this.resolveBackendFieldId(field.id), fieldKeySnapshot: field.fieldKey, labelSnapshot: field.label,
            formTypeSnapshot: field.fieldType, valueJson: JSON.stringify(stringValue),
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
    const customFieldsPayload = this.buildCustomFieldsPayload();
    if (!customFieldsPayload) {
      return null;
    }

    const rentalVerificationPayload = this.buildRentalVerificationFieldsPayload();
    if (!rentalVerificationPayload) {
      return null;
    }

    return [...customFieldsPayload, ...rentalVerificationPayload];
  }

  submit() {
    if (this.isRentOrderSelected() && !this.validateRentalDateSelection()) {
      return;
    }

    const customFieldsPayload = this.buildOrderCustomFieldPayload();
    if (!customFieldsPayload) {
      this.toast.error('Vui lòng hoàn tất các trường bắt buộc!');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Vui lòng điền đầy đủ thông tin liên hệ bắt buộc!');
      return;
    }

    this.confirmOrder();
  }

  confirmOrder() {
    if (this.isRentOrderSelected() && !this.validateRentalDateSelection()) {
      return;
    }

    const customFieldsPayload = this.buildOrderCustomFieldPayload();
    if (!customFieldsPayload) return;

    this.submitting.set(true);

    const v = this.form.value;
    const variant = this.selectedVariant();
    const product = this.selectedProduct();
    const config = this.config();

    // For SELL_RENT, we need to decide order type. Default to SELL unless shop is in RENT mode.
    const orderType = product?.productType === 'SELL_RENT'
      ? this.selectedOrderType()
      : product?.productType;

    const payload = {
      orderType: orderType,
      customerName: v.customerName,
      customerPhone: v.customerPhone,
      customerAddress: v.customerAddress,
      customerNote: v.customerNote,
      rentFrom: v.rentFrom || undefined,
      rentTo: v.rentTo || undefined,
      shippingMethodId: this.selectedShippingMethodId() || undefined,
      sourceChannelId: this.selectedSourceChannelId() || undefined,
      paymentMethod: this.selectedPaymentMethod() || undefined,
      customFieldValues: customFieldsPayload,
      items: [
        {
          variantId: variant.id,
          quantity: this.quantity()
        }
      ]
    };

    this.http.post(`/public/shops/${this.shopSlug}/orders`, payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response: any) => {
          const res = unwrapApiResponse(response) as PublicOrderSubmitResponse;
          const checkout = res.payment ?? null;
          this.paymentCheckout.set(checkout);
          this.trackingToken.set(res.trackingToken ?? null);
          this.paymentNotice.set(null);
          this.successQrUrl.set(null);

          if (this.selectedPaymentMethod() === 'BANK_TRANSFER') {
            if (checkout?.qrImageUrl) {
              this.successQrUrl.set(checkout.qrImageUrl);
            } else {
              const cfg = this.config()?.paymentConfig;
              if (cfg?.bankCode && cfg?.bankAccountNumber) {
                const amount = this.totalAmount();
                const orderCode = res.orderCode || '';
                const name = encodeURIComponent((cfg.bankAccountName ?? '').toUpperCase());
                const addInfo = encodeURIComponent(`Thanh toan don hang ${orderCode}`);
                this.successQrUrl.set(
                  `https://img.vietqr.io/image/${cfg.bankCode}-${cfg.bankAccountNumber}-compact.png?amount=${Math.round(amount)}&addInfo=${addInfo}&accountName=${name}`
                );
              }
            }
            this.isPaymentStep.set(true);
            this.success.set(false);
          } else if (this.selectedPaymentMethod() === 'VNPAY') {
            this.isPaymentStep.set(true);
            this.success.set(false);
          } else {
            this.isPaymentStep.set(false);
            this.success.set(true);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: () => {
          this.toast.error('Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại!');
        }
      });
  }

  completePayment() {
    if (!this.paymentCheckout()) {
      this.isPaymentStep.set(false);
      this.success.set(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const token = this.trackingToken();
    if (!token) {
      this.isPaymentStep.set(false);
      this.success.set(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.checkingPayment.set(true);
    this.http.get(`/public/orders/track/${encodeURIComponent(token)}`)
      .pipe(finalize(() => this.checkingPayment.set(false)))
      .subscribe({
        next: (response: any) => {
          const trackedOrder = unwrapApiResponse(response) as PublicOrderTrackingResponse;
          if (trackedOrder.paymentStatus === 'PAID') {
            this.paymentNotice.set(null);
            this.isPaymentStep.set(false);
            this.success.set(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }

          this.paymentNotice.set('Hệ thống chưa ghi nhận thanh toán. Nếu bạn vừa chuyển khoản, vui lòng đợi vài giây rồi kiểm tra lại.');
        },
        error: () => {
          this.toast.error('Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại!');
        }
      });
  }


  resetForm() {
    this.success.set(false);
    this.isPaymentStep.set(false);
    this.successQrUrl.set(null);
    this.paymentCheckout.set(null);
    this.trackingToken.set(null);
    this.paymentNotice.set(null);
    this.checkingPayment.set(false);
    this.form.reset();
    this.quantity.set(1);
    this.customFieldValues.set({});
    this.customFieldErrors.set({});
    this.rentalVerificationValues.set({});
    this.rentalVerificationErrors.set({});
    this.rentalDateError.set(null);
    if (this.config()?.shippingMethods?.length) {
      this.selectedShippingMethodId.set(this.config()?.shippingMethods![0].id);
    }
    this.selectedSourceChannelId.set(null);
    // Re-select first payment method
    const pmethods: PaymentMethodType[] = [];
    if (this.config()?.paymentConfig?.codEnabled) pmethods.push('COD');
    if (this.config()?.paymentConfig?.bankTransferEnabled) pmethods.push('BANK_TRANSFER');
    if (this.config()?.paymentConfig?.vnpayEnabled) pmethods.push('VNPAY');
    this.selectedPaymentMethod.set(pmethods[0] ?? null);

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private isRentProduct(product: Product | null | undefined): boolean {
    if (!product) {
      return false;
    }

    return product.productType === 'RENT'
      || (product.productType === 'SELL_RENT' && this.selectedOrderType() === 'RENT');
  }

  private resolveProductOrderType(product: Product, requestedOrderType: OrderType | null): OrderType {
    if (product.productType === 'SELL') {
      return 'SELL';
    }

    if (product.productType === 'RENT') {
      return 'RENT';
    }

    if (requestedOrderType) {
      return requestedOrderType;
    }

    return this.config()?.businessMode === 'RENT' ? 'RENT' : 'SELL';
  }

  private normalizeOrderType(value: string | null): OrderType | null {
    const normalized = value?.trim().toUpperCase();
    return normalized === 'SELL' || normalized === 'RENT' ? normalized : null;
  }

  private loadRentalAvailability(): void {
    const product = this.selectedProduct();
    const variant = this.selectedVariant();
    const days = this.rentalCalendarDays();
    if (!product?.id || !variant?.id || !this.shopSlug) {
      this.rentalAvailabilityBlocks.set([]);
      return;
    }

    this.rentalAvailabilityLoading.set(true);
    
    // Find the first non-placeholder day to use as the from date
    const firstValidDay = days.find(d => !d.isPlaceholder);
    
    this.rentalAvailabilityApi.getPublicAvailability(this.shopSlug, {
      productId: product.id,
      variantId: variant.id,
      from: firstValidDay?.dateStr || '',
      to: days[days.length - 1]?.dateStr
    })
      .pipe(finalize(() => this.rentalAvailabilityLoading.set(false)))
      .subscribe({
        next: (blocks) => this.rentalAvailabilityBlocks.set(blocks),
        error: () => this.rentalAvailabilityBlocks.set([])
      });
  }

  private isRentalDayBlocked(day: string): boolean {
    const variant = this.selectedVariant();
    if (!variant?.id) {
      return false;
    }

    const reservedQty = this.rentalAvailabilityBlocks().filter((block) =>
      String(block.variantId) === String(variant.id)
      && block.startDate <= day
      && block.endDate >= day
    ).length;

    return reservedQty >= Math.max(variant.stockQty || 0, 0);
  }

  private isRentalRangeAvailable(start: string, end: string): boolean {
    if (!start || !end || start > end) {
      return false;
    }

    const variant = this.selectedVariant();
    if (!variant?.id) {
      return false;
    }

    const maxReservedQty = this.maxConcurrentRentalBlocks(
      this.rentalAvailabilityBlocks().filter((block) =>
        String(block.variantId) === String(variant.id)
        && block.startDate <= end
        && block.endDate >= start
      ),
      start,
      end
    );

    return maxReservedQty + this.quantity() <= Math.max(variant.stockQty || 0, 0);
  }

  private maxConcurrentRentalBlocks(blocks: RentalAvailabilityBlock[], windowStart: string, windowEnd: string): number {
    const deltas = new Map<string, number>();

    blocks.forEach((block) => {
      const start = block.startDate < windowStart ? windowStart : block.startDate;
      const end = block.endDate > windowEnd ? windowEnd : block.endDate;
      if (end < start) {
        return;
      }

      deltas.set(start, (deltas.get(start) || 0) + 1);
      const releaseDate = this.addDays(end, 1);
      deltas.set(releaseDate, (deltas.get(releaseDate) || 0) - 1);
    });

    let current = 0;
    let max = 0;
    Array.from(deltas.keys()).sort().forEach((date) => {
      current += deltas.get(date) || 0;
      max = Math.max(max, current);
    });

    return max;
  }

  private addDays(date: string, days: number): string {
    const parsed = new Date(`${date}T00:00:00`);
    parsed.setDate(parsed.getDate() + days);
    return parsed.toISOString().slice(0, 10);
  }

  private isRentalDaySelected(day: string): boolean {
    return day === this.form.controls.rentFrom.value || day === this.form.controls.rentTo.value;
  }

  private isRentalDayInSelectedRange(day: string): boolean {
    const start = this.form.controls.rentFrom.value || '';
    const end = this.form.controls.rentTo.value || '';
    return Boolean(start && end && day > start && day < end);
  }

  private validateRentalDateSelection(): boolean {
    if (this.isRentalDateRangeValid()) {
      this.rentalDateError.set(null);
      return true;
    }

    this.rentalDateError.set('Vui lòng chọn ngày bắt đầu và ngày kết thúc thuê còn trống trên lịch.');
    return false;
  }

  private buildRentalCalendarDays(): Array<{ dateStr: string; isPlaceholder: boolean; dayNum: number | string }> {
    const days: Array<{ dateStr: string; isPlaceholder: boolean; dayNum: number | string }> = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const firstDayOfWeek = start.getDay(); // 0 is Sunday
    
    // Add placeholders
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        dateStr: `placeholder-${i}`,
        isPlaceholder: true,
        dayNum: ''
      });
    }

    // Add 60 days
    for (let index = 0; index < 60; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      days.push({
        dateStr: this.toLocalDateString(date),
        isPlaceholder: false,
        dayNum: date.getDate()
      });
    }

    return days;
  }

  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async downloadQr() {
    const url = this.successQrUrl();
    if (!url) return;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QR_ThanhToan_${this.config()?.shopSlug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      this.toast.error('Không thể tải mã QR. Vui lòng chụp màn hình lại!');
    }
  }
}

