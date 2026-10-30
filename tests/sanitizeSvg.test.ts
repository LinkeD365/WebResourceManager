import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../src/components/viewers/sanitizeSvg";

describe("sanitizeSvg", () => {
  it("removes scriptable elements, event handlers, and external references", () => {
    const sanitized = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><iframe src="https://example.com"/></foreignObject><image href="https://example.com/a.png"/><path id="shape" onclick="alert(2)" fill="url(https://example.com/paint)" d="M0 0"/></svg>',
    );

    expect(sanitized).not.toBeNull();
    expect(sanitized).not.toMatch(/script|foreignObject|iframe|image|onload|onclick|example\.com/i);
    expect(sanitized).toContain('d="M0 0"');
  });

  it("keeps safe local fragment references and standard SVG elements", () => {
    const sanitized = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path fill="url(#g)" d="M0 0"/></svg>',
    );

    expect(sanitized).toContain("linearGradient");
    expect(sanitized).toContain('fill="url(#g)"');
  });

  it("rejects malformed or non-SVG documents", () => {
    expect(sanitizeSvg("<div>not svg</div>")).toBeNull();
    expect(sanitizeSvg("<svg><path></svg>")).toBeNull();
  });
});
