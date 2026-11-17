import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isInAppBrowser} from '../src/lib/inAppBrowser.js';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

test('isInAppBrowser flags Facebook, Instagram, Snapchat, LinkedIn, LINE and WhatsApp webviews', () => {
  assert.equal(isInAppBrowser(`${IPHONE_SAFARI} [FBAN/FBIOS;FBAV/450.0.0.0.0;]`), true, 'Facebook FBAN/FBAV');
  assert.equal(isInAppBrowser(`${IPHONE_SAFARI} Instagram 300.0.0.0.0`), true, 'Instagram');
  assert.equal(isInAppBrowser(`${IPHONE_SAFARI} Snapchat/12.0`), true, 'Snapchat');
  assert.equal(isInAppBrowser(`${IPHONE_SAFARI} LinkedInApp`), true, 'LinkedIn');
  assert.equal(isInAppBrowser(`${IPHONE_SAFARI} Line/13.0.0`), true, 'LINE');
  assert.equal(isInAppBrowser(`${IPHONE_SAFARI} WhatsApp/2.24`), true, 'WhatsApp');
});

test('isInAppBrowser flags Android WebViews (the "; wv)" token)', () => {
  const webview = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36';
  assert.equal(isInAppBrowser(webview), true);
});

test('isInAppBrowser is case-insensitive', () => {
  assert.equal(isInAppBrowser('instagram'), true);
  assert.equal(isInAppBrowser('whatsapp/2.0'), true);
});

test('isInAppBrowser leaves regular Chrome and Safari alone', () => {
  assert.equal(isInAppBrowser(ANDROID_CHROME), false);
  assert.equal(isInAppBrowser(IPHONE_SAFARI), false);
  assert.equal(isInAppBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15'), false);
});

test('isInAppBrowser returns false for missing or non-string input', () => {
  assert.equal(isInAppBrowser(''), false);
  assert.equal(isInAppBrowser(undefined), false);
  assert.equal(isInAppBrowser(null), false);
  assert.equal(isInAppBrowser(42), false);
});
