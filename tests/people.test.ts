// ============================================================================
// NUBCONNECT — people.ts unit tests
//
// The people directory maps database profiles into the cards the interface
// renders. These tests hold that mapping still: names, departments,
// verification and interests come from the row, and nothing is invented.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { mapProfileToPerson, type PersonProfileRow } from '@/lib/people';

const ROW: PersonProfileRow = {
  id: 'user-1',
  username: 'rakib.cse',
  display_name: 'Rakib Islam',
  avatar_url: 'https://cdn.test/a.jpg',
  cover_url: null,
  bio: 'Photographs around the permanent campus.',
  interests: ['Photography', 'Cycling'],
  is_verified_student: true,
  is_suspended: false,
  department_id: 'dept-cse',
  semester_label: '7th Semester',
  primary_university_id: 'uni-nub',
  departments: { code: 'CSE', name: 'Computer Science & Engineering' },
};

describe('mapProfileToPerson', () => {
  it('maps a profile row into a person card', () => {
    const person = mapProfileToPerson(ROW);
    expect(person.id).toBe('user-1');
    expect(person.name).toBe('Rakib Islam');
    expect(person.username).toBe('rakib.cse');
    expect(person.departmentCode).toBe('CSE');
    expect(person.departmentName).toBe('Computer Science & Engineering');
    expect(person.semester).toBe('7th Semester');
    expect(person.intro).toBe('Photographs around the permanent campus.');
    expect(person.interests).toEqual(['Photography', 'Cycling']);
    expect(person.isVerified).toBe(true);
    expect(person.discoverable).toBe(true);
  });

  it('falls back honestly when the row is thin', () => {
    const person = mapProfileToPerson({
      id: 'user-2',
      username: 'new.student',
      display_name: 'New Student',
    });
    expect(person.departmentCode).toBe('NUB');
    expect(person.departmentName).toBe('Northern University Bangladesh');
    expect(person.semester).toBe('Semester not set');
    expect(person.intro).toBe('');
    expect(person.interests).toEqual([]);
    expect(person.isVerified).toBe(false);
  });

  it('never offers a suspended account', () => {
    const person = mapProfileToPerson({ ...ROW, is_suspended: true });
    expect(person.discoverable).toBe(false);
  });
});
