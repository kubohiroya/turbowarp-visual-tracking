import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {VisualTrackingExtension} from '../src/extension.js';

beforeEach(() => {
  vi.stubGlobal('Scratch', {
    BlockType: {REPORTER: 'reporter'},
    ArgumentType: {STRING: 'string'},
    Cast: {
      toString: (value: unknown) => String(value)
    },
    translate: (
      message: string | {default: string},
      placeholders: Record<string, string | number> = {}
    ) => {
      const text = typeof message === 'string' ? message : message.default;
      return Object.entries(placeholders).reduce(
        (result, [name, value]) => result.replace(`{${name}}`, String(value)),
        text
      );
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VisualTrackingExtension', () => {
  it('returns a greeting', () => {
    const extension = new VisualTrackingExtension();
    expect(extension.hello({NAME: 'TurboWarp'})).toBe('Hello, TurboWarp!');
  });

  it('uses localizable extension and block text', () => {
    const info = new VisualTrackingExtension().getInfo() as {name: string; blocks: Array<{text: string}>};
    expect(info.name).toBe('TurboWarp-Visual-Tracking');
    expect(info.blocks[0]?.text).toBe('hello [NAME]');
  });

  it('publishes documentation and a self-contained SVG block icon', () => {
    const info = new VisualTrackingExtension().getInfo() as {docsURI: string; blockIconURI: string};
    expect(info.docsURI).toBe('https://kubohiroya.github.io/turbowarp-visual-tracking/');
    expect(info.blockIconURI).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
