// ============================================================================
// NUBCONNECT — Verified institutional roster (public, factual).
//
// Departments and clubs below are the Northern University Bangladesh roster as
// published on nub.ac.bd (Student Affairs and academic listings, verified
// 2026-10-31). This is official institutional data used for public browsing —
// NOT demo fixtures. It mirrors supabase/seed/launch_content.sql so the same
// facts render before and after any database connection.
//
// If you change the seed, change this file too.
// ============================================================================

export const ROSTER_SOURCE = {
  label: 'nub.ac.bd — verified 2026-10-31',
  href: 'https://nub.ac.bd/',
} as const;

export interface RosterDepartment {
  code: string;
  name: string;
  semester: 'Tri-Semester' | 'Bi-Semester';
}

export const NUB_DEPARTMENTS: RosterDepartment[] = [
  { code: 'CSE', name: 'Computer Science & Engineering', semester: 'Tri-Semester' },
  { code: 'EEE', name: 'Electrical & Electronic Engineering', semester: 'Tri-Semester' },
  { code: 'TEXTILE', name: 'Textile Engineering', semester: 'Tri-Semester' },
  { code: 'CE', name: 'Civil Engineering', semester: 'Bi-Semester' },
  { code: 'ME', name: 'Mechanical Engineering', semester: 'Bi-Semester' },
  { code: 'BBA', name: 'Business Administration', semester: 'Tri-Semester' },
  { code: 'MBA', name: 'Master of Business Administration', semester: 'Tri-Semester' },
  { code: 'ENGLISH', name: 'English', semester: 'Tri-Semester' },
  { code: 'LAW', name: 'Law', semester: 'Bi-Semester' },
  { code: 'PHARM', name: 'Pharmacy', semester: 'Bi-Semester' },
  { code: 'MPH', name: 'Public Health', semester: 'Tri-Semester' },
  { code: 'CIVIL-TECH', name: 'Civil Technology (Diploma)', semester: 'Tri-Semester' },
  { code: 'BTHM', name: 'Tourism & Hospitality Management', semester: 'Tri-Semester' },
];

export interface RosterClub {
  name: string;
  category: string;
}

export const NUB_CLUBS: RosterClub[] = [
  { name: 'NUB Computer Club (NUBCC)', category: 'Technology' },
  { name: 'NUB SPOTS Club', category: 'Sports' },
  { name: 'NUB Film & Photography Club', category: 'Arts' },
  { name: 'Debate and Public Speaking Club (Central)', category: 'Academic' },
  { name: 'NUB Environment Club', category: 'Volunteering' },
  { name: 'Human Rights Club', category: 'Awareness' },
  { name: 'IT Club', category: 'Technology' },
  { name: 'NUB Business Society', category: 'Business' },
  { name: 'Games and Sports Club', category: 'Sports' },
  { name: 'Literature and Cultural Club', category: 'Arts' },
  { name: 'CSE Club', category: 'Technology' },
  { name: 'NUB Robotics Club', category: 'Technology' },
  { name: 'EEE Club', category: 'Technology' },
  { name: 'Northern Centre for Skill Development (NCSD)', category: 'Skills' },
  { name: 'Textile Innovation Club', category: 'Technology' },
  { name: 'Textile Sports Club', category: 'Sports' },
  { name: 'Textile Welfare Club', category: 'Volunteering' },
  { name: 'NUB Textile Club', category: 'Academic' },
  { name: 'Pharmacy Career Counseling Club', category: 'Career' },
  { name: 'Pharmacy Health Club', category: 'Health' },
  { name: 'Law Mooting & Debating Club', category: 'Academic' },
  { name: 'Law Journalism and Photography Club', category: 'Arts' },
  { name: 'NUB Association of Law and Literature', category: 'Academic' },
  { name: 'Business Entrepreneurship and Leadership Club', category: 'Business' },
  { name: 'NUB Language Club', category: 'Academic' },
  { name: 'NUB Career & Placement Club', category: 'Career' },
  { name: 'NUB Central Social Welfare Club', category: 'Volunteering' },
];
