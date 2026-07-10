import { test, expect } from "bun:test";
import { isIOS, isNonSafariIOS, isStandalone } from "./useInstallPrompt.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPADOS_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const REAL_MAC = IPADOS_AS_MAC;
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15";

test("isIOS detects iPhone and iPad UAs", () => {
  expect(isIOS(IPHONE_SAFARI, 0)).toBe(true);
  expect(isIOS(IPAD_SAFARI, 0)).toBe(true);
});

test("isIOS detects iPadOS presenting as a Macintosh, via touch points", () => {
  expect(isIOS(IPADOS_AS_MAC, 5)).toBe(true);
});

test("isIOS is false for a real desktop Mac (no touch) or Android", () => {
  expect(isIOS(REAL_MAC, 0)).toBe(false);
  expect(isIOS(ANDROID_CHROME, 0)).toBe(false);
});

test("isStandalone is true when the display-mode media query matches", () => {
  expect(isStandalone(true, undefined)).toBe(true);
});

test("isStandalone is true when navigator.standalone is true (iOS)", () => {
  expect(isStandalone(false, true)).toBe(true);
});

test("isStandalone is false otherwise", () => {
  expect(isStandalone(false, false)).toBe(false);
  expect(isStandalone(false, undefined)).toBe(false);
});

test("isNonSafariIOS flags iOS Chrome and Firefox", () => {
  expect(isNonSafariIOS(IPHONE_CHROME, true)).toBe(true);
  expect(isNonSafariIOS(IPHONE_FIREFOX, true)).toBe(true);
});

test("isNonSafariIOS is false for actual iOS Safari", () => {
  expect(isNonSafariIOS(IPHONE_SAFARI, true)).toBe(false);
});

test("isNonSafariIOS is false when not iOS at all", () => {
  expect(isNonSafariIOS(IPHONE_CHROME, false)).toBe(false);
});
