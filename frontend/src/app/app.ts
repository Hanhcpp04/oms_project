import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { ToastContainerComponent } from './shared/components/ui/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.html'
})
export class App implements OnInit {
  private readonly authStore = inject(AuthStore);

  ngOnInit() {
    this.authStore.loadCurrentUser();
  }
}
