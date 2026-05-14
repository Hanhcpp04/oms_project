import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-entry',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './entry.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryComponent {}