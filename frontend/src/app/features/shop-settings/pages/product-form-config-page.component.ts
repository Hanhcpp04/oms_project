import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, ViewChild } from '@angular/core';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';
import {
  ProductFormTemplate,
  ProductFormTemplateType,
} from '../../../core/models/product-form-template.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ProductFormTemplateService } from '../../../core/services/product-form-template.service';
import { forkJoin, Observable } from 'rxjs';
import { DynamicFormFieldManagerComponent, DynamicFormField } from '../../../shared/components/form-config/dynamic-form-field-manager.component';

@Component({
  selector: 'app-product-form-config-page',
  standalone: true,
  imports: [CommonModule, PageTitleComponent, UiCardComponent, DynamicFormFieldManagerComponent],
  templateUrl: './product-form-config-page.component.html',
  styleUrls: ['./product-form-config-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductFormConfigPageComponent {
  @ViewChild(DynamicFormFieldManagerComponent) manager!: DynamicFormFieldManagerComponent;

  private readonly notificationService = inject(NotificationService);
  private readonly authStore = inject(AuthStore);
  private readonly templateService = inject(ProductFormTemplateService);

  readonly businessMode = computed(() => this.resolveBusinessMode());
  readonly categories = computed(() => this.authStore.currentShop()?.categories || []);
  readonly activeTab = signal<ProductFormTemplateType>('SELL');
  
  protected readonly localFields = signal<DynamicFormField[]>([]);
  readonly isSaving = signal(false);

  constructor() {
    effect(() => {
      const type = this.activeTab();
      const template = this.templateService.getTemplateByType(type);
      if (template) {
        this.localFields.set(JSON.parse(JSON.stringify(template.fields)));
      } else {
        this.localFields.set([]);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const mode = this.businessMode();
      if (mode === 'RENT') this.activeTab.set('RENT');
      else this.activeTab.set('SELL');
    }, { allowSignalWrites: true });
  }

  protected setTab(type: ProductFormTemplateType): void {
    if ((type === 'SELL' && !this.canUseSell()) || (type === 'RENT' && !this.canUseRent())) {
      return;
    }

    this.activeTab.set(type);
  }

  protected onFieldsChanged(fields: DynamicFormField[]): void {
    this.localFields.set(fields);
  }

  protected onSaveField(field: DynamicFormField): void {
    this.isSaving.set(true);
    const type = this.activeTab();
    const validationRulesJson = field.validationRules ? JSON.stringify(field.validationRules) : undefined;
    
    let obs$: Observable<any>;
    if (field.id.startsWith('temp-')) {
      obs$ = this.templateService.addField(type, {
        label: field.label,
        type: field.type as any,
        placeholder: field.placeholder,
        required: field.required,
        helperText: field.helperText,
        options: field.options as any,
        validationRulesJson: validationRulesJson
      });
    } else {
      obs$ = this.templateService.updateField(type, field.id, {
        label: field.label,
        fieldKey: field['fieldKey'],
        type: field.type as any,
        placeholder: field.placeholder,
        helperText: field.helperText,
        required: field.required,
        enabled: field['enabled'] ?? true,
        sortOrder: field.sortOrder,
        validationRules: field.validationRules,
        options: field.options as any
      });
    }

    obs$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.notificationService.success('Đã lưu trường thành công');
        this.templateService.loadConfig(type);
        this.manager.closeAfterSave();
      },
      error: () => {
        this.isSaving.set(false);
        this.notificationService.error('Có lỗi xảy ra khi lưu trường');
      }
    });
  }

  protected onDeleteField(field: DynamicFormField): void {
    const type = this.activeTab();
    
    if (field.id.startsWith('temp-')) {
      this.localFields.update(fields => fields.filter(f => f.id !== field.id));
      this.manager.closeAfterSave();
      return;
    }

    this.isSaving.set(true);
    this.templateService.removeCustomField(type, field.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.notificationService.success('Đã xóa trường thành công');
        this.templateService.loadConfig(type);
        this.manager.closeAfterSave();
      },
      error: () => {
        this.isSaving.set(false);
        this.notificationService.error('Có lỗi xảy ra khi xóa trường');
      }
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
