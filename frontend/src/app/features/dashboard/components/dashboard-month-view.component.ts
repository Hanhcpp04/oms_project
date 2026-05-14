import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardViewBase } from './dashboard-view-base';
import { CommonModule } from '@angular/common';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';

@Component({
  selector: 'app-dashboard-month-view',
  standalone: true,
  imports: [CommonModule, UiCardComponent, UiBadgeComponent],
  templateUrl: './dashboard-month-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardMonthViewComponent extends DashboardViewBase {}
