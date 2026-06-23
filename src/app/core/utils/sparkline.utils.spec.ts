import { describe, expect, it } from 'vitest';
import { getSparklinePoints } from './sparkline.utils';

describe('getSparklinePoints', () => {
  it('returns empty string for 0 points', () => {
    expect(getSparklinePoints([])).toBe('');
  });

  it('returns empty string for 1 point', () => {
    expect(getSparklinePoints([0.5])).toBe('');
  });

  it('maps 2 points correctly to full width', () => {
    const result = getSparklinePoints([0, 1]);
    expect(result).toBe('0.0,20.0 40.0,0.0');
  });

  it('maps 3 evenly-spaced points', () => {
    const result = getSparklinePoints([0, 0.5, 1]);
    expect(result).toBe('0.0,20.0 20.0,10.0 40.0,0.0');
  });

  it('inverts Y axis (value 1 = top = y 0, value 0 = bottom = y h)', () => {
    const result = getSparklinePoints([1, 0]);
    expect(result).toBe('0.0,0.0 40.0,20.0');
  });

  it('respects custom width and height', () => {
    const result = getSparklinePoints([0, 1], 100, 50);
    expect(result).toBe('0.0,50.0 100.0,0.0');
  });

  it('handles a flat line (all same value)', () => {
    const result = getSparklinePoints([0.5, 0.5, 0.5]);
    expect(result).toBe('0.0,10.0 20.0,10.0 40.0,10.0');
  });

  it('clamps values via toFixed(1) without NaN', () => {
    const points = getSparklinePoints([0.1, 0.9]);
    expect(points).not.toContain('NaN');
    expect(points.split(' ')).toHaveLength(2);
  });
});
