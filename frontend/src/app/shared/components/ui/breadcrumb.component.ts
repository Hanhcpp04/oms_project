import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  PRIMARY_OUTLET,
  Router,
  RouterLink,
  UrlSegment
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, startWith } from 'rxjs/operators';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly breadcrumbState = signal<BreadcrumbItem[]>([]);

  readonly breadcrumbs = computed(() => this.breadcrumbState());

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.breadcrumbState.set(this.buildBreadcrumbs());
      });
  }

  private buildBreadcrumbs(): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [];

    let currentSnapshot: ActivatedRouteSnapshot | null = this.route.snapshot.root;
    let accumulatedUrl = '';

    while (currentSnapshot) {
      const child: ActivatedRouteSnapshot | undefined = currentSnapshot.children.find(
        (candidate: ActivatedRouteSnapshot) => candidate.outlet === PRIMARY_OUTLET
      );

      if (!child) {
        break;
      }

      currentSnapshot = child;

      const concretePath = child.url.map((segment: UrlSegment) => segment.path).join('/');

      if (concretePath) {
        accumulatedUrl += `/${concretePath}`;
      }

      const label = this.resolveLabel(child);

      if (!label) {
        continue;
      }

      const targetUrl = accumulatedUrl || '/';

      if (items.some((item) => item.url === targetUrl && item.label === label)) {
        continue;
      }

      items.push({ label, url: targetUrl });
    }

    return items;
  }

  private resolveLabel(snapshot: ActivatedRouteSnapshot): string | null {
    const explicitLabel = snapshot.data['breadcrumb'];

    if (typeof explicitLabel === 'string' && explicitLabel.trim().length > 0) {
      return explicitLabel;
    }

    return null;
  }
}
