import '@testing-library/jest-dom/vitest'

// React Flow needs these in jsdom.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
globalThis.DOMMatrixReadOnly ??= class {
  m22 = 1
  constructor(_init?: string) {}
} as unknown as typeof DOMMatrixReadOnly
