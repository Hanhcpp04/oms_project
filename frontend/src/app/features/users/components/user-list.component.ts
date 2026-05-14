import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UiAvatarComponent } from '../../../shared/components/ui/ui-avatar.component';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiTableComponent } from '../../../shared/components/ui/ui-table.component';
import { UserAccount } from '../data-access/models/user-account.model';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, UiCardComponent, UiTableComponent, UiBadgeComponent, UiAvatarComponent],
  templateUrl: './user-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserListComponent {
  @Input({ required: true }) users: UserAccount[] = [];
  @Input() loading = false;
  @Input() selectedUserId: string | null = null;

  @Output() select = new EventEmitter<UserAccount>();
  @Output() copyPassword = new EventEmitter<string>();
}
