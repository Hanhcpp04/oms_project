import { expect, test } from '@playwright/test';

test('opens the landing page and navigates to login', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /Quản lý đơn hàng/i })).toBeVisible();
  await page.getByRole('link', { name: 'Đăng nhập' }).first().click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập vào OMS' })).toBeVisible();
});

test('shows validation errors for an empty login form', async ({ page }) => {
  await page.goto('/login');
  await page.locator('form').getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Vui lòng nhập tên tài khoản hoặc email')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập mật khẩu')).toBeVisible();
});
