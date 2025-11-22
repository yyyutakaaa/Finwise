-- Create user_settings table
create table if not exists public.user_settings (
  user_id uuid references auth.users on delete cascade not null primary key,
  ai_opt_in boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_settings enable row level security;

-- Create policies
create policy "Users can view their own settings"
  on public.user_settings for select
  using ( auth.uid() = user_id );

create policy "Users can update their own settings"
  on public.user_settings for update
  using ( auth.uid() = user_id );

create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check ( auth.uid() = user_id );

-- Create a trigger to automatically create user_settings entry when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_settings (user_id, ai_opt_in)
  values (new.id, false);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function on new user creation
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
