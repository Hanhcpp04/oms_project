import { parseOrderDraftFromRawText } from './order-draft-parser.util';

describe('parseOrderDraftFromRawText', () => {
  it('should extract customer, rental dates and product rows from raw chat text', () => {
    const draft = parseOrderDraftFromRawText(`
      Ten: Nguyen Van A
      SDT: 0901234567
      Dia chi: 123 Nguyen Trai, Quan 1
      Ngay nhan: 20/05/2026
      Ngay tra: 22/05/2026
      Dam do | M | 2 | 150000
      don thue
    `);

    expect(draft.orderType).toBe('RENT');
    expect(draft.customerName).toBe('Nguyen Van A');
    expect(draft.customerPhone).toBe('0901234567');
    expect(draft.customerAddress).toBe('123 Nguyen Trai, Quan 1');
    expect(draft.rentFrom).toBe('2026-05-20');
    expect(draft.rentTo).toBe('2026-05-22');
    expect(draft.products).toEqual([
      {
        name: 'Dam do',
        size: 'M',
        quantity: 2,
        unitPrice: 150000
      }
    ]);
  });
});
