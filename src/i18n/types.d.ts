import "react-i18next";

// Disable strict i18next key typing project-wide so nested keys like
// "merchant.signOut" work without ns prefixes.
declare module "react-i18next" {
  interface CustomTypeOptions {
    returnNull: false;
    resources: {};
  }
}
