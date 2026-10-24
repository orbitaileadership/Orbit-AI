import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { UsageMeter, type UsageData } from './usage-meter';
const usage: UsageData = {
  live: true, allowance: 1000, spent: 100, reserved: 0,
  windows: [
    { key: 'daily', remainingPercent: 75, heldPercent: 5, nextReleaseAt: null },
    { key: 'weekly', remainingPercent: 40, heldPercent: 0, nextReleaseAt: null },
    { key: 'monthly', remainingPercent: 10, heldPercent: 0, nextReleaseAt: null },
  ],
};
it('renders three percentage bars with remaining-based colors and no student money', () => {
  const html = renderToStaticMarkup(createElement(UsageMeter, { usage, size: 'large' }));
  expect(html.match(/role="meter"/g)).toHaveLength(3);
  for (const label of ['Daily', 'Weekly', 'Monthly', '75% left', '40% left', '10% left', 'var(--success)', 'var(--warning)', 'var(--danger)']) expect(html).toContain(label);
  expect(html).not.toContain('US$'); expect(html).not.toContain('C$');
});
it('does not round a nearly exhausted allowance up to a full percent', () => {
  const html = renderToStaticMarkup(createElement(UsageMeter, { usage: { ...usage, windows: [{ ...usage.windows![0], remainingPercent: 0.9 }] } }));
  expect(html).toContain('&lt;1% left');
});
it('explains entitlement exhaustion and unavailable limits instead of showing false availability', () => {
  const render = (data: UsageData) => renderToStaticMarkup(createElement(UsageMeter, { usage: data }));
  expect(render({ ...usage, spent: 1000 })).toContain('account allowance is exhausted');
  expect(render({ ...usage, windows: undefined })).toContain('temporarily unavailable');
});
