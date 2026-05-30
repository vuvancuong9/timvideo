-- =====================================================================
--  timvideo - 002_auth_trigger_and_seed
--  Tự tạo profile khi có auth user mới + seed danh mục mặc định.
-- =====================================================================

-- Tự tạo row profiles khi có user mới trong auth.users.
-- (App vẫn có lớp getOrCreateProfile() phòng khi trigger không chạy được.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed danh mục mặc định (idempotent).
insert into public.product_categories (name, description)
values
  ('Thời trang', 'Quần áo, phụ kiện thời trang'),
  ('Gia dụng', 'Đồ dùng gia đình'),
  ('Điện tử', 'Thiết bị điện tử, công nghệ'),
  ('Mỹ phẩm', 'Mỹ phẩm, làm đẹp'),
  ('Mẹ & Bé', 'Sản phẩm cho mẹ và bé'),
  ('Khác', 'Danh mục khác')
on conflict (name) do nothing;
