import { CommonModule, NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification.service';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { Product, ProductVariant } from '../data-access/models/product.model';

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

  protected get validationMessage(): string | null {
    const variant = this.selectedVariant;
    if (!variant) {
      return 'Vui lòng chọn biến thể/SKU trước khi copy.';
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

  protected onVariantChange(): void {}

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

  private initializeForm(): void {
    const variants = this.product?.variants ?? [];
    const defaultVariant = variants.find((variant) => variant.active && variant.stockQty > 0) ?? variants[0] ?? null;

    this.selectedVariantId = defaultVariant?.id ?? '';
  }

  private buildCopyText(): string {
    const variant = this.selectedVariant;
    return [
      'Tạo đơn Messenger từ OMS:',
      `- Variant ID: ${variant?.id ?? ''}`
    ].join('\n');
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

  private toScalarString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    return '';
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
