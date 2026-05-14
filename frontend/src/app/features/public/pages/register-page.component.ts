import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { API_CONFIG } from '../../../core/http/api.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { GoogleAuthService } from '../../../core/auth/google-auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { InternationalPhoneInputComponent } from '../../../shared/components/form/international-phone-input.component';

type RegisterField = 'fullName' | 'email' | 'password' | 'phone';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InternationalPhoneInputComponent],
  templateUrl: './register-page.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPageComponent implements AfterViewInit {
  private readonly authStore = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);

  @ViewChild('googleBtn') googleBtn!: ElementRef<HTMLElement>;
  private readonly googleAuthService = inject(GoogleAuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly apiConfig = inject(API_CONFIG);

  protected submitted = false;
  protected showPassword = false;
  protected readonly submitting = this.authStore.submittingAuth;
  protected readonly registerForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
    phone: ['']
  });

  protected fullNameError(): string | null {
    const errors = this.registerForm.controls.fullName.errors;

    if (!this.shouldShowError('fullName') || !errors) {
      return null;
    }

    if (errors['required']) {
      return 'Vui lòng nhập họ và tên.';
    }

    if (errors['maxlength']) {
      return 'Họ và tên không được vượt quá 100 ký tự.';
    }

    return null;
  }

  protected emailError(): string | null {
    const errors = this.registerForm.controls.email.errors;

    if (!this.shouldShowError('email') || !errors) {
      return null;
    }

    if (errors['required']) {
      return 'Vui lòng nhập email.';
    }

    if (errors['email']) {
      return 'Email không đúng định dạng.';
    }

    return null;
  }

  protected passwordError(): string | null {
    const errors = this.registerForm.controls.password.errors;

    if (!this.shouldShowError('password') || !errors) {
      return null;
    }

    if (errors['required']) {
      return 'Vui lòng nhập mật khẩu.';
    }

    if (errors['minlength']) {
      return 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    if (errors['maxlength']) {
      return 'Mật khẩu không được vượt quá 100 ký tự.';
    }

    return null;
  }

  protected phoneError(): string | null {
    const errors = this.registerForm.controls.phone.errors;

    if (!this.shouldShowError('phone') || !errors) {
      return null;
    }

    if (errors['phoneNumber']) {
      return 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.';
    }

    return null;
  }

  protected submitRegister(): void {
    this.submitted = true;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { fullName, email, password, phone } = this.registerForm.getRawValue();

    this.authStore.register({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      phone: phone || undefined
    });
  }

  ngAfterViewInit(): void {
    this.setupGoogleRegister();
  }

  private shouldShowError(field: RegisterField): boolean {
    return this.submitted || this.registerForm.controls[field].touched;
  }

  private async setupGoogleRegister(): Promise<void> {
    try {
      const credential = await this.googleAuthService.renderButton(
        this.apiConfig.googleClientId,
        this.googleBtn.nativeElement,
        { text: 'signup_with', width: this.googleBtn.nativeElement.offsetWidth || 350 }
      );
      this.authStore.registerWithGoogle({
        idToken: credential
      });
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

  return 'Không thể đăng ký bằng Google lúc này.';
}
