create unique index if not exists notifications_unique_telegram_settings_idx
on public.notifications (business_id, channel, type)
where channel = 'telegram' and type = 'telegram_settings';
