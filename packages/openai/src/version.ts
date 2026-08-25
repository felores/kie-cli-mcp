declare const __PACKAGE_VERSION__: string | undefined;

export const PACKAGE_VERSION =
  typeof __PACKAGE_VERSION__ === "string" ? __PACKAGE_VERSION__ : "1.0.0";
export const CONTRACT_VERSION = "3";
