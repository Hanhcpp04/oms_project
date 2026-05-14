import { FormControl, FormGroup } from '@angular/forms';
import { dateRangeValidator } from './date-range.validator';

describe('dateRangeValidator', () => {
  it('should reject a range whose end date is before the start date', () => {
    const form = new FormGroup(
      {
        rentFrom: new FormControl('2026-05-22'),
        rentTo: new FormControl('2026-05-20')
      },
      { validators: dateRangeValidator('rentFrom', 'rentTo') }
    );

    expect(form.valid).toBeFalse();
    expect(form.errors).toEqual({ invalidDateRange: true });
  });
});
