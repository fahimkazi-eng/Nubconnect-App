// ============================================================================
// NUBCONNECT — Demonstration dataset.
//
// POLICY: When Supabase environment variables are configured, the app reads
// real data through src/lib/supabase. Without credentials it renders this
// clearly-labelled DEMO dataset so the product is fully explorable — every
// demo item carries `isDemo: true` and surfaces a DEMO badge in the UI.
// Institutional records (departments, clubs) preserve the source-tracked
// verified data from the original project (nub.ac.bd, verified 2026-10-31).
// ============================================================================
import type {
  ActivityPlan,
  AppNotification,
  CampusEvent,
  CampusHighlight,
  CampusHonourEntry,
  CampusNowStatus,
  CampusService,
  Circle,
  Club,
  ClubMembershipCard,
  ClubVerification,
  Conversation,
  Department,
  Group,
  Introduction,
  LostFoundItem,
  MarketplaceListing,
  Opportunity,
  Person,
  Post,
  HostelListing,
  HostelPhoto,
  MessListing,
  MessPhoto,
  RoomListing,
  RoommateProfile,
} from '../types';
import { campusNowExpiry, membershipVerifyToken } from '../orbit';
import {
  PROJECT_PHOTO_CAMPUS_1,
  PROJECT_PHOTO_CAMPUS_2,
  campusScene,
  coverScene,
  hostelScene,
  messScene,
  productScene,
  roomScene,
} from '../photos';

export const DEMO_USER = {
  id: 'usr-tasnim',
  name: 'Tasnim Rahman',
  username: 'tasnim.cse',
  role: 'verified_student' as const,
  departmentCode: 'CSE',
  departmentName: 'Computer Science & Engineering',
  semester: '7th Semester (Tri-Semester)',
  allowMessages: 'Consent Requests Only' as const,
  discoverability: 'University Students Only' as const,
  // Person-compatible fields so the demo user renders on profile pages:
  isVerified: true,
  discoverable: false, // you never appear in your own "People You May Know"
  intro: 'CSE thesis-year student. I photograph campus life and organise study circles before finals.',
  interests: ['Machine Learning', 'Campus Photography', 'UI Design'],
  isNewAround: false,
  isDemo: true,
};

/* --- People (fictional demo students; real students are never fabricated) */
export const DEMO_PEOPLE: Person[] = [
  {
    id: 'p-mahmudul', name: 'Mahmudul Hasan', username: 'mahmudul.cse', departmentCode: 'CSE', departmentName: 'Computer Science & Engineering',
    semester: '6th Semester', intro: 'Database enthusiast. Currently building a tiny query planner for fun.',
    interests: ['Databases', 'Cricket', 'Programming'], isVerified: true, discoverable: true, mutualCircles: ['Photography Circle'],
  },
  {
    id: 'p-farhana', name: 'Farhana Akter', username: 'farhana.pharm', departmentCode: 'PHARM', departmentName: 'Pharmacy',
    semester: '4th Year (Bi-Semester)', intro: 'Pharmacy student who lives in the Central Library journal corner.',
    interests: ['Research', 'Medical Chemistry', 'Volunteering'], isVerified: true, discoverable: true, mutualCircles: ['Reading Circle'],
  },
  {
    id: 'p-rakib', name: 'Rakibul Islam', username: 'rakib.cse', departmentCode: 'CSE', departmentName: 'Computer Science & Engineering',
    semester: '7th Semester', intro: 'Capstone team lead — Bengali OCR & document verification.',
    interests: ['AI/ML', 'Open Source', 'Football'], isVerified: true, discoverable: true, mutualCircles: ['Technology Circle', 'Photography Circle'],
  },
  {
    id: 'p-nusrat', name: 'Nusrat Jahan', username: 'nusrat.bba', departmentCode: 'BBA', departmentName: 'Business Administration',
    semester: '5th Semester', intro: 'BBA student organizing the campus entrepreneurship meetup.',
    interests: ['Entrepreneurship', 'Debate', 'Music'], isVerified: true, discoverable: true, mutualCircles: [],
  },
  {
    id: 'p-sabbir', name: 'Sabbir Ahmed', username: 'sabbir.mph', departmentCode: 'MPH', departmentName: 'Public Health',
    semester: '2nd Semester', intro: 'MPH student, HINARI power user. Ask me about Research4Life access.',
    interests: ['Public Health', 'Reading'], isVerified: true, discoverable: true, mutualCircles: ['Reading Circle'],
  },
  {
    id: 'p-tanvir', name: 'Tanvir Hossain', username: 'tanvir.cse', departmentCode: 'CSE', departmentName: 'Computer Science & Engineering',
    semester: '6th Semester', intro: 'Sharing a student flat near the Permanent Campus. Weekend cyclist.',
    interests: ['Cycling', 'Gaming', 'Cooking'], isVerified: true, discoverable: true, mutualCircles: ['Gaming Circle'],
  },
  {
    id: 'p-jannat', name: 'Jannatul Ferdous', username: 'jannat.law', departmentCode: 'LAW', departmentName: 'Law',
    semester: '3rd Year (Bi-Semester)', intro: 'Mooting and debating. Currently drafting a campus legal-aid clinic proposal.',
    interests: ['Mooting', 'Writing', 'Film'], isVerified: true, discoverable: true, mutualCircles: [],
  },
  {
    id: 'p-arif', name: 'Arif Chowdhury', username: 'arif.eee', departmentCode: 'EEE', departmentName: 'Electrical & Electronic Engineering',
    semester: '5th Semester', intro: 'Robotics club member — building a line-follower for the spring showcase.',
    interests: ['Robotics', 'Photography', 'Football'], isVerified: true, discoverable: true, mutualCircles: ['Photography Circle', 'Technology Circle'],
  },
  {
    id: 'p-sumaiya', name: 'Sumaiya Islam', username: 'sumaiya.textile', departmentCode: 'TEXTILE', departmentName: 'Textile Engineering',
    semester: '4th Semester', intro: 'Textile engineering. Handloom nerd. Sells campus tote bags in Marketplace.',
    interests: ['Design', 'Crafts', 'Music'], isVerified: true, discoverable: true, mutualCircles: [],
    isNewAround: true,
  },
  {
    id: 'p-rezaul', name: 'Rezaul Karim', username: 'rezaul.civil', departmentCode: 'CE', departmentName: 'Civil Engineering',
    semester: '2nd Year (Bi-Semester)', intro: 'Civil engineering, loves structural site visits and strong tea.',
    interests: ['Structures', 'Cricket'], isVerified: true, discoverable: true, mutualCircles: [],
    isNewAround: true,
  },
  {
    id: 'p-maliha', name: 'Maliha Noor', username: 'maliha.english', departmentCode: 'ENGLISH', departmentName: 'English',
    semester: '3rd Semester', intro: 'Literature circle regular. Writing a campus zine about Dhaka monsoons.',
    interests: ['Reading', 'Writing', 'Film'], isVerified: false, discoverable: true, mutualCircles: ['Reading Circle', 'Film Circle'],
  },
  {
    id: 'p-shakib', name: 'Shakib Al Hasan', username: 'shakib.bus', departmentCode: 'BBA', departmentName: 'Business Administration',
    semester: '6th Semester', intro: 'Business society volunteer — campus events, sponsorships, logistics.',
    interests: ['Events', 'Entrepreneurship', 'Gaming'], isVerified: true, discoverable: true, mutualCircles: ['Gaming Circle'],
  },
];

/* --- Campus Highlights ----------------------------------------------------
 * Real NUB photography from nub.ac.bd (registry: src/lib/nubAssets.ts),
 * plus the project's own genuine photos. Nothing fabricated. */
export const DEMO_HIGHLIGHTS: CampusHighlight[] = [
  { id: 'h1', title: 'Basanta Utsav 2024', subtitle: 'Spring festival at NUB — from nub.ac.bd', photo: '/assets/nub/basanta-utsav-1.jpg', origin: 'nub.ac.bd', isDemo: false, sourceUrl: 'https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024' },
  { id: 'h2', title: '3rd Convocation 2015', subtitle: 'Convocation ceremony — from nub.ac.bd', photo: '/assets/nub/convocation-2015-1.jpg', origin: 'nub.ac.bd', isDemo: false, sourceUrl: 'https://nub.ac.bd/gallery/picture/lphkszu8/3rd-convocation-2015' },
  { id: 'h3', title: 'Permanent Campus', subtitle: 'Campus view — from nub.ac.bd', photo: '/assets/nub/campus-permanent-1.jpg', origin: 'nub.ac.bd', isDemo: false, sourceUrl: 'https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus' },
  { id: 'h4', title: 'Graduation Dinner (Law)', subtitle: 'From nub.ac.bd', photo: '/assets/nub/graduation-dinner-law.jpg', origin: 'nub.ac.bd', isDemo: false, sourceUrl: 'https://nub.ac.bd/gallery/picture/rnlp7vqn/graduation-dinner' },
  { id: 'h5', title: 'AquaGuard wins WSDG Challenge', subtitle: 'CSE Team celebrated for Champion Title — Official NUB News', photo: PROJECT_PHOTO_CAMPUS_1, origin: 'CSE Department', isDemo: false },
  { id: 'h6', title: 'Central Library study evenings', subtitle: 'Group study area during tri-semester finals', photo: PROJECT_PHOTO_CAMPUS_2, origin: 'Campus Life', isDemo: false },
];

/* --- Posts ---------------------------------------------------------------- */
const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
/** Relative-future helper for expiring content (plans, Campus Now, circles). */
const inMins = (m: number) => new Date(now + m * 60_000).toISOString();
const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString();

export const DEMO_POSTS: Post[] = [
  {
    id: 'post-1',
    authorId: 'club-nubcc', authorName: 'NUB Computer Club (NUBCC)',
    authorRole: 'Recognized Organization • CSE',
    originBadge: 'Club Activity', departmentCode: 'CSE', circleSlug: 'technology',
    scope: 'University', category: 'Club Activity', createdAt: hoursAgo(3),
    body: 'Skill Tracks Week 3 is live! Track 01 Web Engineering (React), Track 02 Database Management (SQL indexing lab), Track 03 Python for Data Analysis. Registration closes Thursday — bring your laptop, we bring the chai.',
    media: [PROJECT_PHOTO_CAMPUS_1],
    audience: 'University',
    reactions: { love: 14, fire: 6, amazing: 4 }, myReaction: 'love', saved: true,
    comments: [
      { id: 'c1', author: 'Mahmudul Hasan', authorRole: 'CSE 6th Semester', text: 'Joined Track 02 last week — the SQL indexing lab was super clear!', createdAt: hoursAgo(2), reactions: { support: 3 }, myReaction: null },
    ],
    isDemo: true, sourceUrl: 'https://www.nubcc.club/',
  },
  {
    id: 'post-2',
    authorId: 'sys-academic', authorName: 'NUB Academic Regulations',
    authorRole: 'Official Source Sync • nub.ac.bd',
    originBadge: 'Official University Info',
    scope: 'University', category: 'Official Notice', createdAt: hoursAgo(5),
    body: 'Reminder from NUB Academic Regulations: Course withdrawal with a 50% tuition fee refund requires submitting an application to the Head of Department through your Course Teacher within the first week of classes after mid-term examinations. After that window, 100% of semester charges apply.',
    media: [], audience: 'University',
    reactions: { respect: 22, support: 7 }, myReaction: null, saved: true,
    comments: [], isDemo: false,
    sourceUrl: 'https://nub.ac.bd/academic/w5rkklgr/academic-regulations',
  },
  {
    id: 'post-3',
    authorId: 'p-farhana', authorName: 'Farhana Akter',
    authorRole: 'Verified Student • B.Pharm (Bi-Semester)',
    originBadge: 'Student Community Post', departmentCode: 'PHARM', circleSlug: 'reading',
    scope: 'University', category: 'Question', createdAt: hoursAgo(22),
    body: 'Any Pharmacy or Public Health students using Research4Life (HINARI) in the Central Library Group Study Area tomorrow afternoon? Looking for 2 study partners to review medicinal chemistry & pharmacology papers together.',
    media: [], audience: 'University',
    reactions: { support: 9, inspired: 4 }, myReaction: null, saved: false,
    comments: [
      { id: 'c2', author: 'Sabbir Ahmed', authorRole: 'MPH', text: 'I will be at the Library Journal Corner around 2 PM! Let\'s review the HINARI access workflow.', createdAt: hoursAgo(20), reactions: { support: 2, love: 1 }, myReaction: null },
    ],
    isDemo: true,
  },
  {
    id: 'post-4',
    authorId: 'p-rakib', authorName: 'Rakibul Islam',
    authorRole: 'Verified Student • CSE 7th Semester',
    originBadge: 'Student Community Post', departmentCode: 'CSE', circleSlug: 'technology',
    scope: 'My Department', category: 'Project', createdAt: hoursAgo(48),
    body: 'Forming a 3-member capstone team in CSE focusing on Bengali OCR & document verification. We meet every Wednesday after DBMS lab at the Permanent Campus. Drop a comment or send a message request if interested!',
    media: [], audience: 'My Department',
    reactions: { fire: 12, inspired: 4 }, myReaction: 'inspired', saved: false,
    comments: [], isDemo: true,
  },
  {
    id: 'post-5',
    authorId: 'p-arif', authorName: 'Arif Chowdhury',
    authorRole: 'Verified Student • EEE 5th Semester',
    originBadge: 'Student Community Post', departmentCode: 'EEE', circleSlug: 'photography',
    scope: 'My Circles', category: 'Campus Photo', createdAt: hoursAgo(30),
    body: 'Golden hour on the rooftop lab wing. Three frames from yesterday\'s robotics test runs — the line-follower survived the whole track this time!',
    media: [campusScene('post5a', 1200, 800), campusScene('post5b', 1200, 800), campusScene('post5c', 1200, 800)],
    audience: 'My Circles',
    reactions: { love: 12, amazing: 9, fire: 3 }, myReaction: 'love', saved: true,
    comments: [], isDemo: true,
  },
  {
    id: 'post-6',
    authorId: 'club-debate', authorName: 'Debate and Public Speaking Club (Central)',
    authorRole: 'Recognized Organization • Central',
    originBadge: 'Club Activity', circleSlug: 'reading',
    scope: 'University', category: 'Club Activity', createdAt: hoursAgo(8),
    body: 'Inter-department debate finale this Friday, 3 PM, Central Auditorium. Motion: "Bangladesh\'s gig economy helps students more than it harms them." Audience seats are first-come — come support your department team!',
    media: [campusScene('post6a', 1200, 800), campusScene('post6b', 1200, 800)],
    audience: 'University',
    reactions: { respect: 15, fire: 8 }, myReaction: null, saved: false,
    comments: [], isDemo: true,
  },
  {
    id: 'post-7',
    authorId: 'p-maliha', authorName: 'Maliha Noor',
    authorRole: 'Verified Student • English 3rd Semester',
    originBadge: 'Student Community Post', departmentCode: 'ENGLISH', circleSlug: 'film',
    scope: 'University', category: 'Student Discussion', createdAt: hoursAgo(12),
    body: 'Film Circle Friday screening: a double bill of Tareque Masud classics in Room 305. Bringing homemade jhalmuri. All departments welcome — DM for the reading list.',
    media: [], audience: 'University',
    reactions: { love: 8, inspired: 3 }, myReaction: null, saved: false,
    comments: [], isDemo: true,
  },
  {
    id: 'post-8',
    authorId: 'p-nusrat', authorName: 'Nusrat Jahan',
    authorRole: 'Verified Student • BBA 5th Semester',
    originBadge: 'Student Community Post', departmentCode: 'BBA', circleSlug: 'entrepreneurship',
    scope: 'University', category: 'Achievement', createdAt: hoursAgo(55),
    body: 'Entrepreneurship Meetup #4 recap + photos. 42 students, 6 pitch teams, and the winning idea was a campus laundry marketplace. Slide deck and contacts in the Entrepreneurship Circle resources tab.',
    media: [campusScene('post8a', 1200, 800), campusScene('post8b', 1200, 800), campusScene('post8c', 1200, 800), campusScene('post8d', 1200, 800)],
    audience: 'University',
    reactions: { fire: 18, amazing: 9, proud: 8 }, myReaction: null, saved: false,
    comments: [], isDemo: true,
  },
  {
    id: 'post-9',
    authorId: 'p-sumaiya', authorName: 'Sumaiya Islam',
    authorRole: 'Verified Student • Textile 4th Semester',
    originBadge: 'Student Community Post', departmentCode: 'TEXTILE', circleSlug: 'crafts',
    scope: 'University', category: 'Campus Photo', createdAt: hoursAgo(16),
    body: 'Finished the new batch of handloom tote bags! Cotton warp, natural dyes. Listing a few in the Marketplace this week if anyone wants one before the exhibition.',
    media: [productScene('post9a', 'Accessories', 1200, 800), productScene('post9b', 'Accessories', 1200, 800)],
    audience: 'University',
    reactions: { love: 14, inspired: 7 }, myReaction: null, saved: true,
    comments: [], isDemo: true,
  },
  {
    id: 'post-10',
    authorId: 'club-env', authorName: 'NUB Environment Club',
    authorRole: 'Recognized Organization • University-Wide',
    originBadge: 'Club Activity', circleSlug: 'volunteering',
    scope: 'University', category: 'Club Activity', createdAt: hoursAgo(75),
    body: 'Campus clean-up drive Saturday morning. Meet at the main gate 8 AM — gloves and bags provided, chai guaranteed. Volunteers get an Environment Club activity credit for the semester.',
    media: [], audience: 'University',
    reactions: { support: 20, respect: 12 }, myReaction: 'support', saved: false,
    comments: [], isDemo: true,
  },
];

/* --- Departments (verified institutional data, nub.ac.bd) ---------------- */
export const DEMO_DEPARTMENTS: Department[] = [
  { code: 'CSE', name: 'Computer Science & Engineering', faculty: 'Faculty of Science & Engineering', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Officially Verified', description: 'Fosters skilled computing professionals through software engineering, algorithms, AI, database systems, cybersecurity, and hands-on capstone research.', programs: ['B.Sc. in Computer Science & Engineering (Regular Day Program)', 'B.Sc. in Computer Science & Engineering (Evening / Diploma Holders Package)'], cohorts: ['CSE Spring Batch Cohort', 'CSE Summer Batch Cohort', 'CSE Fall Batch Cohort', 'CSE Diploma Evening Track'], officialContact: 'Permanent Campus, Ashiyan City Road / Ashkona, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://cse.nub.ac.bd/', isDemo: false },
  { code: 'EEE', name: 'Electrical & Electronic Engineering', faculty: 'Faculty of Science & Engineering', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Officially Verified', description: 'Undergraduate engineering education in power systems, electronics, telecommunications, embedded control systems, and renewable energy laboratories.', programs: ['B.Sc. in Electrical & Electronic Engineering (Regular & Diploma Track)'], cohorts: ['EEE Power & Electronics Cohort', 'EEE Diploma Holders Cohort'], officialContact: 'Permanent Campus, Ashkona, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'TEXTILE', name: 'Textile Engineering', faculty: 'Faculty of Science & Engineering', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Officially Verified', description: 'Textile technology, wet processing, apparel engineering, and sustainable fibre innovation with dedicated labs.', programs: ['B.Sc. in Textile Engineering'], cohorts: ['Textile Yarn Batch Cohort', 'Textile Apparel Batch Cohort'], officialContact: 'Permanent Campus, Ashkona, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://textile.nub.ac.bd/', isDemo: false },
  { code: 'CE', name: 'Civil Engineering', faculty: 'Faculty of Science & Engineering', semesterSystem: 'Bi-Semester', verificationStatus: 'Officially Verified', description: 'Structural, geotechnical, transportation, and environmental engineering with field-based project learning.', programs: ['B.Sc. in Civil Engineering'], cohorts: ['CE Structures Cohort', 'CE Environment Cohort'], officialContact: 'Permanent Campus, Ashkona, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'ME', name: 'Mechanical Engineering', faculty: 'Faculty of Science & Engineering', semesterSystem: 'Bi-Semester', verificationStatus: 'Officially Verified', description: 'Thermodynamics, fluid mechanics, manufacturing processes, and mechatronics design studios.', programs: ['B.Sc. in Mechanical Engineering'], cohorts: ['ME Thermal Cohort', 'ME Design Cohort'], officialContact: 'Permanent Campus, Ashkona, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'BBA', name: 'Business Administration', faculty: 'Faculty of Business', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Officially Verified', description: 'Management, marketing, finance, and entrepreneurship education with case-based teaching.', programs: ['Bachelor of Business Administration (BBA)'], cohorts: ['BBA Finance Cohort', 'BBA Marketing Cohort'], officialContact: 'Permanent Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'MBA', name: 'Master of Business Administration', faculty: 'Faculty of Business', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Officially Verified', description: 'Graduate business education for working professionals with evening and weekend tracks.', programs: ['MBA (Regular)', 'MBA (Executive Track)'], cohorts: ['MBA Evening Cohort'], officialContact: 'Permanent Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'ENGLISH', name: 'English', faculty: 'Faculty of Humanities & Social Science', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Officially Verified', description: 'Literature, linguistics, and applied communication studies with a writing-centre culture.', programs: ['BA (Hons.) in English', 'MA in English'], cohorts: ['English Literature Cohort'], officialContact: 'Permanent Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'LAW', name: 'Law', faculty: 'Faculty of Law', semesterSystem: 'Bi-Semester', verificationStatus: 'Officially Verified', description: 'LL.B (Hons.) with mooting chambers, legal aid clinics, and jurisprudence seminars.', programs: ['LL.B (Hons.)', 'LL.M'], cohorts: ['Law Mooting Cohort', 'Law Bar-prep Cohort'], officialContact: 'Permanent Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'PHARM', name: 'Pharmacy', faculty: 'Faculty of Health Science', semesterSystem: 'Bi-Semester', verificationStatus: 'Officially Verified', description: 'B.Pharm with medicinal chemistry, pharmacology labs, and hospital-attachment rotations.', programs: ['B.Pharm (Hons.)'], cohorts: ['Pharm Industrial Cohort', 'Pharm Clinical Cohort'], officialContact: 'Permanent Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'MPH', name: 'Public Health', faculty: 'Faculty of Health Science', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Officially Verified', description: 'MPH with epidemiology, biostatistics, and field research in community health.', programs: ['Master of Public Health (MPH)'], cohorts: ['MPH Epidemiology Cohort'], officialContact: 'Permanent Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'CIVIL-TECH', name: 'Civil Technology (Diploma)', faculty: 'Faculty of Science & Engineering', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Department Verified', description: 'Diploma track in civil technology for technician-level engineering careers.', programs: ['Diploma in Civil Technology'], cohorts: ['Diploma Evening Track'], officialContact: 'Ashkona Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
  { code: 'BTHM', name: 'Tourism & Hospitality Management', faculty: 'Faculty of Business', semesterSystem: 'Tri-Semester (16 Weeks)', verificationStatus: 'Department Verified', description: 'Hospitality operations, tourism economics, and event management studies.', programs: ['BSc. in Tourism & Hospitality Management'], cohorts: ['THM Cohort'], officialContact: 'Permanent Campus, Dhaka-1230 • info@nub.ac.bd', sourceUrl: 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', isDemo: false },
];

export const DEMO_FACULTIES = [
  'Faculty of Science & Engineering',
  'Faculty of Business',
  'Faculty of Humanities & Social Science',
  'Faculty of Law',
  'Faculty of Health Science',
];

/* --- Clubs (verified NUB roster with duplicate reconciliation preserved) -- */
type ClubSeed = [string, string, string, Club['scope'], Club['verificationStatus'], string, number];
const CLUB_SEEDS: ClubSeed[] = [
  ['nubcc', 'NUB Computer Club (NUBCC)', 'Technology', 'Departmental', 'Officially Verified', 'Skill-track workshops, programming contests, and the largest CSE student community on campus.', 412],
  ['nub-spots', 'NUB SPOTS Club', 'Sports', 'University-Wide', 'Awaiting Verification', 'Student-reported sports community pending Student Affairs sign-off.', 86],
  ['film-photo', 'NUB Film & Photography Club', 'Arts', 'University-Wide', 'Recognized Organization', 'Photowalks, screening nights, and the annual campus photo exhibition.', 233],
  ['debate-central', 'Debate and Public Speaking Club (Central)', 'Academic', 'Central', 'Officially Verified', 'Inter-department debates, mooting support, and public speaking bootcamps.', 301],
  ['environment', 'NUB Environment Club (University-Wide)', 'Volunteering', 'University-Wide', 'Officially Verified', 'Clean-up drives, tree plantations, and campus sustainability campaigns.', 198],
  ['human-rights', 'Human Rights Club', 'Awareness', 'University-Wide', 'Recognized Organization', 'Awareness campaigns and legal literacy sessions with the Law department.', 121],
  ['it-club', 'IT Club (Student Affairs Reference)', 'Technology', 'University-Wide', 'Recognized Organization', 'Practical IT skill sessions referenced from the Student Affairs 16-club roster.', 143],
  ['business-society', 'NUB Business Society', 'Business', 'University-Wide', 'Officially Verified', 'Case competitions, startup meetups, and corporate networking nights.', 276],
  ['games-sports', 'Games and Sports Club (University-Wide)', 'Sports', 'University-Wide', 'Officially Verified', 'Football, cricket, and indoor tournaments across all departments.', 355],
  ['lit-cultural', 'Literature and Cultural Club', 'Arts', 'Central', 'Officially Verified', 'Poetry evenings, drama productions, and Pohela Boishakh celebrations.', 240],
  ['cse-club', 'CSE Club (Departmental Reference)', 'Technology', 'Departmental', 'Department Verified', 'Departmental CSE community — study support and junior mentoring.', 187],
  ['robotics', 'NUB Robotics Club', 'Technology', 'University-Wide', 'Recognized Organization', 'Line-followers, robo-soccer, and the spring showcase.', 154],
  ['eee-club', 'EEE Club', 'Technology', 'Departmental', 'Department Verified', 'EEE departmental community — project labs and industry visits.', 132],
  ['ncsd', 'Northern Centre for Skill Development (NCSD)', 'Skills', 'Central', 'Officially Verified', 'University-led skill development programs and certification tracks.', 320],
  ['textile-innovation', 'Textile Innovation Club', 'Technology', 'Departmental', 'Department Verified', 'Fibre innovation challenges and handloom revival projects.', 98],
  ['textile-sports', 'Textile Sports Club', 'Sports', 'Departmental', 'Department Verified', 'Textile department tournaments and friendly leagues.', 67],
  ['textile-welfare', 'Textile Welfare Club', 'Volunteering', 'Departmental', 'Department Verified', 'Peer support and welfare activities for Textile students.', 54],
  ['nub-textile', 'NUB Textile Club', 'Academic', 'Departmental', 'Recognized Organization', 'General textile departmental community and alumni connections.', 89],
  ['pharm-career', 'Pharmacy Career Counseling Club', 'Career', 'Departmental', 'Department Verified', 'PharmD career paths, industrial attachments, and licensing guidance.', 116],
  ['pharm-health', 'Pharmacy Health Club (Cultural / Debate / Photo / Sports Wings)', 'Health', 'Departmental', 'Department Verified', 'Health awareness camps with cultural, debate, photo and sports wings.', 102],
  ['law-mooting', 'Law Mooting & Debating Club', 'Academic', 'Departmental', 'Officially Verified', 'Moot court chambers, drafting workshops, and national competitions.', 138],
  ['law-journalism', 'Law Journalism and Photography Club', 'Arts', 'Departmental', 'Recognized Organization', 'Campus legal journalism and documentary photography.', 61],
  ['law-literature', 'NUB Association of Law and Literature', 'Academic', 'Departmental', 'Recognized Organization', 'Where jurisprudence meets literature — reading circles and symposia.', 48],
  ['business-entrepreneurship', 'Business Entrepreneurship and Leadership Club', 'Business', 'University-Wide', 'Recognized Organization', 'Pitch nights, mentor matching, and the campus startup directory.', 176],
  ['language', 'NUB Language Club', 'Academic', 'University-Wide', 'Officially Verified', 'English, Bangla, and international language practice circles.', 205],
  ['career-placement', 'NUB Career & Placement Club', 'Career', 'Central', 'Officially Verified', 'CV clinics, mock interviews, and the annual career fair.', 289],
  ['social-welfare', 'NUB Central Social Welfare Club', 'Volunteering', 'Central', 'Officially Verified', 'Blood donation drives, winter campaigns, and community aid.', 312],
];

/* --- Club Universe depth (§7) ---------------------------------------------- */
/** Legacy roster statuses mapped onto the Campus Orbit 7-level taxonomy.
 *  Legacy 'Recognized Organization' entries come from the Student Affairs
 *  referenced roster — closest orbit level: Club Verified. University-level
 *  'Officially Verified' stays university-level, by definition. */
const LEGACY_TO_ORBIT_VERIFICATION: Record<string, ClubVerification> = {
  'Officially Verified': 'Officially Verified',
  'Department Verified': 'Department Recognized',
  'Recognized Organization': 'Club Verified',
  'Awaiting Verification': 'Awaiting Verification',
  'Student-Led': 'Student-Led',
};

/**
 * Rich depth for featured clubs. Committee rosters/achievements/galleries are
 * DEMO content layered on the real nub.ac.bd club roster (slugs/names/statuses
 * remain source-tracked); the UI labels these sections DEMO.
 */
const CLUB_UNIVERSE_EXTRAS: Record<string, Partial<Club>> = {
  nubcc: {
    aliases: ['NUB Computer Club', 'NCC', 'CSE Computer Club (early name)'],
    sourceNote: 'Student Affairs roster + club sources (nub.ac.bd, verified 2026-10-31). Committee, achievements and gallery below are DEMO.',
    committee: [
      { personId: 'usr-tasnim', name: 'Tasnim Rahman', role: 'President', since: 'Spring 2026', note: 'Skill Tracks program lead' },
      { personId: 'p-rakib', name: 'Rakibul Islam', role: 'Vice President', since: 'Spring 2026' },
      { personId: 'p-mahmudul', name: 'Mahmudul Hasan', role: 'General Secretary', since: 'Spring 2026' },
      { personId: 'p-tanvir', name: 'Tanvir Hossain', role: 'Treasurer', since: 'Summer 2026' },
      { personId: 'p-arif', name: 'Arif Chowdhury', role: 'Event Coordinator', since: 'Summer 2026' },
    ],
    committeeHistory: [
      { personId: 'p-shakib', name: 'Shakib Al Hasan', role: 'Vice President', since: 'Fall 2025', note: 'Succeeded by Rakibul Islam in Spring 2026' },
      { personId: 'p-rakib', name: 'Rakibul Islam', role: 'General Secretary', since: 'Fall 2025', note: 'Promoted to Vice President in Spring 2026' },
    ],
    achievements: [
      { year: '2026', title: 'Skill Tracks — semester skill program', detail: 'Six weekly tracks with 180+ participating students across departments.' },
      { year: '2026', title: 'NUB Inter-University Programming Contest host', detail: 'Hosted 14 teams from 5 universities in the CSE labs.' },
      { year: '2025', title: 'National Collegiate Programming Contest — 4th place', detail: 'Team “AquaGuard” placed 4th nationally.' },
    ],
    gallery: [
      campusScene('club-nubcc-1', 1200, 800),
      campusScene('club-nubcc-2', 1200, 800),
      campusScene('club-nubcc-3', 1200, 800),
    ],
    presidentId: 'usr-tasnim',
  },
  'film-photo': {
    aliases: ['NUB Film Club', 'NUB Photography Club (merged)'],
    sourceNote: 'Club sources (merged roster). Committee and gallery below are DEMO.',
    committee: [
      { personId: 'p-maliha', name: 'Maliha Noor', role: 'President', since: 'Summer 2026' },
      { personId: 'p-arif', name: 'Arif Chowdhury', role: 'Photography Secretary', since: 'Summer 2026' },
    ],
    achievements: [
      { year: '2026', title: 'Annual campus photo exhibition', detail: '120 prints from 9 departments in the central corridor.' },
    ],
    gallery: [
      campusScene('club-film-1', 1200, 800),
      campusScene('club-film-2', 1200, 800),
    ],
    presidentId: 'p-maliha',
  },
  'debate-central': {
    aliases: ['Central Debate Club', 'NUB Debate and Public Speaking Club'],
    committee: [
      { personId: 'p-jannat', name: 'Jannatul Ferdous', role: 'President', since: 'Spring 2026' },
      { personId: 'p-nusrat', name: 'Nusrat Jahan', role: 'Vice President', since: 'Spring 2026' },
    ],
    achievements: [
      { year: '2026', title: 'Inter-department debate league', detail: 'Nine department teams across three rounds.' },
    ],
    presidentId: 'p-jannat',
  },
  environment: {
    aliases: ['NUB Eco Club'],
    committee: [
      { personId: 'p-sabbir', name: 'Sabbir Ahmed', role: 'President', since: 'Summer 2026' },
    ],
    achievements: [
      { year: '2026', title: 'Zero-waste canteen pilot', detail: 'Segregation bins and a 40% waste-diversion rate.' },
    ],
    presidentId: 'p-sabbir',
  },
  'business-entrepreneurship': {
    aliases: ['BELC'],
    committee: [
      { personId: 'p-shakib', name: 'Shakib Al Hasan', role: 'Vice President', since: 'Spring 2026' },
    ],
    achievements: [
      { year: '2026', title: 'Campus startup directory launch', detail: '24 student ventures catalogued with mentor matching.' },
    ],
    presidentId: 'p-shakib',
  },
  'games-sports': {
    aliases: ['GSC'],
    committee: [
      { personId: 'p-rezaul', name: 'Rezaul Karim', role: 'Sports Secretary', since: 'Summer 2026' },
    ],
  },
  robotics: {
    aliases: ['NUBRC'],
    committee: [
      { personId: 'p-arif', name: 'Arif Chowdhury', role: 'General Secretary', since: 'Summer 2026' },
    ],
    achievements: [
      { year: '2026', title: 'Spring showcase line-follower podium', detail: 'Three podium finishes across categories.' },
    ],
    presidentId: 'p-arif',
  },
};

export const DEMO_CLUBS: Club[] = CLUB_SEEDS.map(
  ([slug, name, category, scope, verificationStatus, about, memberCount]) => ({
    slug, name, category, scope, verificationStatus, about, memberCount, isDemo: false,
    activity: 'Active' as const,
    verification: LEGACY_TO_ORBIT_VERIFICATION[verificationStatus] ?? 'Student-Led',
    ...CLUB_UNIVERSE_EXTRAS[slug],
  }),
);

/* --- Circles (interest-based communities) --------------------------------- */
export const DEMO_CIRCLES: Circle[] = [
  { slug: 'photography', name: 'Photography Circle', category: 'Arts', description: 'Campus photowalks every Friday and a shared darkroom of ideas. Phone cameras welcome.', memberCount: 214, rules: ['Photos only — no video', 'Credit your own work', 'Ask before posting people'], isDemo: true },
  { slug: 'technology', name: 'Technology Circle', category: 'Technology', description: 'From React labs to robotics teardowns. Bring a project, find a teammate.', memberCount: 326, rules: ['Be kind to beginners', 'No spam recruiting'], isDemo: true },
  { slug: 'gaming', name: 'Gaming Circle', category: 'Games', description: 'Mobile and PC gamers united. Weekend LAN meets and tournament brackets.', memberCount: 189, rules: ['Good manners in every lobby', 'No cheating talk'], isDemo: true },
  { slug: 'sports', name: 'Sports Circle', category: 'Sports', description: 'Football at the permanent campus field, cricket in the courtyard, table tennis indoors.', memberCount: 267, rules: ['Respect all skill levels', 'Report injuries'], isDemo: true },
  { slug: 'music', name: 'Music Circle', category: 'Music', description: 'Campus jam sessions, choir evenings, and a monthly open-mic in the auditorium foyer.', memberCount: 156, rules: ['Originals and covers both welcome'], isDemo: true },
  { slug: 'film', name: 'Film Circle', category: 'Film', description: 'Weekly double bills with a Bangladeshi classic and an international pick.', memberCount: 98, rules: ['No spoilers in the first thread', 'Photos of events only'], isDemo: true },
  { slug: 'reading', name: 'Reading Circle', category: 'Books', description: 'Monthly book picks, HINARI paper swaps, and the campus zine editorial board.', memberCount: 143, rules: ['Recommend, never spoil'], isDemo: true },
  { slug: 'entrepreneurship', name: 'Entrepreneurship Circle', category: 'Business', description: 'Idea validation nights, pitch practice, and the student startup directory.', memberCount: 231, rules: ['Constructive feedback only', 'No MLM pitches'], isDemo: true },
  { slug: 'volunteering', name: 'Volunteering Circle', category: 'Community', description: 'Clean-up drives, blood donation campaigns, and winter clothing collections.', memberCount: 178, rules: ['Show up when you sign up'], isDemo: true },
  { slug: 'crafts', name: 'Crafts Circle', category: 'Arts', description: 'Handloom, illustration, and DIY stationery. Home of the campus tote bag.', memberCount: 74, rules: ['Share techniques freely'], isDemo: true },
  /* Temporary Circles (§6.4): fade out when they expire; members can keep
     them alive by making them permanent. */
  { slug: 'thesis-sprint', name: 'Thesis Sprint Circle', category: 'Academics', description: 'Thesis-year students doing two-week writing sprints. Fades out when the sprint ends — make it permanent if it becomes a standing crew.', memberCount: 9, rules: ['Share drafts, not dread', 'Weekly check-in'], isDemo: true, temporary: true, expiresAt: inDays(4) },
  { slug: 'fest-committee', name: 'Fall Fest 2026 Committee', category: 'Events', description: 'Temporary coordination circle for the fall festival — stage, logistics, and volunteer rosters.', memberCount: 22, rules: ['Decisions in threads, not DMs'], isDemo: true, temporary: true, expiresAt: inDays(19) },
  { slug: 'cox-trip', name: 'Cox’s Bazar Trip Circle', category: 'Travel', description: 'A trip circle for the winter break beach plan — itinerary, budget splits, and packing lists.', memberCount: 11, rules: ['No seat swapping drama'], isDemo: true, temporary: true, expiresAt: inDays(26) },
];

/* --- Groups ---------------------------------------------------------------- */
export const DEMO_GROUPS: Group[] = [
  { slug: 'grp-dbms', name: 'DBMS Lab Group — Section A', type: 'Course', description: 'CSE 7th semester DBMS lab coordination: schedules, lab sheets, and submission deadlines.', memberCount: 38, joined: true, isDemo: true },
  { slug: 'grp-ai-study', name: 'AI/ML Study Group', type: 'Study', description: 'Reading papers and reimplementing them. Meets Wednesdays after DBMS lab.', memberCount: 22, joined: false, isDemo: true },
  { slug: 'grp-ocr', name: 'Bengali OCR Capstone Team', type: 'Project', description: 'Three-member capstone team for Bengali OCR & document verification.', memberCount: 3, joined: false, isDemo: true },
  { slug: 'grp-hinari', name: 'HINARI Research Buddies', type: 'Interest', description: 'Pharmacy & MPH students sharing Research4Life workflows and paper reading lists.', memberCount: 17, joined: true, isDemo: true },
  { slug: 'grp-orientation', name: 'Fall Orientation Volunteers', type: 'Event', description: 'Volunteer coordination for the Fall tri-semester orientation week.', memberCount: 45, joined: false, isDemo: true },
  { slug: 'grp-cse-2022', name: 'CSE Spring 2022 Batch', type: 'Department', description: 'The whole Spring 2022 CSE cohort — announcements, lost items, and cohort meets.', memberCount: 118, joined: true, isDemo: true },
];

/* --- Rooms ------------------------------------------------------------------ */
const room = (seed: string, kind: 'Bedroom' | 'Kitchen' | 'Bathroom' | 'Living Area', caption: string) => ({
  uri: roomScene(seed, kind), room: kind, caption,
});

export const DEMO_ROOMS: RoomListing[] = [
  {
    id: 'rm-1', title: '1 Seat Available in 3-Bedroom Student Flat', area: 'Ashkona (Near Hajj Camp)',
    rent: 4200, advance: 8400, roomType: 'Shared Room', furnished: 'Semi-Furnished', shared: true,
    available: true, availableFrom: 'Nov 15, 2026',
    description: 'One seat opened up in our 3-bedroom student flat — five minutes from the Permanent Campus gate. Flat-mates are all final-year students, quiet during exams, friendly otherwise.',
    amenities: ['Wi-Fi', 'Attached Bathroom', 'Water 24/7', 'Kitchen Access', 'Desk & Chair'],
    utilities: 'Electricity shared by meter; gas & service included',
    houseRules: 'No smoking indoors • Guests until 9 PM • Quiet hours 11 PM–7 AM',
    ownerName: 'Tanvir Hossain', ownerDepartment: 'CSE 6th Semester', ownerId: 'p-tanvir',
    photos: [
      room('rm1-bed', 'Bedroom', 'The available single bed with study desk'),
      room('rm1-kitchen', 'Kitchen', 'Shared two-burner kitchen'),
      room('rm1-bath', 'Bathroom', 'Attached bathroom, 24/7 water'),
      room('rm1-living', 'Living Area', 'Small dining corner'),
    ],
    saved: false, isDemo: true,
  },
  {
    id: 'rm-2', title: 'Single Room, 5 Minutes Walk from Permanent Campus', area: 'Ashiyan City Road',
    rent: 5500, advance: 11000, roomType: 'Single Room', furnished: 'Fully Furnished', shared: false,
    available: true, availableFrom: 'Dec 1, 2026',
    description: 'Independent single room with its own reading table and balcony access. Best for someone who wants privacy without hostel restrictions.',
    amenities: ['Wi-Fi', 'Attached Bathroom', 'Balcony', 'AC Ready', 'Reading Table'],
    utilities: 'Electricity by meter; water bill included',
    houseRules: 'Students only • No subletting',
    ownerName: 'Farhana Akter', ownerDepartment: 'B.Pharm', ownerId: 'p-farhana',
    photos: [
      room('rm2-bed', 'Bedroom', 'Single bed with new mattress'),
      room('rm2-bath', 'Bathroom', 'Clean attached bathroom'),
      room('rm2-living', 'Living Area', 'Shared corridor balcony'),
    ],
    saved: true, isDemo: true,
  },
  {
    id: 'rm-3', title: 'Shared Twin Room in Girls\' Flat (Vegetarian Preferred)', area: 'Dakshinkhan',
    rent: 3500, advance: 7000, roomType: 'Shared Room', furnished: 'Semi-Furnished', shared: true,
    available: true, availableFrom: 'Nov 20, 2026',
    description: 'Twin room in a girls-only flat with a divider curtain between beds. The kitchen is strictly vegetarian, and the entrance has CCTV.',
    amenities: ['Wi-Fi', 'Kitchen Access', 'Washing Machine', 'CCTV Entrance'],
    utilities: 'All utilities shared equally among 4',
    houseRules: 'Girls only • Vegetarian kitchen • Guardian visit allowed',
    ownerName: 'Nusrat Jahan', ownerDepartment: 'BBA 5th Semester', ownerId: 'p-nusrat',
    photos: [
      room('rm3-bed', 'Bedroom', 'Twin beds with divider curtain'),
      room('rm3-kitchen', 'Kitchen', 'Clean shared kitchen'),
      room('rm3-bath', 'Bathroom', 'Geyser available in winter'),
    ],
    saved: false, isDemo: true,
  },
  {
    id: 'rm-4', title: 'Studio Flat Near Main Gate — Independent Entry', area: 'Kawlar',
    rent: 7500, advance: 22500, roomType: 'Studio', furnished: 'Fully Furnished', shared: false,
    available: false, availableFrom: 'Jan 10, 2027',
    description: 'Compact studio flat with independent entry — ideal for a thesis-year student who needs their own schedule. Currently reserved; join the waitlist for January.',
    amenities: ['Wi-Fi', 'Private Bathroom', 'Kitchenette', 'Balcony', 'Parking'],
    utilities: 'Independent meter; internet included in rent',
    houseRules: 'Registered tenants only',
    ownerName: 'Shakib Al Hasan', ownerDepartment: 'BBA 6th Semester', ownerId: 'p-shakib',
    photos: [
      room('rm4-living', 'Living Area', 'Studio main space with work corner'),
      room('rm4-bed', 'Bedroom', 'Sleeping corner, partitioned'),
      room('rm4-kitchen', 'Kitchen', 'Compact kitchenette'),
      room('rm4-bath', 'Bathroom', 'Private attached bathroom'),
    ],
    saved: false, isDemo: true,
  },
  {
    id: 'rm-5', title: '2-Bed Flat Share — Seat in Master Bedroom', area: 'Ashkona',
    rent: 4800, advance: 9600, roomType: 'Shared Room', furnished: 'Semi-Furnished', shared: true,
    available: true, availableFrom: 'Immediately',
    description: 'A seat in the master bedroom of a 2-bed flat with lift and generator backup. Window side of the room, shared wardrobe.',
    amenities: ['Wi-Fi', 'Lift', 'Generator Backup', 'Kitchen Access'],
    utilities: 'Service charge included; electricity by meter',
    houseRules: 'No pets • Rent due by the 5th',
    ownerName: 'Arif Chowdhury', ownerDepartment: 'EEE 5th Semester', ownerId: 'p-arif',
    photos: [
      room('rm5-bed', 'Bedroom', 'Master bedroom, seat by the window'),
      room('rm5-living', 'Living Area', 'Shared living room'),
      room('rm5-kitchen', 'Kitchen', 'Gas stove kitchen'),
      room('rm5-bath', 'Bathroom', 'Common bathroom with geyser'),
    ],
    saved: false, isDemo: true,
  },
  {
    id: 'rm-6', title: 'Unfurnished Single Room, Budget Friendly', area: 'Nikunja 2',
    rent: 2800, advance: 5600, roomType: 'Single Room', furnished: 'Unfurnished', shared: false,
    available: true, availableFrom: 'Nov 25, 2026',
    description: 'Freshly painted unfurnished single room at a friendly price — bring your own bed and table. Round-the-clock water supply, which is rare at this budget.',
    amenities: ['Water 24/7', 'Kitchen Access'],
    utilities: 'Electricity by sub-meter',
    houseRules: 'Ideal for final-year students who want quiet',
    ownerName: 'Rezaul Karim', ownerDepartment: 'Civil 2nd Year', ownerId: 'p-rezaul',
    photos: [
      room('rm6-bed', 'Bedroom', 'Empty single room, fresh paint'),
      room('rm6-bath', 'Bathroom', 'Shared bathroom, two doors down'),
    ],
    saved: false, isDemo: true,
  },
];

/* --- Roommate profiles ------------------------------------------------------ */
export const DEMO_ROOMMATES: RoommateProfile[] = [
  { id: 'rmp-1', name: 'Sumaiya Islam', departmentCode: 'TEXTILE', intro: 'Textile student, early riser, keeps a small plant collection. Looking for a calm flat-share near the Permanent Campus.', budgetMin: 3000, budgetMax: 4500, preferredArea: 'Ashkona / Ashiyan City Road', moveIn: 'December 2026', lifestyle: ['Early riser', 'Vegetarian', 'Non-smoker'], interests: ['Crafts', 'Design'], isDemo: true },
  { id: 'rmp-2', name: 'Rezaul Karim', departmentCode: 'CE', intro: 'Civil engineering, away on site visits most weekends. Looking for a budget single room, unfurnished is fine.', budgetMin: 2500, budgetMax: 3500, preferredArea: 'Nikunja / Kawlar', moveIn: 'November 2026', lifestyle: ['Weekend away', 'Non-smoker'], interests: ['Structures', 'Cricket'], isDemo: true },
  { id: 'rmp-3', name: 'Sabbir Ahmed', departmentCode: 'MPH', intro: 'MPH student, quiet and library-bound. Would love a roommate who respects quiet hours during thesis season.', budgetMin: 3500, budgetMax: 5000, preferredArea: 'Dakshinkhan', moveIn: 'January 2027', lifestyle: ['Quiet hours', 'Non-smoker', 'Early riser'], interests: ['Research', 'Reading'], isDemo: true },
  { id: 'rmp-4', name: 'Shakib Al Hasan', departmentCode: 'BBA', intro: 'BBA volunteer-life means I\'m out at events a lot. Neat, cooks a mean khichuri, looking for a 2-bed share.', budgetMin: 4500, budgetMax: 6000, preferredArea: 'Ashkona', moveIn: 'December 2026', lifestyle: ['Tidy', 'Cooks', 'Social'], interests: ['Events', 'Entrepreneurship'], isDemo: true },
  { id: 'rmp-5', name: 'Maliha Noor', departmentCode: 'ENGLISH', intro: 'English literature — zine deadlines mean late nights with tea. Looking for a girls\' flat with a writing desk by a window.', budgetMin: 3000, budgetMax: 4200, preferredArea: 'Anywhere near campus', moveIn: 'November 2026', lifestyle: ['Night owl', 'Non-smoker'], interests: ['Writing', 'Film'], isDemo: true },
];

/* --- Hostels (Room → Hostels tab) — DEMO-labelled synthetic listings.
 * Real hostels are never fabricated; contact happens via private enquiries. */

const hostel = (seed: string, kind: HostelPhoto['kind'], caption: string): HostelPhoto => ({
  uri: hostelScene(seed),
  kind,
  caption,
});

export const DEMO_HOSTELS: HostelListing[] = [
  {
    id: 'ht-1', name: 'Ashkona Student Residence (Male Block)', area: 'Ashkona — Near Hajj Camp',
    monthlyRate: 3800, seatType: 'Shared Room', seatsAvailable: 4,
    includes: ['Utilities', 'Wi-Fi', 'Mess (2 meals)', 'Cleaning'],
    messIncluded: true,
    rules: 'Gate closes 11 PM • Guests in common room only • No smoking',
    gender: 'Male',
    photos: [
      hostel('ht1-dorm', 'Dorm Room', 'Four-bed dorm with study desks'),
      hostel('ht1-common', 'Common Area', 'Common room with seating'),
      hostel('ht1-study', 'Study Room', 'Shared study table'),
      hostel('ht1-wash', 'Wash Area', 'Wash block on each floor'),
    ],
    isDemo: true,
  },
  {
    id: 'ht-2', name: 'Nikunja 2 Ladies Hostel', area: 'Nikunja 2 — 10 min to campus',
    monthlyRate: 4800, seatType: 'Twin Sharing', seatsAvailable: 2,
    includes: ['Utilities', 'Wi-Fi', 'Breakfast', 'Guarded entry'],
    messIncluded: false,
    rules: 'Gate closes 9:30 PM • Female guests only • Guardian visit register',
    gender: 'Female',
    photos: [
      hostel('ht2-dorm', 'Dorm Room', 'Twin-sharing room with window'),
      hostel('ht2-common', 'Common Area', 'Ground-floor common room'),
      hostel('ht2-wash', 'Wash Area', 'Attached wash area'),
    ],
    isDemo: true,
  },
  {
    id: 'ht-3', name: 'Kawlar Co-living House (Separate Floors)', area: 'Kawlar — Uttara side',
    monthlyRate: 4200, seatType: 'Single Seat', seatsAvailable: 3,
    includes: ['Utilities', 'Wi-Fi', 'Kitchen access'],
    messIncluded: false,
    rules: 'House meeting monthly • Quiet after 11 PM • Shared cooking roster',
    gender: 'Separate floors',
    photos: [
      hostel('ht3-dorm', 'Dorm Room', 'Single seat with reading table'),
      hostel('ht3-study', 'Study Room', 'Corner study nook'),
    ],
    isDemo: true,
  },
];

/* --- Mess (Room → Mess tab) — dining subscriptions around campus. */

const mess = (seed: string, kind: MessPhoto['kind'], caption: string): MessPhoto => ({
  uri: messScene(seed),
  kind,
  caption,
});

export const DEMO_MESS: MessListing[] = [
  {
    id: 'ms-1', name: 'Ashkona Mess Hall', area: 'Ashkona — behind the hostel gate',
    monthlyRate: 2400, mealsPerDay: 3,
    mealTimes: 'Breakfast 8:00 · Lunch 13:30 · Dinner 20:30',
    weeklyHighlight: 'Friday dinner — kacchi biryani night',
    vegOption: true,
    serves: 'Hostel residents and day-students nearby',
    photos: [mess('ms1-hall', 'Dining Hall', 'Long-table dining hall'), mess('ms1-counter', 'Serving Counter', 'Daily serving counter'), mess('ms1-kitchen', 'Kitchen', 'Two-burner kitchen')],
    isDemo: true,
  },
  {
    id: 'ms-2', name: 'Campus Gate Mess', area: 'Main Gate, Permanent Campus',
    monthlyRate: 2000, mealsPerDay: 2,
    mealTimes: 'Lunch 13:00 · Dinner 20:00',
    weeklyHighlight: 'Wednesday lunch — jhal muri and chicken roast',
    vegOption: true,
    serves: 'Day-students and evening-batch students',
    photos: [mess('ms2-hall', 'Dining Hall', 'First-floor dining'), mess('ms2-kitchen', 'Kitchen', 'Open kitchen')],
    isDemo: true,
  },
  {
    id: 'ms-3', name: 'Nikunja Mess Corner', area: 'Nikunja 2 — near the ladies hostel',
    monthlyRate: 1800, mealsPerDay: 2,
    mealTimes: 'Breakfast 8:30 · Dinner 20:30',
    weeklyHighlight: 'Sunday porota and dal fry night',
    vegOption: false,
    serves: 'Nikunja hostel residents',
    photos: [mess('ms3-hall', 'Dining Hall', 'Corner dining space'), mess('ms3-counter', 'Serving Counter', 'Self-serve counter')],
    isDemo: true,
  },
];

/* --- Marketplace ------------------------------------------------------------- */
export const DEMO_MARKETPLACE: MarketplaceListing[] = [
  { id: 'mk-1', title: 'Handloom Cotton Tote Bag (Natural Dye)', price: 650, category: 'Accessories', condition: 'New', description: 'Handwoven on campus looms by the Textile Crafts Circle. Natural indigo dye, reinforced straps. Two colourways available.', pickupArea: 'Permanent Campus — Textile Building', sellerId: 'p-sumaiya', sellerName: 'Sumaiya Islam', sellerDepartment: 'Textile 4th Semester', status: 'Active', createdAt: hoursAgo(26), photos: [productScene('mk1a', 'Accessories'), productScene('mk1b', 'Accessories')], saved: true, isDemo: true },
  { id: 'mk-2', title: 'Engineering Graphics Drawing Board + Tee Square', price: 1200, category: 'Books & Academic', condition: 'Good', description: 'A2 drawing board with parallel motion, used for two semesters of Engineering Graphics. Some pencil marks on the edge.', pickupArea: 'Ashkona Hostel Gate', sellerId: 'p-rezaul', sellerName: 'Rezaul Karim', sellerDepartment: 'Civil 2nd Year', status: 'Active', createdAt: hoursAgo(8), photos: [productScene('mk2', 'Books & Academic')], saved: false, isDemo: true },
  { id: 'mk-3', title: 'Cengage Physics for Engineers (Ed. 11) — Clean Copy', price: 900, category: 'Books & Academic', condition: 'Like New', description: 'Barely used — switched tracks after first tri-semester. No highlighting, spine intact.', pickupArea: 'Permanent Campus — CSE Building', sellerId: 'p-mahmudul', sellerName: 'Mahmudul Hasan', sellerDepartment: 'CSE 6th Semester', status: 'Active', createdAt: hoursAgo(52), photos: [productScene('mk3', 'Books & Academic')], saved: false, isDemo: true },
  { id: 'mk-4', title: 'Study Desk Lamp (Rechargeable, 3 Brightness)', price: 480, category: 'Home Items', condition: 'Good', description: 'Lasts a full night per charge during load-shedding season. Selling because I got a bigger one.', pickupArea: 'Dakshinkhan Bazar Road', sellerId: 'p-tanvir', sellerName: 'Tanvir Hossain', sellerDepartment: 'CSE 6th Semester', status: 'Active', createdAt: hoursAgo(70), photos: [productScene('mk4', 'Home Items')], saved: false, isDemo: true },
  { id: 'mk-5', title: 'Casio fx-991EX ClassWiz Scientific Calculator', price: 1400, category: 'Electronics', condition: 'Like New', description: 'Two semesters old, all functions working, includes the slide cover and manual.', pickupArea: 'Permanent Campus — EEE Building', sellerId: 'p-arif', sellerName: 'Arif Chowdhury', sellerDepartment: 'EEE 5th Semester', status: 'Reserved', createdAt: hoursAgo(100), photos: [productScene('mk5', 'Electronics')], saved: false, isDemo: true },
  { id: 'mk-6', title: 'Cricket Bat (Kashmir Willow, Full Size)', price: 2600, category: 'Sports', condition: 'Good', description: 'Games & Sports Club tournament bat, freshly knocked-in with new grip. Selling after graduating from the team roster.', pickupArea: 'Campus Field Office', sellerId: 'p-shakib', sellerName: 'Shakib Al Hasan', sellerDepartment: 'BBA 6th Semester', status: 'Active', createdAt: hoursAgo(30), photos: [productScene('mk6', 'Sports')], saved: true, isDemo: true },
  { id: 'mk-7', title: 'Hostel Mattress (Foam, 4-inch, 6 Months Used)', price: 900, category: 'Furniture', condition: 'Good', description: 'Moved to a furnished flat so the mattress needs a new home. Covered with protector the whole time.', pickupArea: 'Ashkona — Near Hajj Camp', sellerId: 'p-tanvir', sellerName: 'Tanvir Hossain', sellerDepartment: 'CSE 6th Semester', status: 'Sold', createdAt: hoursAgo(160), photos: [productScene('mk7', 'Furniture')], saved: false, isDemo: true },
  { id: 'mk-8', title: 'Nivia Volleyball (Official Size 5)', price: 750, category: 'Sports', condition: 'Fair', description: 'Scuffed from courtyard games but holds air perfectly. Great for practice sessions.', pickupArea: 'Permanent Campus Gym', sellerId: 'p-shakib', sellerName: 'Shakib Al Hasan', sellerDepartment: 'BBA 6th Semester', status: 'Active', createdAt: hoursAgo(12), photos: [productScene('mk8', 'Sports')], saved: false, isDemo: true },
  { id: 'mk-9', title: 'White Formal Shirt (M, Worn Once to Orientation)', price: 550, category: 'Clothing', condition: 'Like New', description: 'Bought for orientation day and the placement fair. Dry-cleaned, no stains.', pickupArea: 'Nikunja 2', sellerId: 'p-maliha', sellerName: 'Maliha Noor', sellerDepartment: 'English 3rd Semester', status: 'Active', createdAt: hoursAgo(44), photos: [productScene('mk9', 'Clothing')], saved: false, isDemo: true },
  { id: 'mk-10', title: 'Wireless Mouse + Keyboard Combo (2.4GHz)', price: 1150, category: 'Computers', condition: 'Good', description: 'USB receiver combo, batteries included. Selling because my new desk has a built-in set.', pickupArea: 'Permanent Campus — CSE Lab 2', sellerId: 'p-rakib', sellerName: 'Rakibul Islam', sellerDepartment: 'CSE 7th Semester', status: 'Active', createdAt: hoursAgo(6), photos: [productScene('mk10', 'Computers')], saved: false, isDemo: true },
];

/* --- Conversations ------------------------------------------------------------ */
export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    // Make-a-Plan group chat for DEMO_PLANS 'plan-4' (created by 'me').
    id: 'cv-plan-plan-4', kind: 'plan', title: 'Plan · Golden-hour photowalk — main gate to field', participants: ['p-arif', 'p-maliha'], avatarSeeds: ['p-arif', 'p-maliha'],
    unread: 1, pinned: false, muted: false, request: 'none', planId: 'plan-4',
    messages: [
      { id: 'pm1', senderId: 'me', text: 'Plan created — Golden-hour photowalk — main gate to field. Meeting at Main Gate, Permanent Campus. Any camera welcome.', createdAt: hoursAgo(30) },
      { id: 'pm2', senderId: 'p-arif', text: 'Bringing the 50mm — see you at the gate!', createdAt: hoursAgo(29), read: true },
      { id: 'pm3', senderId: 'p-maliha', text: 'I\'ll bring a spare power bank for anyone whose phone dies mid-shoot.', createdAt: hoursAgo(1) },
    ],
    isDemo: true,
  },
  {
    id: 'cv-1', kind: 'direct', title: 'Mahmudul Hasan', participants: ['p-mahmudul'], avatarSeeds: ['p-mahmudul'],
    unread: 2, pinned: true, muted: false, request: 'none',
    messages: [
      { id: 'm1', senderId: 'p-mahmudul', text: 'Are you joining the DBMS lab group this semester?', createdAt: hoursAgo(5) },
      { id: 'm2', senderId: 'me', text: 'Definitely — which section did you get?', createdAt: hoursAgo(4.5), read: true },
      { id: 'm3', senderId: 'p-mahmudul', text: 'Section A. Lab sheets 1–3 are already in the group.', createdAt: hoursAgo(0.4) },
      { id: 'm4', senderId: 'p-mahmudul', text: 'Also, I found a shortcut for the indexing exercise — will show you Wednesday.', createdAt: hoursAgo(0.3) },
    ],
    isDemo: true,
  },
  {
    id: 'cv-2', kind: 'group', title: 'Bengali OCR Capstone Team', participants: ['p-rakib', 'p-mahmudul', 'p-arif'], avatarSeeds: ['p-rakib', 'p-mahmudul', 'p-arif'],
    unread: 0, pinned: true, muted: false, request: 'none',
    messages: [
      { id: 'm5', senderId: 'p-rakib', text: 'Kickoff Wednesday after DBMS lab — Permanent Campus room 305.', createdAt: hoursAgo(26) },
      { id: 'm6', senderId: 'p-arif', text: 'I\'ll bring the scanned corpus samples.', createdAt: hoursAgo(25), read: true },
      { id: 'm7', senderId: 'me', text: 'Great, I\'ll draft the preprocessing pipeline doc.', createdAt: hoursAgo(24), read: true },
    ],
    isDemo: true,
  },
  {
    id: 'cv-3', kind: 'room', title: 'Tanvir Hossain — Room Enquiry', participants: ['p-tanvir'], avatarSeeds: ['p-tanvir'],
    unread: 1, pinned: false, muted: false, request: 'none',
    context: { thumb: roomScene('rm1-bed', 'Bedroom'), title: '1 Seat Available in 3-Bedroom Student Flat', price: '৳4,200/mo', status: 'Available', href: '/roommates/rm-1' },
    messages: [
      { id: 'm8', senderId: 'me', text: 'Hi! Is the Ashkona seat still available for mid-November?', createdAt: hoursAgo(48), read: true },
      { id: 'm9', senderId: 'p-tanvir', text: 'Yes it is! Utilities are shared by meter. Want to see the kitchen photos?', createdAt: hoursAgo(2) },
    ],
    isDemo: true,
  },
  {
    id: 'cv-4', kind: 'marketplace', title: 'Sumaiya Islam — Tote Bag', participants: ['p-sumaiya'], avatarSeeds: ['p-sumaiya'],
    unread: 0, pinned: false, muted: false, request: 'none',
    context: { thumb: productScene('mk1a', 'Accessories'), title: 'Handloom Cotton Tote Bag (Natural Dye)', price: '৳650', status: 'Active', href: '/marketplace/mk-1' },
    messages: [
      { id: 'm10', senderId: 'me', text: 'Is the indigo colourway still in stock?', createdAt: hoursAgo(20), read: true },
      { id: 'm11', senderId: 'p-sumaiya', text: 'Two left! I\'m at the Textile building till 4 PM today.', createdAt: hoursAgo(19), read: true },
    ],
    isDemo: true,
  },
  {
    id: 'cv-5', kind: 'direct', title: 'Jannatul Ferdous', participants: ['p-jannat'], avatarSeeds: ['p-jannat'],
    unread: 0, pinned: false, muted: false, request: 'incoming',
    messages: [
      { id: 'm12', senderId: 'p-jannat', text: 'Hi! Saw your post about the zine — could I contribute a piece on campus law clinics?', createdAt: hoursAgo(30) },
    ],
    isDemo: true,
  },
];

/* --- Notifications -------------------------------------------------------------- */
export const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', category: 'Social', title: 'Mahmudul Hasan reacted to your comment', body: '"the SQL indexing lab was super clear!" got a ❤️', createdAt: hoursAgo(0.5), read: false, href: '/messages/cv-1', isDemo: true },
  { id: 'n2', category: 'Communities', title: 'Photography Circle is walking Friday', body: 'Golden-hour photowalk meets at the main gate at 4:30 PM.', createdAt: hoursAgo(3), read: false, href: '/circles/photography', isDemo: true },
  { id: 'n3', category: 'Messages', title: 'New message request', body: 'Jannatul Ferdous wants to message you about the campus zine.', createdAt: hoursAgo(6), read: false, href: '/messages', isDemo: true },
  { id: 'n4', category: 'Roommates', title: 'Tanvir replied to your enquiry', body: '"Yes it is! Utilities are shared by meter."', createdAt: hoursAgo(2), read: false, href: '/roommates/rm-1', isDemo: true },
  { id: 'n5', category: 'Marketplace', title: 'Casio fx-991EX is now Reserved', body: 'Arif Chowdhury reserved the calculator you saved.', createdAt: hoursAgo(9), read: true, href: '/marketplace/mk-5', isDemo: true },
  { id: 'n6', category: 'Events', title: 'Debate finale this Friday', body: 'Central Debate Club — 3 PM, Central Auditorium.', createdAt: hoursAgo(11), read: true, href: '/events', isDemo: true },
  { id: 'n7', category: 'Academic', title: 'Bi-Semester mid-term window opens', body: 'Pharmacy, Law, Civil and Mechanical departments — check your academic calendar.', createdAt: hoursAgo(24), read: true, href: '/academic', isDemo: true },
  { id: 'n8', category: 'System', title: 'Welcome to NUBCONNECT', body: 'This demo experience shows clearly-labelled sample content until you connect your university\'s Supabase backend.', createdAt: hoursAgo(72), read: true, href: '/settings', isDemo: true },
];

/* --- Events ----------------------------------------------------------------------- */
export const DEMO_EVENTS: CampusEvent[] = [
  { id: 'ev-1', title: 'Inter-Department Debate Finale', organizer: 'Debate and Public Speaking Club (Central)', venue: 'Central Auditorium', date: '2026-11-13', startTime: '15:00', originLabel: 'Club Event', registered: false, isDemo: true },
  { id: 'ev-2', title: 'Skill Tracks Week 3 — NUBCC', organizer: 'NUB Computer Club (NUBCC)', venue: 'CSE Lab 2, Permanent Campus', date: '2026-11-12', startTime: '16:00', originLabel: 'Club Event', registered: true, isDemo: true },
  { id: 'ev-3', title: 'Campus Clean-Up Drive', organizer: 'NUB Environment Club', venue: 'Main Gate, Permanent Campus', date: '2026-11-14', startTime: '08:00', originLabel: 'Volunteering', registered: false, isDemo: true },
  { id: 'ev-4', title: 'Entrepreneurship Meetup #5', organizer: 'Business Entrepreneurship and Leadership Club', venue: 'Business Society Room', date: '2026-11-18', startTime: '17:30', originLabel: 'Club Event', registered: false, isDemo: true },
  { id: 'ev-5', title: 'Film Circle Double Bill', organizer: 'NUB Film & Photography Club', venue: 'Room 305, Permanent Campus', date: '2026-11-15', startTime: '18:00', originLabel: 'Club Event', registered: false, isDemo: true },
  { id: 'ev-6', title: 'Blood Donation Campaign', organizer: 'NUB Central Social Welfare Club', venue: 'Central Library Lawn', date: '2026-11-21', startTime: '10:00', originLabel: 'Volunteering', registered: true, isDemo: true },
];

/* --- Opportunities & Lost & Found -------------------------------------------------- */
export const DEMO_OPPORTUNITIES: Opportunity[] = [
  { id: 'op-1', title: 'Campus Ambassador — Spring Intake', category: 'Leadership', description: 'Represent NUBCONNECT in your department and help onboard your cohort.', isDemo: true },
  { id: 'op-2', title: 'Library Journal Assistant (Part-time)', category: 'On-Campus Job', description: 'Central Library needs two evening assistants for the journal section.', isDemo: true },
  { id: 'op-3', title: 'Textile Innovation Challenge 2027', category: 'Competition', description: 'Sustainable fibre innovation challenge — teams of 2–4, registration opens December.', isDemo: true },
  { id: 'op-4', title: 'Winter Coding Bootcamp Mentors', category: 'Volunteering', description: 'NCSD seeks senior students to mentor first-year coding circles.', isDemo: true },
];

export const DEMO_LOST_FOUND: LostFoundItem[] = [
  { id: 'lf-1', title: 'Student ID Card (CSE, 7th Semester)', kind: 'Lost', location: 'DBMS Lab, Permanent Campus', date: '2026-11-08', description: 'Lost somewhere between Lab 2 and the canteen. Name card inside the holder.', isDemo: true },
  { id: 'lf-2', title: 'Black Umbrella', kind: 'Found', location: 'Central Library Journal Corner', date: '2026-11-06', description: 'Sturdy black umbrella left beside the HINARI terminal. Claim at the library desk.', isDemo: true },
  { id: 'lf-3', title: 'Water Bottle (Steel, Blue Lid)', kind: 'Found', location: 'Campus Field', date: '2026-11-09', description: 'Left behind after the evening football session.', isDemo: true },
];

/* --- Campus services ------------------------------------------------------------ */
/* Desk/office references only — NUBCONNECT never publishes fabricated phone
   numbers. Every entry here is demo content pending backend verification. */
export const DEMO_CAMPUS_SERVICES: CampusService[] = [
  {
    id: 'svc-1', name: 'Central Library', description: 'Lending, reference section and the HINARI research terminal. Bring your student ID for entry and borrowing.',
    location: 'Permanent Campus — Central Library', hours: 'Sun–Thu, 9:00 AM – 4:30 PM', contactPoint: 'Front circulation desk', isDemo: true,
  },
  {
    id: 'svc-2', name: 'IT Help Desk', description: 'University email, Wi-Fi, lab login and exam-portal problems. Bring your ID card.',
    location: 'Permanent Campus — CSE Building', hours: 'Sun–Thu, 10:00 AM – 3:00 PM', contactPoint: 'Help desk window, ground floor', isDemo: true,
  },
  {
    id: 'svc-3', name: 'Medical Room (First Aid)', description: 'First aid and basic medication for on-campus emergencies. A staff nurse is on duty during class hours.',
    location: 'Permanent Campus — Ground Floor', hours: 'During class hours', contactPoint: 'Duty nurse at the medical room', isDemo: true,
  },
  {
    id: 'svc-4', name: 'Transport Desk', description: 'Bus route information and student pass queries for university transport.',
    location: 'Permanent Campus — Administrative Block', hours: 'Sun–Thu, 9:00 AM – 2:00 PM', contactPoint: 'Transport desk, admin office', isDemo: true,
  },
  {
    id: 'svc-5', name: 'Accounts & Fees', description: 'Tuition payments, installment plans, and payment-receipt reprints.',
    location: 'Permanent Campus — Accounts Department', hours: 'Sun–Thu, 9:30 AM – 3:30 PM', contactPoint: 'Accounts counter', isDemo: true,
  },
  {
    id: 'svc-6', name: 'Examination Controller', description: 'Exam forms, admit cards, and certified transcripts. Check notice boards for semester deadlines.',
    location: 'Permanent Campus — Administrative Block', hours: 'Sun–Thu, 10:00 AM – 2:00 PM', contactPoint: 'Controller’s office window', isDemo: true,
  },
];

/* ============================================================================
   CAMPUS ORBIT — signature feature datasets (all DEMO, all clearly labelled)
   ============================================================================ */

/* --- Make a Plan (§6.1): real-life meetups with participant limits -------- */
export const DEMO_PLANS: ActivityPlan[] = [
  {
    id: 'plan-1', title: 'DBMS lab prep — query planner walkthrough', category: 'Study',
    spot: 'CSE Lab 2, Permanent Campus', startsAt: inMins(95), durationMins: 120,
    participantLimit: 5, createdBy: 'p-mahmudul', participants: ['p-mahmudul', 'p-rakib'],
    note: 'Walkthrough of the indexing exercise before Wednesday’s lab. Bring lab sheet 3.',
    createdAt: hoursAgo(3), isDemo: true,
  },
  {
    id: 'plan-2', title: 'Evening football — 5-a-side', category: 'Sports',
    spot: 'Campus Field, Permanent Campus', startsAt: inMins(190), durationMins: 90,
    participantLimit: 10, createdBy: 'p-rezaul',
    participants: ['p-rezaul', 'p-mahmudul', 'p-tanvir', 'p-arif', 'p-rakib', 'p-shakib', 'p-sabbir'],
    note: 'Two teams, first to 7. Astro shoes or plain sneakers both fine.',
    createdAt: hoursAgo(6), isDemo: true,
  },
  {
    id: 'plan-3', title: 'Canteen iftar table — food street preview', category: 'Food',
    spot: 'Canteen, CSE Building', startsAt: inMins(28 * 60), durationMins: 60,
    participantLimit: 6, createdBy: 'p-shakib', participants: ['p-shakib', 'p-nusrat'],
    note: 'Tasting the new kebab counter before the food street week. Pay for your own plate.',
    createdAt: hoursAgo(9), isDemo: true,
  },
  {
    id: 'plan-4', title: 'Golden-hour photowalk — main gate to field', category: 'Event',
    spot: 'Main Gate, Permanent Campus', startsAt: inMins(50 * 60), durationMins: 75,
    participantLimit: 12, createdBy: 'me', participants: ['me', 'p-arif', 'p-maliha'],
    note: 'Any camera welcome. We end at the field benches for the dusk skyline shots.',
    createdAt: hoursAgo(30), isDemo: true,
  },
  {
    id: 'plan-5', title: 'Robotics showcase rehearsal — stage lift', category: 'Errand',
    spot: 'Robotics Lab, CSE Building', startsAt: inMins(12), durationMins: 45,
    participantLimit: 4, createdBy: 'p-arif', participants: ['p-arif', 'p-tanvir'],
    note: 'Carrying the tables and taping the track — starts in a few minutes, join the next rehearsal if you miss this one.',
    createdAt: hoursAgo(1.5), isDemo: true,
  },
];

/* --- Campus Now (§6.2): opt-in, auto-expiring presence, no tracking ------- */
export const DEMO_CAMPUS_NOW: CampusNowStatus[] = [
  {
    id: 'cn-1', personId: 'p-rakib', personName: 'Rakibul Islam', activity: 'Studying',
    spot: 'Central Library — 3rd floor, journal corner', note: 'OCR capstone reading. Join me if you want quiet company.',
    postedAt: hoursAgo(0.4), expiresAt: campusNowExpiry(now - 0.4 * 3_600_000), isDemo: true,
  },
  {
    id: 'cn-2', personId: 'p-farhana', personName: 'Farhana Akter', activity: 'Free',
    spot: 'Central Library lawn benches', note: 'Free until the 3 PM pharmacology lab — happy to chat.',
    openToConnect: true,
    postedAt: hoursAgo(0.7), expiresAt: campusNowExpiry(now - 0.7 * 3_600_000), isDemo: true,
  },
  {
    id: 'cn-3', personId: 'p-tanvir', personName: 'Tanvir Hossain', activity: 'Eating',
    spot: 'Canteen, CSE Building', note: 'Lunch + DBMS sheets. The corner table is free.',
    postedAt: hoursAgo(0.2), expiresAt: campusNowExpiry(now - 0.2 * 3_600_000), isDemo: true,
  },
  {
    id: 'cn-4', personId: 'p-sumaiya', personName: 'Sumaiya Islam', activity: 'Club room',
    spot: 'Textile Innovation Club room', note: 'Dyeing tote batches till 4 PM — come say hi.',
    openToConnect: true,
    postedAt: hoursAgo(0.9), expiresAt: campusNowExpiry(now - 0.9 * 3_600_000), isDemo: true,
  },
];

/* --- Campus Introductions (§6.3): mutual + consent ------------------------ */
export const DEMO_INTRODUCTIONS: Introduction[] = [
  { id: 'intro-1', personId: 'p-arif', reason: 'You both photograph campus life — Arif is looking for photowalk partners.', basis: 'Shared interest', status: 'pending', isDemo: true },
  { id: 'intro-2', personId: 'p-sabbir', reason: 'You share the Reading Circle — Sabbir runs the HINARI paper swap table.', basis: 'Mutual circle', status: 'pending', isDemo: true },
  { id: 'intro-3', personId: 'p-mahmudul', reason: 'Same department, same DBMS section — a natural study-table introduction.', basis: 'Same department', status: 'pending', isDemo: true },
  { id: 'intro-4', personId: 'p-maliha', reason: 'Film Circle double bills — you already accepted this introduction.', basis: 'Mutual circle', status: 'accepted', isDemo: true },
];

/* --- Campus Honours (§9): transparent contribution points ----------------- */
export const DEMO_HONOURS: CampusHonourEntry[] = [
  { id: 'hon-1', personId: 'p-rakib', personName: 'Rakibul Islam', departmentCode: 'CSE', category: 'Mentoring', title: 'Capstone team mentoring', detail: 'Weekly Bengali OCR capstone guidance for two junior teams.', points: 30, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-2', personId: 'p-rakib', personName: 'Rakibul Islam', departmentCode: 'CSE', category: 'Knowledge Sharing', title: 'AI/ML paper reading circle', detail: 'Founded and runs the Wednesday paper-reading session.', points: 25, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-3', personId: 'p-rakib', personName: 'Rakibul Islam', departmentCode: 'CSE', category: 'Organizing', title: 'Skill Tracks Week 3', detail: 'Coordinated the NUBCC skill-track logistics with 60 attendees.', points: 20, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-4', personId: 'p-farhana', personName: 'Farhana Akter', departmentCode: 'PHARM', category: 'Knowledge Sharing', title: 'HINARI access workshops', detail: 'Taught 40+ students Research4Life search workflows.', points: 20, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-5', personId: 'p-farhana', personName: 'Farhana Akter', departmentCode: 'PHARM', category: 'Community Help', title: 'Exam-week first-aid desk', detail: 'Volunteered daily at the medical room during mid-terms.', points: 20, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-6', personId: 'p-farhana', personName: 'Farhana Akter', departmentCode: 'PHARM', category: 'Volunteering', title: 'Winter clothing drive', detail: 'Sorted and delivered 300+ donated items.', points: 15, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-7', personId: 'p-shakib', personName: 'Shakib Al Hasan', departmentCode: 'BBA', category: 'Organizing', title: 'Entrepreneurship Meetup #4', detail: 'Ran logistics for a 42-student meetup with 6 pitch teams.', points: 25, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-8', personId: 'p-shakib', personName: 'Shakib Al Hasan', departmentCode: 'BBA', category: 'Volunteering', title: 'Orientation week crew', detail: 'Guided 5 newcomer groups across campus.', points: 15, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-9', personId: 'p-shakib', personName: 'Shakib Al Hasan', departmentCode: 'BBA', category: 'Community Help', title: 'Lost & Found desk', detail: 'Reunited 9 lost ID cards with their owners.', points: 10, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-10', personId: 'usr-tasnim', personName: 'Tasnim Rahman', departmentCode: 'CSE', category: 'Mentoring', title: 'Junior study circles', detail: 'Hosted pre-finals study circles for 3rd-semester students.', points: 25, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-11', personId: 'usr-tasnim', personName: 'Tasnim Rahman', departmentCode: 'CSE', category: 'Creative Contribution', title: 'Campus photo archive', detail: 'Documented club events for the campus photo exhibition.', points: 15, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-12', personId: 'usr-tasnim', personName: 'Tasnim Rahman', departmentCode: 'CSE', category: 'Organizing', title: 'Photography Circle walks', detail: 'Led four golden-hour photowalks, open to all departments.', points: 10, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-13', personId: 'p-maliha', personName: 'Maliha Noor', departmentCode: 'ENGLISH', category: 'Creative Contribution', title: 'Campus zine editorial', detail: 'Edited and printed the monsoon zine, 80 copies.', points: 20, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-14', personId: 'p-maliha', personName: 'Maliha Noor', departmentCode: 'ENGLISH', category: 'Knowledge Sharing', title: 'Reading circle picks', detail: 'Curated the monthly book picks board.', points: 10, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-15', personId: 'p-nusrat', personName: 'Nusrat Jahan', departmentCode: 'BBA', category: 'Organizing', title: 'Pitch night host', detail: 'Hosted two entrepreneurship pitch nights.', points: 20, semester: 'Fall 2026', isDemo: true },
  { id: 'hon-16', personId: 'p-nusrat', personName: 'Nusrat Jahan', departmentCode: 'BBA', category: 'Volunteering', title: 'Blood donation drive', detail: 'Registered 60 donors across two days.', points: 10, semester: 'Fall 2026', isDemo: true },
];

/* --- Digital membership cards (§7.6) — demo user's clubs ------------------ */
export const DEMO_MEMBERSHIP_CARDS: ClubMembershipCard[] = [
  {
    id: 'card-nubcc', clubSlug: 'nubcc', clubName: 'NUB Computer Club (NUBCC)',
    personName: 'Tasnim Rahman', personDepartment: 'CSE — 7th Semester',
    role: 'President', since: 'Spring 2026',
    verifyToken: membershipVerifyToken('nubcc', 'usr-tasnim'), isDemo: true,
  },
  {
    id: 'card-film', clubSlug: 'film-photo', clubName: 'NUB Film & Photography Club',
    personName: 'Tasnim Rahman', personDepartment: 'CSE — 7th Semester',
    role: 'Member', since: 'Summer 2026',
    verifyToken: membershipVerifyToken('film-photo', 'usr-tasnim'), isDemo: true,
  },
];

/** Clubs the demo user belongs to (drives Club Universe membership UI). */
export const DEMO_JOINED_CLUBS: string[] = ['nubcc', 'film-photo'];

