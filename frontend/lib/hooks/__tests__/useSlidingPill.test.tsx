import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { render } from '@testing-library/react';

import { useSlidingPill } from '../useSlidingPill';

// jsdom has no layout: each item's offsets come from its data-* attributes.
const offset = (name: 'left' | 'width') =>
  function (this: HTMLElement) {
    return Number(this.dataset[name] ?? 0);
  };
const spies: jest.SpyInstance[] = [];

function Bar({ active }: { active: string | null }) {
  const { containerRef, pillRef } = useSlidingPill<HTMLDivElement>(active);
  return (
    <div ref={containerRef}>
      <span data-testid="pill" ref={pillRef} />
      <a data-left="10" data-pill="a" data-width="80">A</a>
      <a data-left="120" data-pill="b" data-width="96">B</a>
    </div>
  );
}

describe('useSlidingPill', () => {
  beforeAll(() => {
    spies.push(jest.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(offset('left')));
    spies.push(jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(offset('width')));
  });

  afterAll(() => spies.forEach((spy) => spy.mockRestore()));

  it('places the pill over the active item', () => {
    const { getByTestId } = render(<Bar active="b" />);

    expect(getByTestId('pill')).toHaveStyle({ transform: 'translate(120px, 0px)', width: '96px', opacity: '1' });
  });

  it('slides to the next active item', () => {
    const { getByTestId, rerender } = render(<Bar active="a" />);

    rerender(<Bar active="b" />);

    expect(getByTestId('pill').style.transform).toBe('translate(120px, 0px)');
  });

  it('keeps its transition for the slide', () => {
    const { getByTestId, rerender } = render(<Bar active="a" />);

    rerender(<Bar active="b" />);

    expect(getByTestId('pill').style.transition).toBe('');
  });

  it('fades out when no item is active', () => {
    const { getByTestId } = render(<Bar active={null} />);

    expect(getByTestId('pill')).toHaveStyle({ opacity: '0' });
  });
});
