import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { BreadcrumbComponent } from '../../../shared/components/ui/breadcrumb.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet, UiButtonComponent, BreadcrumbComponent],
  templateUrl: './public-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicShellComponent {
  private readonly router = inject(Router);

  protected goToLogin(): void {
    void this.router.navigate(['/login']);
  }

  protected goToRegister(): void {
    void this.router.navigate(['/register']);
  }
}
