import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'emptyValue',
  standalone: true
})
export class EmptyValuePipe implements PipeTransform {
  transform(value: string | number | null | undefined, fallback = '--'): string | number {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    return value;
  }
}