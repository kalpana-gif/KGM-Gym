export type Activity = 'unspecified' | 'sedentary' | 'light' | 'moderate' | 'active';
export type Profile = {
  age: number; height: number; weight: number;
  sex: 'unspecified' | 'male' | 'female'; activity: Activity;
  targetWeight?: number; deficit: number; proteinPercent: number; fatPercent: number;
  preference: 'all' | 'vegetarian'; allergies: string;
  budget: 'low' | 'standard'; cooking: 'kitchen' | 'limited';
  experience: 'beginner' | 'returning'; equipment: 'none' | 'bands' | 'gym';
  injuries: string; conditions: string; timezone: string; aiConsent: boolean;
};
export type Macros = { protein: number; carbs: number; fat: number };
export type Food = {
  id: string; name: string; aliases: string[]; kcal: number; macros: Macros;
  state: 'cooked' | 'raw' | 'ready'; group: 'grain' | 'protein' | 'vegetable' | 'fruit' | 'extra';
  servings: { label: string; grams: number; approximate: boolean }[];
  source: string; sourceUrl?: string; uncertainty: 'reference' | 'recipe estimate' | 'user supplied' | 'ai estimate';
  allergens: string[]; vegetarian: boolean; ingredients?: { foodId: string; grams: number }[];
  instructions?: string; yieldGrams?: number;
};
export type MealItem = { id: string; food: Food; grams: number; source?: 'photo' };
export type PhotoEstimate = {
  foods: { name: string; grams: number; kcalMin: number; kcalMax: number; proteinGrams: number; carbsGrams: number; fatGrams: number; assumptions: string }[];
  uncertainty: string;
};
export type Meal = {
  name: string; slot: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  date: string; timestamp: string; timezone: string; items: MealItem[];
  photoEstimate?: PhotoEstimate;
};
export type Target = { date: string; kcal: number; maintenance: number; deficit: number; proteinPercent: number; fatPercent: number };
export type Weight = { date: string; kg: number };
export type Session = { date: string; name: string; minutes: number; completed: boolean; exercises: { name: string; sets: number; reps: number }[] };
export type PhotoDraft = { date: string; mime: string; base64: string; description: string; analyzed: boolean };
export type Entity = 'profiles' | 'meal_logs' | 'daily_targets' | 'weight_entries' | 'custom_foods' | 'recipes' | 'meal_plans' | 'workout_sessions' | 'photo_metadata' | 'favorites';
export type Payload = Profile | Meal | Target | Weight | Food | Session | PhotoDraft | { foodId: string } | { date: string; items: MealItem[]; name: string };
export type LocalRecord<T = Payload> = { id: string; owner: string; entity: Entity; data: T; version: number; deleted: boolean; modifiedAt: string; syncedVersion: number };
export type Operation = { id: string; owner: string; recordId: string; entity: Entity; baseVersion: number; record: LocalRecord; createdAt: string };
export type Conflict = { id: string; owner: string; record: LocalRecord; remote: LocalRecord; createdAt: string };
export const initialProfile: Profile = {
  age: 29, height: 183, weight: 103, sex: 'unspecified', activity: 'unspecified',
  deficit: 12, proteinPercent: 25, fatPercent: 30, preference: 'all', allergies: '',
  budget: 'low', cooking: 'kitchen', experience: 'beginner', equipment: 'none',
  injuries: '', conditions: '', timezone: 'Asia/Colombo', aiConsent: false,
};
