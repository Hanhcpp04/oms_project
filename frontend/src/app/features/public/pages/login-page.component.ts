import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_CONFIG } from '../../../core/http/api.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { GoogleAuthService } from '../../../core/auth/google-auth.service';
import { NotificationService } from '../../../core/services/notification.service';

type LoginField = 'identifier' | 'password';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authStore = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);

  @ViewChild('googleBtn') googleBtn!: ElementRef<HTMLElement>;
  private readonly googleAuthService = inject(GoogleAuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly apiConfig = inject(API_CONFIG);

  protected submitted = false;
  protected showPassword = false;
  protected readonly submitting = this.authStore.submittingAuth;
  protected readonly loginForm = this.formBuilder.nonNullable.group({
    identifier: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected identifierError(): string | null {
    if (!this.shouldShowError('identifier') || !this.loginForm.controls.identifier.errors) {
      return null;
    }

    return 'Vui lòng nhập tên tài khoản hoặc email.';
  }

  protected passwordError(): string | null {
    const errors = this.loginForm.controls.password.errors;

    if (!this.shouldShowError('password') || !errors) {
      return null;
    }

    if (errors['required']) {
      return 'Vui lòng nhập mật khẩu.';
    }

    if (errors['minlength']) {
      return 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    return null;
  }

  protected submitLogin(): void {
    this.submitted = true;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.getRawValue();

    this.authStore.login(
      {
        identifier: identifier.trim(),
        password
      },
      {
        redirectTo: this.route.snapshot.queryParamMap.get('redirect') ?? undefined
      }
    );
  }

  ngAfterViewInit(): void {
    this.setupGoogleLogin();
  }

  private shouldShowError(field: LoginField): boolean {
    return this.submitted || this.loginForm.controls[field].touched;
  }

  private async setupGoogleLogin(): Promise<void> {
    try {
      const credential = await this.googleAuthService.renderButton(
        this.apiConfig.googleClientId,
        this.googleBtn.nativeElement,
        { text: 'signin_with', width: this.googleBtn.nativeElement.offsetWidth || 350 }
      );
      this.authStore.loginWithGoogle(
        { idToken: credential },
        { redirectTo: this.route.snapshot.queryParamMap.get('redirect') ?? undefined }
      );
    } catch (error) {
      if (error instanceof Error && error.message !== 'Google credential was not returned.') {
        this.notificationService.error(resolveErrorMessage(error));
      }
    }
  }
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Không thể đăng nhập bằng Google lúc này.';
}
