import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { HttpService } from '../../../core/http/http.service';
import { FileApiService } from '../../../core/services/file-api.service';
import { Product } from '../../products/data-access/models/product.model';
import { NotificationService } from '../../../core/services/notification.service';
import { OrderFormTemplate, OrderFormTemplateField } from '../../../core/models/order-form-template.model';
import { OrderCustomFieldValue, OrderType } from '../../orders/data-access/models/order.model';
import { ApiEnvelope, unwrapApiResponse } from '../../../core/utils/api-response.util';
import { PublicPaymentConfig } from '../../../core/services/payment-config.service';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneDigits } from '../../../shared/utils/phone-format.util';
import { FIXED_RENTAL_VERIFICATION_FIELDS } from '../../orders/utils/rental-verification-fields.util';
import { RentalAvailabilityApiService, RentalAvailabilityBlock } from '../../../core/services/rental-availability-api.service';
import { InternationalPhoneInputComponent } from '../../../shared/components/form/international-phone-input.component';

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
  businessMode: string;
  rentalIdentityVerificationEnabled?: boolean;
  products: Product[];
  sellConfig?: OrderFormConfigDto;
  rentConfig?: OrderFormConfigDto;
  shippingMethods?: any[];
  orderSources?: any[];
  paymentConfig?: PublicPaymentConfig;
}

@Component({
  selector: 'app-public-order-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InternationalPhoneInputComponent],
  template: `
    <div class="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto">
        
        @if (loading()) {
          <div class="flex flex-col items-center justify-center py-20 text-[#707072]">
            <div class="h-8 w-8 border-4 border-[#111111] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Đang tải thông tin form...</p>
          </div>
        } @else if (error()) {
          <div class="bg-white rounded-xl border border-[#E5E5E5] p-8 shadow-sm">
            <div class="text-center">
              <div class="w-16 h-16 mx-auto bg-[#FFE5E5] text-[#D30005] rounded-full flex items-center justify-center mb-4">
                <i class="ri-error-warning-line text-2xl"></i>
              </div>
              <h2 class="text-xl font-bold text-[#111111] mb-2">Không tìm thấy Form</h2>
              <p class="text-[#707072]">{{ error() }}</p>
            </div>
          </div>
        } @else if (isPaymentStep()) {
          <div class="bg-white rounded-xl border border-[#E5E5E5] p-8 shadow-sm">
            <div class="mb-8">
              <button (click)="isPaymentStep.set(false)" class="flex items-center text-sm font-medium text-[#707072] hover:text-[#111111] transition-colors mb-4">
                <i class="ri-arrow-left-s-line text-lg"></i> Quay lại thông tin
              </button>
              <h2 class="text-2xl font-bold text-[#111111]">Chọn phương thức thanh toán</h2>
              <p class="text-sm text-[#707072] mt-1">Chọn cách bạn muốn thanh toán cho đơn hàng này.</p>
            </div>

            <div class="grid gap-3 mb-8">
              @for (method of availablePaymentMethods(); track method.value) {
                <label
                  class="flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all hover:bg-[#FAFAFA]"
                  [class.border-[#111111]]="selectedPaymentMethod() === method.value"
                  [class.bg-[#F5F5F5]]="selectedPaymentMethod() === method.value"
                  [class.border-[#E5E5E5]]="selectedPaymentMethod() !== method.value"
                >
                  <input type="radio" [name]="'paymentMethod'" [value]="method.value"
                    [checked]="selectedPaymentMethod() === method.value"
                    (change)="selectedPaymentMethod.set(method.value)"
                    class="w-5 h-5 accent-[#111111]">
                  <div class="flex items-center gap-4">
                    <span class="text-3xl">{{ method.icon }}</span>
                    <div>
                      <div class="text-base font-bold text-[#111111]">{{ method.label }}</div>
                      <div class="text-sm text-[#707072]">{{ method.desc }}</div>
                    </div>
                  </div>
                </label>
              }
            </div>

            <div class="sticky bottom-0 bg-white pt-4 border-t border-[#E5E5E5]">
              <div class="flex items-center justify-between mb-4">
                <span class="text-[#707072] font-medium">Tổng thanh toán:</span>
                <span class="text-2xl font-bold text-[#111111]">{{ formatCurrency(totalAmount()) }}</span>
              </div>
              <button (click)="confirmOrder()" [disabled]="!selectedPaymentMethod() || submitting()" class="w-full py-4 text-lg rounded-full bg-[#111111] text-white font-bold disabled:bg-[#E5E5E5] disabled:cursor-not-allowed">
                {{ submitting() ? 'Đang xử lý...' : 'Xác nhận & Đặt hàng' }}
              </button>
            </div>
          </div>
        } @else if (success()) {
          <div class="bg-white rounded-xl border border-[#E5E5E5] p-8 shadow-sm">
            <div class="text-center py-4">
              <div class="w-20 h-20 mx-auto bg-[#E5F5E5] text-[#0A7D0A] rounded-full flex items-center justify-center mb-6">
                <i class="ri-check-line text-4xl"></i>
              </div>
              <h2 class="text-3xl font-bold text-[#111111] mb-3">Đặt hàng thành công!</h2>
              <p class="text-[#707072] text-lg mb-8 max-w-md mx-auto">
                Đơn hàng của bạn đã được ghi nhận. Chủ shop sẽ sớm liên hệ với bạn qua số điện thoại để xác nhận.
              </p>

              @if (selectedPaymentMethod() === 'BANK_TRANSFER' && successQrUrl()) {
                <div class="mb-8 p-6 rounded-3xl bg-[#F8F8F8] border border-[#EEEEEE] shadow-sm animate-in zoom-in duration-300">
                  <h3 class="text-lg font-bold text-[#111111] mb-2">Thanh toán chuyển khoản</h3>
                  <p class="text-sm text-[#707072] mb-6">Mã QR đã được tạo với số tiền và nội dung đơn hàng của bạn.</p>
                  
                  <div class="relative group inline-block">
                    <img [src]="successQrUrl()!" alt="QR thanh toán" 
                      class="mx-auto w-64 h-64 rounded-2xl border-4 border-white bg-white p-2 shadow-xl mb-4 transition-transform group-hover:scale-[1.02]">
                  </div>

                  <div class="flex flex-col gap-3 max-w-sm mx-auto">
                    <button (click)="downloadQr()" class="w-full py-3 rounded-full bg-[#111111] text-white font-bold">
                      <i class="ri-download-2-line mr-2"></i> Tải mã QR về máy
                    </button>
                    <div class="bg-white p-4 rounded-xl border border-[#E5E5E5] text-left">
                      <div class="flex justify-between text-xs text-[#707072] mb-1">
                        <span>Chủ tài khoản:</span>
                        <span class="font-bold text-[#111111]">{{ config()?.paymentConfig?.bankAccountName }}</span>
                      </div>
                      <div class="flex justify-between text-xs text-[#707072] mb-1">
                        <span>Số tài khoản:</span>
                        <span class="font-bold text-[#111111]">{{ config()?.paymentConfig?.bankAccountNumber }}</span>
                      </div>
                      <div class="flex justify-between text-xs text-[#707072]">
                        <span>Ngân hàng:</span>
                        <span class="font-bold text-[#111111]">{{ config()?.paymentConfig?.bankName }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <div class="pt-4">
                <button (click)="resetForm()" class="px-6 py-3 rounded-full border border-[#111111] text-[#111111] font-bold hover:bg-[#F5F5F5] transition-colors">
                  Quay lại trang đặt hàng
                </button>
              </div>
            </div>
          </div>
        } @else if (config()) {
          <div class="bg-white rounded-xl border border-[#E5E5E5] p-8 shadow-sm">
            <!-- Header -->
            <div class="text-center mb-8">
              <h1 class="text-3xl font-extrabold text-[#111111]">
                {{ config()?.shopName }}
              </h1>
              <p class="mt-2 text-lg text-[#707072]">
                Điền thông tin bên dưới để đặt hàng
              </p>
            </div>

            <!-- Product Info -->
            @if (selectedProduct()) {
              <div class="mb-8 pb-8 border-b border-[#E5E5E5]">
                <h3 class="text-lg font-medium text-[#111111] mb-4">Sản phẩm bạn chọn</h3>
                
                <div class="flex gap-4 mb-6">
                  <img [src]="selectedProduct()?.images?.[0]?.url || 'assets/images/placeholder.webp'" class="w-20 h-20 object-cover rounded-lg border border-[#E5E5E5]">
                  <div>
                    <h4 class="font-bold text-[#111111] text-lg">{{ selectedProduct()?.name }}</h4>
                    <p class="text-sm text-[#707072]">{{ selectedProduct()?.description }}</p>
                  </div>
                </div>

                <!-- Variant selection if multiple or single -->
                <div class="space-y-3">
                  <label class="block text-sm font-medium text-[#111111]">Chọn biến thể</label>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    @for (variant of availableVariants(); track variant.id) {
                      <div 
                        class="border rounded-lg p-3 cursor-pointer transition-all"
                        [class.border-[#111111]]="selectedVariant()?.id === variant.id"
                        [class.bg-[#F5F5F5]]="selectedVariant()?.id === variant.id"
                        [class.border-[#CACACB]]="selectedVariant()?.id !== variant.id"
                        (click)="selectVariant(variant)"
                      >
                        <div class="flex items-center justify-between">
                          <span class="font-medium text-[#111111]">Size: {{ variant.size }}</span>
                          <span class="text-[#111111] font-semibold">{{ formatCurrency(getVariantPrice(variant)) }}</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <div class="mt-6 flex items-center justify-between">
                  <label class="block text-sm font-medium text-[#111111]">Số lượng</label>
                  <div class="flex items-center gap-3">
                    <button type="button" class="w-10 h-10 rounded-full bg-[#F5F5F5] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors" (click)="updateQuantity(-1)">
                      <i class="ri-subtract-line"></i>
                    </button>
                    <span class="w-8 text-center font-bold text-lg text-[#111111]">{{ quantity() }}</span>
                    <button type="button" class="w-10 h-10 rounded-full bg-[#F5F5F5] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors" (click)="updateQuantity(1)">
                      <i class="ri-add-line"></i>
                    </button>
                  </div>
                </div>
              </div>
            } @else {
              <div class="bg-[#FFFBEA] text-[#8B6914] p-4 rounded-lg border border-[#F5D547] mb-8">
                Không tìm thấy thông tin sản phẩm. Vui lòng kiểm tra lại link.
              </div>
            }

            <!-- Shipping Method Selection -->
            @if (config()?.shippingMethods?.length) {
              <div class="mb-8 pb-8 border-b border-[#E5E5E5]">
                <label class="block text-sm font-medium text-[#111111] mb-1.5">Phương thức vận chuyển</label>
                <select 
                  class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all"
                  [value]="selectedShippingMethodId()?.toString() || ''"
                  (change)="selectedShippingMethodId.set($any($event.target).value ? Number($any($event.target).value) : null)"
                >
                  <option value="">-- Chọn phương thức --</option>
                  @for (opt of shippingMethodOptions(); track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </div>
            }

            <!-- Order Source Selection -->
            @if (config()?.orderSources?.length) {
              <div class="mb-8 pb-8 border-b border-[#E5E5E5]">
                <label class="block text-sm font-medium text-[#111111] mb-1.5">Bạn biết đến shop qua đâu? (Tùy chọn)</label>
                <select 
                  class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all"
                  [value]="selectedSourceChannelId()?.toString() || ''"
                  (change)="selectedSourceChannelId.set($any($event.target).value ? Number($any($event.target).value) : null)"
                >
                  <option value="">-- Chọn nền tảng --</option>
                  @for (opt of orderSourceOptions(); track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </div>
            }

            <!-- Customer Form -->
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6">
              <h3 class="text-lg font-medium text-[#111111] border-b border-[#E5E5E5] pb-2 mb-6">Thông tin liên hệ</h3>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#111111]">Họ và tên <span class="text-[#D30005]">*</span></label>
                  <input formControlName="customerName" class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all" [class.border-red-400]="form.get('customerName')?.invalid && form.get('customerName')?.touched" placeholder="Nhập họ và tên của bạn">
                  @if (form.get('customerName')?.invalid && form.get('customerName')?.touched) {
                    <p class="text-xs text-[#D30005] font-medium mt-0.5">Vui lòng nhập họ và tên.</p>
                  }
                </div>
                <app-international-phone-input
                  label="Số điện thoại"
                  formControlName="customerPhone"
                  [required]="true"
                  [showError]="!!(form.get('customerPhone')?.invalid && form.get('customerPhone')?.touched)"
                  errorText="Vui lòng nhập số điện thoại hợp lệ."
                />
              </div>
              
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#111111]">Địa chỉ giao hàng <span class="text-[#D30005]">*</span></label>
                <input formControlName="customerAddress" class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all" [class.border-red-400]="form.get('customerAddress')?.invalid && form.get('customerAddress')?.touched" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/TP">
                @if (form.get('customerAddress')?.invalid && form.get('customerAddress')?.touched) {
                  <p class="text-xs text-[#D30005] font-medium mt-0.5">Vui lòng nhập địa chỉ giao hàng.</p>
                }
              </div>

              @if (isRentOrderSelected()) {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#111111]">Ngày thuê <span class="text-[#D30005]">*</span></label>
                    <input type="date" formControlName="rentFrom" readonly class="w-full rounded-lg border border-[#CACACB] bg-white text-sm p-3 text-[#111111]">
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#111111]">Ngày trả <span class="text-[#D30005]">*</span></label>
                    <input type="date" formControlName="rentTo" readonly class="w-full rounded-lg border border-[#CACACB] bg-white text-sm p-3 text-[#111111]">
                  </div>
                </div>

                <div class="mt-4 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 class="m-0 text-sm font-bold uppercase tracking-wide text-[#111111]">Lịch thuê còn trống</h4>
                      <p class="m-0 mt-1 text-sm text-[#707072]">
                        Chọn ngày bắt đầu và ngày kết thúc trên lịch. Ngày đỏ là đã có khách giữ lịch.
                      </p>
                    </div>
                    @if (rentalAvailabilityLoading()) {
                      <span class="text-xs font-medium text-[#707072]">Đang tải lịch...</span>
                    }
                  </div>

                  <div class="mb-3 flex flex-wrap items-center gap-3 text-xs text-[#707072]">
                    <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded border border-[#BBF7D0] bg-[#F0FDF4]"></span>Còn trống</span>
                    <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded border border-[#FCA5A5] bg-[#FEF2F2]"></span>Đã giữ lịch</span>
                    <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded border border-[#111111] bg-[#111111]"></span>Đang chọn</span>
                  </div>

                  <div class="grid grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-10">
                    @for (day of rentalCalendarDays(); track day.date) {
                      <button type="button"
                        class="min-h-14 rounded-lg border px-1 text-center transition disabled:cursor-not-allowed disabled:opacity-60"
                        [ngClass]="getRentalDayClass(day.date)"
                        [disabled]="isRentalDayDisabled(day.date)"
                        (click)="selectRentalDate(day.date)"
                        [title]="getRentalDayTitle(day.date)">
                        <span class="block text-[10px] font-semibold uppercase">{{ day.weekday }}</span>
                        <span class="block text-xs font-bold">{{ formatRentalDayLabel(day.date) }}</span>
                      </button>
                    }
                  </div>

                  @if (rentalDateError()) {
                    <p class="mt-3 text-xs font-medium text-[#D30005]">{{ rentalDateError() }}</p>
                  }
                </div>
              }

              @if (shouldShowRentalVerificationFields()) {
                <div class="mt-6 pt-6 border-t border-[#E5E5E5] space-y-6">
                  <div>
                    <h4 class="text-sm font-semibold text-[#111111] uppercase tracking-wider">Xác thực giấy tờ tùy thân</h4>
                    <p class="mt-1 text-sm text-[#707072]">Shop yêu cầu tải đủ ảnh mặt trước và mặt sau giấy tờ tùy thân cho đơn thuê.</p>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    @for (field of rentalVerificationFields; track field.key) {
                      <div class="space-y-1.5">
                        <label class="block text-sm font-medium text-[#111111]">
                          {{ field.label }} <span class="text-[#D30005]">*</span>
                        </label>
                        <div
                          class="relative flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-[#CACACB] bg-[#F5F5F5] transition-all hover:bg-[#EEEEEE] group"
                        >
                          @if (getRentalVerificationImageUrl(field.key)) {
                            <img [src]="getRentalVerificationImageUrl(field.key)" class="h-full w-full object-cover" [alt]="field.label">
                            <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                              <span class="text-xs font-bold text-white">Đổi ảnh</span>
                            </div>
                          } @else {
                            <i class="ri-upload-cloud-2-line text-3xl text-[#707072]"></i>
                            <span class="text-xs text-[#707072] text-center px-4">{{ field.placeholder }}</span>
                          }
                          <input type="file" class="absolute inset-0 cursor-pointer opacity-0" accept="image/*"
                            (change)="onRentalVerificationFileChange(field.key, $event)">
                        </div>
                        <p class="text-xs text-[#707072]">{{ field.helperText }}</p>
                        @if (getRentalVerificationError(field.key)) {
                          <p class="text-xs font-medium text-[#D30005]">{{ getRentalVerificationError(field.key) }}</p>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Dynamic Custom Fields -->
              @if (customFields().length > 0) {
                <div class="mt-6 pt-6 border-t border-[#E5E5E5] space-y-6">
                  <h4 class="text-sm font-semibold text-[#111111] uppercase tracking-wider">Thông tin bổ sung</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    @for (field of customFields(); track field.id) {
                      <div class="space-y-1.5">
                        <label class="block text-sm font-medium text-[#111111]">
                          {{ field.label }}
                          @if (field.isRequired) { <span class="text-[#D30005]">*</span> }
                        </label>

                        @if (isCustomTextAreaField(field)) {
                          <textarea 
                            class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all"
                            [placeholder]="field.placeholder || 'Nhập thông tin'"
                            [value]="getCustomFieldValue(field.id)"
                            (input)="updateCustomFieldValue(field.id, $any($event.target).value)"
                            rows="3"
                          ></textarea>
                        } @else if (isCustomSingleChoiceField(field)) {
                          <div class="space-y-2">
                            @for (option of field.options; track option.id) {
                              <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" [name]="field.id" 
                                  [checked]="getCustomFieldValue(field.id) === option.label"
                                  (change)="setCustomSingleChoiceValue(field.id, option.label)"
                                  class="text-[#111111] focus:ring-[#111111]"
                                />
                                <span class="text-sm text-[#707072]">{{ option.label }}</span>
                              </label>
                            }
                          </div>
                        } @else if (isCustomMultiChoiceField(field)) {
                          <div class="space-y-2">
                            @for (option of field.options; track option.id) {
                              <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox"
                                  [checked]="isCustomMultiChoiceSelected(field.id, option.label)"
                                  (change)="toggleCustomMultiChoiceValue(field.id, option.label, $any($event.target).checked)"
                                  class="rounded text-[#111111] focus:ring-[#111111]"
                                />
                                <span class="text-sm text-[#707072]">{{ option.label }}</span>
                              </label>
                            }
                          </div>
                        } @else if (isCustomDropdownField(field)) {
                          <select 
                            class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all"
                            [value]="getCustomFieldValue(field.id)"
                            (change)="updateCustomFieldValue(field.id, $any($event.target).value)"
                          >
                            <option value="">{{ field.placeholder || 'Chọn một giá trị' }}</option>
                            @for (option of field.options; track option.id) {
                              <option [value]="option.label">{{ option.label }}</option>
                            }
                          </select>
                        } @else if (isCustomImageField(field)) {
                          <div class="w-full h-32 bg-[#F5F5F5] border-2 border-dashed border-[#CACACB] rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#FAFAFA] transition-all overflow-hidden relative group">
                            @if (getCustomFieldValue(field.id)) {
                              <img [src]="getCustomFieldValue(field.id)" class="w-full h-full object-cover">
                              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span class="text-white text-xs font-bold">Đổi ảnh</span>
                              </div>
                            } @else {
                              <i class="ri-image-add-line text-3xl text-[#CACACB]"></i>
                              <span class="text-xs text-[#707072]">{{ field.placeholder || 'Tải ảnh lên' }}</span>
                            }
                            <input type="file" class="absolute inset-0 opacity-0 cursor-pointer" (change)="onCustomFileChange(field.id, $event)" accept="image/*">
                          </div>
                        } @else {
                          <input 
                            [type]="resolveCustomInputType(field)"
                            [attr.inputmode]="field.fieldType === 'phone' ? 'numeric' : null"
                            class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all"
                            [placeholder]="field.placeholder || 'Nhập thông tin'"
                            [value]="getCustomFieldDisplayValue(field)"
                            (input)="onCustomFieldInput(field, $event)"
                          />
                        }

                        @if (field.helperText) {
                          <p class="text-xs text-[#707072] italic">{{ field.helperText }}</p>
                        }
                        @if (getCustomFieldError(field.id)) {
                          <p class="text-xs text-[#D30005] font-medium">{{ getCustomFieldError(field.id) }}</p>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
              
              <div class="pt-6 border-t border-[#E5E5E5] space-y-6">
                <div>
                  <label class="block text-sm font-medium text-[#111111] mb-1">Ghi chú thêm (không bắt buộc)</label>
                  <textarea 
                    formControlName="customerNote"
                    rows="3" 
                    class="w-full rounded-lg border border-[#CACACB] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(17,17,17,0.15)] bg-[#F5F5F5] text-sm p-3 transition-all"
                    placeholder="Ghi chú thêm cho đơn hàng (không bắt buộc)"
                  ></textarea>
                </div>
                
                <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div class="text-left w-full sm:w-auto">
                    <span class="text-sm text-[#707072]">Tổng cộng:</span>
                    <div class="text-2xl font-bold text-[#111111]">{{ formatCurrency(totalAmount()) }}</div>
                    @if (selectedShippingMethodId()) {
                      <div class="text-xs text-[#707072] mt-1">(Đã bao gồm phí vận chuyển nếu có)</div>
                    }
                  </div>
                  <button 
                    type="submit" 
                    class="w-full sm:w-auto px-8 py-3 rounded-full bg-[#111111] text-white font-bold disabled:bg-[#E5E5E5] disabled:cursor-not-allowed transition-colors"
                    [disabled]="form.invalid || !selectedVariant() || (isRentOrderSelected() && !isRentalDateRangeValid()) || submitting()"
                  >
                    @if (submitting()) {
                      <span class="flex items-center gap-2">
                        <i class="ri-loader-4-line animate-spin"></i> Đang xử lý...
                      </span>
                    } @else {
                      Tiếp tục chọn thanh toán
                    }
                  </button>
                </div>
              </div>
            </form>
          </div>
        }
      </div>
    </div>
  `,
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
    if (!value) return '0 VNĐ';
    const num = typeof value === 'string' ? parseInt(value.replace(/\D/g, '')) : value;
    if (isNaN(num)) return '0 VNĐ';
    return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
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
  readonly error = signal<string | null>(null);
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
      this.error.set('Thiếu thông tin shop');
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
        error: () => {
          this.error.set('Không thể tải form. Shop có thể không tồn tại hoặc đã bị khóa.');
        }
      });
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
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
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
      return;
    }

    // Instead of immediate API call, move to payment step
    this.isPaymentStep.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          const res = unwrapApiResponse(response);
          // Build QR URL for bank transfer success screen
          if (this.selectedPaymentMethod() === 'BANK_TRANSFER') {
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
          this.isPaymentStep.set(false);
          this.success.set(true);
        },
        error: () => {
          this.toast.error('Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại!');
        }
      });
  }


  resetForm() {
    this.success.set(false);
    this.isPaymentStep.set(false);
    this.successQrUrl.set(null);
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
    this.rentalAvailabilityApi.getPublicAvailability(this.shopSlug, {
      productId: product.id,
      variantId: variant.id,
      from: days[0]?.date,
      to: days[days.length - 1]?.date
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

  private buildRentalCalendarDays(): Array<{ date: string; weekday: string }> {
    const days: Array<{ date: string; weekday: string }> = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let index = 0; index < 60; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      days.push({
        date: this.toLocalDateString(date),
        weekday: date.toLocaleDateString('vi-VN', { weekday: 'short' })
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

