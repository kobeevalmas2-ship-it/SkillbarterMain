begin;

-- Serialize the initial projection with normal compare-and-swap app commits.
lock table public.application_state in share row exclusive mode;

create table if not exists public.wallet_transactions (
  id text primary key check (char_length(id) > 0),
  type text not null check (type in ('bonus', 'transfer', 'service', 'refund', 'admin_adjustment')),
  operation_label text generated always as (case type
    when 'bonus' then 'Стартовый бонус'
    when 'transfer' then 'Перевод минут'
    when 'service' then 'Оплата услуги'
    when 'refund' then 'Возврат минут'
    when 'admin_adjustment' then 'Перевод администратора'
  end) stored,
  from_email text,
  to_email text not null,
  minutes bigint not null check (minutes > 0),
  note text not null,
  offer_id text,
  request_id text,
  reverses text,
  admin_email text,
  reason text,
  created_at timestamptz not null,
  check ((type = 'bonus' and from_email is null) or (type <> 'bonus' and from_email is not null))
);

create table if not exists public.wallet_balances (
  email text primary key,
  name text not null,
  total_minutes bigint not null,
  reserved_minutes bigint not null check (reserved_minutes >= 0),
  available_minutes bigint not null,
  received_minutes bigint not null check (received_minutes >= 0),
  sent_minutes bigint not null check (sent_minutes >= 0),
  bonus_minutes bigint not null check (bonus_minutes >= 0),
  check (available_minutes = total_minutes - reserved_minutes)
);

create table if not exists public.service_requests (
  id text primary key check (char_length(id) > 0),
  offer_id text not null,
  title text not null,
  category text not null,
  customer_email text not null,
  customer_name text not null,
  provider_email text not null,
  provider_name text not null,
  minutes bigint not null check (minutes > 0),
  status text not null check (status in ('pending', 'accepted', 'in_progress', 'awaiting_confirmation', 'completed', 'declined', 'cancelled', 'refunded')),
  status_label text generated always as (case status
    when 'pending' then 'Ожидает ответа'
    when 'accepted' then 'Согласована'
    when 'in_progress' then 'В процессе'
    when 'awaiting_confirmation' then 'Ожидает подтверждения'
    when 'completed' then 'Завершена'
    when 'declined' then 'Отклонена'
    when 'cancelled' then 'Отменена'
    when 'refunded' then 'Минуты возвращены'
  end) stored,
  scheduled_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  refunded_minutes bigint not null default 0 check (refunded_minutes >= 0)
);

create table if not exists public.complaints (
  id text primary key check (char_length(id) > 0),
  request_id text not null,
  title text not null,
  reporter_email text not null,
  reporter_name text not null,
  customer_email text not null,
  provider_email text not null,
  text text not null,
  status text not null check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  status_label text generated always as (case status
    when 'open' then 'Открыта'
    when 'reviewing' then 'На рассмотрении'
    when 'resolved' then 'Решена'
    when 'rejected' then 'Отклонена'
  end) stored,
  resolution_action text,
  resolution_reason text,
  resolution_minutes bigint check (resolution_minutes >= 0),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.service_offers (
  id text primary key check (char_length(id) > 0),
  owner_email text not null,
  owner_name text not null,
  title text not null,
  description text not null,
  category text not null,
  format text not null,
  level text not null,
  city text not null,
  language text not null,
  min_minutes bigint not null check (min_minutes >= 15 and min_minutes <= 480),
  max_minutes bigint not null check (max_minutes >= min_minutes and max_minutes <= 480),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists wallet_transactions_sender_created on public.wallet_transactions (from_email, created_at desc);
create index if not exists wallet_transactions_recipient_created on public.wallet_transactions (to_email, created_at desc);
create index if not exists service_requests_customer_scheduled on public.service_requests (customer_email, scheduled_at);
create index if not exists service_requests_provider_scheduled on public.service_requests (provider_email, scheduled_at);
create index if not exists complaints_request on public.complaints (request_id);
create index if not exists service_offers_owner on public.service_offers (owner_email);

comment on table public.wallet_transactions is
  'Операции с минутами. Автоматическая копия application_state для просмотра; добавляйте и изменяйте операции через сайт. Ручные изменения этой таблицы не меняют сайт.';
comment on table public.wallet_balances is
  'Баланс и оборот минут по участникам. Автоматическая копия application_state для просмотра; ручные изменения этой таблицы не меняют сайт.';
comment on table public.service_requests is
  'Заявки на занятия. Автоматическая копия application_state для просмотра; меняйте заявки через сайт. Ручные изменения этой таблицы не меняют сайт.';
comment on table public.complaints is
  'Обращения в поддержку и решения. Автоматическая копия application_state для просмотра; меняйте обращения через сайт. Ручные изменения этой таблицы не меняют сайт.';
comment on table public.service_offers is
  'Опубликованные услуги. Автоматическая копия application_state для просмотра; меняйте услуги через сайт. Ручные изменения этой таблицы не меняют сайт.';

comment on column public.wallet_transactions.type is 'Тип операции: bonus, transfer, service, refund или admin_adjustment.';
comment on column public.wallet_transactions.operation_label is 'Название типа операции на русском языке.';
comment on column public.wallet_transactions.from_email is 'Отправитель минут; для стартового бонуса отсутствует.';
comment on column public.wallet_transactions.to_email is 'Получатель минут.';
comment on column public.wallet_transactions.minutes is 'Количество минут в этой операции; всегда положительное.';
comment on column public.wallet_transactions.note is 'Назначение перевода или название оплаченной услуги.';
comment on column public.wallet_transactions.offer_id is 'Услуга, с которой связана оплата или возврат, если она указана.';
comment on column public.wallet_transactions.request_id is 'Заявка на занятие; для оплаты извлекается из идентификатора request:... .';
comment on column public.wallet_transactions.reverses is 'Идентификатор оплаченной операции, которую отменяет возврат.';
comment on column public.wallet_transactions.admin_email is 'Администратор, выполнивший возврат или корректировку.';
comment on column public.wallet_transactions.reason is 'Причина возврата или корректировки администратором.';
comment on column public.wallet_transactions.created_at is 'Время операции с часовым поясом.';

comment on column public.wallet_balances.email is 'Электронная почта участника; история сохраняется после удаления профиля.';
comment on column public.wallet_balances.name is 'Имя из истории кошелька на момент создания счёта.';
comment on column public.wallet_balances.total_minutes is 'Все поступления минус все списания, включая бонусы; при задолженности может быть отрицательным.';
comment on column public.wallet_balances.reserved_minutes is 'Минуты заказчика по заявкам accepted, in_progress и awaiting_confirmation.';
comment on column public.wallet_balances.available_minutes is 'Доступные минуты: total_minutes минус reserved_minutes; при задолженности может быть отрицательным.';
comment on column public.wallet_balances.received_minutes is 'Все полученные минуты без стартовых бонусов, включая возвраты и корректировки администратора.';
comment on column public.wallet_balances.sent_minutes is 'Все отправленные минуты без бонусов, включая возвраты и корректировки администратора.';
comment on column public.wallet_balances.bonus_minutes is 'Сумма стартовых бонусов участника.';

comment on column public.service_requests.customer_email is 'Заказчик занятия.';
comment on column public.service_requests.provider_email is 'Исполнитель занятия.';
comment on column public.service_requests.minutes is 'Продолжительность занятия и стоимость в минутах.';
comment on column public.service_requests.status is 'Статус заявки в приложении.';
comment on column public.service_requests.status_label is 'Название статуса заявки на русском языке.';
comment on column public.service_requests.scheduled_at is 'Запланированное время начала занятия с часовым поясом.';
comment on column public.service_requests.refunded_minutes is 'Сколько минут уже возвращено заказчику за это занятие.';

comment on column public.complaints.reporter_email is 'Участник занятия, отправивший жалобу.';
comment on column public.complaints.status_label is 'Название статуса обращения на русском языке.';
comment on column public.complaints.resolution_action is 'Решение: refund, cancel, refund_cancel или reject; до решения отсутствует.';
comment on column public.complaints.resolution_reason is 'Обоснование решения администратора.';
comment on column public.complaints.resolution_minutes is 'Минуты, возвращённые в рамках решения по этому обращению.';
comment on column public.complaints.resolved_by is 'Электронная почта администратора, принявшего решение.';
comment on column public.complaints.resolved_at is 'Время принятия решения с часовым поясом.';

comment on column public.service_offers.owner_email is 'Автор опубликованной услуги.';
comment on column public.service_offers.format is 'Формат занятия: Онлайн или Офлайн.';
comment on column public.service_offers.level is 'Уровень подготовки получателя услуги.';
comment on column public.service_offers.language is 'Язык общения на занятии.';
comment on column public.service_offers.min_minutes is 'Минимальная продолжительность занятия в минутах.';
comment on column public.service_offers.max_minutes is 'Максимальная продолжительность занятия в минутах.';

alter table public.wallet_transactions enable row level security;
alter table public.wallet_balances enable row level security;
alter table public.service_requests enable row level security;
alter table public.complaints enable row level security;
alter table public.service_offers enable row level security;

-- Also revoke default Supabase grants from service_role before SELECT only.
revoke all on public.wallet_transactions, public.wallet_balances, public.service_requests,
  public.complaints, public.service_offers from public, anon, authenticated, service_role;
grant select on public.wallet_transactions, public.wallet_balances, public.service_requests,
  public.complaints, public.service_offers to service_role;

create or replace function public.skillbarter_refresh_activity_tables(p_state jsonb, p_previous_state jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  transactions_changed boolean := p_previous_state is null or
    (p_state #> '{ledger,transactions}') is distinct from (p_previous_state #> '{ledger,transactions}');
  accounts_changed boolean := p_previous_state is null or
    (p_state #> '{ledger,accounts}') is distinct from (p_previous_state #> '{ledger,accounts}');
  requests_changed boolean := p_previous_state is null or
    (p_state #> '{ledger,activity,requests}') is distinct from (p_previous_state #> '{ledger,activity,requests}');
  complaints_changed boolean := p_previous_state is null or
    (p_state #> '{ledger,support,cases}') is distinct from (p_previous_state #> '{ledger,support,cases}');
  offers_changed boolean := p_previous_state is null or
    (p_state #> '{catalog,offers}') is distinct from (p_previous_state #> '{catalog,offers}');
begin
  if transactions_changed then
    insert into public.wallet_transactions
      (id, type, from_email, to_email, minutes, note, offer_id, request_id, reverses, admin_email, reason, created_at)
    select entry.id, entry.type, entry."from", entry."to", entry.minutes, entry.note, entry."offerId",
      coalesce(entry."requestId", case when entry.type = 'service' and pg_catalog.left(entry.id, 8) = 'request:'
        then pg_catalog.substr(entry.id, 9) end),
      entry.reverses, entry."adminEmail", entry.reason, entry."createdAt"
    from pg_catalog.jsonb_to_recordset(coalesce(p_state #> '{ledger,transactions}', '[]'::jsonb))
      as entry(id text, type text, "from" text, "to" text, minutes bigint, note text, "offerId" text,
        "requestId" text, reverses text, "adminEmail" text, reason text, "createdAt" timestamptz)
    on conflict (id) do update set
      type = excluded.type, from_email = excluded.from_email, to_email = excluded.to_email,
      minutes = excluded.minutes, note = excluded.note, offer_id = excluded.offer_id,
      request_id = excluded.request_id, reverses = excluded.reverses, admin_email = excluded.admin_email,
      reason = excluded.reason, created_at = excluded.created_at;

    delete from public.wallet_transactions as saved where not exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(p_state #> '{ledger,transactions}', '[]'::jsonb)) as entry(value)
      where entry.value ->> 'id' = saved.id
    );
  end if;

  if transactions_changed or requests_changed or accounts_changed then
    -- Compute from canonical JSON, never from an independently editable mirror.
    with accounts as (
      select entry.email, entry.name
      from pg_catalog.jsonb_to_recordset(coalesce(p_state #> '{ledger,accounts}', '[]'::jsonb)) as entry(email text, name text)
    ), transactions as (
      select entry.type, entry."from", entry."to", entry.minutes
      from pg_catalog.jsonb_to_recordset(coalesce(p_state #> '{ledger,transactions}', '[]'::jsonb))
        as entry(type text, "from" text, "to" text, minutes bigint)
    ), movements as (
      select tx."to" as email, tx.minutes as delta,
        case when tx.type <> 'bonus' then tx.minutes else 0 end as received,
        0::bigint as sent, case when tx.type = 'bonus' then tx.minutes else 0 end as bonus
      from transactions as tx
      union all
      select tx."from" as email, -tx.minutes as delta, 0::bigint as received,
        case when tx.type <> 'bonus' then tx.minutes else 0 end as sent, 0::bigint as bonus
      from transactions as tx where tx."from" is not null
    ), totals as (
      select email, sum(delta)::bigint as total_minutes, sum(received)::bigint as received_minutes,
        sum(sent)::bigint as sent_minutes, sum(bonus)::bigint as bonus_minutes
      from movements group by email
    ), reservations as (
      select entry.customer ->> 'email' as email, sum(entry.minutes)::bigint as reserved_minutes
      from pg_catalog.jsonb_to_recordset(coalesce(p_state #> '{ledger,activity,requests}', '[]'::jsonb))
        as entry(customer jsonb, minutes bigint, status text)
      where entry.status in ('accepted', 'in_progress', 'awaiting_confirmation')
      group by entry.customer ->> 'email'
    )
    insert into public.wallet_balances
      (email, name, total_minutes, reserved_minutes, available_minutes, received_minutes, sent_minutes, bonus_minutes)
    select accounts.email, accounts.name, coalesce(totals.total_minutes, 0), coalesce(reservations.reserved_minutes, 0),
      coalesce(totals.total_minutes, 0) - coalesce(reservations.reserved_minutes, 0),
      coalesce(totals.received_minutes, 0), coalesce(totals.sent_minutes, 0), coalesce(totals.bonus_minutes, 0)
    from accounts left join totals using (email) left join reservations using (email)
    on conflict (email) do update set
      name = excluded.name, total_minutes = excluded.total_minutes, reserved_minutes = excluded.reserved_minutes,
      available_minutes = excluded.available_minutes, received_minutes = excluded.received_minutes,
      sent_minutes = excluded.sent_minutes, bonus_minutes = excluded.bonus_minutes;

    delete from public.wallet_balances as saved where not exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(p_state #> '{ledger,accounts}', '[]'::jsonb)) as entry(value)
      where entry.value ->> 'email' = saved.email
    );
  end if;

  if requests_changed then
    insert into public.service_requests
      (id, offer_id, title, category, customer_email, customer_name, provider_email, provider_name,
        minutes, status, scheduled_at, created_at, updated_at, refunded_minutes)
    select entry.id, entry."offerId", entry.title, entry.category,
      entry.customer ->> 'email', entry.customer ->> 'name', entry.provider ->> 'email', entry.provider ->> 'name',
      entry.minutes, entry.status, entry."scheduledAt", entry."createdAt", entry."updatedAt", coalesce(entry."refundedMinutes", 0)
    from pg_catalog.jsonb_to_recordset(coalesce(p_state #> '{ledger,activity,requests}', '[]'::jsonb))
      as entry(id text, "offerId" text, title text, category text, customer jsonb, provider jsonb,
        minutes bigint, status text, "scheduledAt" timestamptz, "createdAt" timestamptz, "updatedAt" timestamptz, "refundedMinutes" bigint)
    on conflict (id) do update set
      offer_id = excluded.offer_id, title = excluded.title, category = excluded.category,
      customer_email = excluded.customer_email, customer_name = excluded.customer_name,
      provider_email = excluded.provider_email, provider_name = excluded.provider_name,
      minutes = excluded.minutes, status = excluded.status, scheduled_at = excluded.scheduled_at,
      created_at = excluded.created_at, updated_at = excluded.updated_at, refunded_minutes = excluded.refunded_minutes;

    delete from public.service_requests as saved where not exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(p_state #> '{ledger,activity,requests}', '[]'::jsonb)) as entry(value)
      where entry.value ->> 'id' = saved.id
    );
  end if;

  if complaints_changed then
    insert into public.complaints
      (id, request_id, title, reporter_email, reporter_name, customer_email, provider_email, text, status,
        resolution_action, resolution_reason, resolution_minutes, resolved_by, resolved_at, created_at, updated_at)
    select entry.id, entry."requestId", entry.title, entry.reporter ->> 'email', entry.reporter ->> 'name',
      entry.customer ->> 'email', entry.provider ->> 'email', entry.text, entry.status,
      entry.resolution ->> 'action', entry.resolution ->> 'reason', (entry.resolution ->> 'minutes')::bigint,
      entry.resolution ->> 'by', (entry.resolution ->> 'createdAt')::timestamptz, entry."createdAt", entry."updatedAt"
    from pg_catalog.jsonb_to_recordset(coalesce(p_state #> '{ledger,support,cases}', '[]'::jsonb))
      as entry(id text, "requestId" text, title text, reporter jsonb, customer jsonb, provider jsonb,
        text text, status text, resolution jsonb, "createdAt" timestamptz, "updatedAt" timestamptz)
    on conflict (id) do update set
      request_id = excluded.request_id, title = excluded.title, reporter_email = excluded.reporter_email,
      reporter_name = excluded.reporter_name, customer_email = excluded.customer_email,
      provider_email = excluded.provider_email, text = excluded.text, status = excluded.status,
      resolution_action = excluded.resolution_action, resolution_reason = excluded.resolution_reason,
      resolution_minutes = excluded.resolution_minutes, resolved_by = excluded.resolved_by,
      resolved_at = excluded.resolved_at, created_at = excluded.created_at, updated_at = excluded.updated_at;

    delete from public.complaints as saved where not exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(p_state #> '{ledger,support,cases}', '[]'::jsonb)) as entry(value)
      where entry.value ->> 'id' = saved.id
    );
  end if;

  if offers_changed then
    insert into public.service_offers
      (id, owner_email, owner_name, title, description, category, format, level, city, language,
        min_minutes, max_minutes, created_at, updated_at)
    select entry.id, entry.email, entry.n, entry.t, entry.d, entry.cat, entry.f, entry.l, entry.city, entry.lg,
      entry.m1, entry.m2, entry."createdAt", entry."updatedAt"
    from pg_catalog.jsonb_to_recordset(coalesce(p_state #> '{catalog,offers}', '[]'::jsonb))
      as entry(id text, email text, n text, t text, d text, cat text, f text, l text, city text, lg text,
        m1 bigint, m2 bigint, "createdAt" timestamptz, "updatedAt" timestamptz)
    on conflict (id) do update set
      owner_email = excluded.owner_email, owner_name = excluded.owner_name,
      title = excluded.title, description = excluded.description, category = excluded.category,
      format = excluded.format, level = excluded.level, city = excluded.city, language = excluded.language,
      min_minutes = excluded.min_minutes, max_minutes = excluded.max_minutes,
      created_at = excluded.created_at, updated_at = excluded.updated_at;

    delete from public.service_offers as saved where not exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(p_state #> '{catalog,offers}', '[]'::jsonb)) as entry(value)
      where entry.value ->> 'id' = saved.id
    );
  end if;
end;
$$;

revoke all on function public.skillbarter_refresh_activity_tables(jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.skillbarter_sync_activity_tables_from_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    perform public.skillbarter_refresh_activity_tables(new.state, old.state);
  else
    perform public.skillbarter_refresh_activity_tables(new.state, null);
  end if;
  return new;
end;
$$;

revoke all on function public.skillbarter_sync_activity_tables_from_state()
  from public, anon, authenticated, service_role;

drop trigger if exists skillbarter_activity_tables_from_state on public.application_state;
create trigger skillbarter_activity_tables_from_state
after insert or update of state on public.application_state
for each row execute function public.skillbarter_sync_activity_tables_from_state();

-- Populate and reconcile all five projections without changing source data.
select public.skillbarter_refresh_activity_tables(source.state, null)
from public.application_state as source where source.id = 1;

notify pgrst, 'reload schema';
commit;
