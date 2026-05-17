import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormTemplatePermission } from '../../../core/models/form-template.model';
import { FormTemplateService } from '../../../core/services/form-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UsersStore } from '../../users/state/users.store';
import { UiModalComponent } from '../../../shared/components/ui/ui-modal.component';
import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';

@Component({
  selector: 'app-form-dashboard-page',
  standalone: true,
  imports: [CommonModule, PageTitleComponent, UiModalComponent],
  templateUrl: './form-dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormDashboardPageComponent {
  private readonly formTemplateService = inject(FormTemplateService);
  private readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usersStore = inject(UsersStore);

  protected openMenuId = signal<string | null>(null);
  protected isPermissionModalOpen = signal(false);
  protected permissionTemplateId = signal<string | null>(null);
  protected permissionDraft = signal<Record<string, FormTemplatePermission>>({});

  readonly templates = this.formTemplateService.templates;

  readonly activeTab = computed<'rent' | 'sell'>(() => {
    return (this.route.snapshot.data as { category: 'rent' | 'sell' }).category;
  });

  readonly visibleTemplates = computed(() => {
    const all = this.templates();
    const tab = this.activeTab();
    return all.filter((template) => template.category === tab && template.status !== 'ARCHIVED');
  });

  readonly shopMembers = computed(() =>
    this.usersStore
      .users()
      .filter((user: any) => user.active)
      .sort((first: any, second: any) => first.fullName.localeCompare(second.fullName))
  );

  protected deleteForm(id: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.openMenuId.set(null);

    if (!confirm('Ban co chac chan muon xoa bieu mau nay khong?')) {
      return;
    }

    this.formTemplateService.removeTemplate(id).subscribe({
      next: () => this.notificationService.success('Da xoa bieu mau thanh cong.'),
      error: () => this.notificationService.error('Khong the xoa bieu mau.')
    });
  }

  protected createBlankForm(): void {
    this.formTemplateService.createNewTemplate('Mau khong co tieu de', this.activeTab()).subscribe({
      next: (newTemplate) => {
        this.router.navigate(['/app/form-config/edit', newTemplate.id]);
      },
      error: () => this.notificationService.error('Khong the tao bieu mau moi.')
    });
  }

  protected editForm(id: string): void {
    this.router.navigate(['/app/form-config/edit', id]);
  }

  protected toggleMenu(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  protected closeMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.openMenuId.set(null);
  }

  protected openPermissionModal(templateId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.openMenuId.set(null);
    this.permissionTemplateId.set(templateId);
    this.seedPermissionDraft(templateId);
    this.isPermissionModalOpen.set(true);
  }

  protected closePermissionModal(): void {
    this.permissionTemplateId.set(null);
    this.permissionDraft.set({});
    this.isPermissionModalOpen.set(false);
  }

  protected getMemberPermission(userId: string): FormTemplatePermission {
    return this.permissionDraft()[userId] ?? 'view';
  }

  protected updateMemberPermission(userId: string, permission: string): void {
    this.permissionDraft.update((current) => ({
      ...current,
      [userId]: permission === 'edit' ? 'edit' : 'view'
    }));
  }

  protected savePermissions(): void {
    const templateId = this.permissionTemplateId();

    if (!templateId) {
      return;
    }

    const memberPermissions = Object.entries(this.permissionDraft())
      .filter(([, permission]) => permission === 'edit')
      .map(([userId, permission]) => ({ userId, permission }));

    this.formTemplateService.updateTemplateSharing(templateId, {
      defaultPermission: 'view',
      memberPermissions
    });

    this.notificationService.success('Da luu quyen truy cap cho form.');
    this.closePermissionModal();
  }

  private seedPermissionDraft(templateId: string): void {
    const template = this.templates().find((item) => item.id === templateId);

    if (!template) {
      this.permissionDraft.set({});
      return;
    }

    const explicitPermissionMap = new Map(
      template.sharing.memberPermissions.map((entry) => [entry.userId, entry.permission] as const)
    );
    const draft: Record<string, FormTemplatePermission> = {};

    this.shopMembers().forEach((member) => {
      draft[member.id] = explicitPermissionMap.get(member.id) ?? template.sharing.defaultPermission;
    });

    this.permissionDraft.set(draft);
  }
}
