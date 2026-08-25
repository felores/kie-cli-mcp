declare const __PACKAGE_VERSION__: string | undefined;

export const PACKAGE_VERSION =
  typeof __PACKAGE_VERSION__ === "string" ? __PACKAGE_VERSION__ : "0.4.0";
export const CONTRACT_VERSION = "3";
