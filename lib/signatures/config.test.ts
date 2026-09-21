import { afterEach, describe, expect, it } from "vitest";
import {
  getConfiguredSigningProviderName,
  isDropboxSignTestMode,
} from "@/lib/signatures/config";

const originalDropbox = process.env.DROPBOX_SIGN_TEST_MODE;
const originalProvider = process.env.SIGNING_PROVIDER;

afterEach(() => {
  if (originalDropbox === undefined) {
    delete process.env.DROPBOX_SIGN_TEST_MODE;
  } else {
    process.env.DROPBOX_SIGN_TEST_MODE = originalDropbox;
  }
  if (originalProvider === undefined) {
    delete process.env.SIGNING_PROVIDER;
  } else {
    process.env.SIGNING_PROVIDER = originalProvider;
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

describe("configured signing provider", () => {
  it("defaults to native Lexflow unless Dropbox Sign is selected", () => {
    delete process.env.SIGNING_PROVIDER;
    expect(getConfiguredSigningProviderName()).toBe("native_lexflow");
    process.env.SIGNING_PROVIDER = "dropbox_sign";
    expect(getConfiguredSigningProviderName()).toBe("dropbox_sign");
    process.env.SIGNING_PROVIDER = "something-else";
    expect(getConfiguredSigningProviderName()).toBe("native_lexflow");
  });
});
