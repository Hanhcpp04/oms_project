import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
  exiting: boolean;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  info: 4000,
  warning: 5000
};

let nextToastId = 0;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toastsSubject = new BehaviorSubject<Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  success(message: string, duration?: number): void {
    this.show('success', message, duration);
  }

  info(message: string, duration?: number): void {
    this.show('info', message, duration);
  }

  warning(message: string, duration?: number): void {
    this.show('warning', message, duration);
  }

  error(message: string, duration?: number): void {
    this.show('error', message, duration);
  }

  dismiss(id: number): void {
    this.startExit(id);
  }

  private show(type: ToastType, message: string, duration?: number): void {
    const resolvedDuration = duration ?? DEFAULT_DURATION[type];
    const id = ++nextToastId;

    const toast: Toast = { id, type, message, duration: resolvedDuration, exiting: false };

    const current = this.toastsSubject.value;
    // Limit visible toasts to 5
    const capped = current.length >= 5 ? current.slice(1) : current;
    this.toastsSubject.next([...capped, toast]);

    // Auto dismiss after duration
    const timer = setTimeout(() => this.startExit(id), resolvedDuration);
    this.timers.set(id, timer);

    // Also log to console for debugging
    switch (type) {
      case 'success':
        console.info('[SUCCESS]', message);
        break;
      case 'error':
        console.error('[ERROR]', message);
        break;
      case 'warning':
        console.warn('[WARNING]', message);
        break;
      default:
        console.info('[INFO]', message);
    }
  }

  private startExit(id: number): void {
    const current = this.toastsSubject.value;
    const toast = current.find(t => t.id === id);
    if (!toast || toast.exiting) return;

    // Mark as exiting for the slide-out animation
    toast.exiting = true;
    this.toastsSubject.next([...current]);

    // Remove from DOM after exit animation
    setTimeout(() => {
      this.removeToast(id);
    }, 300);
  }

  private removeToast(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    const current = this.toastsSubject.value.filter(t => t.id !== id);
    this.toastsSubject.next(current);
  }
}