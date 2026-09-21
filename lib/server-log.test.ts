import { describe, expect, it } from "vitest";
import { isNextNavigationError, publicActionError } from "@/lib/server-log";

describe("publicActionError", () => {
  it("returns the fallback when the message is empty", () => {
    expect(publicActionError(undefined, "Unable to create agreement.")).toBe(
      "Unable to create agreement.",
    );
  });

  it("keeps a safe database message", () => {
    expect(
      publicActionError(
        "insert or update on table \"costs_agreements\" violates foreign key constraint",
        "Unable to create agreement.",
      ),
    ).toContain("costs_agreements");
  });

  it("hides credentials and secrets", () => {
    expect(
      publicActionError("password=supersecret", "Unable to create agreement."),
    ).toBe("Unable to create agreement.");
    expect(
      publicActionError(
        "postgres://user:pass@db.example.com/lexflow",
        "Unable to create agreement.",
      ),
    ).toBe("Unable to create agreement.");
  });
});

describe("isNextNavigationError", () => {
  it("recognises Next.js redirect errors so they are not swallowed", () => {
    expect(isNextNavigationError({ digest: "NEXT_REDIRECT;replace;/edit" })).toBe(
      true,
    );
    expect(isNextNavigationError(new Error("Unable to create client"))).toBe(false);
  });
});
