-- Support projects with automatic API grants disabled.
-- RLS continues to restrict private rows to their authenticated owner.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.foods, public.food_aliases, public.exercises, public.workout_plans
  to anon, authenticated;
grant select on public.profiles, public.meal_logs, public.daily_targets,
  public.weight_entries, public.custom_foods, public.recipes, public.meal_plans,
  public.workout_sessions, public.photo_metadata, public.favorites,
  public.meal_log_items, public.recipe_ingredients to authenticated;
