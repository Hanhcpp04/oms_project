export interface FixedRentalVerificationField {
  key: string;
  label: string;
  placeholder: string;
  helperText: string;
  sortOrder: number;
}

export const RENTAL_IDENTITY_DOCUMENT_FRONT_FIELD_KEY = 'rental_identity_document_front';
export const RENTAL_IDENTITY_DOCUMENT_BACK_FIELD_KEY = 'rental_identity_document_back';

export const FIXED_RENTAL_VERIFICATION_FIELDS: ReadonlyArray<FixedRentalVerificationField> = [
  {
    key: RENTAL_IDENTITY_DOCUMENT_FRONT_FIELD_KEY,
    label: 'Giấy tờ tùy thân mặt trước',
    placeholder: 'Tải ảnh mặt trước giấy tờ tùy thân',
    helperText: 'Hỗ trợ CMND, CCCD hoặc hộ chiếu. Ảnh cần rõ nét.',
    sortOrder: 9000
  },
  {
    key: RENTAL_IDENTITY_DOCUMENT_BACK_FIELD_KEY,
    label: 'Giấy tờ tùy thân mặt sau',
    placeholder: 'Tải ảnh mặt sau giấy tờ tùy thân',
    helperText: 'Nếu giấy tờ chỉ có một mặt, bạn có thể tải lại cùng ảnh để hoàn tất xác thực.',
    sortOrder: 9001
  }
];
