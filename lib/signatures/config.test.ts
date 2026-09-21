import { afterEach, describe, expect, it } from "vitest";
import { isDropboxSignTestMode } from "@/lib/signatures/config";

const original = process.env.DROPBOX_SIGN_TEST_MODE;

afterEach(() => {
  if (original === undefined) {
    delete process.env.DROPBOX_SIGN_TEST_MODE;
  } else {
    process.env.DROPBOX_SIGN_TEST_MODE = original;
  }
});

describe("Dropbox Sign test mode", () => {
  it("is off unless explicitly set to true", () => {
    delete process.env.DROPBOX_SIGN_TEST_MODE;
    expect(isDropboxSignTestMode()).toBe(false);
    process.env.DROPBOX_SIGN_TEST_MODE = "false";
    expect(isDropboxSignTestMode()).toBe(false);
    process.env.DROPBOX_SIGN_TEST_MODE = "TRUE";
    expect(isDropboxSignTestMode()).toBe(false);
    process.env.DROPBOX_SIGN_TEST_MODE = "true";
    expect(isDropboxSignTestMode()).toBe(true);
  });
});
