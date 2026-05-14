import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-unauthorized-page',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './unauthorized-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnauthorizedPageComponent { }
