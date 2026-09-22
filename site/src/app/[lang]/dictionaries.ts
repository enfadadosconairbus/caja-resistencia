import "server-only";
import es from "./dictionaries/es.json";

/** El español es el idioma de referencia; su forma define el tipo del diccionario. */
export type Dict = typeof es;
export type Locale = "es" | "en" | "fr" | "de";

export const locales: Locale[] = ["es", "en", "fr", "de"];
export const defaultLocale: Locale = "es";

const loaders: Record<Locale, () => Promise<Dict>> = {
  es: async () => es,
  en: () => import("./dictionaries/en.json").then((m) => m.default as Dict),
  fr: () => import("./dictionaries/fr.json").then((m) => m.default as Dict),
  de: () => import("./dictionaries/de.json").then((m) => m.default as Dict),
};

export const hasLocale = (locale: string): locale is Locale =>
  (locales as string[]).includes(locale);

export const getDictionary = (locale: Locale): Promise<Dict> => loaders[locale]();
