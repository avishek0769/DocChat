import { describe, expect, it } from "vitest";
import { formatTokens } from "./format";

describe("formatTokens", () => {
    it("formats values", () => {
        expect(formatTokens(0)).toBe("0");
        expect(formatTokens(42)).toBe("42");
        expect(formatTokens(999)).toBe("999");
        expect(formatTokens(1000)).toBe("1k");
        expect(formatTokens(1500)).toBe("1.5k");
        expect(formatTokens(12000)).toBe("12k");
        expect(formatTokens(999999)).toBe("1000k");
        expect(formatTokens(1000000)).toBe("1M");
        expect(formatTokens(2500000)).toBe("2.5M");
        expect(formatTokens(1200000)).toBe("1.2M");
    });
});
