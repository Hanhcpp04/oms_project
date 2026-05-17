import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  OrderFormFieldType,
  OrderFormTemplateField,
  OrderFormTemplateType
} from '../../../core/models/order-form-template.model';
import { NotificationService } from '../../../core/services/notification.service';
import { OrderFormTemplateService } from '../../../core/services/order-form-template.service';
import { FormConfigToolbarComponent } from '../components/form-config-toolbar/form-config-toolbar.component';
import {
  FormConfigMode,
  FormHeaderEditorComponent
} from '../components/form-header-editor/form-header-editor.component';
import { FormFieldCardComponent } from '../components/form-field-card/form-field-card.component';
import { FormPreviewComponent } from '../components/form-preview/form-preview.component';
import {
  FIELD_TYPE_OPTIONS,
  createEmptyOrderField,
  duplicateOrderField,
  formTypeLabel,
  isTempId,
  normalizeFieldForSave,
  validateFields
} from '../models/form-config-ui.model';

@Component({
  selector: 'app-order-form-config-page',
  standalone: true,
  imports: [
    CommonModule,
    FormHeaderEditorComponent,
    FormFieldCardComponent,
    FormConfigToolbarComponent,
    FormPreviewComponent
  ],
  templateUrl: './order-form-config-page.component.html',
  styleUrls: ['./order-form-config-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderFormConfigPageComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly authStore = inject(AuthStore);
  private readonly templateService = inject(OrderFormTemplateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = this.templateService.loading;
  readonly businessMode = computed(() => this.resolveBusinessMode());
  readonly activeTab = signal<OrderFormTemplateType>('SELL');
  readonly currentTemplate = computed(() => this.templateService.getTemplateByType(this.activeTab()));

  protected readonly mode = signal<FormConfigMode>('edit');
  protected readonly activeFieldId = signal<string | null>(null);
  protected readonly localFields = signal<OrderFormTemplateField[]>([]);
  protected readonly deletedFieldIds = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly savedSnapshot = signal('');
  protected readonly fieldTypeOptions = FIELD_TYPE_OPTIONS;
  protected readonly formTypeLabel = computed(() => formTypeLabel(this.activeTab()));
  protected readonly formDescription = computed(
    () =>
      `Thiết lập các trường thông tin cần thu thập khi tạo ${formTypeLabel(this.activeTab()).toLowerCase()}, public order form và form nội bộ.`
  );
  protected readonly fieldCount = computed(
    () => this.localFields().filter((field) => field.active !== false).length
  );
  protected readonly validationErrors = computed(() => validateFields(this.localFields()));
  protected readonly isInvalid = computed(() => Object.keys(this.validationErrors()).length > 0);
  protected readonly hasUnsavedChanges = computed(
    () => this.createSnapshot(this.localFields(), this.deletedFieldIds()) !== this.savedSnapshot()
  );
  private lastSyncedTemplateKey = '';

  constructor() {
    const routeCategory = this.route.snapshot.data['category'] as string;
    if (routeCategory === 'rent') {
      if (!this.canUseRent()) {
        void this.router.navigate(['/app/form-config', this.canUseSell() ? 'sell' : 'rent']);
        return;
      }
      this.activeTab.set('RENT');
    } else if (routeCategory === 'sell') {
      if (!this.canUseSell()) {
        void this.router.navigate(['/app/form-config', this.canUseRent() ? 'rent' : 'sell']);
        return;
      }
      this.activeTab.set('SELL');
    }

    effect(
      () => {
        const template = this.currentTemplate();
        const fields = this.cloneFields(template.fields).sort(
          (first, second) => first.sortOrder - second.sortOrder
        );
        const templateKey = `${template.templateType}:${template.updatedAt}:${this.createSnapshot(fields, [])}`;

        if (templateKey === this.lastSyncedTemplateKey) {
          return;
        }

        this.lastSyncedTemplateKey = templateKey;

        this.localFields.set(fields);
        this.deletedFieldIds.set([]);
        this.activeFieldId.set(fields[0]?.id ?? null);
        this.savedSnapshot.set(this.createSnapshot(fields, []));
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        if (routeCategory) {
          return;
        }

        const mode = this.businessMode();
        this.activeTab.set(mode === 'RENT' ? 'RENT' : 'SELL');
      },
      { allowSignalWrites: true }
    );
  }

  protected setMode(mode: FormConfigMode): void {
    this.mode.set(mode);
  }

  protected setTab(type: OrderFormTemplateType): void {
    if ((type === 'SELL' && !this.canUseSell()) || (type === 'RENT' && !this.canUseRent())) {
      return;
    }

    if (type !== this.activeTab() && this.hasUnsavedChanges()) {
      const shouldContinue = confirm('Bạn có thay đổi chưa lưu. Chuyển loại form sẽ bỏ các thay đổi này?');
      if (!shouldContinue) {
        return;
      }
    }

    this.mode.set('edit');
    this.activeTab.set(type);
  }

  protected addField(type: OrderFormFieldType = 'text'): void {
    const templateId = this.currentTemplate().id;
    const nextField = createEmptyOrderField(templateId, type, this.localFields().length + 1);

    this.localFields.update((fields) => this.reindexFields([...fields, nextField]));
    this.activeFieldId.set(nextField.id);
    this.mode.set('edit');
  }

  protected updateField(updatedField: OrderFormTemplateField): void {
    this.localFields.update((fields) =>
      fields.map((field) => (field.id === updatedField.id ? updatedField : field))
    );
  }

  protected duplicateField(field: OrderFormTemplateField): void {
    const fields = this.localFields();
    const fieldIndex = fields.findIndex((item) => item.id === field.id);
    const copy = duplicateOrderField(field, fieldIndex + 2);
    const nextFields = [...fields];
    nextFields.splice(fieldIndex + 1, 0, copy);

    this.localFields.set(this.reindexFields(nextFields));
    this.activeFieldId.set(copy.id);
  }

  protected deleteField(field: OrderFormTemplateField): void {
    const shouldDelete = confirm(`Xóa field "${field.label || 'chưa đặt tên'}"?`);
    if (!shouldDelete) {
      return;
    }

    if (!isTempId(field.id)) {
      this.deletedFieldIds.update((ids) => [...ids, field.id]);
    }

    this.localFields.update((fields) => this.reindexFields(fields.filter((item) => item.id !== field.id)));
    this.activeFieldId.set(null);
  }

  protected moveField(fieldId: string, direction: 'up' | 'down'): void {
    const fields = [...this.localFields()];
    const currentIndex = fields.findIndex((field) => field.id === fieldId);

    if (currentIndex < 0) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) {
      return;
    }

    [fields[currentIndex], fields[targetIndex]] = [fields[targetIndex], fields[currentIndex]];
    this.localFields.set(this.reindexFields(fields));
  }

  protected saveConfiguration(): void {
    const errors = this.validationErrors();
    const firstInvalidId = Object.keys(errors)[0];
    if (firstInvalidId) {
      this.activeFieldId.set(firstInvalidId);
      this.mode.set('edit');
      this.notificationService.error(errors[firstInvalidId][0]);
      return;
    }

    if (!this.hasUnsavedChanges()) {
      this.notificationService.info('Không có thay đổi mới để lưu.');
      return;
    }

    const type = this.activeTab();
    const fields = this.localFields().map((field, index) => normalizeFieldForSave(field, index));
    const operations: Observable<unknown>[] = [];

    for (const fieldId of this.deletedFieldIds()) {
      operations.push(this.templateService.removeCustomField(type, fieldId));
    }

    for (const field of fields) {
      if (isTempId(field.id)) {
        operations.push(
          this.templateService.addField(type, {
            label: field.label,
            type: field.type,
            placeholder: field.placeholder,
            required: field.required,
            helperText: field.helperText,
            showInOrderList: field.showInOrderList,
            showInOrderDetail: field.showInOrderDetail,
            sortOrder: field.sortOrder,
            options: field.options,
            validationRulesJson: this.serializeValidationRules(field)
          })
        );
      } else {
        operations.push(
          this.templateService.updateField(type, field.id, {
            label: field.label,
            fieldKey: field.fieldKey,
            type: field.type,
            placeholder: field.placeholder,
            helperText: field.helperText,
            required: field.required,
            active: field.active,
            sortOrder: field.sortOrder,
            showInOrderList: field.showInOrderList,
            showInOrderDetail: field.showInOrderDetail,
            validationRules: field.validationRules,
            options: field.options
          })
        );
      }
    }

    if (operations.length === 0) {
      return;
    }

    this.isSaving.set(true);
    forkJoin(operations).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.deletedFieldIds.set([]);
        this.savedSnapshot.set(this.createSnapshot(fields, []));
        this.notificationService.success('Đã lưu cấu hình form thành công.');
        this.templateService.loadConfig(type);
      },
      error: () => {
        this.isSaving.set(false);
        this.notificationService.error('Không thể lưu cấu hình form. Vui lòng thử lại.');
      }
    });
  }

  protected getFieldErrors(fieldId: string): string[] {
    return this.validationErrors()[fieldId] ?? [];
  }

  private serializeValidationRules(field: OrderFormTemplateField): string | undefined {
    if (!field.validationRules || Object.keys(field.validationRules).length === 0) {
      return undefined;
    }

    return JSON.stringify(field.validationRules);
  }

  private reindexFields(fields: OrderFormTemplateField[]): OrderFormTemplateField[] {
    return fields.map((field, index) => ({ ...field, sortOrder: index + 1 }));
  }

  private cloneFields(fields: OrderFormTemplateField[]): OrderFormTemplateField[] {
    return fields.map((field) => ({
      ...field,
      options: field.options.map((option) => ({ ...option })),
      validationRules: { ...(field.validationRules ?? {}) }
    }));
  }

  private createSnapshot(fields: OrderFormTemplateField[], deletedFieldIds: string[]): string {
    return JSON.stringify({
      deletedFieldIds,
      fields: fields.map((field, index) => normalizeFieldForSave(field, index))
    });
  }

  private resolveBusinessMode(): string {
    const shop = this.authStore.currentShop();
    if (shop?.enableSell && shop.enableRent) {
      return 'BOTH';
    }

    return shop?.enableRent ? 'RENT' : 'SELL';
  }

  private canUseSell(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableSell) : true;
  }

  private canUseRent(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableRent) : true;
  }
}
