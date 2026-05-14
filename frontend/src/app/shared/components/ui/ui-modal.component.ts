import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-ui-modal',
    standalone: true,
    template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4" (click)="closed.emit()">
      <div [class]="'w-full max-h-[90vh] flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-surface)] shadow-[var(--shadow-xl)] animate-fade-in-up ' + maxWidthClass"
           (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 class="m-0 text-lg font-bold text-[var(--color-text-primary)]">{{ title }}</h2>
            @if (description) {
              <p class="m-0 mt-1 text-xs text-[var(--color-text-tertiary)]">{{ description }}</p>
            }
          </div>
          <button class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" (click)="closed.emit()" title="Đóng">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <!-- Body (scrollable) -->
        <div class="overflow-y-auto p-6">
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
