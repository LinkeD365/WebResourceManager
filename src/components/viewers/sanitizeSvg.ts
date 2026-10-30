const allowedElements = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "title",
  "desc",
  "text",
  "tspan",
]);

const allowedAttributes = new Set([
  "xmlns",
  "viewbox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientunits",
  "gradienttransform",
  "spreadmethod",
  "preserveaspectratio",
  "clip-path",
  "mask",
  "id",
  "xmlns:xlink",
  "xlink:href",
  "href",
  "font-size",
  "font-family",
  "text-anchor",
]);

const localReferenceOnly = new Set(["clip-path", "mask", "fill", "stroke", "href", "xlink:href"]);

const isSafeAttributeValue = (name: string, value: string): boolean => {
  const trimmed = value.trim();
  if (
    (name === "xmlns" && trimmed === "http://www.w3.org/2000/svg") ||
    (name === "xmlns:xlink" && trimmed === "http://www.w3.org/1999/xlink")
  ) {
    return true;
  }
  if (localReferenceOnly.has(name) && /url\s*\(/i.test(trimmed)) {
    return /^url\(\s*#[\w:.-]+\s*\)$/i.test(trimmed);
  }
  if (name === "href" || name === "xlink:href") {
    return trimmed.startsWith("#");
  }
  return !/(javascript:|data:|https?:|file:)/i.test(trimmed);
};

const cleanElement = (element: Element): void => {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (
      !allowedAttributes.has(name) ||
      name.startsWith("on") ||
      !isSafeAttributeValue(name, attribute.value)
    ) {
      element.removeAttribute(attribute.name);
    }
  }

  for (const child of Array.from(element.children)) {
    if (!allowedElements.has(child.localName.toLowerCase())) {
      child.remove();
    } else {
      cleanElement(child);
    }
  }
};

export const sanitizeSvg = (markup: string): string | null => {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = document.documentElement;
  if (root.localName.toLowerCase() !== "svg" || document.querySelector("parsererror")) {
    return null;
  }

  cleanElement(root);
  return new XMLSerializer().serializeToString(root);
};
