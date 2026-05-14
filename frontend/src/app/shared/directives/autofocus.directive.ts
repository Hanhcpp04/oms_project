import { AfterViewInit, Directive, ElementRef, inject, Input } from '@angular/core';

@Directive({
  selector: '[appAutofocus]',
  standalone: true
})
export class AutofocusDirective implements AfterViewInit {
  @Input() appAutofocus = true;

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    if (!this.appAutofocus) {
      return;
    }

    this.elementRef.nativeElement.focus();
  }
}