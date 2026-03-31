export const THEME_STORAGE_KEY = "homeschool-theme";

export type ThemeMode = "light" | "dark";

export const THEME_INIT_SCRIPT = `
(() => {
  const storageKey = "${THEME_STORAGE_KEY}";
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const stored = window.localStorage.getItem(storageKey);
  const theme = stored === "light" || stored === "dark"
    ? stored
    : systemPrefersDark
      ? "dark"
      : "light";

  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
})();
`;
