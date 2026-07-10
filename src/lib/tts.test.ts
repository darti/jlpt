import { test, expect } from "bun:test";
import { sentenceFromG } from "./tts.ts";

test("sentenceFromG strips French glosses «…», keeps the post-→ form, drops furigana (…)", () => {
  // one segment: "帰る（かえる）→帰ったら «conditionnel»" → "帰ったら"
  expect(sentenceFromG("帰る（かえる）→帰ったら «conditionnel»")).toBe("帰ったら");
});

test("sentenceFromG joins ' · '-separated segments", () => {
  expect(sentenceFromG("音楽（おんがく）«musique» · を «COD»")).toBe("音楽を");
});

test("sentenceFromG on empty input returns empty string", () => {
  expect(sentenceFromG("")).toBe("");
});
