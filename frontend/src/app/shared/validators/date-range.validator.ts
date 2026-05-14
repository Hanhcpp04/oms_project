import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function dateRangeValidator(startField: string, endField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const startDate = control.get(startField)?.value;
    const endDate = control.get(endField)?.value;

    if (!startDate || !endDate) {
      return null;
    }

    return new Date(startDate) <= new Date(endDate) ? null : { invalidDateRange: true };
  };
}