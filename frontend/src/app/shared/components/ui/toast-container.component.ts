import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit
} from '@angular/core';
import { NotificationService, Toast } from '../../../core/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (toast of toasts; track toast.id) {
        <div
          class="toast"
          [class.toast-success]="toast.type === 'success'"
          [class.toast-error]="toast.type === 'error'"
          [class.toast-info]="toast.type === 'info'"
          [class.toast-warning]="toast.type === 'warning'"
          [class.toast-exiting]="toast.exiting"
          role="alert"
        >
          <div class="toast-icon">
            @switch (toast.type) {
              @case ('success') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              }
              @case ('error') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              }
              @case ('warning') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
              @default {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              }
            }
          </div>
          <p class="toast-message">{{ toast.message }}</p>
          <button class="toast-close" (click)="dismiss(toast.id)" aria-label="Đóng thông báo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div class="toast-progress" [style.animation-duration]="toast.duration + 'ms'"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
      width: calc(100vw - 40px);
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid;
      backdrop-filter: blur(12px);
      animation: toastSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      pointer-events: auto;
      position: relative;
      overflow: hidden;
      font-family: var(--font-sans, 'Inter', sans-serif);
    }

    .toast-exiting {
      animation: toastSlideOut 0.28s cubic-bezier(0.55, 0, 1, 0.45) forwards;
    }

    .toast-success {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-color: #a7f3d0;
      color: #065f46;
    }

    .toast-error {
      background: linear-gradient(135deg, #fef2f2 0%, #ffe5e5 100%);
      border-color: #fca5a5;
      color: #991b1b;
    }

    .toast-info {
      background: linear-gradient(135deg, #eff6ff 0%, #d6eeff 100%);
      border-color: #93c5fd;
      color: #1e3a5f;
    }

    .toast-warning {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border-color: #fcd34d;
      color: #92400e;
    }

    .toast-icon {
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast-message {
      flex: 1;
      margin: 0;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
    }

    .toast-close {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: inherit;
      opacity: 0.5;
      cursor: pointer;
      transition: opacity 0.15s, background 0.15s;
      padding: 0;
    }

    .toast-close:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.06);
    }

    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: currentColor;
      opacity: 0.2;
      animation: toastProgress linear forwards;
      border-radius: 0 0 12px 12px;
    }

    @keyframes toastSlideIn {
      from {
        opacity: 0;
        transform: translateX(100%) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @keyframes toastSlideOut {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateX(100%) scale(0.95);
      }
    }

    @keyframes toastProgress {
      from { width: 100%; }
      to { width: 0%; }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast,
      .toast-exiting,
      .toast-progress {
        animation: none !important;
      }
    }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;

  toasts: Toast[] = [];

  ngOnInit(): void {
    this.subscription = this.notificationService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }
}
