import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, Input, signal } from '@angular/core';
import { Product, ProductImage } from '../data-access/models/product.model';

@Component({
  selector: 'app-product-detail-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail-gallery.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailGalleryComponent {
  @Input({ required: true }) product!: Product;

  protected readonly selectedIndex = signal(0);
  protected readonly viewerOpen = signal(false);

  protected get sortedImages(): ProductImage[] {
    return [...(this.product.images ?? [])].sort((first, second) => first.sortOrder - second.sortOrder);
  }

  protected get selectedImage(): ProductImage | null {
    return this.sortedImages[this.selectedIndex()] ?? null;
  }

  protected selectImage(index: number): void {
    this.selectedIndex.set(index);
  }

  protected openViewer(): void {
    if (this.sortedImages.length === 0) {
      return;
    }

    this.viewerOpen.set(true);
  }

  protected closeViewer(): void {
    this.viewerOpen.set(false);
  }

  protected showPrevious(event?: Event): void {
    event?.stopPropagation();
    const images = this.sortedImages;
    if (images.length <= 1) {
      return;
    }

    this.selectedIndex.set((this.selectedIndex() - 1 + images.length) % images.length);
  }

  protected showNext(event?: Event): void {
    event?.stopPropagation();
    const images = this.sortedImages;
    if (images.length <= 1) {
      return;
    }

    this.selectedIndex.set((this.selectedIndex() + 1) % images.length);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.viewerOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeViewer();
    }

    if (event.key === 'ArrowLeft') {
      this.showPrevious();
    }

    if (event.key === 'ArrowRight') {
      this.showNext();
    }
  }
}
