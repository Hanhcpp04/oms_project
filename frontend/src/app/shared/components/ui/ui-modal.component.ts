import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ui-modal',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4" (click)="closed.emit()">
      <div [class]="'w-full max-h-[90vh] flex flex-col overflow-hidden rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] animate-fade-in-up ' + maxWidthClass" (click)="$event.stopPropagation()">
        <div class="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <h2 class="m-0 text-base font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">{{ title }}</h2>
            @if (description) {
              <p class="m-0 mt-1 text-sm text-[var(--color-text-secondary)]">{{ description }}</p>
            }
          </div>
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-none text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]" (click)="closed.emit()" aria-label="Đóng modal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div class="overflow-y-auto p-5 sm:p-4">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiModalComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() maxWidthClass = 'max-w-2xl';
  @Output() closed = new EventEmitter<void>();
}
