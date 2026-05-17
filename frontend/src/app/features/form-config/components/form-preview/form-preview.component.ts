import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  OrderFormTemplateField,
  OrderFormTemplateType
} from '../../../../core/models/order-form-template.model';
import { DynamicFormRendererComponent } from '../../../../shared/components/dynamic-form/dynamic-form-renderer.component';
import {
  formTypeLabel
} from '../../models/form-config-ui.model';

@Component({
  selector: 'app-form-preview',
  standalone: true,
  imports: [CommonModule, DynamicFormRendererComponent],
  template: `
    <section class="form-preview">
      <div class="form-preview__header">
        <span>{{ formTypeLabel(formType) }}</span>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>

      <div class="form-preview__card">
        <h3>Thông tin khách hàng</h3>
        <div class="form-preview__grid">
          <label>
            <span>Tên khách hàng <b>*</b></span>
            <input type="text" placeholder="Nguyễn Văn A" disabled />
          </label>
          <label>
            <span>Số điện thoại <b>*</b></span>
            <input type="tel" placeholder="090..." disabled />
          </label>
          <label class="form-preview__wide">
            <span>Địa chỉ giao hàng</span>
            <input type="text" placeholder="Địa chỉ giao hàng" disabled />
          </label>
          @if (formType === 'RENT') {
            <label>
              <span>Thời gian thuê</span>
              <input type="text" placeholder="Ngày bắt đầu - ngày kết thúc" disabled />
            </label>
            <label>
              <span>Tiền cọc</span>
              <input type="text" placeholder="0đ" disabled />
            </label>
          }
        </div>
      </div>

      @if (visibleFields.length > 0) {
        <div class="form-preview__card">
          <app-dynamic-form-renderer
            [fields]="visibleFields"
            mode="preview"
            context="public"
            variant="preview"
            [readonly]="true"
          />
        </div>
      } @else {
        <div class="form-preview__empty">Chưa có field public nào để xem trước.</div>
      }
    </section>
  `,
  styleUrls: ['./form-preview.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormPreviewComponent {
  @Input() title = 'Form đặt hàng';
  @Input() description = '';
  @Input() formType: OrderFormTemplateType = 'SELL';
  @Input() fields: OrderFormTemplateField[] = [];

  protected readonly formTypeLabel = formTypeLabel;

  protected get visibleFields(): OrderFormTemplateField[] {
    return this.fields.filter((field) => field.active !== false);
  }
}
