const required = ['GEMINI_API_KEY', 'AI_MODEL'] as const;
export type AiSettings = Partial<Record<typeof required[number], string>>;
export type AiContext = { ip?: string; aiSettings?: AiSettings };

export function missingAiSettings(settings: AiSettings = process.env): string[] {
  return required.filter(key => !settings[key]?.trim());
}

export function aiConfigured(settings: AiSettings = process.env): boolean {
  return missingAiSettings(settings).length === 0;
}
