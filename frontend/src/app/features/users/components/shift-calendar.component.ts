import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiAvatarComponent } from '../../../shared/components/ui/ui-avatar.component';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { WorkShiftResponse } from '../data-access/models/shift.model';

@Component({
  selector: 'app-shift-calendar',
  standalone: true,
  imports: [CommonModule, UiCardComponent, UiButtonComponent, UiBadgeComponent, UiAvatarComponent],
  templateUrl: './shift-calendar.component.html'
})
export class ShiftCalendarComponent {
  @Input() shifts: WorkShiftResponse[] = [];
  @Input() loading = false;
  
  @Output() createRequested = new EventEmitter<string>();
  @Output() editRequested = new EventEmitter<WorkShiftResponse>();
  @Output() deleteRequested = new EventEmitter<WorkShiftResponse>();

  get shiftsByDate(): { date: string, shifts: WorkShiftResponse[] }[] {
    const grouped = this.shifts.reduce((acc, shift) => {
      if (!acc[shift.shiftDate]) {
        acc[shift.shiftDate] = [];
      }
      acc[shift.shiftDate].push(shift);
      return acc;
    }, {} as Record<string, WorkShiftResponse[]>);

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map(date => ({ date, shifts: grouped[date] }));
  }
}
