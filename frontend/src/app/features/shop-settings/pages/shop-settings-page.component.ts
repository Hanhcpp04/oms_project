import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FileApiService } from '../../../core/services/file-api.service';
import { API_CONFIG } from '../../../core/http/api.config';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  signal,
  ChangeDetectorRef
} from '@angular/core';
import { LocationApiService, Province, District, Ward } from '../../../core/services/location-api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiModalComponent } from '../../../shared/components/ui/ui-modal.component';
import { UiToggleComponent } from '../../../shared/components/ui/ui-toggle.component';
import { UiSelectComponent } from '../../../shared/components/ui/ui-select.component';
import { InternationalPhoneInputComponent } from '../../../shared/components/form/international-phone-input.component';

import {
  Employee,
  DayStaffBucket,
  MonthCalendarDay,
  buildDayStaffBuckets,
  buildMonthCalendarDays
} from '../utils/staff-schedule.util';
import { AuthStore } from '../../../core/auth/auth.store';
import { StaffApiService } from '../../../core/services/staff-api.service';
import { ShopSetupStatusService } from '../../../core/services/shop-setup-status.service';
import { UsersStore } from '../../users/state/users.store';
import { ShiftApiService, WorkShiftResponse, CreateWorkShiftPayload } from '../../users/data-access/shift-api.service';
import { MultiShiftModalComponent } from '../components/multi-shift-modal.component';
import { AddressApiService, ShopAddressResponse, CreateAddressRequest } from '../data-access/address-api.service';
import { effect } from '@angular/core';
import { forkJoin } from 'rxjs';

type StaffSubView = 'management' | 'schedule';
type ScheduleViewMode = 'day' | 'month';
type SettingsView = 'profile' | 'business-type' | 'category' | 'staff' | 'form-setup' | 'first-product';

@Component({
  selector: 'app-shop-settings-page',
  standalone: true,
  imports: [CommonModule, PageTitleComponent, UiCardComponent, UiInputComponent, UiToggleComponent, UiSelectComponent, UiModalComponent, MultiShiftModalComponent, InternationalPhoneInputComponent],
  templateUrl: './shop-settings-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopSettingsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('dayScroller')
  private dayScroller?: ElementRef<HTMLElement>;

  @ViewChildren('dayCard')
  private dayCards?: QueryList<ElementRef<HTMLElement>>;

  private readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly authStore = inject(AuthStore);
  private readonly staffApiService = inject(StaffApiService);
  private readonly shiftApiService = inject(ShiftApiService);
  private readonly fileApiService = inject(FileApiService);
  private readonly locationApiService = inject(LocationApiService);
  private readonly addressApiService = inject(AddressApiService);
  private readonly shopSetupStatusService = inject(ShopSetupStatusService);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly usersStore = inject(UsersStore);
  private currentDateKey = this.toIsoDate(new Date());
  private realtimeTimerId: number | null = null;
  private followToday = true;

  protected readonly settingView = signal<SettingsView>(this.route.snapshot.data['settingView'] || 'profile');
  protected readonly onboardingFlow = signal(Boolean(this.route.snapshot.data['onboardingFlow']));
  protected readonly staffSubView = signal<StaffSubView>('management');
  protected readonly scheduleViewMode = signal<ScheduleViewMode>('day');

  protected readonly shopName = signal(this.authStore.currentShop()?.name ?? '');
  protected readonly shopEmail = signal(this.resolveInitialShopEmail());
  protected readonly shopPhone = signal(this.resolveInitialShopPhone());
  protected readonly supportEmail = signal(this.authStore.currentShop()?.supportEmail ?? '');
  protected readonly supportPhone = signal(this.authStore.currentShop()?.supportPhone ?? '');
  protected readonly logoUrl = signal<string>('');
  protected readonly address = signal('');
  protected readonly shopProfile = signal('flagship');
  protected readonly shopCategory = signal('fashion');
  protected readonly staffModel = signal('core-team');
  protected readonly enableSell = signal(this.authStore.currentShop()?.enableSell ?? true);
  protected readonly enableRent = signal(this.authStore.currentShop()?.enableRent ?? true);
  protected readonly notificationsEnabled = signal(this.authStore.currentShop()?.notificationsEnabled ?? true);
  protected readonly autoAcceptOrders = signal(this.authStore.currentShop()?.autoAcceptOrders ?? false);
  protected readonly maintenanceMode = signal(this.authStore.currentShop()?.maintenanceMode ?? false);
  protected readonly showInventoryOnStorefront = signal(this.authStore.currentShop()?.showInventoryOnStorefront ?? true);
  protected readonly rentalIdentityVerificationEnabled = signal(
    this.authStore.currentShop()?.rentalIdentityVerificationEnabled ?? false
  );

  protected readonly shopAddresses = signal<ShopAddressResponse[]>([]);

  protected showAddEmployee = false;
  protected showEmployeeDetailModal = false;
  protected showAddAddress = signal(false);
  protected submittingStaff = signal(false);
  protected submittingAddress = signal(false);
  protected editingAddressId: number | null = null;
  protected newAddressLabel = signal('');
  protected newAddressLine = signal('');
  protected newAddressWard = signal('');
  protected newAddressDistrict = signal('');
  protected newAddressProvince = signal('');
  protected newAddressIsDefault = signal(false);

  protected provinces = signal<Province[]>([]);
  protected districts = signal<District[]>([]);
  protected wards = signal<Ward[]>([]);

  protected provinceOptions = computed(() =>
    this.provinces().map(p => ({ label: p.name, value: p.name }))
  );
  protected districtOptions = computed(() =>
    this.districts().map(d => ({ label: d.name, value: d.name }))
  );
  protected wardOptions = computed(() =>
    this.wards().map(w => ({ label: w.name, value: w.name }))
  );

  protected newEmployeeName = '';
  protected newEmployeeEmail = '';
  protected newEmployeePhone = '';
  protected createdEmployeeAccount: { employeeName: string; username: string; password?: string } | null = null;
  protected expandedEmployeeIds: Record<string, boolean> = {};

  // ── Inline validation error signals ──
  protected readonly errorShopName = signal('');
  protected readonly errorShopEmail = signal('');
  protected readonly errorShopPhone = signal('');
  protected readonly errorSupportEmail = signal('');
  protected readonly errorSupportPhone = signal('');
  protected readonly errorNewEmployeeName = signal('');
  protected readonly errorAddressLabel = signal('');
  protected readonly errorAddressLine = signal('');
  protected readonly errorAddressProvince = signal('');
  protected readonly errorAddressDistrict = signal('');
  protected readonly errorAddressWard = signal('');

  protected readonly categories = signal<string[]>([]);

  protected readonly forms = ['Form bán hàng mặc định', 'Form cho thuê mặc định', 'Form kết hợp'];

  protected newCategoryName = '';
  protected newFormName = '';
  protected selectedFormTemplate = 'Form bán hàng mặc định';

  // Category edit state
  protected editingCategoryIndex: number | null = null;
  protected editingCategoryName = '';

  protected readonly staffSubViewTabs: { label: string; value: StaffSubView }[] = [
    { label: 'Nhân sự', value: 'management' },
    { label: 'Lịch ca', value: 'schedule' }
  ];

  protected readonly scheduleModeTabs: { label: string; value: ScheduleViewMode }[] = [
    { label: 'Theo ngày', value: 'day' },
    { label: 'Theo tháng', value: 'month' }
  ];

  protected readonly monthWeekLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  protected readonly employees: Employee[] = [];

  // Sync store users to local employees array for the schedule utility
  private readonly syncEmployees = effect(() => {
    const storeUsers = this.usersStore.users();

    // Clear and repopulate the local array used by the schedule logic
    this.employees.length = 0;
    storeUsers.forEach(u => {
      this.employees.push({
        id: u.id,
        name: u.fullName,
        phone: u.phone ?? '',
        role: 'Nhân viên',
        active: u.active,
        username: u.username,
        password: u.temporaryPassword
      });
    });

    // Trigger schedule refresh only if there are items to prevent unnecessary cycles
    this.refreshScheduleViews();
    this.cdr.markForCheck();
  });

  private readonly syncBusinessType = effect(() => {
    const shop = this.authStore.currentShop();
    if (!shop) {
      return;
    }

    this.enableSell.set(Boolean(shop.enableSell));
    this.enableRent.set(Boolean(shop.enableRent));
    this.autoAcceptOrders.set(Boolean(shop.autoAcceptOrders));
    this.maintenanceMode.set(Boolean(shop.maintenanceMode));
    this.showInventoryOnStorefront.set(Boolean(shop.showInventoryOnStorefront));
    this.notificationsEnabled.set(Boolean(shop.notificationsEnabled));
    this.rentalIdentityVerificationEnabled.set(Boolean(shop.rentalIdentityVerificationEnabled));
  }, { allowSignalWrites: true });

  protected selectedDateValue = this.toIsoDate(new Date());
  protected readonly dayStaffBuckets: DayStaffBucket[] = this.buildDayStaffBuckets();
  protected monthAnchorDate = this.getMonthAnchorFromDateValue(this.selectedDateValue);
  protected selectedMonthValue = this.toMonthValue(this.monthAnchorDate);
  protected monthTitle = this.formatMonthTitle(this.monthAnchorDate);
  protected readonly monthCalendarDays: MonthCalendarDay[] = this.buildMonthCalendarDays(this.monthAnchorDate);

  // Real shift data from API
  protected realShifts: WorkShiftResponse[] = [];
  protected shiftsByDate: Record<string, WorkShiftResponse[]> = {};

  // Multi-shift modal state
  protected showShiftModal = false;
  protected shiftModalDate = '';
  protected savingShifts = false;

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      if (data['settingView']) {
        this.settingView.set(data['settingView']);
      }
      if (data['onboardingFlow'] !== undefined) {
        this.onboardingFlow.set(Boolean(data['onboardingFlow']));
      }
    });

    // Resolve avatar URL after injection tokens are ready
    const rawAvatarUrl = this.authStore.currentShop()?.avatarUrl;
    if (rawAvatarUrl) {
      this.logoUrl.set(this.resolveAvatarUrl(rawAvatarUrl));
    }

    const currentCategories = this.authStore.currentShop()?.categories;
    if (currentCategories && currentCategories.length > 0) {
      this.categories.set([...currentCategories]);
    }

    this.loadProvinces();

    if (this.authStore.currentShop() && !this.onboardingFlow()) {
      this.loadAddresses();
      this.usersStore.loadUsers({ size: 100 }); // Load all staff for the settings view
      this.loadShiftsForView();
    }
  }

  private loadAddresses(): void {
    this.addressApiService.getAddresses().subscribe({
      next: (addresses) => {
        this.shopAddresses.set(addresses || []);
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load addresses:', err.status, err.error, err.message);
        // Show user-friendly warning while keeping a detailed console log for debugging
        this.notificationService.warning('Không thể tải danh sách địa chỉ. Vui lòng thử lại.');
      }
    });
  }

  private resolveInitialShopEmail(): string {
    const shopEmail = this.authStore.currentShop()?.email?.trim();
    if (shopEmail) {
      return shopEmail;
    }

    return this.route.snapshot.data['onboardingFlow']
      ? this.authStore.currentUser()?.email?.trim() ?? ''
      : '';
  }

  private resolveInitialShopPhone(): string {
    const shopPhone = this.authStore.currentShop()?.phone?.trim();
    if (shopPhone) {
      return shopPhone;
    }

    return this.route.snapshot.data['onboardingFlow']
      ? this.authStore.currentUser()?.phone?.trim() ?? ''
      : '';
  }

  private loadShiftsForView(): void {
    // Load shifts for the visible date range (14 days for day view, 42 days for month view)
    const anchor = this.monthAnchorDate;
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const startDate = this.toIsoDate(new Date(year, month, 1));
    const endDate = this.toIsoDate(new Date(year, month + 2, 0));

    this.shiftApiService.getShiftsByDateRange(startDate, endDate).subscribe({
      next: (shifts) => {
        this.realShifts = shifts || [];
        this.shiftsByDate = {};
        this.realShifts.forEach(s => {
          const key = s.shiftDate as unknown as string;
          if (!this.shiftsByDate[key]) this.shiftsByDate[key] = [];
          this.shiftsByDate[key].push(s);
        });
        this.cdr.markForCheck();
      },
      error: () => {
        this.shiftsByDate = {};
        this.cdr.markForCheck();
      }
    });
  }

  protected openShiftModal(date: string, event: Event): void {
    event.stopPropagation();
    this.shiftModalDate = date;
    this.showShiftModal = true;
    this.cdr.markForCheck();
  }

  protected closeShiftModal(): void {
    this.showShiftModal = false;
    this.savingShifts = false;
    this.cdr.markForCheck();
  }

  protected saveShifts(payloads: any[]): void {
    if (!payloads.length) return;
    this.savingShifts = true;
    this.cdr.markForCheck();

    const requests = payloads.map((p: CreateWorkShiftPayload) => this.shiftApiService.createShift(p));
    forkJoin(requests).subscribe({
      next: (results: WorkShiftResponse[]) => {
        this.notificationService.success(`Đã tạo ${results.length} ca làm việc thành công.`);
        this.closeShiftModal();
        this.loadShiftsForView();
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Không thể tạo ca làm việc.';
        this.notificationService.error(msg);
        this.savingShifts = false;
        this.cdr.markForCheck();
      }
    });
  }

  protected getShiftsForDate(isoDate: string): WorkShiftResponse[] {
    return this.shiftsByDate[isoDate] || [];
  }


  private loadProvinces(): void {
    this.locationApiService.getProvinces().subscribe({
      next: (data) => {
        console.log('Provinces loaded:', data);
        this.provinces.set(data || []);
      },
      error: (err) => {
        console.error('Failed to load provinces:', err);
        this.notificationService.warning('Không thể tải danh sách tỉnh/thành. Vui lòng kiểm tra kết nối mạng và thử lại.');
      }
    });
  }

  protected updateShopName(value: string): void {
    this.shopName.set(value);
    this.errorShopName.set(this.validateRequired(value, 'Tên shop'));
  }
  protected updateShopPhone(value: string): void {
    this.shopPhone.set(value);
    this.errorShopPhone.set(this.validatePhone(value));
  }
  protected updateShopEmail(value: string): void {
    this.shopEmail.set(value);
    this.errorShopEmail.set(this.validateEmail(value));
  }
  protected updateSupportPhone(value: string): void {
    this.supportPhone.set(value);
    this.errorSupportPhone.set(this.validatePhone(value));
  }
  protected updateSupportEmail(value: string): void {
    this.supportEmail.set(value);
    this.errorSupportEmail.set(this.validateEmail(value));
  }
  protected updateAddress(value: string): void { this.address.set(value); }
  protected updateShopProfile(value: string): void { this.shopProfile.set(value); }
  protected updateShopCategory(value: string): void { this.shopCategory.set(value); }

  protected onAvatarSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.notificationService.error('Kích thước ảnh tối đa là 2MB');
      return;
    }

    this.notificationService.info('Đang tải ảnh lên...');
    this.fileApiService.upload(file).subscribe({
      next: (relativePath: string) => {
        const fullUrl = this.resolveAvatarUrl(relativePath);
        this.logoUrl.set(fullUrl);
        // Save immediately if not in onboarding
        if (!this.onboardingFlow()) {
          this.authStore.updateLogo({ logoUrl: relativePath });
        } else {
          this.notificationService.success('Đã tải ảnh lên thành công');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.notificationService.error('Không thể tải ảnh lên: ' + (err.error?.message || 'Lỗi không xác định'));
      }
    });
  }

  private resolveAvatarUrl(path: string | undefined | null): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    // Relative path from backend - prepend the backend origin
    const baseOrigin = this.apiConfig.baseUrl.replace('/api', '');
    return baseOrigin + path;
  }

  protected saveBasicInfo(): void {
    // Validate all basic info fields
    const nameErr = this.validateRequired(this.shopName(), 'Tên shop');
    const emailErr = this.validateEmail(this.shopEmail());
    const phoneErr = this.validatePhone(this.shopPhone());

    this.errorShopName.set(nameErr);
    this.errorShopEmail.set(emailErr);
    this.errorShopPhone.set(phoneErr);

    if (nameErr || emailErr || phoneErr) {
      return;
    }

    this.authStore.updateBasicInfo({
      name: this.shopName(),
      email: this.shopEmail(),
      phone: this.shopPhone()
    });
  }

  protected saveSupportInfo(): void {
    const emailErr = this.validateEmail(this.supportEmail());
    const phoneErr = this.validatePhone(this.supportPhone());

    this.errorSupportEmail.set(emailErr);
    this.errorSupportPhone.set(phoneErr);

    if (emailErr || phoneErr) {
      return;
    }

    this.authStore.updateSupportInfo({
      supportEmail: this.supportEmail(),
      supportPhone: this.supportPhone()
    });
  }

  protected saveAddresses(): void {
    // This method is deprecated - addresses are now saved individually through the API
    // Keeping it for backward compatibility but it no longer does anything
  }

  protected openAddAddressModal(): void {
    this.newAddressLabel.set('');
    this.newAddressLine.set('');
    this.newAddressWard.set('');
    this.newAddressDistrict.set('');
    this.newAddressProvince.set('');
    this.districts.set([]);
    this.wards.set([]);
    this.newAddressIsDefault.set(this.shopAddresses().length === 0);
    // Reset address validation errors
    this.errorAddressLabel.set('');
    this.errorAddressLine.set('');
    this.errorAddressProvince.set('');
    this.errorAddressDistrict.set('');
    this.errorAddressWard.set('');
    this.showAddAddress.set(true);

    if (this.provinces().length === 0) {
      this.loadProvinces();
    }
  }

  protected handleProvinceChange(provinceName: string): void {
    console.log('Province selected:', provinceName);
    this.newAddressProvince.set(provinceName);
    this.newAddressDistrict.set('');
    this.newAddressWard.set('');
    this.districts.set([]);
    this.wards.set([]);

    const province = this.provinces().find(p => p.name === provinceName);
    if (province) {
      this.locationApiService.getDistricts(province.code).subscribe({
        next: (data) => {
          console.log('Districts loaded:', data.districts);
          this.districts.set(data.districts || []);
        },
        error: (err) => {
          console.error('Failed to load districts:', err);
        }
      });
    }
  }

  protected handleDistrictChange(districtName: string): void {
    console.log('District selected:', districtName);
    this.newAddressDistrict.set(districtName);
    this.newAddressWard.set('');
    this.wards.set([]);

    const district = this.districts().find(d => d.name === districtName);
    if (district) {
      this.locationApiService.getWards(district.code).subscribe({
        next: (data) => {
          console.log('Wards loaded:', data.wards);
          this.wards.set(data.wards || []);
        },
        error: (err) => {
          console.error('Failed to load wards:', err);
        }
      });
    }
  }





  protected closeAddressModal(): void {
    this.showAddAddress.set(false);
    this.editingAddressId = null;
    // Reset form
    this.newAddressLabel.set('');
    this.newAddressLine.set('');
    this.newAddressWard.set('');
    this.newAddressDistrict.set('');
    this.newAddressProvince.set('');
    this.newAddressIsDefault.set(false);
    // Reset errors
    this.errorAddressLabel.set('');
    this.errorAddressLine.set('');
    this.errorAddressProvince.set('');
    this.errorAddressDistrict.set('');
    this.errorAddressWard.set('');
  }

  protected addAddress(): void {
    if (this.onboardingFlow() || !this.authStore.currentShop()) {
      this.notificationService.warning('Hãy hoàn tất tạo shop trước khi thêm địa chỉ.');
      return;
    }

    // Validate all address fields
    const labelErr = this.validateRequired(this.newAddressLabel(), 'Tên gợi nhớ');
    const lineErr = this.validateRequired(this.newAddressLine(), 'Địa chỉ chi tiết');
    const provinceErr = this.validateRequired(this.newAddressProvince(), 'Tỉnh/Thành phố');
    const districtErr = this.validateRequired(this.newAddressDistrict(), 'Quận/Huyện');
    const wardErr = this.validateRequired(this.newAddressWard(), 'Phường/Xã');

    this.errorAddressLabel.set(labelErr);
    this.errorAddressLine.set(lineErr);
    this.errorAddressProvince.set(provinceErr);
    this.errorAddressDistrict.set(districtErr);
    this.errorAddressWard.set(wardErr);

    const hasErrors = labelErr || lineErr || provinceErr || districtErr || wardErr;
    if (hasErrors) {
      this.notificationService.error('Vui lòng nhập đầy đủ thông tin địa chỉ.');
      return;
    }

    const newAddr: CreateAddressRequest = {
      label: this.newAddressLabel(),
      addressLine: this.newAddressLine(),
      ward: this.newAddressWard(),
      district: this.newAddressDistrict(),
      province: this.newAddressProvince(),
      isDefault: this.newAddressIsDefault()
    };

    // Call API to create address
    this.submittingAddress.set(true);
    this.addressApiService.createAddress(newAddr).subscribe({
      next: (createdAddress) => {
        const current = [...this.shopAddresses()];
        if (newAddr.isDefault) {
          current.forEach(a => a.isDefault = false);
        }
        current.push(createdAddress);
        this.shopAddresses.set(current);

        this.submittingAddress.set(false);
        this.closeAddressModal();
        this.shopSetupStatusService.refresh();
        this.notificationService.success('Đã thêm địa chỉ thành công.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submittingAddress.set(false);
        const msg = err?.error?.message || 'Không thể thêm địa chỉ.';
        this.notificationService.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  protected removeAddress(index: number): void {
    const addressToDelete = this.shopAddresses()[index];
    if (!addressToDelete) return;

    this.submittingAddress.set(true);
    this.addressApiService.deleteAddress(addressToDelete.id).subscribe({
      next: () => {
        const current = [...this.shopAddresses()];
        current.splice(index, 1);

        // If deleted address was default, set first remaining as default
        if (addressToDelete.isDefault && current.length > 0) {
          current[0].isDefault = true;
        }

        this.shopAddresses.set(current);
        this.submittingAddress.set(false);
        this.shopSetupStatusService.refresh();
        this.notificationService.success('Đã xóa địa chỉ thành công.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submittingAddress.set(false);
        const msg = err?.error?.message || 'Không thể xóa địa chỉ.';
        this.notificationService.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  protected editAddress(index: number): void {
    const address = this.shopAddresses()[index];
    if (!address) return;

    this.editingAddressId = address.id;
    this.newAddressLabel.set(address.label);
    this.newAddressLine.set(address.addressLine);
    this.newAddressWard.set(address.ward);
    this.newAddressDistrict.set(address.district);
    this.newAddressProvince.set(address.province);
    this.newAddressIsDefault.set(address.isDefault);

    // Load provinces and districts
    if (this.provinces().length === 0) {
      this.loadProvinces();
    }

    // Load districts for selected province
    const province = this.provinces().find(p => p.name === address.province);
    if (province) {
      this.locationApiService.getDistricts(province.code).subscribe({
        next: (data) => {
          this.districts.set(data.districts || []);
        },
        error: (err) => {
          console.error('Failed to load districts:', err);
        }
      });

      // Load wards for selected district
      this.locationApiService.getDistricts(province.code).subscribe({
        next: (districtData) => {
          const district = districtData.districts.find((d: District) => d.name === address.district);
          if (district) {
            this.locationApiService.getWards(district.code).subscribe({
              next: (wardData) => {
                this.wards.set(wardData.wards || []);
              },
              error: (err) => {
                console.error('Failed to load wards:', err);
              }
            });
          }
        }
      });
    }

    this.showAddAddress.set(true);
    this.cdr.markForCheck();
  }

  protected saveEditedAddress(): void {
    if (!this.editingAddressId) {
      this.notificationService.error('Lỗi: Không tìm thấy địa chỉ cần sửa.');
      return;
    }

    // Validate all address fields
    const labelErr = this.validateRequired(this.newAddressLabel(), 'Tên gợi nhớ');
    const lineErr = this.validateRequired(this.newAddressLine(), 'Địa chỉ chi tiết');
    const provinceErr = this.validateRequired(this.newAddressProvince(), 'Tỉnh/Thành phố');
    const districtErr = this.validateRequired(this.newAddressDistrict(), 'Quận/Huyện');
    const wardErr = this.validateRequired(this.newAddressWard(), 'Phường/Xã');

    this.errorAddressLabel.set(labelErr);
    this.errorAddressLine.set(lineErr);
    this.errorAddressProvince.set(provinceErr);
    this.errorAddressDistrict.set(districtErr);
    this.errorAddressWard.set(wardErr);

    const hasErrors = labelErr || lineErr || provinceErr || districtErr || wardErr;
    if (hasErrors) {
      this.notificationService.error('Vui lòng nhập đầy đủ thông tin địa chỉ.');
      return;
    }

    const updateRequest: any = {
      label: this.newAddressLabel(),
      addressLine: this.newAddressLine(),
      ward: this.newAddressWard(),
      district: this.newAddressDistrict(),
      province: this.newAddressProvince(),
      isDefault: this.newAddressIsDefault()
    };

    // Call API to update address
    this.submittingAddress.set(true);
    this.addressApiService.updateAddress(this.editingAddressId, updateRequest).subscribe({
      next: (updatedAddress) => {
        const current = [...this.shopAddresses()];
        const index = current.findIndex(a => a.id === this.editingAddressId);

        if (index !== -1) {
          // If setting as default, unset default for others
          if (updatedAddress.isDefault) {
            current.forEach(a => a.isDefault = false);
          }
          current[index] = updatedAddress;
        }

        this.shopAddresses.set(current);
        this.submittingAddress.set(false);
        this.editingAddressId = null;
        this.closeAddressModal();
        this.shopSetupStatusService.refresh();
        this.notificationService.success('Đã cập nhật địa chỉ thành công.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submittingAddress.set(false);
        const msg = err?.error?.message || 'Không thể cập nhật địa chỉ.';
        this.notificationService.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  protected setAddressAsDefault(index: number): void {
    const address = this.shopAddresses()[index];
    if (!address || address.isDefault) return;

    this.submittingAddress.set(true);
    this.addressApiService.setDefaultAddress(address.id).subscribe({
      next: (updatedAddress) => {
        const current = [...this.shopAddresses()];
        current.forEach(a => a.isDefault = false);
        const idx = current.findIndex(a => a.id === address.id);
        if (idx !== -1) {
          current[idx] = updatedAddress;
        }
        this.shopAddresses.set(current);
        this.submittingAddress.set(false);
        this.shopSetupStatusService.refresh();
        this.notificationService.success('Đã đặt địa chỉ làm mặc định.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submittingAddress.set(false);
        const msg = err?.error?.message || 'Không thể đặt địa chỉ làm mặc định.';
        this.notificationService.error(msg);
        this.cdr.markForCheck();
      }
    });
  }
  protected updateStaffModel(value: string): void { this.staffModel.set(value); }

  protected toggleAutoAcceptOrders(nextValue: boolean): void {
    this.autoAcceptOrders.set(nextValue);
    this.authStore.updateOperationalSettings({ autoAcceptOrders: nextValue });
  }
  protected toggleMaintenanceMode(nextValue: boolean): void {
    this.maintenanceMode.set(nextValue);
    this.authStore.updateOperationalSettings({ maintenanceMode: nextValue });
  }
  protected toggleShowInventoryOnStorefront(nextValue: boolean): void {
    this.showInventoryOnStorefront.set(nextValue);
    this.authStore.updateOperationalSettings({ showInventoryOnStorefront: nextValue });
  }
  protected toggleNotifications(nextValue: boolean): void {
    this.notificationsEnabled.set(nextValue);
    this.authStore.updateOperationalSettings({ notificationsEnabled: nextValue });
  }
  protected toggleRentalIdentityVerification(nextValue: boolean): void {
    this.rentalIdentityVerificationEnabled.set(nextValue);
    this.authStore.updateOperationalSettings({ rentalIdentityVerificationEnabled: nextValue });
  }
  protected toggleSellCapability(nextValue: boolean): void {
    if (!nextValue && !this.enableRent()) {
      this.enableRent.set(true);
      this.enableSell.set(false);
      return;
    }

    this.enableSell.set(nextValue);
  }

  protected toggleRentCapability(nextValue: boolean): void {
    if (!nextValue && !this.enableSell()) {
      this.enableSell.set(true);
      this.enableRent.set(false);
      return;
    }

    this.enableRent.set(nextValue);
  }

  protected saveBusinessType(): void {
    if (!this.enableSell() && !this.enableRent()) {
      this.notificationService.error('Cần bật ít nhất 1 chế độ kinh doanh.');
      return;
    }
    this.authStore.updateBusinessTypeSettings({
      enableSell: this.enableSell(),
      enableRent: this.enableRent()
    });
  }

  protected setStaffSubView(value: StaffSubView): void {
    this.staffSubView.set(value);
    if (value === 'schedule' && this.scheduleViewMode() === 'day') {
      this.deferCenterFocusedCard();
    }
  }

  protected setScheduleViewMode(value: ScheduleViewMode): void {
    this.scheduleViewMode.set(value);
    if (value === 'day' && this.staffSubView() === 'schedule') {
      this.deferCenterFocusedCard();
    }
  }

  protected onDatePickerChange(value: string): void {
    const parsed = this.parseIsoDate(value);
    if (!parsed) {
      return;
    }

    this.selectedDateValue = this.toIsoDate(parsed);
    this.followToday = this.selectedDateValue === this.toIsoDate(new Date());
    this.refreshScheduleViews(true);
  }

  protected onMonthPickerChange(value: string): void {
    const parsedMonth = this.parseMonthValue(value);
    if (!parsedMonth) {
      return;
    }

    this.followToday = false;
    this.monthAnchorDate = parsedMonth;
    this.selectedMonthValue = this.toMonthValue(parsedMonth);
    this.monthTitle = this.formatMonthTitle(this.monthAnchorDate);
    this.refreshScheduleViews();
  }

  protected jumpToToday(): void {
    this.followToday = true;
    this.selectedDateValue = this.toIsoDate(new Date());
    this.refreshScheduleViews(true);
  }

  protected pickDateFromMonth(isoDate: string): void {
    const parsed = this.parseIsoDate(isoDate);
    if (!parsed) {
      return;
    }

    this.selectedDateValue = this.toIsoDate(parsed);
    this.followToday = this.selectedDateValue === this.toIsoDate(new Date());
    this.scheduleViewMode.set('day');
    this.refreshScheduleViews(true);
  }

  protected addEmployee(): void {
    const nameErr = this.validateRequired(this.newEmployeeName, 'Họ tên');
    this.errorNewEmployeeName.set(nameErr);
    if (nameErr) {
      return;
    }

    this.submittingStaff.set(true);
    this.staffApiService.createStaff({
      fullName: this.newEmployeeName.trim()
    }).subscribe({
      next: (staff) => {
        this.submittingStaff.set(false);
        const createdEmployee: Employee = {
          id: staff.id.toString(),
          name: staff.fullName,
          phone: this.newEmployeePhone,
          role: 'Nhân viên',
          active: true,
          username: staff.username,
          password: staff.temporaryPassword
        };

        this.employees.push(createdEmployee);
        this.refreshScheduleViews();

        // Refresh the global store so other pages (like /app/employees) are updated
        this.usersStore.loadUsers({ size: 100 });

        this.createdEmployeeAccount = {
          employeeName: staff.fullName,
          username: staff.username,
          password: staff.temporaryPassword
        };

        this.expandedEmployeeIds[createdEmployee.id] = true;
        this.newEmployeeName = '';
        this.newEmployeeEmail = '';
        this.newEmployeePhone = '';
        this.notificationService.success('Đã tạo tài khoản nhân viên thành công.');
      },
      error: () => {
        this.submittingStaff.set(false);
      }
    });
  }

  protected openAddEmployeeModal(): void {
    this.showAddEmployee = true;
    this.newEmployeeName = '';
    this.newEmployeePhone = '';
    this.createdEmployeeAccount = null;
  }

  protected closeAddEmployeeModal(): void {
    this.showAddEmployee = false;
    this.newEmployeeName = '';
    this.newEmployeePhone = '';
    this.createdEmployeeAccount = null;
  }

  protected openEmployeeDetail(employee: Employee, event?: Event): void {
    event?.stopPropagation();

    const matchedUser = this.usersStore.users().find((user) => user.id === employee.id);
    if (!matchedUser) {
      this.notificationService.warning('Không tìm thấy dữ liệu chi tiết của nhân viên này.');
      return;
    }

    this.usersStore.selectUser(matchedUser);
    this.showEmployeeDetailModal = true;
  }

  protected closeEmployeeDetailModal(): void {
    this.showEmployeeDetailModal = false;
  }

  protected createAnotherEmployee(): void {
    this.newEmployeeName = '';
    this.newEmployeePhone = '';
    this.createdEmployeeAccount = null;
  }

  protected toggleEmployeeStatus(employee: Employee): void {
    employee.active = !employee.active;
    this.refreshScheduleViews();
    this.cdr.markForCheck();
  }

  protected addCategory(): void {
    if (!this.newCategoryName.trim()) {
      this.notificationService.warning('Vui lòng nhập tên danh mục.');
      return;
    }
    this.categories.update(current => [...current, this.newCategoryName.trim()]);
    this.newCategoryName = '';
    if (!this.onboardingFlow()) {
      this.authStore.updateCategoriesSettings([...this.categories()]);
    } else {
      this.notificationService.success('Đã thêm danh mục.');
    }
  }

  protected removeCategory(index: number): void {
    this.categories.update(current => {
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
    if (!this.onboardingFlow()) {
      this.authStore.updateCategoriesSettings([...this.categories()]);
    } else {
      this.notificationService.success('Đã xóa danh mục.');
    }
  }

  protected startEditCategory(index: number, name: string): void {
    this.editingCategoryIndex = index;
    this.editingCategoryName = name;
  }

  protected confirmEditCategory(index: number): void {
    if (!this.editingCategoryName.trim()) return;
    this.categories.update(current => {
      const next = [...current];
      next[index] = this.editingCategoryName.trim();
      return next;
    });
    this.cancelEditCategory();
    if (!this.onboardingFlow()) {
      this.authStore.updateCategoriesSettings([...this.categories()]);
    } else {
      this.notificationService.success('Đã cập nhật danh mục.');
    }
  }

  protected cancelEditCategory(): void {
    this.editingCategoryIndex = null;
    this.editingCategoryName = '';
  }

  protected saveCategories(): void {
    this.authStore.saveCategories([...this.categories()]);
  }

  protected selectForm(formName: string): void {
    this.selectedFormTemplate = formName;
  }

  protected createCustomForm(): void {
    if (!this.newFormName.trim()) {
      this.notificationService.warning('Vui lòng nhập tên form mới.');
      return;
    }
    this.forms.push(this.newFormName.trim());
    this.selectedFormTemplate = this.newFormName.trim();
    this.newFormName = '';
    this.notificationService.success('Đã tạo form mới.');
  }

  protected toggleEmployeeExpand(employeeId: string): void {
    this.expandedEmployeeIds[employeeId] = !this.expandedEmployeeIds[employeeId];
  }

  protected isEmployeeExpanded(employeeId: string): boolean {
    return Boolean(this.expandedEmployeeIds[employeeId]);
  }

  protected copyEmployeeField(value: string | undefined, fieldLabel: string): void {
    if (!value) {
      this.notificationService.info(`Chưa có ${fieldLabel.toLowerCase()} để sao chép.`);
      return;
    }

    const onSuccess = () => this.notificationService.success(`Đã sao chép ${fieldLabel}.`);
    const onFailure = () => this.notificationService.error(`Không thể sao chép ${fieldLabel}.`);

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(onSuccess).catch(onFailure);
      return;
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onSuccess();
    } catch {
      onFailure();
    }
  }

  protected getUserRoleLabel(role: string | undefined): string {
    switch (role) {
      case 'OWNER':
        return 'Chủ shop';
      case 'ADMIN':
        return 'Quản trị';
      case 'OPERATOR':
        return 'Điều phối';
      case 'VIEWER':
        return 'Chỉ xem';
      case 'STAFF':
      default:
        return 'Nhân viên';
    }
  }

  ngAfterViewInit(): void {
    this.deferCenterFocusedCard('auto');
    this.startRealtimeScheduleSync();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (this.staffSubView() === 'schedule' && this.scheduleViewMode() === 'day') {
      this.deferCenterFocusedCard('auto');
    }
  }

  ngOnDestroy(): void {
    if (this.realtimeTimerId !== null) {
      window.clearInterval(this.realtimeTimerId);
      this.realtimeTimerId = null;
    }
  }

  protected getTitle(): string {
    switch (this.settingView()) {
      case 'profile': return 'Hồ sơ shop';
      case 'category': return 'Danh mục shop';
      case 'staff': return 'Quản lý nhân sự';
      case 'business-type': return 'Mô hình kinh doanh';
      case 'form-setup': return 'Cấu hình form nhận đơn';
      case 'first-product': return 'Sản phẩm đầu tiên';
      default: return 'Thiết lập shop';
    }
  }

  protected getDescription(): string {
    if (this.onboardingFlow()) {
      return 'Hoàn tất thông tin shop theo đúng thứ tự để mở khóa trang quản trị.';
    }

    return 'Quản lý thông tin shop, nhân sự và cấu hình vận hành.';
  }

  protected getSaveActionLabel(): string {
    if (!this.onboardingFlow()) {
      return '';
    }

    switch (this.settingView()) {
      case 'profile':
        return 'Tiếp theo';
      case 'business-type':
        return 'Tiếp theo';
      case 'category':
        return 'Hoàn tất';
      default:
        return 'Lưu';
    }
  }

  protected saveSettings(): void {
    if (!this.enableSell() && !this.enableRent()) {
      this.notificationService.error('Loại hình kinh doanh chỉ cho phép bật Bán, Thuê hoặc cả hai.');
      return;
    }

    if (!this.onboardingFlow()) {
      // In normal mode, this method might not be called from the global button anymore,
      // but we keep it as a fallback or for other views.
      return;
    }

    switch (this.settingView()) {
      case 'profile': {
        // Validate shop name before creating profile
        const nameErr = this.validateRequired(this.shopName(), 'Tên shop');
        this.errorShopName.set(nameErr);
        if (nameErr) {
          this.notificationService.error('Vui lòng nhập tên shop trước khi tiếp tục.');
          return;
        }
        this.authStore.createShopProfile({
          shopName: this.shopName(),
          email: this.shopEmail(),
          phone: this.shopPhone(),
          logoUrl: this.logoUrl()
        });
        return;
      }
      case 'business-type':
        this.authStore.updateBusinessType({
          enableSell: this.enableSell(),
          enableRent: this.enableRent()
        });
        return;
      case 'category':
        this.authStore.saveCategories([...this.categories()]);
        return;
      default:
        this.notificationService.success('Đã lưu thiết lập shop.');
    }
  }

  private buildDayStaffBuckets(): DayStaffBucket[] {
    return buildDayStaffBuckets(
      this.selectedDateValue,
      this.employees,
      this.toIsoDate.bind(this),
      this.parseIsoDate.bind(this),
      this.isSameDate.bind(this)
    );
  }

  private buildMonthCalendarDays(anchorDate: Date): MonthCalendarDay[] {
    return buildMonthCalendarDays(
      anchorDate,
      this.employees,
      this.toIsoDate.bind(this),
      this.isSameDate.bind(this)
    );
  }

  private formatMonthTitle(date: Date): string {
    return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private refreshScheduleViews(syncMonthFromSelectedDate = false): void {
    this.currentDateKey = this.toIsoDate(new Date());

    if (syncMonthFromSelectedDate) {
      this.monthAnchorDate = this.getMonthAnchorFromDateValue(this.selectedDateValue);
      this.selectedMonthValue = this.toMonthValue(this.monthAnchorDate);
    }

    this.monthTitle = this.formatMonthTitle(this.monthAnchorDate);
    this.dayStaffBuckets.splice(0, this.dayStaffBuckets.length, ...this.buildDayStaffBuckets());
    this.monthCalendarDays.splice(0, this.monthCalendarDays.length, ...this.buildMonthCalendarDays(this.monthAnchorDate));

    if (this.staffSubView() === 'schedule' && this.scheduleViewMode() === 'day') {
      this.deferCenterFocusedCard();
    }
  }

  private getMonthAnchorFromDateValue(dateValue: string): Date {
    const selectedDate = this.parseIsoDate(dateValue) ?? new Date();
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }

  private toMonthValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private parseIsoDate(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);

    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
      return null;
    }

    return parsed;
  }

  private parseMonthValue(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month < 1 || month > 12) {
      return null;
    }

    return new Date(year, month - 1, 1);
  }

  private startRealtimeScheduleSync(): void {
    this.realtimeTimerId = window.setInterval(() => {
      const nextDateKey = this.toIsoDate(new Date());
      if (nextDateKey === this.currentDateKey) {
        return;
      }

      this.currentDateKey = nextDateKey;

      if (this.followToday) {
        this.selectedDateValue = nextDateKey;
        this.monthAnchorDate = this.getMonthAnchorFromDateValue(this.selectedDateValue);
        this.selectedMonthValue = this.toMonthValue(this.monthAnchorDate);
      }

      this.refreshScheduleViews();
    }, 60_000);
  }

  private deferCenterFocusedCard(behavior: ScrollBehavior = 'smooth'): void {
    setTimeout(() => this.centerFocusedCard(behavior), 0);
  }

  private centerFocusedCard(behavior: ScrollBehavior): void {
    if (!this.dayScroller || !this.dayCards || this.dayCards.length === 0) {
      return;
    }

    const focusedIndex = this.dayStaffBuckets.findIndex((day) => day.isFocused);
    const todayIndex = this.dayStaffBuckets.findIndex((day) => day.isToday);
    const targetIndex = focusedIndex >= 0 ? focusedIndex : todayIndex;

    if (targetIndex < 0) {
      return;
    }

    const scrollerElement = this.dayScroller.nativeElement;
    const targetCard = this.dayCards.get(targetIndex)?.nativeElement;

    if (!targetCard) {
      return;
    }

    const targetLeft = targetCard.offsetLeft - (scrollerElement.clientWidth - targetCard.clientWidth) / 2;
    scrollerElement.scrollTo({ left: Math.max(0, targetLeft), behavior });
  }

  private isSameDate(left: Date, right: Date): boolean {
    return left.getDate() === right.getDate()
      && left.getMonth() === right.getMonth()
      && left.getFullYear() === right.getFullYear();
  }

  // ── Validation helpers ──
  private validateRequired(value: string, fieldName: string): string {
    if (!value || !value.trim()) {
      return `${fieldName} không được để trống.`;
    }
    return '';
  }

  private validateEmail(value: string): string {
    if (!value || !value.trim()) {
      return ''; // Email is optional
    }
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(value.trim())) {
      return 'Email không đúng định dạng. VD: example@gmail.com';
    }
    return '';
  }

  private validatePhone(value: string): string {
    if (!value || !value.trim()) {
      return ''; // Phone is optional
    }
    // Accept Vietnamese phone formats: 09xxx, 03xxx, +84xxx, 1900xxx
    const phoneRegex = /^(\+?84|0)[0-9]{8,10}$|^1[89]00[0-9]{4,6}$/;
    const cleaned = value.trim().replace(/[\s\-\.]/g, '');
    if (!phoneRegex.test(cleaned)) {
      return 'Số điện thoại không đúng định dạng. VD: 0901234567';
    }
    return '';
  }
}
