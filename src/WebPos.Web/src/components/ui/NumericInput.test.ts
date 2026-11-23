import { describe, expect, it } from 'vitest';
import { formatDecimalValue, parseDecimalInput } from './NumericInput';

describe('NumericInput decimal parsing and formatting', () => {
  describe('parseDecimalInput', () => {
    it('parses Bosnian comma and standard dot decimals', () => {
      expect(parseDecimalInput('12,5')).toBe(12.5);
      expect(parseDecimalInput('12.5')).toBe(12.5);
      expect(parseDecimalInput('1,2345')).toBe(1.2345);
      expect(parseDecimalInput('0.05')).toBe(0.05);
      expect(parseDecimalInput(',5')).toBe(0.5);
      expect(parseDecimalInput('.5')).toBe(0.5);
      expect(parseDecimalInput('12,')).toBe(12);
      expect(parseDecimalInput(' 42,75 ')).toBe(42.75);
    });

    it('returns null for empty or non-numeric strings', () => {
      expect(parseDecimalInput('')).toBeNull();
      expect(parseDecimalInput('   ')).toBeNull();
      expect(parseDecimalInput('abc')).toBeNull();
      expect(parseDecimalInput('12abc')).toBeNull();
      expect(parseDecimalInput(',')).toBeNull();
      expect(parseDecimalInput('.')).toBeNull();
      expect(parseDecimalInput('-')).toBeNull();
    });

    it('rejects multiple decimal separators cleanly', () => {
      expect(parseDecimalInput('12.3.4')).toBeNull();
      expect(parseDecimalInput('12,3,4')).toBeNull();
      expect(parseDecimalInput('12.3,4')).toBeNull();
      expect(parseDecimalInput('12,3.4')).toBeNull();
      expect(parseDecimalInput('1..2')).toBeNull();
      expect(parseDecimalInput('1,,2')).toBeNull();
    });

    it('respects allowNegative flag', () => {
      expect(parseDecimalInput('-5,25', false)).toBeNull();
      expect(parseDecimalInput('-5,25')).toBeNull();
      expect(parseDecimalInput('-5,25', true)).toBe(-5.25);
      expect(parseDecimalInput('-0', true)).toBe(0);
    });
  });

  describe('formatDecimalValue', () => {
    it('formats Bosnian comma and dot values to 2 decimals', () => {
      expect(formatDecimalValue('12,5', 2)).toBe('12.50');
      expect(formatDecimalValue('12.5', 2)).toBe('12.50');
      expect(formatDecimalValue('12,', 2)).toBe('12.00');
      expect(formatDecimalValue(',5', 2)).toBe('0.50');
      expect(formatDecimalValue(12.5, 2)).toBe('12.50');
    });

    it('formats 4-decimal prices accurately with ROUND_HALF_UP', () => {
      expect(formatDecimalValue('1,2345', 4)).toBe('1.2345');
      expect(formatDecimalValue('1.23455', 4)).toBe('1.2346');
      expect(formatDecimalValue('1.005', 2)).toBe('1.01');
    });

    it('formats 0-decimal integers accurately', () => {
      expect(formatDecimalValue('5', 0)).toBe('5');
      expect(formatDecimalValue('5,6', 0)).toBe('6');
      expect(formatDecimalValue('', 0)).toBe('0');
    });

    it('converts empty or invalid strings to zero (or min bound)', () => {
      expect(formatDecimalValue('', 2)).toBe('0.00');
      expect(formatDecimalValue('   ', 4)).toBe('0.0000');
      expect(formatDecimalValue('12.3.4', 2)).toBe('0.00');
      expect(formatDecimalValue('', 2, 1)).toBe('1.00');
    });

    it('clamps negative values when min={0} and respects max bound', () => {
      expect(formatDecimalValue('-5', 2, 0)).toBe('0.00');
      expect(formatDecimalValue('-12,75', 2, 0)).toBe('0.00');
      expect(formatDecimalValue('-0.001', 2)).toBe('0.00');
      expect(formatDecimalValue('-5', 2)).toBe('-5.00');
      expect(formatDecimalValue('150,5', 2, 0, 100)).toBe('100.00');
      expect(formatDecimalValue('25,5', 2, 0, 100)).toBe('25.50');
    });
  });
});
