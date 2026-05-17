import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal, effect } from '@angular/core';
import { ProductFormCoreKey, ProductFormTemplateField, ProductFormTemplateType } from '../../../../core/models/product-form-template.model';
import { ProductFormTemplateService } from '../../../../core/services/product-form-template.service';
import { CreateProductInput, ProductType, VariantInput, Product } from '../../data-access/models/product.model';
import { parseNumber, parseOptionalNumber } from '../../utils/form.util';
import { FileApiService } from '../../../../core/services/file-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
    formatVndCurrency,
    formatVndCurrencyInput,
    normalizeVndCurrencyInput
} from '../../../../shared/utils/currency.util';
import { finalize } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DynamicFormRendererComponent } from '../../../../shared/components/dynamic-form/dynamic-form-renderer.component';
import { DynamicFieldValue, DynamicRenderField } from '../../../../shared/components/dynamic-form/dynamic-form.types';

@Component({
    selector: 'app-product-form',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        DynamicFormRendererComponent
    ],
    templateUrl: './product-form.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductFormComponent {
    private readonly productFormTemplateService = inject(ProductFormTemplateService);
    private readonly fileApiService = inject(FileApiService);
    private readonly notificationService = inject(NotificationService);
    private readonly authStore = inject(AuthStore);

    @Input() set initialData(product: Product | null) {
        if (product) {
            this.productType.set(product.productType);
            this.category.set(product.category || '');
            this.name.set(product.name);
            this.description.set(product.description);
            this.imageUrls.set(product.images.map(i => i.url));
            this.variants.set(product.variants.map(v => ({
                id: v.id,
                size: v.size,
                color: v.color,
                stockQty: v.stockQty,
                priceSell: v.priceSell !== null ? v.priceSell : undefined,
                priceRentPerDay: v.priceRentPerDay !== null ? v.priceRentPerDay : undefined,
                depositAmount: v.depositAmount !== null ? v.depositAmount : undefined
            })));
            if (product.customAttributes) {
                this.customValues.set({ ...product.customAttributes });
            }
        }
    }

    @Input() mode: 'create' | 'view' | 'edit' = 'create';
    @Input() loading = false;

    @Output() saved = new EventEmitter<CreateProductInput>();
    @Output() canceled = new EventEmitter<void>();

    readonly uploading = signal(false);

    // Form state
    readonly productType = signal<ProductType>(this.getDefaultProductType());
    readonly category = signal('');
    readonly name = signal('');
    readonly description = signal('');
    readonly imageUrls = signal<string[]>([]);
    
    // Variants array state
    readonly variants = signal<VariantInput[]>([]);

    // Variant form inputs (for adding new)
    readonly vSize = signal('');
    readonly vColor = signal('');
    readonly vStockQty = signal('1');
    readonly vPriceSell = signal('');
    readonly vPriceRentPerDay = signal('');
    readonly vDepositAmount = signal('');

    readonly categories = computed(() => this.authStore.currentShop()?.categories ?? []);
    readonly categoryOptions = computed(() => this.categories().map(cat => ({ label: cat, value: cat })));
    
    // Custom fields state
    readonly customValues = signal<Record<string, any>>({});
    readonly customErrors = signal<Record<string, string>>({});

    // Inline validation error signals
    readonly nameError = signal('');
    readonly variantError = signal('');
    readonly variantPriceError = signal('');

    // Template state
    readonly activeTemplate = computed(() => {
        const type = this.productType() === 'SELL_RENT' ? 'SELL' : this.productType() as ProductFormTemplateType;
        return this.productFormTemplateService.getTemplateByType(type);
    });

    readonly typeOptions = [
        { label: 'Chỉ bán', value: 'SELL' },
        { label: 'Chỉ thuê', value: 'RENT' },
        { label: 'Bán & Thuê', value: 'SELL_RENT' }
    ];

    constructor() {
        effect(() => {
            if (this.mode !== 'create') {
                return;
            }

            if (!this.isProductTypeAllowed(this.productType())) {
                this.productType.set(this.getDefaultProductType());
            }
        }, { allowSignalWrites: true });

        effect(() => {
            const template = this.activeTemplate();
            // Only reset if creating new product, skip if we have initialData
            if (template && this.mode === 'create') {
                const initialValues: Record<string, any> = {};
                template.fields.filter(f => !f.coreKey && f.enabled).forEach(f => {
                    initialValues[f.id] = f.type === 'multi_choice' ? [] : '';
                });
                this.customValues.set(initialValues);
            }
        }, { allowSignalWrites: true });
    }

    // --- Variant Management ---

    protected addVariant(): void {
        const stockQty = parseNumber(this.vStockQty(), 0);
        const priceSell = parseOptionalNumber(this.vPriceSell());
        const priceRentPerDay = parseOptionalNumber(this.vPriceRentPerDay());
        const depositAmount = parseOptionalNumber(this.vDepositAmount());
        
        // Basic validation for variant
        if (this.productType() === 'SELL' || this.productType() === 'SELL_RENT') {
            if (priceSell === undefined) {
                this.variantPriceError.set('Vui lòng nhập giá bán cho biến thể này.');
                return;
            }
        }
        if (this.productType() === 'RENT' || this.productType() === 'SELL_RENT') {
            if (priceRentPerDay === undefined) {
                this.variantPriceError.set('Vui lòng nhập giá thuê cho biến thể này.');
                return;
            }
        }
        this.variantPriceError.set('');

        const newVariant: VariantInput = {
            size: this.vSize() || 'Mặc định',
            color: this.vColor(),
            stockQty,
            priceSell,
            priceRentPerDay,
            depositAmount
        };

        this.variants.update(v => [...v, newVariant]);

        // Reset inputs
        this.vSize.set('');
        this.vColor.set('');
        this.vStockQty.set('1');
        this.vPriceSell.set('');
        this.vPriceRentPerDay.set('');
        this.vDepositAmount.set('');
    }

    protected removeVariant(index: number): void {
        this.variants.update(v => v.filter((_, i) => i !== index));
    }

    protected updateVariant(index: number, field: keyof VariantInput, value: any): void {
        this.variants.update(v => {
            const copy = [...v];
            const updated = { ...copy[index] };
            
            if (field === 'stockQty') {
                updated[field] = parseNumber(value, 0);
            } else if (field === 'priceSell' || field === 'priceRentPerDay' || field === 'depositAmount') {
                updated[field] = parseOptionalNumber(value);
            } else {
                (updated as any)[field] = value;
            }
            
            copy[index] = updated;
            return copy;
        });
    }

    // --- End Variant Management ---

    protected getCoreField(key: ProductFormCoreKey): ProductFormTemplateField | undefined {
        return this.activeTemplate()?.fields.find(f => f.coreKey === key);
    }

    protected shouldDisplayCoreField(key: ProductFormCoreKey, fallbackVisible = true): boolean {
        const field = this.getCoreField(key);
        return field ? field.enabled : fallbackVisible;
    }

    protected getFieldLabel(key: ProductFormCoreKey, fallback: string): string {
        return this.getCoreField(key)?.label || fallback;
    }

    protected getFieldPlaceholder(key: ProductFormCoreKey, fallback = ''): string {
        return this.getCoreField(key)?.placeholder || fallback;
    }

    protected getFieldHelperText(key: ProductFormCoreKey): string {
        return this.getCoreField(key)?.helperText || '';
    }

    protected isFieldRequired(key: ProductFormCoreKey, fallback = false): boolean {
        if (key === 'name') return true;
        return this.getCoreField(key)?.required ?? fallback;
    }

    protected getCustomFields(): ProductFormTemplateField[] {
        return this.activeTemplate()?.fields.filter(f => !f.coreKey && f.enabled) || [];
    }

    protected getRenderableCustomFields(): ProductFormTemplateField[] {
        return this.getCustomFields().filter(field => field.type !== 'image');
    }

    protected getImageCustomFields(): ProductFormTemplateField[] {
        return this.getCustomFields().filter(field => field.type === 'image');
    }

    protected onCustomValuesChange(values: Record<string, DynamicFieldValue>): void {
        if (this.mode === 'view') return;
        if (!this.isProductTypeAllowed(this.productType())) {
            this.notificationService.error('Loại sản phẩm này đang tắt trong mô hình kinh doanh của shop.');
            return;
        }

        this.customValues.set({ ...values });
        this.customErrors.update((errors) => {
            const next = { ...errors };
            Object.keys(values).forEach((fieldId) => delete next[fieldId]);
            return next;
        });
    }

    protected updateCustomValue(fieldId: string, value: any): void {
        if (this.mode === 'view') return;
        if (!this.isProductTypeAllowed(this.productType())) {
            this.notificationService.error('Loại sản phẩm này đang tắt trong mô hình kinh doanh của shop.');
            return;
        }
        this.customValues.update(v => ({ ...v, [fieldId]: value }));
        this.customErrors.update(e => {
            const { [fieldId]: _, ...rest } = e;
            return rest;
        });
    }

    protected toggleMultiChoice(fieldId: string, value: string, checked: boolean): void {
        if (this.mode === 'view') return;
        const current = this.customValues()[fieldId] as string[] || [];
        const next = checked 
            ? [...current, value]
            : current.filter(v => v !== value);
        this.updateCustomValue(fieldId, next);
    }

    protected isMultiChoiceSelected(fieldId: string, value: string): boolean {
        const current = this.customValues()[fieldId] as string[] || [];
        return current.includes(value);
    }

    protected onImageSelected(event: Event): void {
        if (this.mode === 'view') return;
        const input = event.target as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) return;

        this.uploading.set(true);
        
        const uploadPromises = Array.from(files).map(file => 
            new Promise<string>((resolve, reject) => {
                this.fileApiService.upload(file).subscribe({
                    next: url => resolve(url),
                    error: err => reject(err)
                });
            })
        );

        Promise.all(uploadPromises)
            .then(urls => {
                this.imageUrls.update(current => [...current, ...urls]);
                this.notificationService.success(`Đã tải lên ${urls.length} ảnh thành công`);
            })
            .catch(() => this.notificationService.error('Có lỗi xảy ra khi tải ảnh lên'))
            .finally(() => {
                this.uploading.set(false);
                input.value = '';
            });
    }

    protected removeImage(index: number): void {
        if (this.mode === 'view') return;
        this.imageUrls.update(urls => urls.filter((_, i) => i !== index));
    }

    protected applyDescriptionFormat(
        editor: HTMLTextAreaElement,
        format: 'bold' | 'italic' | 'underline' | 'list' | 'link' | 'image'
    ): void {
        if (this.mode === 'view') return;

        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? start;
        const current = this.description();
        const selectedText = current.slice(start, end);
        let replacement = selectedText;
        let cursorStart = start;
        let cursorEnd = start;

        switch (format) {
            case 'bold':
                replacement = `**${selectedText || 'văn bản'}**`;
                cursorStart = start + 2;
                cursorEnd = start + replacement.length - 2;
                break;
            case 'italic':
                replacement = `*${selectedText || 'văn bản'}*`;
                cursorStart = start + 1;
                cursorEnd = start + replacement.length - 1;
                break;
            case 'underline':
                replacement = `<u>${selectedText || 'văn bản'}</u>`;
                cursorStart = start + 3;
                cursorEnd = start + replacement.length - 4;
                break;
            case 'list':
                replacement = selectedText
                    ? selectedText.split('\n').map((line) => `- ${line}`).join('\n')
                    : '- ';
                cursorStart = start + replacement.length;
                cursorEnd = cursorStart;
                break;
            case 'link':
                replacement = `[${selectedText || 'liên kết'}](https://)`;
                cursorStart = start + replacement.indexOf('https://');
                cursorEnd = cursorStart + 'https://'.length;
                break;
            case 'image':
                replacement = `![${selectedText || 'ảnh sản phẩm'}](https://)`;
                cursorStart = start + replacement.indexOf('https://');
                cursorEnd = cursorStart + 'https://'.length;
                break;
        }

        this.description.set(`${current.slice(0, start)}${replacement}${current.slice(end)}`);

        queueMicrotask(() => {
            editor.focus();
            editor.setSelectionRange(cursorStart, cursorEnd);
        });
    }

    protected visibleThumbnailUrls(): string[] {
        return this.imageUrls().slice(0, 5);
    }

    protected hiddenImageCount(index: number): number {
        return index === 4 ? Math.max(this.imageUrls().length - 5, 0) : 0;
    }

    protected updateCustomImage(fieldId: string, event: Event): void {
        if (this.mode === 'view') return;
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        this.uploading.set(true);
        this.fileApiService.upload(file)
            .pipe(finalize(() => this.uploading.set(false)))
            .subscribe({
                next: (url) => {
                    this.updateCustomValue(fieldId, url);
                    this.notificationService.success('Tải ảnh lên thành công');
                },
                error: () => this.notificationService.error('Tải ảnh lên thất bại')
            });
    }

    protected onCustomRendererFileSelected(event: { field: DynamicRenderField; file: File }): void {
        if (this.mode === 'view') return;

        this.uploading.set(true);
        this.fileApiService.upload(event.file)
            .pipe(finalize(() => this.uploading.set(false)))
            .subscribe({
                next: (url) => {
                    this.updateCustomValue(event.field.id, url);
                    this.notificationService.success('Tải ảnh lên thành công');
                },
                error: () => this.notificationService.error('Tải ảnh lên thất bại')
            });
    }

    public submit(): void {
        if (this.mode === 'view') return;
        if (!this.name().trim()) {
            this.nameError.set('Vui lòng nhập tên sản phẩm.');
            return;
        }
        this.nameError.set('');

        if (!this.isProductTypeAllowed(this.productType())) {
            this.notificationService.error('Loại sản phẩm này đang tắt trong mô hình kinh doanh của shop.');
            return;
        }

        if (this.variants().length === 0) {
            this.variantError.set('Vui lòng thêm ít nhất một biến thể (size/màu).');
            return;
        }
        this.variantError.set('');

        const errors: Record<string, string> = {};
        this.getCustomFields().forEach(f => {
            const val = this.customValues()[f.id];
            if (f.required) {
                if (f.type === 'multi_choice') {
                    if (!val || val.length === 0) errors[f.id] = 'Vui lòng chọn ít nhất một giá trị';
                } else if (!val || !String(val).trim()) {
                    errors[f.id] = 'Trường này là bắt buộc';
                }
            }
        });

        if (Object.keys(errors).length > 0) {
            this.customErrors.set(errors);
            return;
        }

        const input: CreateProductInput = {
            name: this.name(),
            description: this.description(),
            productType: this.productType(),
            category: this.category(),
            variants: this.variants(),
            imageUrls: this.imageUrls(),
            customAttributes: this.customValues()
        };

        this.saved.emit(input);
    }

    public cancel(): void {
        this.canceled.emit();
    }
    
    // Format currency for view mode
    protected formatCurrency(val: number | undefined | null): string {
        return formatVndCurrency(val);
    }

    protected formatCurrencyInput(value: string | number | undefined | null): string {
        return formatVndCurrencyInput(value);
    }

    protected normalizeCurrencyInput(value: string | number | undefined | null): string {
        return normalizeVndCurrencyInput(value);
    }

    protected canUseSell(): boolean {
        const shop = this.authStore.currentShop();
        return shop ? Boolean(shop.enableSell) : true;
    }

    protected canUseRent(): boolean {
        const shop = this.authStore.currentShop();
        return shop ? Boolean(shop.enableRent) : true;
    }

    protected canUseSellRent(): boolean {
        return this.canUseSell() && this.canUseRent();
    }

    private isProductTypeAllowed(type: ProductType): boolean {
        switch (type) {
            case 'SELL':
                return this.canUseSell();
            case 'RENT':
                return this.canUseRent();
            case 'SELL_RENT':
                return this.canUseSellRent();
        }
    }

    private getDefaultProductType(): ProductType {
        const shop = this.authStore.currentShop();
        if (shop?.enableSell) {
            return 'SELL';
        }

        return 'RENT';
    }
}
