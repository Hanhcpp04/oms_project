import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiModalComponent } from '../../../shared/components/ui/ui-modal.component';
import { CreateWorkShiftPayload, UpdateWorkShiftPayload, WorkShiftResponse } from '../data-access/models/shift.model';
import { UserAccount } from '../data-access/models/user-account.model';

@Component({
  selector: 'app-shift-form-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiButtonComponent, UiInputComponent],
  templateUrl: './shift-form-modal.component.html'
})
export class ShiftFormModalComponent {
  @Input() existingShift: WorkShiftResponse | null = null;
  @Input() availableStaff: UserAccount[] = [];
  @Input() selectedDate: string = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CreateWorkShiftPayload | UpdateWorkShiftPayload>();

  shiftDate = '';
  startTime = '';
  endTime = '';
  name = '';
  selectedStaffIds = new Set<string>();

  ngOnInit(): void {
    if (this.existingShift) {
      this.shiftDate = this.existingShift.shiftDate;
      this.startTime = this.existingShift.startTime;
      this.endTime = this.existingShift.endTime;
      this.name = this.existingShift.name || '';
      this.selectedStaffIds = new Set(this.existingShift.assignedStaff.map((s: any) => String(s.id)));
    } else {
      this.shiftDate = this.selectedDate || new Date().toISOString().split('T')[0];
      this.startTime = '08:00';
      this.endTime = '12:00';
    }
  }

  toggleStaff(staffId: string): void {
    if (this.selectedStaffIds.has(staffId)) {
      this.selectedStaffIds.delete(staffId);
    } else {
      this.selectedStaffIds.add(staffId);
    }
  }

  submit(): void {
    if (!this.shiftDate || !this.startTime || !this.endTime) return;

    const payload = {
      shiftDate: this.shiftDate,
      startTime: this.startTime,
      endTime: this.endTime,
      name: this.name,
      staffIds: Array.from(this.selectedStaffIds)
    };

    this.saved.emit(payload);
  }
}
