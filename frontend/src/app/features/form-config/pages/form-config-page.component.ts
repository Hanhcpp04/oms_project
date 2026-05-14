import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';
import { FormFieldType } from '../../../core/models/form-template.model';
import { FormTemplateService } from '../../../core/services/form-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FormConfigFieldCardComponent } from '../components/form-config-field-card/form-config-field-card.component';
import { UiModalComponent } from '../../../shared/components/ui/ui-modal.component';

@Component({
  selector: 'app-form-config-page',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterModule, FormConfigFieldCardComponent, UiModalComponent],
  templateUrl: './form-config-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormConfigPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formTemplateService = inject(FormTemplateService);
  private readonly notificationService = inject(NotificationService);

  protected isSaveModalOpen = signal(false);
  protected saveFormName = signal('');

  readonly selectedTemplateId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly templates = this.formTemplateService.templates;
  readonly selectedTemplate = computed(
    () => this.templates().find((template) => template.id === this.selectedTemplateId()) ?? null
  );

  protected readonly fieldTypeOptions: ReadonlyArray<{ label: string; value: FormFieldType }> = [
    { label: 'Text', value: 'text' },
    { label: 'Email', value: 'email' },
    { label: 'So dien thoai', value: 'phone' },
    { label: 'Ghi chu', value: 'textarea' },
    { label: 'So', value: 'number' },
    { label: 'Ngay', value: 'date' },
    { label: 'Gio', value: 'time' },
    { label: '1 dap an', value: 'single_choice' },
    { label: 'Nhieu dap an', value: 'multi_choice' },
    { label: 'Dropdown', value: 'dropdown' },
    { label: 'Upload anh', value: 'image' }
  ];

  protected activeFieldId: string | null = null;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.selectedTemplateId.set(params.get('id'));
    });
  }

  protected saveForm(): void {
    this.notificationService.success('Da luu cau hinh bieu mau thanh cong.');
  }

  protected updateTemplateName(value: string): void {
    const selectedId = this.selectedTemplateId();

    if (!selectedId) {
      return;
    }

    this.formTemplateService.updateTemplateDetails(selectedId, { name: value }).subscribe({
      error: () => this.notificationService.error('Khong the cap nhat ten bieu mau.')
    });
  }

  protected updateTemplateDescription(value: string): void {
    const selectedId = this.selectedTemplateId();

    if (!selectedId) {
      return;
    }

    this.formTemplateService.updateTemplateDetails(selectedId, { description: value }).subscribe({
      error: () => this.notificationService.error('Khong the cap nhat mo ta bieu mau.')
    });
  }

  protected addQuickField(type: FormFieldType): void {
    const selectedId = this.selectedTemplateId();

    if (!selectedId) {
      return;
    }

    const labelMap: Record<string, string> = {
      text: 'Cau hoi moi (Van ban)',
      textarea: 'Doan van ban',
      single_choice: 'Trac nghiem',
      multi_choice: 'Hop kiem',
      image: 'Upload anh',
      dropdown: 'Dropdown',
      email: 'Email',
      phone: 'So dien thoai',
      number: 'So',
      date: 'Ngay',
      time: 'Gio'
    };

    this.formTemplateService
      .addField(
        selectedId,
        {
          label: labelMap[type] || 'Cau hoi moi',
          type,
          placeholder: '',
          helperText: '',
          required: false
        },
        this.activeFieldId
      )
      .subscribe({
        next: (field) => {
          this.activeFieldId = field.id;
        },
        error: () => this.notificationService.error('Khong the them truong moi.')
      });
  }

  protected openSaveModal(): void {
    const template = this.selectedTemplate();

    if (!template) {
      return;
    }

    this.saveFormName.set(template.name);
    this.isSaveModalOpen.set(true);
  }

  protected closeSaveModal(): void {
    this.isSaveModalOpen.set(false);
  }

  protected getPublicFormLink(): string[] | null {
    const id = this.selectedTemplateId();
    return id ? ['/forms', id] : null;
  }

  protected confirmSave(): void {
    const template = this.selectedTemplate();

    if (!template) {
      return;
    }

    this.formTemplateService.updateTemplateDetails(template.id, { name: this.saveFormName() }).subscribe({
      next: () => {
        this.closeSaveModal();
        this.router.navigate(['/app/form-config', template.category]);
      },
      error: () => this.notificationService.error('Khong the luu bieu mau.')
    });
  }
}
