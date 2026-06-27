const DEFAULT_HOUR_JST = 7;

/**
 * Cloudflare Cron Triggers are static, so the daily suggestion batch runs hourly
 * and this gate decides, per user, whether *this* hour is their configured time.
 * `profileHour` is the user's preferred hour in JST (null → 07:00 default);
 * `nowUtcHour` is the current UTC hour (0–23). Pure + tested.
 */
export const dueForSuggestions = (profileHour: number | null, nowUtcHour: number): boolean => {
  const jstHour = (((nowUtcHour + 9) % 24) + 24) % 24;
  const target = profileHour ?? DEFAULT_HOUR_JST;
  return jstHour === target;
};
