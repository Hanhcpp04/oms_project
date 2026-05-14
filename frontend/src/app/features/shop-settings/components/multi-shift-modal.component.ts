import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UserAccount } from '../../users/data-access/models/user-account.model';
import { CreateWorkShiftPayload } from '../../users/data-access/shift-api.service';

export interface ShiftSlot {
  startTime: string;
  endTime: string;
  selectedStaffIds: Set<string>;
  staffDropdownOpen: boolean;
  error?: string;
}

@Component({
  selector: 'app-multi-shift-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      (click)="closed.emit()">
      <div
        class="w-full max-w-xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 class="m-0 text-sm font-bold text-[var(--color-text-primary)]">Tạo ca làm việc</h3>
            <p class="m-0 mt-0.5 text-xs text-[var(--color-text-tertiary)]">{{ formatDisplayDate(shiftDate) }}</p>
          </div>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            (click)="closed.emit()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body: scrollable -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          @for (slot of slots; track $index; let i = $index) {
          <div class="rounded-xl border bg-[var(--color-surface-secondary)] overflow-visible"
            [class]="slot.error ? 'border-red-300' : 'border-[var(--color-border)]'">

            <!-- Slot title row -->
            <div class="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 rounded-t-xl">
              <span class="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Ca {{ i + 1 }}
              </span>
              @if (slots.length > 1) {
              <button
                class="flex h-6 w-6 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Xóa ca này" (click)="removeSlot(i)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              }
            </div>

            <div class="px-4 pb-4 pt-3 space-y-3">
              <!-- Time range -->
              <div class="grid grid-cols-2 gap-3">
                <div class="grid gap-1">
                  <label class="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Bắt đầu</label>
                  <input type="time" [value]="slot.startTime"
                    (change)="updateSlotTime(slot, 'startTime', $any($event.target).value)"
                    class="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent)]" />
                </div>
                <div class="grid gap-1">
                  <label class="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Kết thúc</label>
                  <input type="time" [value]="slot.endTime"
                    (change)="updateSlotTime(slot, 'endTime', $any($event.target).value)"
                    class="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent)]" />
                </div>
              </div>

              <!-- Overlap error -->
              @if (slot.error) {
              <p class="m-0 text-[11px] font-medium text-red-500">⚠ {{ slot.error }}</p>
              }

              <!-- Staff dropdown -->
              <div class="grid gap-1">
                <label class="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Nhân viên
                  @if (slot.selectedStaffIds.size > 0) {
                  <span class="ml-1 font-bold text-[var(--color-accent)]">· {{ slot.selectedStaffIds.size }} đã chọn</span>
                  }
                </label>

                @if (availableStaff.length === 0) {
                <p class="text-xs text-[var(--color-text-tertiary)] italic">Chưa có nhân viên nào trong shop.</p>
                } @else {
                <div class="relative">
                  <!-- Trigger button -->
                  <button type="button"
                    class="flex h-9 w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-left transition hover:border-[var(--color-accent)]/50"
                    (click)="toggleDropdown(slot)">
                    <span [class]="slot.selectedStaffIds.size > 0 ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-tertiary)]'">
                      @if (slot.selectedStaffIds.size === 0) {
                        Chọn nhân viên...
                      } @else {
                        {{ getSelectedNames(slot) }}
                      }
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      [style.transform]="slot.staffDropdownOpen ? 'rotate(180deg)' : ''" style="transition:.15s">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  <!-- Dropdown list -->
                  @if (slot.staffDropdownOpen) {
                  <div class="absolute left-0 right-0 top-10 z-10 max-h-44 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                    @for (staff of availableStaff; track staff.id) {
                    <button type="button"
                      class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-[var(--color-surface-hover)]"
                      (click)="toggleStaff(slot, staff.id)">
                      <!-- Checkbox visual -->
                      <span
                        class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition"
                        [class]="slot.selectedStaffIds.has(staff.id)
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)]'">
                        @if (slot.selectedStaffIds.has(staff.id)) {
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        }
                      </span>
                      <!-- Avatar -->
                      <span
                        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        [style.background]="getAvatarColor(staff.id)">
                        {{ staff.fullName.charAt(0) }}
                      </span>
                      <span class="truncate text-[var(--color-text-primary)]">{{ staff.fullName }}</span>
                    </button>
                    }
                  </div>
                  }
                </div>
                }
              </div>
            </div>
          </div>
          }

          <!-- Add slot button -->
          <button
            class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-accent)]/40 py-2.5 text-sm font-semibold text-[var(--color-accent)] transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
            (click)="addSlot()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm ca nữa
          </button>
        </div>

        <!-- Footer -->
        <div class="flex shrink-0 items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
          <p class="m-0 text-xs text-[var(--color-text-tertiary)]">
            Tổng <strong class="text-[var(--color-text-primary)]">{{ slots.length }}</strong> ca
          </p>
          <div class="flex gap-2">
            <button
              class="flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              (click)="closed.emit()">Hủy</button>
            <button
              class="flex h-9 items-center rounded-lg bg-[var(--color-accent)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="saving || !isValid()"
              (click)="submit()">
              {{ saving ? 'Đang lưu...' : 'Lưu ' + slots.length + ' ca' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MultiShiftModalComponent implements OnInit {
  @Input({ required: true }) shiftDate!: string;
  @Input() availableStaff: UserAccount[] = [];
  @Input() saving = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CreateWorkShiftPayload[]>();

  slots: ShiftSlot[] = [];

  private readonly avatarColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
    '#14b8a6', '#0ea5e9', '#84cc16', '#f59e0b'
  ];

  ngOnInit(): void {
    this.addSlot();
  }

  addSlot(): void {
    const lastSlot = this.slots[this.slots.length - 1];
    let nextStart = '08:00';
    let nextEnd = '12:00';

    if (lastSlot) {
      nextStart = lastSlot.endTime;
      const [h, m] = lastSlot.endTime.split(':').map(Number);
      const endHour = Math.min(h + 4, 23);
      nextEnd = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    this.slots.push({
      startTime: nextStart,
      endTime: nextEnd,
      selectedStaffIds: new Set(),
      staffDropdownOpen: false
    });
    this.validateSlots();
  }

  removeSlot(index: number): void {
    this.slots.splice(index, 1);
    this.validateSlots();
  }

  updateSlotTime(slot: ShiftSlot, field: 'startTime' | 'endTime', value: string): void {
    slot[field] = value;
    this.validateSlots();
  }

  toggleDropdown(slot: ShiftSlot): void {
    // Close all others first
    this.slots.forEach(s => {
      if (s !== slot) s.staffDropdownOpen = false;
    });
    slot.staffDropdownOpen = !slot.staffDropdownOpen;
  }

  toggleStaff(slot: ShiftSlot, staffId: string): void {
    if (slot.selectedStaffIds.has(staffId)) {
      slot.selectedStaffIds.delete(staffId);
    } else {
      slot.selectedStaffIds.add(staffId);
    }
    slot.selectedStaffIds = new Set(slot.selectedStaffIds);
  }

  validateSlots(): void {
    // Clear all errors first
    this.slots.forEach(s => s.error = undefined);

    for (let i = 0; i < this.slots.length; i++) {
      const a = this.slots[i];

      // Time order check
      if (a.startTime && a.endTime && a.startTime >= a.endTime) {
        a.error = 'Giờ bắt đầu phải trước giờ kết thúc.';
        continue;
      }

      // Overlap check against other slots
      for (let j = 0; j < this.slots.length; j++) {
        if (i === j) continue;
        const b = this.slots[j];
        if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) continue;

        const overlaps = a.startTime < b.endTime && a.endTime > b.startTime;
        if (overlaps) {
          a.error = `Trùng giờ với Ca ${j + 1} (${b.startTime}–${b.endTime}).`;
          break;
        }
      }
    }
  }

  isValid(): boolean {
    return this.slots.length > 0 &&
      this.slots.every(s => s.startTime && s.endTime && s.startTime < s.endTime && !s.error);
  }

  submit(): void {
    this.validateSlots();
    if (!this.isValid()) return;

    const payloads: CreateWorkShiftPayload[] = this.slots.map(slot => ({
      shiftDate: this.shiftDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      staffIds: Array.from(slot.selectedStaffIds)
    }));
    this.saved.emit(payloads);
  }

  getSelectedNames(slot: ShiftSlot): string {
    const names = this.availableStaff
      .filter(s => slot.selectedStaffIds.has(s.id))
      .map(s => s.fullName);
    if (names.length === 0) return '';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  getAvatarColor(id: string): string {
    const n = parseInt(id.slice(-2), 16) || id.charCodeAt(0);
    return this.avatarColors[n % this.avatarColors.length];
  }

  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    // Parse as local date (Vietnam timezone) – avoid UTC shift
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh'
    });
  }
}
