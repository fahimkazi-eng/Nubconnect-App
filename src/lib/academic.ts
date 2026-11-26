// ============================================================================
// NUBCONNECT — Academic calculation rules (pure, unit-tested)
// Verified NUB 4.00 grading scale. Source: https://nub.ac.bd/academic/aid3rqrn/academic-system
// All calculations are Unofficial Student Estimates.
// ============================================================================

/** NUB verified 4.00 grade scale (grade -> grade point). */
export const NUB_GRADE_MAP: Record<string, number> = {
  'A+': 4.0,
  A: 3.75,
  'A-': 3.5,
  'B+': 3.25,
  B: 3.0,
  'B-': 2.75,
  'C+': 2.5,
  C: 2.25,
  D: 2.0,
  F: 0.0,
};

export interface GpaCourse {
  code: string;
  title: string;
  credits: number;
  grade: string;
}

/** GPA for one semester on the NUB 4.00 scale, weighted by credits. */
export function calculateGpa(courses: GpaCourse[]): number {
  const graded = courses.filter((c) => c.credits > 0 && c.grade in NUB_GRADE_MAP);
  if (graded.length === 0) return 0;
  const totalPoints = graded.reduce(
    (sum, c) => sum + c.credits * (NUB_GRADE_MAP[c.grade] ?? 0),
    0,
  );
  const totalCredits = graded.reduce((sum, c) => sum + c.credits, 0);
  return round2(totalPoints / totalCredits);
}

/** CGPA across multiple semester records. */
export function calculateCgpa(
  semesters: { gpa: number; credits: number }[],
): number {
  const graded = semesters.filter((s) => s.credits > 0);
  if (graded.length === 0) return 0;
  const totalPoints = graded.reduce((sum, s) => sum + s.gpa * s.credits, 0);
  const totalCredits = graded.reduce((sum, s) => sum + s.credits, 0);
  return round2(totalPoints / totalCredits);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Semester system by department. Pharmacy, Law, Civil and Mechanical follow
 * the Bi-Semester calendar; the rest of NUB follows Tri-Semester.
 */
export const BI_SEMESTER_DEPARTMENTS = ['PHARM', 'LAW', 'CE', 'ME'];

export function semesterSystemForDepartment(code: string): 'Bi-Semester' | 'Tri-Semester' {
  return BI_SEMESTER_DEPARTMENTS.includes(code) ? 'Bi-Semester' : 'Tri-Semester';
}

/** GPA verbal standing per NUB conventions (estimates only). */
export function gpaStanding(gpa: number): string {
  if (gpa >= 3.75) return 'Excellent';
  if (gpa >= 3.5) return 'Very Good';
  if (gpa >= 3.0) return 'Good';
  if (gpa >= 2.5) return 'Satisfactory';
  if (gpa >= 2.0) return 'Pass';
  return 'Retake Advised';
}
