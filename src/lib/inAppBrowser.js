// Detects social-app in-app browsers (Facebook/Instagram/Snapchat/LinkedIn/LINE/WhatsApp
// and Android WebViews). Google blocks OAuth inside these embedded browsers, so sign-in
// must be started from the system browser instead. Pure: unit-tested in tests/inAppBrowser.test.mjs.

const IN_APP_PATTERN = /FBAN|FBAV|Instagram|Snapchat|LinkedInApp|Line\/|WhatsApp|; wv\)/i;

export function isInAppBrowser(ua) {
  if (typeof ua !== "string" || !ua) return false;
  return IN_APP_PATTERN.test(ua);
}
