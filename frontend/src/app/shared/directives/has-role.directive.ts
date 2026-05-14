import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AppRole } from '../../core/auth/auth.models';
import { AuthStore } from '../../core/auth/auth.store';

/**
 * Structural directive to show/hide elements based on the current user's role.
 *
 * Usage:
 * ```html
 * <button *appHasRole="'SHOP_OWNER'">Only for shop owner</button>
 * <div *appHasRole="['SHOP_OWNER', 'STAFF']">For both roles</div>
 * ```
 */
@Directive({
    selector: '[appHasRole]',
    standalone: true
})
export class HasRoleDirective {
    private readonly templateRef = inject(TemplateRef<unknown>);
    private readonly viewContainer = inject(ViewContainerRef);
    private readonly authStore = inject(AuthStore);

    /** Single role or array of roles that are allowed to see this element. */
    readonly appHasRole = input.required<AppRole | AppRole[]>();

    private hasView = false;

    constructor() {
        effect(() => {
            const roleInput = this.appHasRole();
            const roles = Array.isArray(roleInput) ? roleInput : [roleInput];
            const allowed = this.authStore.hasAnyRole(roles);

            if (allowed && !this.hasView) {
                this.viewContainer.createEmbeddedView(this.templateRef);
                this.hasView = true;
            } else if (!allowed && this.hasView) {
                this.viewContainer.clear();
                this.hasView = false;
            }
        });
    }
}
