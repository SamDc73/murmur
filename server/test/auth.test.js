import { describe, expect, test } from "bun:test"
import { isAuthorised, tokenFrom } from "../src/auth.js"

describe("auth", () => {
	test("token from header or query", () => {
		expect(tokenFrom("http://x/api/media/1", new Headers({ authorization: "Bearer abc" }))).toBe("abc")
		expect(tokenFrom("http://x/api/media/1?token=q", new Headers())).toBe("q")
		expect(tokenFrom("/sync?token=q", { authorization: "" })).toBe("q")
		expect(tokenFrom("/sync", {})).toBe("")
	})
	test("compare", () => {
		expect(isAuthorised("", "anything")).toBe(true)
		expect(isAuthorised("secret", "secret")).toBe(true)
		expect(isAuthorised("secret", "secreT")).toBe(false)
		expect(isAuthorised("secret", "")).toBe(false)
		expect(isAuthorised("secret", undefined)).toBe(false)
	})
})
