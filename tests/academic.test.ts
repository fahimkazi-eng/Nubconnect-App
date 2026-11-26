// ============================================================================
// NUBCONNECT — academic.ts unit tests
// Verifies the NUB 4.00 grade scale, GPA/CGPA math, semester system split
// and standing thresholds against verified university rules.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  calculateGpa,
  calculateCgpa,
  gpaStanding,
  NUB_GRADE_MAP,
  semesterSystemForDepartment,
  round2,
} from '@/lib/academic';

describe('NUB grade scale (verified against nub.ac.bd)', () => {
  it('maps all nine NUB grades to the official 4.00 scale', () => {
    expect(NUB_GRADE_MAP['A+']).toBe(4.0);
    expect(NUB_GRADE_MAP['A']).toBe(3.75);
    expect(NUB_GRADE_MAP['A-']).toBe(3.5);
    expect(NUB_GRADE_MAP['B+']).toBe(3.25);
    expect(NUB_GRADE_MAP['B']).toBe(3.0);
    expect(NUB_GRADE_MAP['B-']).toBe(2.75);
    expect(NUB_GRADE_MAP['C+']).toBe(2.5);
    expect(NUB_GRADE_MAP['C']).toBe(2.25);
    expect(NUB_GRADE_MAP['D']).toBe(2.0);
    expect(NUB_GRADE_MAP['F']).toBe(0.0);
  });
});

describe('calculateGpa (credit-weighted, NUB 4.00 scale)', () => {
  it('weights grade points by course credits', () => {
    // (3×3.75 + 3×4.0 + 1.5×3.25) / 7.5 = 28.125 / 7.5 = 3.75
    const gpa = calculateGpa([
      { code: 'CSE-301', title: '', credits: 3, grade: 'A' },
      { code: 'CSE-303', title: '', credits: 3, grade: 'A+' },
      { code: 'CSE-305', title: '', credits: 1.5, grade: 'B+' },
    ]);
    expect(gpa).toBe(3.75);
  });

  it('returns 0 for an empty semester', () => {
    expect(calculateGpa([])).toBe(0);
  });

  it('ignores non-credit courses and unknown grades', () => {
    const gpa = calculateGpa([
      { code: 'CSE-301', title: '', credits: 3, grade: 'A' }, // 3.75
      { code: 'AUD-001', title: '', credits: 0, grade: 'A+' }, // zero credits — excluded
      { code: 'CSE-309', title: '', credits: 3, grade: 'X' }, // unknown grade — excluded
    ]);
    expect(gpa).toBe(3.75);
  });

  it('treats an all-F semester as 0.00 without dividing by zero', () => {
    const gpa = calculateGpa([
      { code: 'CSE-301', title: '', credits: 3, grade: 'F' },
      { code: 'CSE-303', title: '', credits: 3, grade: 'F' },
    ]);
    expect(gpa).toBe(0);
  });
});

describe('calculateCgpa (across semesters)', () => {
  it('weights semester GPAs by credits completed', () => {
    // (3.65×16.5 + 3.72×17 + 3.80×16) / 49.5 ≈ 3.72
    const cgpa = calculateCgpa([
      { gpa: 3.65, credits: 16.5 },
      { gpa: 3.72, credits: 17 },
      { gpa: 3.8, credits: 16 },
    ]);
    expect(cgpa).toBe(3.72);
  });

  it('returns 0 with no completed semesters', () => {
    expect(calculateCgpa([])).toBe(0);
    expect(calculateCgpa([{ gpa: 3.5, credits: 0 }])).toBe(0);
  });
});

describe('semesterSystemForDepartment (Bi/Tri split)', () => {
  it('assigns Pharmacy, Law, Civil and Mechanical to Bi-Semester', () => {
    for (const code of ['PHARM', 'LAW', 'CE', 'ME']) {
      expect(semesterSystemForDepartment(code)).toBe('Bi-Semester');
    }
  });

  it('assigns the rest of NUB to Tri-Semester', () => {
    for (const code of ['CSE', 'EEE', 'BBA', 'MPH', 'ENGL', 'THM']) {
      expect(semesterSystemForDepartment(code)).toBe('Tri-Semester');
    }
  });
});

describe('gpaStanding', () => {
  it('maps GPAs to NUB verbal conventions', () => {
    expect(gpaStanding(4.0)).toBe('Excellent');
    expect(gpaStanding(3.75)).toBe('Excellent');
    expect(gpaStanding(3.74)).toBe('Very Good');
    expect(gpaStanding(3.5)).toBe('Very Good');
    expect(gpaStanding(3.49)).toBe('Good');
    expect(gpaStanding(3.0)).toBe('Good');
    expect(gpaStanding(2.99)).toBe('Satisfactory');
    expect(gpaStanding(2.5)).toBe('Satisfactory');
    expect(gpaStanding(2.49)).toBe('Pass');
    expect(gpaStanding(2.0)).toBe('Pass');
    expect(gpaStanding(1.99)).toBe('Retake Advised');
    expect(gpaStanding(0)).toBe('Retake Advised');
  });
});

describe('round2', () => {
  it('rounds to two decimal places', () => {
    expect(round2(3.6789)).toBe(3.68);
    expect(round2(3.674)).toBe(3.67);
    expect(round2(0)).toBe(0);
  });
});
