import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardViewBase } from './dashboard-view-base';
import { CommonModule } from '@angular/common';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiStatCardComponent } from '../../../shared/components/ui/ui-stat-card.component';

@Component({
  selector: 'app-dashboard-day-view',
  standalone: true,
  imports: [CommonModule, UiCardComponent, UiBadgeComponent, UiStatCardComponent],
  templateUrl: './dashboard-day-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardDayViewComponent extends DashboardViewBase {}
