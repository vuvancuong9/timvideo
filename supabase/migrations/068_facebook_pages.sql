-- 068: Facebook Pages lien ket voi tai khoan affiliate (1 account -> nhieu page).
-- Quyen: admin + aggregator (tong hop) duoc them/sua/xoa; accountant chi xem.

create table if not exists public.facebook_pages (
  id                   uuid primary key default gen_random_uuid(),
  affiliate_account_id uuid not null
    references public.affiliate_accounts(id) on delete cascade,
  name                 text not null,
  url                  text,
  note                 text,
  is_active            boolean not null default true,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists facebook_pages_account_idx
  on public.facebook_pages (affiliate_account_id);

alter table public.facebook_pages enable row level security;

-- Xem: accountant / aggregator / admin (giong affiliate_accounts).
drop policy if exists facebook_pages_select on public.facebook_pages;
create policy facebook_pages_select on public.facebook_pages
  for select to authenticated
  using (public.current_app_role() in ('accountant', 'aggregator', 'admin'));

-- Them/Sua/Xoa: admin + aggregator (tong hop).
drop policy if exists facebook_pages_write on public.facebook_pages;
create policy facebook_pages_write on public.facebook_pages
  for all to authenticated
  using (public.current_app_role() in ('aggregator', 'admin'))
  with check (public.current_app_role() in ('aggregator', 'admin'));

notify pgrst, 'reload schema';
