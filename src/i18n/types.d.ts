import "i18next";

// Loose typing: allow any string key so feature code can freely use
// nested translation paths without exhaustive literal types.
declare module "i18next" {
  interface CustomTypeOptions {
    returnNull: false;
    resources: Record<string, Record<string, unknown>>;
  }
}