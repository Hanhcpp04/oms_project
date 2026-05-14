import { Directive, inject, Input, TemplateRef, ViewContainerRef, OnInit } from '@angular/core';
import { PermissionCode, PermissionService } from '../../core/services/permission.service';

/**
 * Structural directive to show/hide content based on permission.
 *
 * Usage:
 * ```html
 * <div *appHasPermission="'PRODUCT_CREATE'">
 *   Content only visible if user has PRODUCT_CREATE permission
 * </div>
 * ```
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  @Input({ required: true, alias: 'appHasPermission' }) permission!: PermissionCode;

  private hasView = false;

  ngOnInit(): void {
    this.updateView();
  }

  private updateView(): void {
    const hasPermission = this.permissionService.hasPermission(this.permission);

    if (hasPermission && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasPermission && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
