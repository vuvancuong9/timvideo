# timvideo

Hệ thống quản lý quy trình **nhân viên tìm video sản phẩm affiliate**.

- **Next.js 15** (App Router) + **TypeScript** + **TailwindCSS**
- **Supabase** (Auth + Postgres + RLS)
- **Google Drive** (upload resumable bằng service account)
- Triển khai trên **Vercel**

---

## 1. Yêu cầu

- Node.js 18.18+ (khuyến nghị 20/22)
- Tài khoản Supabase + project đã tạo
- (Tuỳ chọn) Google Cloud service account để upload Drive

## 2. Cài đặt & chạy local

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị thật
npm run dev
```

Mở http://localhost:3000 → tự chuyển tới `/login`.

## 3. Biến môi trường (`.env.local` / Vercel)

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon/public key (an toàn để lộ ra client) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — **CHỈ server**, không bao giờ để ra client |
| `GOOGLE_DRIVE_CLIENT_EMAIL` | ⛅ | Email service account (cần nếu dùng upload Drive) |
| `GOOGLE_DRIVE_PRIVATE_KEY` | ⛅ | Private key service account (giữ `\n`, bọc trong nháy kép) |
| `GOOGLE_DRIVE_FOLDER_ID` | ⛅ | ID folder Drive đích |
| `ADMIN_EMAILS` | ✅ | Danh sách email admin, ngăn cách bởi dấu phẩy |

> Không commit `.env.local`. Chỉ commit `.env.example`.

## 4. Database (Supabase)

Migrations nằm trong `supabase/migrations/` và **đã được áp dụng** vào project Supabase qua MCP:

1. `001_initial_schema.sql` — enums, bảng, index, RLS, triggers
2. `002_auth_trigger_and_seed.sql` — trigger tạo profile khi có auth user + seed danh mục
3. `003_harden_function_grants.sql` — thu hồi EXECUTE thừa trên trigger functions
4. `004_fix_search_path.sql` — khóa `search_path` cho `current_app_role`

Nếu cần chạy lại trên project khác: mở **Supabase Dashboard → SQL Editor**, dán nội dung từng file theo thứ tự và Run. Tất cả đều idempotent.

## 5. Tạo admin đầu tiên

1. Supabase Dashboard → **Authentication → Users → Add user**
   - Nhập email + mật khẩu, bật **Auto Confirm User**.
2. Thêm chính email đó vào `ADMIN_EMAILS` (env của Vercel + `.env.local`).
3. Đăng nhập tại `/login`. Hệ thống tự nâng quyền tài khoản đó thành **admin**
   (cơ chế bootstrap trong `lib/auth/session.ts`).
4. Vào `/admin/users` để phân quyền cho các tài khoản còn lại.

> Khuyến nghị: Authentication → Providers → Email → **tắt "Enable Signup"** nếu
> muốn chỉ admin tạo user. Khi tạo user mới hãy bật Auto Confirm.

## 6. Phân quyền

| Khu vực | staff | accountant | aggregator | admin |
|---------|:-----:|:----------:|:----------:|:-----:|
| Nhân viên `/staff` | ✅ (chỉ của mình) | – | – | ✅ |
| Kế toán `/accounting` (read-only) | – | ✅ | – | ✅ |
| Tổng hợp `/aggregate` | – | – | ✅ | ✅ |
| Quản trị `/admin` | – | – | – | ✅ |
| Phân affiliate | – | – | ✅ | ✅ |
| Link rút gọn | – | – | **❌** | ✅ |
| Sửa dữ liệu video | – | **❌** | chỉ field tổng hợp | ✅ |
| Upload Drive | ✅ | ❌ | ✅ | ✅ |

Phân quyền được thực thi ở **3 lớp độc lập**:
1. **UI** — sidebar/menu theo role (`lib/constants.ts`).
2. **API/server** — guard `requireApi()` + whitelist field `lib/permissions.ts`.
3. **Database** — Supabase RLS policies + triggers `enforce_video_update` /
   `enforce_profile_update` (kể cả khi gọi thẳng REST API vẫn bị chặn).

## 7. Chống trùng video (2 lớp)

1. **Client**: ô nhập link video debounce 500ms gọi `GET /api/videos/check-duplicate`.
2. **Server/DB**: khi submit, server normalize URL → `canonical_video_hash` →
   insert. **Unique index** trên `canonical_video_hash` là lớp quyết định cuối
   (trả về *"Video này đã tồn tại trong hệ thống"*).

Logic normalize: `lib/url/canonical.ts` (xử lý YouTube/TikTok/Facebook + bỏ
tracking params `utm_*`, `fbclid`, `gclid`, `spm`, `aff`, `ref`, …).

## 8. Kiểm thử

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # next build
npm test            # vitest (40 test: quyền + canonical)
```

## 9. Triển khai Vercel

1. Import repo GitHub vào Vercel.
2. Thêm đầy đủ biến môi trường ở mục **Settings → Environment Variables**.
3. Deploy (framework tự nhận diện Next.js).

## 10. Google Drive (service account)

1. Google Cloud Console → tạo project → bật **Google Drive API**.
2. Tạo **Service Account** → tạo key JSON.
3. Lấy `client_email` → `GOOGLE_DRIVE_CLIENT_EMAIL`, `private_key` →
   `GOOGLE_DRIVE_PRIVATE_KEY`.
4. Tạo 1 folder Drive, **Share** cho email service account quyền *Editor*,
   lấy ID folder → `GOOGLE_DRIVE_FOLDER_ID`.

Luồng upload: client xin phiên resumable (`/api/uploads/drive/create-session`)
→ PUT file thẳng lên Google (không proxy qua Vercel) → `/api/uploads/drive/complete`
cấp quyền xem theo link + lấy metadata → lưu vào `video_submissions`.
