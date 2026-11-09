import re

path = r'e:/oms-project/frontend/src/app/features/public-order-form/pages/public-order-form-page.component.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the exact Customer Form text to extract
start_marker = "        <!-- Customer Form -->\n        <section class=\"overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]\">\n          <div class=\"border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4\">\n            <h3 class=\"m-0 text-base font-semibold text-[var(--color-text-primary)]\">2. Thông tin liên hệ</h3>\n          </div>\n          <div class=\"p-4 sm:p-5\">\n            <div class=\"grid gap-4 sm:grid-cols-2\">\n              <div class=\"space-y-1.5\">\n                <label class=\"block text-sm font-medium text-[var(--color-text-secondary)]\">Họ và tên <span class=\"text-[var(--color-danger-text)]\">*</span></label>\n                <input type=\"text\" formControlName=\"customerName\" placeholder=\"Nhập họ và tên...\"\n                  class=\"w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]\" />\n              </div>\n              <div class=\"space-y-1.5\">\n                <label class=\"block text-sm font-medium text-[var(--color-text-secondary)]\">Số điện thoại <span class=\"text-[var(--color-danger-text)]\">*</span></label>\n                <input type=\"tel\" formControlName=\"customerPhone\" (input)=\"onPhoneInput($event)\" placeholder=\"Ví dụ: 0912 345 678\"\n                  class=\"w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]\" />\n              </div>\n              <div class=\"space-y-1.5 sm:col-span-2\">\n                <label class=\"block text-sm font-medium text-[var(--color-text-secondary)]\">Địa chỉ nhận hàng <span class=\"text-[var(--color-danger-text)]\">*</span></label>\n                <input type=\"text\" formControlName=\"customerAddress\" placeholder=\"Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố...\"\n                  class=\"w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]\" />\n              </div>\n              <div class=\"space-y-1.5 sm:col-span-2\">\n                <label class=\"block text-sm font-medium text-[var(--color-text-secondary)]\">Ghi chú (Tùy chọn)</label>\n                <textarea formControlName=\"customerNote\" rows=\"2\" placeholder=\"Ghi chú thêm về đơn hàng...\"\n                  class=\"w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]\"></textarea>\n              </div>\n            </div>\n          </div>\n        </section>"

start_marker_win = start_marker.replace('\n', '\r\n')

if start_marker in content:
    extracted = start_marker
elif start_marker_win in content:
    extracted = start_marker_win
else:
    print("Could not find customer block")
    exit(1)

content = content.replace(extracted, "")
content = content.replace("1. Chọn loại sản phẩm", "2. Chọn loại sản phẩm")
extracted = extracted.replace("2. Thông tin liên hệ", "1. Thông tin liên hệ")

form_tag = "      <form [formGroup]=\"form\" (ngSubmit)=\"submit()\" class=\"grid gap-5 sm:gap-4\">"
form_tag_win = form_tag + "\r\n"
if form_tag_win in content:
    content = content.replace(form_tag_win, form_tag_win + extracted + "\r\n\r\n")
else:
    content = content.replace(form_tag + "\n", form_tag + "\n" + extracted + "\n\n")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Reordered successfully!")
