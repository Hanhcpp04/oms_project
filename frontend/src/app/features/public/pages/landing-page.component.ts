import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './landing-page.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPageComponent {
  protected readonly metrics = [
    { value: '98.7%', label: 'Tỷ lệ hoàn thành đơn' },
    { value: '2,500+', label: 'Đơn hàng đã xử lý' },
    { value: '24/7', label: 'Theo dõi liên tục' }
  ];

  protected readonly features = [
    {
      icon: 'chart',
      title: 'Dashboard trực quan',
      description: 'Theo dõi doanh thu, đơn hàng và hiệu suất vận hành qua biểu đồ trực quan.'
    },
    {
      icon: 'package',
      title: 'Quản lý đơn hàng',
      description: 'Xử lý đơn thuê & bán, in phiếu, theo dõi trạng thái từ tiếp nhận đến hoàn thành.'
    },
    {
      icon: 'tag',
      title: 'Quản lý sản phẩm',
      description: 'Thêm, sửa, sao chép sản phẩm dễ dàng. Hỗ trợ nhiều biến thể và hình ảnh.'
    },
    {
      icon: 'form',
      title: 'Cấu hình Form',
      description: 'Tạo form thu thập thông tin khách hàng tùy chỉnh theo kiểu Google Forms.'
    },
    {
      icon: 'settings',
      title: 'Thiết lập Shop',
      description: 'Quản lý hồ sơ shop, danh mục sản phẩm, nhân viên và loại hình kinh doanh.'
    },
    {
      icon: 'users',
      title: 'Quản lý nhân viên',
      description: 'Tạo tài khoản nhân viên, theo dõi lịch làm việc và phân công đơn hàng.'
    }
  ];

  protected readonly steps = [
    {
      number: 1,
      title: 'Đăng ký tài khoản',
      description: 'Tạo tài khoản shop của bạn chỉ trong vài giây.'
    },
    {
      number: 2,
      title: 'Thiết lập cửa hàng',
      description: 'Cấu hình thông tin shop, thêm sản phẩm và nhân viên.'
    },
    {
      number: 3,
      title: 'Bắt đầu vận hành',
      description: 'Tiếp nhận đơn hàng, theo dõi doanh thu và quản lý mọi thứ.'
    }
  ];
}
