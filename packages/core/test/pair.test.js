import { describe, expect, test } from "bun:test"
import { normaliseServerUrl, pairLink, parsePairLink } from "../src/pair.js"

describe("pairing link", () => {
	test("round-trips a server and token", () => {
		const link = pairLink("https://murmur.example.com", "s3cret/+=")
		expect(link.startsWith("murmur://pair?")).toBe(true)
		expect(parsePairLink(link)).toEqual({ serverUrl: "https://murmur.example.com", token: "s3cret/+=" })
	})
	test("a server with no token", () => {
		expect(parsePairLink(pairLink("http://192.168.1.10:3000", ""))).toEqual({
			serverUrl: "http://192.168.1.10:3000",
			token: "",
		})
	})
	test("trailing slash and whitespace are forgiven", () => {
		expect(parsePairLink("  murmur://pair?server=http%3A%2F%2Fhost%3A3000%2F&token=t \n")).toEqual({
			serverUrl: "http://host:3000",
			token: "t",
		})
	})
	test("anything else is not a pairing link", () => {
		expect(parsePairLink("https://youtu.be/dQw4w9WgXcQ")).toBeNull()
		expect(parsePairLink("murmur://pair")).toBeNull()
		expect(parsePairLink("murmur://pair?token=t")).toBeNull()
		expect(parsePairLink("murmur://pair?server=not-a-url")).toBeNull()
		expect(parsePairLink("")).toBeNull()
	})
})

describe("typed server addresses", () => {
	test("home-network and single-word hosts are http", () => {
		for (const typed of [
			"localhost:3000",
			"127.0.0.1:3000",
			"192.168.1.5:3000",
			"10.0.0.2",
			"172.20.0.4:3000",
			"nas.local:3000",
			"nas:3000",
		]) {
			expect(normaliseServerUrl(typed)).toBe(`http://${typed}`)
		}
	})
	test("anything with a public-looking name is https", () => {
		expect(normaliseServerUrl("murmur.example.com")).toBe("https://murmur.example.com")
		expect(normaliseServerUrl("172.40.0.1")).toBe("https://172.40.0.1")
	})
	test("a typed scheme wins; trailing slashes go", () => {
		expect(normaliseServerUrl("http://murmur.example.com/")).toBe("http://murmur.example.com")
		expect(normaliseServerUrl("https://localhost:3000//")).toBe("https://localhost:3000")
		expect(normaliseServerUrl("  ")).toBe("")
	})
})
