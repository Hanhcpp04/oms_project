import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { InternationalPhoneInputComponent } from '../../../shared/components/form/international-phone-input.component';

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [CommonModule, UiCardComponent, UiInputComponent, UiButtonComponent, InternationalPhoneInputComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[var(--color-surface-secondary)] p-4">
      <app-ui-card className="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-[var(--color-text-primary)]">Hoàn tất hồ sơ</h2>
          <p class="text-[var(--color-text-tertiary)] mt-2">Chào mừng bạn! Vui lòng cập nhật thông tin và đổi mật khẩu cho lần đăng nhập đầu tiên.</p>
        </div>
        
        <form (submit)="onSubmit($event)" class="space-y-5">
          <div class="grid gap-4">
             <app-ui-input 
              label="Họ và tên" 
              [value]="fullName" 
              placeholder="Nhập họ tên đầy đủ"
              (valueChange)="fullName = $event" 
              [required]="true"
            />
            
            <app-ui-input 
              label="Email" 
              [value]="email" 
              placeholder="Nhập email cá nhân"
              (valueChange)="email = $event" 
              [required]="true"
            />

             <app-international-phone-input
              label="Số điện thoại"
              [value]="phone"
              (valueChange)="phone = $event"
            />
          </div>

          <div class="h-px bg-[var(--color-border)] my-6"></div>

          <div class="grid gap-4">
            <app-ui-input 
              label="Mật khẩu hiện tại" 
              type="password"
              [value]="currentPassword" 
              placeholder="Mật khẩu tạm thời được cấp"
              (valueChange)="currentPassword = $event" 
              [required]="true"
            />
            
            <app-ui-input 
              label="Mật khẩu mới" 
              type="password"
              [value]="newPassword" 
              placeholder="Tối thiểu 6 ký tự"
              (valueChange)="newPassword = $event" 
              [required]="true"
            />
          </div>
          
          <app-ui-button 
            type="submit" 
            variant="primary" 
            className="w-full mt-6"
            [disabled]="authStore.submittingAuth()"
          >
            {{ authStore.submittingAuth() ? 'Đang lưu...' : 'Hoàn tất và bắt đầu' }}
          </app-ui-button>
        </form>
      </app-ui-card>
    </div>
  `
})
export class ChangePasswordPageComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);

  fullName = '';
  email = '';
  phone = '';
  currentPassword = '';
  newPassword = '';

  ngOnInit(): void {
    const user = this.authStore.currentUser();
    if (user) {
      this.fullName = user.fullName;
      this.email = user.email.endsWith('@shop.local') ? '' : user.email;
      this.phone = user.phone || '';
    }
  }

  onSubmit(e: Event) {
    e.preventDefault();
    if (!this.fullName || !this.email || !this.currentPassword || !this.newPassword) return;
    
    this.authStore.completeProfile({
      fullName: this.fullName,
      email: this.email,
      phone: this.phone,
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    });
  }
}

