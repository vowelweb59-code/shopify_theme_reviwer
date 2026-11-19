import { describe, expect, it } from 'vitest';
import { looksLikeClientName, nearExisting, samePostClient } from './auto-project-rules';

describe('samePostClient', () => {
  it('matches the same name or one that is the other\'s leading words', () => {
    expect(samePostClient('Ledty LavishCo', 'Ledty LavishCo')).toBe(true);
    expect(samePostClient('Ledty LavishCo', 'Ledty')).toBe(true);
    expect(samePostClient('Sumer Kashyap', 'sumer  kashyap')).toBe(true);
  });
  it('does not match different people, or a short first name alone', () => {
    expect(samePostClient('Tim Fitz', 'Tim Cook')).toBe(false);
    expect(samePostClient('Tim', 'Tim Fitz')).toBe(false);
  });
});

describe('nearExisting', () => {
  it('flags a first name or a longer form of an existing client', () => {
    expect(nearExisting('Tim', ['Tim Fitz', 'Andrew Johnson'])).toBe('Tim Fitz');
    expect(nearExisting('Tim Fitz Frontend', ['Tim Fitz'])).toBe('Tim Fitz');
  });
  it('lets a genuinely new name through, and ignores an identical one', () => {
    expect(nearExisting('Ledty LavishCo', ['Tim Fitz', 'Andrew Johnson'])).toBeNull();
    expect(nearExisting('Tim Fitz', ['Tim Fitz'])).toBeNull();
  });
});

describe('looksLikeClientName', () => {
  it('accepts names and rejects tasks, labels and fragments', () => {
    expect(looksLikeClientName('Ledty LavishCo')).toBe(true);
    expect(looksLikeClientName('Task: Klaviyo Account Review – Raw Botanicals')).toBe(false);
    expect(looksLikeClientName('Meeting with team')).toBe(false);
    expect(looksLikeClientName('NA')).toBe(false);
    expect(looksLikeClientName('12')).toBe(false);
  });
});
