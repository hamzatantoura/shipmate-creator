import "react-i18next";

// Loose i18next typing: accept any string key and return string,
// so feature code can use nested paths like "nav.features" freely.
declare module "react-i18next" {
  interface CustomTypeOptions {
    returnNull: false;
    resources: Record<string, Record<string, string>>;
  }
}

declare module "i18next" {
  interface TFunction {
    (key: string | string[], options?: Record<string, unknown>): string;
  }
}
