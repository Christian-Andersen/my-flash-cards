/**
 * Browser API stubs for the jsdom test environment.
 *
 * jsdom implements neither `matchMedia` nor the async clipboard, and the app
 * touches both. These are minimal fakes: they satisfy the calls the app makes
 * without trying to emulate the real browser.
 */

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {} },
      configurable: true,
    });
  }
}
