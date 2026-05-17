import { CommonModule, NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification.service';
import {
  formatVndCurrency,
  formatVndCurrencyInput,
  parseVndCurrencyInput
} from '../../../shared/utils/currency.util';
import { Product, ProductType, ProductVariant } from '../data-access/models/product.model';

type CopyOrderType = 'SELL' | 'RENT';

@Component({
  selector: 'app-copy-order-info-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass],
  templateUrl: './copy-order-info-modal.component.html'
})
export class CopyOrderInfoModalComponent implements OnChanges {
  private readonly notificationService = inject(NotificationService);

  @Input() isOpen = false;
  @Input() product: Product | null = null;

  @Output() close = new EventEmitter<void>();

  protected selectedVariantId = '';
  protected orderType: CopyOrderType = 'SELL';
  protected quantity = 1;
  protected rentalDays = 1;
  protected deliveryDate = this.todayIso();
  protected unitPrice: number | null = null;
  protected rentalPrice: number | null = null;
  protected depositAmount: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['product'] || changes['isOpen']) && this.isOpen && this.product) {
      this.initializeForm();
    }
  }

  protected get selectedVariant(): ProductVariant | null {
    return this.product?.variants.find((variant) => variant.id === this.selectedVariantId) ?? null;
  }

  protected get productCode(): string {
    return this.resolveProductCode(this.product);
  }

  protected get supportsSell(): boolean {
    return this.supportsProductType(this.product?.productType, 'SELL');
  }

  protected get supportsRent(): boolean {
    return this.supportsProductType(this.product?.productType, 'RENT');
  }

  protected get selectedVariantSupportsSell(): boolean {
    const variant = this.selectedVariant;
    return Boolean(variant && this.supportsSell && this.isPositive(variant.priceSell));
  }

  protected get selectedVariantSupportsRent(): boolean {
    const variant = this.selectedVariant;
    return Boolean(variant && this.supportsRent && this.isPositive(variant.priceRentPerDay));
  }

  protected get rentalEndDate(): string {
    return this.calculateRentalEndDate(this.deliveryDate, this.rentalDays);
  }

  protected get validationMessage(): string | null {
    const variant = this.selectedVariant;
    if (!variant) {
      return 'Vui lòng chọn biến thể/SKU trước khi copy.';
    }

    if (!Number.isFinite(Number(this.quantity)) || Number(this.quantity) <= 0) {
      return 'Số lượng phải lớn hơn 0.';
    }

    if (this.orderType === 'SELL' && !this.selectedVariantSupportsSell) {
      return 'Biến thể này không hỗ trợ đơn bán.';
    }

    if (this.orderType === 'RENT' && !this.selectedVariantSupportsRent) {
      return 'Biến thể này không hỗ trợ đơn thuê.';
    }

    if (this.orderType === 'RENT' && (!Number.isFinite(Number(this.rentalDays)) || Number(this.rentalDays) <= 0)) {
      return 'Số ngày thuê phải lớn hơn 0.';
    }

    if (this.orderType === 'RENT' && !this.deliveryDate) {
      return 'Vui lòng chọn ngày nhận.';
    }

    return null;
  }

  protected get copyPreview(): string {
    return this.buildCopyText();
  }

  protected get primaryImageUrl(): string | null {
    return this.product?.images[0]?.url ?? null;
  }

  protected onClose(): void {
    this.close.emit();
  }

  protected onVariantChange(): void {
    const variant = this.selectedVariant;
    if (!variant) {
      this.unitPrice = null;
      this.rentalPrice = null;
      this.depositAmount = null;
      return;
    }

    if (this.orderType === 'SELL' && !this.selectedVariantSupportsSell && this.selectedVariantSupportsRent) {
      this.orderType = 'RENT';
    }

    if (this.orderType === 'RENT' && !this.selectedVariantSupportsRent && this.selectedVariantSupportsSell) {
      this.orderType = 'SELL';
    }

    this.unitPrice = variant.priceSell;
    this.rentalPrice = variant.priceRentPerDay;
    this.depositAmount = variant.depositAmount ?? 0;
  }

  protected selectOrderType(type: CopyOrderType): void {
    this.orderType = type;
    this.onVariantChange();
  }

  protected async copy(): Promise<void> {
    if (this.validationMessage) {
      this.notificationService.error(this.validationMessage);
      return;
    }

    try {
      await this.writeClipboard(this.buildCopyText());
      this.notificationService.success('Đã copy thông tin tạo đơn');
    } catch {
      this.notificationService.error('Không thể copy vào clipboard. Vui lòng thử lại.');
    }
  }

  protected variantLabel(variant: ProductVariant): string {
    const sku = variant.sku ? `SKU ${variant.sku}` : `Variant ${variant.id}`;
    const size = variant.size ? `Size ${variant.size}` : 'Size --';
    const color = variant.color ? `Màu ${variant.color}` : 'Màu --';
    return `${sku} · ${size} · ${color}`;
  }

  protected formatCurrency(value: number | null | undefined): string {
    return formatVndCurrency(value);
  }

  protected formatCurrencyInput(value: number | null | undefined): string {
    return formatVndCurrencyInput(value);
  }

  protected setMoneyField(field: 'unitPrice' | 'rentalPrice' | 'depositAmount', value: string): void {
    const amount = parseVndCurrencyInput(value) ?? 0;

    if (field === 'unitPrice') {
      this.unitPrice = amount;
      return;
    }

    if (field === 'rentalPrice') {
      this.rentalPrice = amount;
      return;
    }

    this.depositAmount = amount;
  }

  private initializeForm(): void {
    const variants = this.product?.variants ?? [];
    const defaultVariant = variants.find((variant) => variant.active && variant.stockQty > 0) ?? variants[0] ?? null;

    this.selectedVariantId = defaultVariant?.id ?? '';
    this.orderType = this.supportsSell ? 'SELL' : 'RENT';
    this.quantity = 1;
    this.rentalDays = 1;
    this.deliveryDate = this.todayIso();
    this.unitPrice = defaultVariant?.priceSell ?? null;
    this.rentalPrice = defaultVariant?.priceRentPerDay ?? null;
    this.depositAmount = defaultVariant?.depositAmount ?? 0;
    this.onVariantChange();
  }

  private buildCopyText(): string {
    const product = this.product;
    const variant = this.selectedVariant;
    const lines = [
      'Tạo đơn Messenger từ OMS:',
      `- Product ID: ${product?.id ?? ''}`,
      `- Variant ID: ${variant?.id ?? ''}`,
      `- Mã sản phẩm: ${this.productCode}`,
      `- Tên sản phẩm: ${product?.name ?? ''}`,
      `- SKU: ${variant?.sku ?? ''}`,
      `- Size: ${variant?.size ?? ''}`,
      `- Màu: ${variant?.color ?? ''}`,
      `- Số lượng: ${this.quantity || ''}`,
      `- Loại đơn: ${this.orderType}`
    ];

    if (this.orderType === 'SELL') {
      lines.push(`- Đơn giá: ${this.toCopyMoney(this.unitPrice)}`);
    } else {
      lines.push(
        `- Giá thuê: ${this.toCopyMoney(this.rentalPrice)}`,
        `- Tiền cọc: ${this.toCopyMoney(this.depositAmount)}`,
        `- Số ngày thuê: ${this.rentalDays || ''}`,
        `- Ngày nhận: ${this.deliveryDate || ''}`,
        `- Ngày trả: ${this.rentalEndDate || ''}`
      );
    }

    return lines.join('\n');
  }

  private async writeClipboard(text: string): Promise<void> {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) {
      throw new Error('Clipboard fallback failed');
    }
  }

  private resolveProductCode(product: Product | null): string {
    if (!product) {
      return '';
    }

    const direct = product as Product & { productCode?: unknown; code?: unknown };
    const directValue = this.toScalarString(direct.productCode) || this.toScalarString(direct.code);
    if (directValue) {
      return directValue;
    }

    const customValue = product.customAttributeValues
      ?.find((attribute) => this.looksLikeProductCodeKey(`${attribute.fieldKey} ${attribute.label}`))
      ?.value;
    const customText = this.toScalarString(customValue);
    if (customText) {
      return customText;
    }

    for (const [key, value] of Object.entries(product.customAttributes ?? {})) {
      if (this.looksLikeProductCodeKey(key)) {
        const text = this.toScalarString(value);
        if (text) {
          return text;
        }
      }
    }

    return '';
  }

  private looksLikeProductCodeKey(value: string): boolean {
    const normalized = this.normalizeLookup(value);
    return normalized === 'code'
      || normalized.includes('product code')
      || normalized.includes('ma san pham')
      || normalized.includes('ma sp')
      || normalized.includes('ma hang');
  }

  private supportsProductType(productType: ProductType | undefined, orderType: CopyOrderType): boolean {
    if (!productType) {
      return false;
    }

    if (orderType === 'SELL') {
      return productType === 'SELL' || productType === 'SELL_RENT';
    }

    return productType === 'RENT' || productType === 'SELL_RENT';
  }

  private toCopyMoney(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : formatVndCurrency(value, '');
  }

  private calculateRentalEndDate(startDate: string, days: number): string {
    if (!startDate || !Number.isFinite(Number(days)) || Number(days) <= 0) {
      return '';
    }

    const date = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    date.setDate(date.getDate() + Math.max(0, Number(days) - 1));
    return date.toISOString().slice(0, 10);
  }

  private toScalarString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    return '';
  }

  private isPositive(value: number | null | undefined): boolean {
    return typeof value === 'number' && value > 0;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private normalizeLookup(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }
}
