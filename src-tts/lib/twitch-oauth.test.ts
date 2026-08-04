import { describe, expect, it } from "vitest";
import {
  parseTwitchAccessTokenFromLocation,
  parseTwitchOAuthErrorFromLocation,
  parseTwitchOAuthStateFromLocation,
} from "./twitch-oauth";

describe("parseTwitchOAuthErrorFromLocation", () => {
  it("parses access_denied query from Twitch cancel redirect", () => {
    const href =
      "http://localhost:8765/tts?error=access_denied&error_description=The+user+denied+you+access.";
    expect(parseTwitchOAuthErrorFromLocation(href)).toEqual({
      error: "access_denied",
      message: "The user denied you access.",
    });
  });

  it("returns null when no error query", () => {
    expect(parseTwitchOAuthErrorFromLocation("http://localhost:8765/tts")).toBeNull();
  });

  it("ignores success hash token pages", () => {
    expect(
      parseTwitchOAuthErrorFromLocation(
        "http://localhost:8765/tts#access_token=abc&token_type=bearer",
      ),
    ).toBeNull();
  });
});

describe("parseTwitchAccessTokenFromLocation", () => {
  it("parses hash access_token", () => {
    expect(
      parseTwitchAccessTokenFromLocation(
        "http://localhost:8765/tts#access_token=secret&scope=chat%3Aread",
      ),
    ).toBe("secret");
  });

  it("does not treat query error as token", () => {
    expect(
      parseTwitchAccessTokenFromLocation(
        "http://localhost:8765/tts?error=access_denied&error_description=The+user+denied+you+access.",
      ),
    ).toBeNull();
  });
});

describe("parseTwitchOAuthStateFromLocation", () => {
  it("parses state from hash and query", () => {
    expect(
      parseTwitchOAuthStateFromLocation(
        "http://localhost:8765/tts#access_token=abc&state=csrf-1",
      ),
    ).toBe("csrf-1");
    expect(
      parseTwitchOAuthStateFromLocation(
        "http://localhost:8765/tts?error=access_denied&state=csrf-2",
      ),
    ).toBe("csrf-2");
  });
});
