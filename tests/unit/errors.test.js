import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GENERIC_ERROR, errorMessage, isCancelledSignIn } from "../../public/js/errors.js";

describe("errorMessage", () => {
  test("explains known Firestore errors", () => {
    assert.match(errorMessage({ code: "permission-denied" }), /access/);
    assert.match(errorMessage({ code: "unavailable" }), /connection/);
  });

  test("explains known sign-in errors", () => {
    assert.match(errorMessage({ code: "auth/expired-action-code" }), /expired/);
    assert.match(errorMessage({ code: "auth/popup-blocked" }), /pop-ups/);
  });

  test("uses the fallback for anything else", () => {
    assert.equal(errorMessage({ code: "internal" }), GENERIC_ERROR);
    assert.equal(errorMessage(new Error("boom"), "Custom"), "Custom");
    assert.equal(errorMessage(undefined), GENERIC_ERROR);
  });
});

describe("isCancelledSignIn", () => {
  test("recognises a closed sign-in window", () => {
    assert.equal(isCancelledSignIn({ code: "auth/popup-closed-by-user" }), true);
    assert.equal(isCancelledSignIn({ code: "auth/network-request-failed" }), false);
    assert.equal(isCancelledSignIn(null), false);
  });
});
