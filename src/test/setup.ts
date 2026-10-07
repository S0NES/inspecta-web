import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement the Blob URL APIs — needed by any feature that triggers a
// real file download (e.g. Extrato's CSV/JSON export).
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock-url';
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

// jsdom implements neither matchMedia nor ResizeObserver. ResponsiveActions guards
// against a missing matchMedia (falls back to "wide viewport" → nothing collapses),
// but a stub keeps the guard honest and lets a test flip the breakpoint if needed.
if (typeof window.matchMedia !== 'function') {
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
    }) as unknown as MediaQueryList;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
