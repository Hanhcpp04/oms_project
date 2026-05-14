import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import {
  OrderFormTemplateType,
  OrderFormFieldOption,
} from '../../../core/models/order-form-template.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { OrderFormTemplateService } from '../../../core/services/order-form-template.service';
import { forkJoin, Observable } from 'rxjs';
import { DynamicFormFieldManagerComponent, DynamicFormField } from '../../../shared/components/form-config/dynamic-form-field-manager.component';

@Component({
  selector: 'app-order-form-config-page',
  standalone: true,
  imports: [CommonModule, UiCardComponent, DynamicFormFieldManagerComponent],
  templateUrl: './order-form-config-page.component.html',
  styleUrls: ['./order-form-config-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderFormConfigPageComponent {
  @ViewChild(DynamicFormFieldManagerComponent) manager!: DynamicFormFieldManagerComponent;
  
  private readonly notificationService = inject(NotificationService);
  private readonly authStore = inject(AuthStore);
  private readonly templateService = inject(OrderFormTemplateService);
  private readonly route = inject(ActivatedRoute);

  readonly businessMode = computed(() => this.authStore.currentShop()?.businessMode || 'BOTH');
  readonly activeTab = signal<OrderFormTemplateType>('SELL');

  protected readonly localFields = signal<DynamicFormField[]>([]);
  readonly isSaving = signal(false);

  constructor() {
    // Read category from route data if available
    const routeCategory = this.route.snapshot.data['category'] as string;
    if (routeCategory === 'rent') {
      this.activeTab.set('RENT');
    } else if (routeCategory === 'sell') {
      this.activeTab.set('SELL');
    }

    // Auto-load fields when tab changes or service data updates
    effect(() => {
      const type = this.activeTab();
      const template = this.templateService.getTemplateByType(type);
      if (template) {
        // Deep clone to avoid direct signal mutation
        this.localFields.set(JSON.parse(JSON.stringify(template.fields)));
      } else {
        this.localFields.set([]);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      if (!routeCategory) {
        const mode = this.businessMode();
        if (mode === 'RENT') this.activeTab.set('RENT');
        else this.activeTab.set('SELL');
      }
    }, { allowSignalWrites: true });
  }

  protected setTab(type: OrderFormTemplateType): void {
    this.activeTab.set(type);
  }

  protected onFieldsChanged(fields: DynamicFormField[]): void {
    this.localFields.set(fields);
  }

  // ── Individual Operations ──

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
        showInOrderList: field['showInOrderList'] ?? false,
        showInOrderDetail: field['showInOrderDetail'] ?? true,
        options: field.options as OrderFormFieldOption[],
        validationRulesJson
      });
    } else {
      obs$ = this.templateService.updateField(type, field.id, {
        label: field.label,
        fieldKey: field['fieldKey'],
        type: field.type as any,
        placeholder: field.placeholder,
        helperText: field.helperText,
        required: field.required,
        active: field.active ?? true,
        sortOrder: field.sortOrder,
        showInOrderList: field['showInOrderList'] ?? false,
        showInOrderDetail: field['showInOrderDetail'] ?? true,
        validationRules: field.validationRules,
        options: field.options as OrderFormFieldOption[]
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
    
    // Nếu là trường tạm (chưa lưu DB) thì chỉ cần xóa khỏi list local
    if (field.id.startsWith('temp-')) {
      this.localFields.update(fields => fields.filter(f => f.id !== field.id));
      this.manager.closeAfterSave();
      return;
    }

    // Nếu đã lưu DB thì gọi API xóa
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
}
