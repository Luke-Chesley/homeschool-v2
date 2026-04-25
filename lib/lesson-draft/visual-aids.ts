export const LESSON_VISUAL_AID_ALLOWED_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "wikimedia.org",
  "wikipedia.org",
  "noaa.gov",
  "weather.gov",
  "nasa.gov",
  "images-assets.nasa.gov",
] as const;

export function isAllowedLessonVisualAidUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return LESSON_VISUAL_AID_ALLOWED_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

export function extractAllowedLessonVisualAidUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>),]+/g) ?? [];
  return [...new Set(matches.map((value) => value.trim()).filter(isAllowedLessonVisualAidUrl))];
}
