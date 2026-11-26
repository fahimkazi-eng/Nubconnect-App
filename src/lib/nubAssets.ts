// ============================================================================
// NUBCONNECT — Authentic NUB photograph registry (§16).
//
// Every file under /public/assets/nub was downloaded from Northern University
// Bangladesh's official public website (nub.ac.bd) photo gallery, with the
// original album titles preserved verbatim. The registry below records the
// exact source URL and permission status for each asset, because university
// photography must never be fabricated, and credit must stay traceable.
//
// Permission status is recorded HONESTLY:
//   • 'official-public-website' — published publicly by NUB on nub.ac.bd.
//     Formal written permission for redistribution inside NUBCONNECT should
//     still be confirmed with the university before a production launch.
//     (Until then these images appear only in the clearly-labelled demo
//     experience, with their source visible.)
//
// Students own their own profile pictures — nothing in this registry depicts
// private individuals and none of it is used for people's avatars.
// ============================================================================

export type NubAssetCategory = 'campus' | 'event' | 'ceremony';

export interface NubPhotoAsset {
  id: string;
  /** Bundled file under /public/assets/nub/ */
  file: string;
  /** Original album title on nub.ac.bd, preserved verbatim */
  album: string;
  /** Short display title for highlight cards */
  title: string;
  category: NubAssetCategory;
  /** nub.ac.bd gallery page the photo was downloaded from */
  sourceUrl: string;
  origin: 'nub.ac.bd';
  permission: 'official-public-website';
}

export const NUB_PHOTO_ASSETS: readonly NubPhotoAsset[] = [
  {
    id: 'nub-campus-1',
    file: '/assets/nub/campus-permanent-1.jpg',
    album: 'Permanent Campus',
    title: 'Permanent Campus',
    category: 'campus',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
  {
    id: 'nub-campus-2',
    file: '/assets/nub/campus-permanent-2.jpg',
    album: 'Permanent Campus',
    title: 'Permanent Campus',
    category: 'campus',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
  {
    id: 'nub-basanta-1',
    file: '/assets/nub/basanta-utsav-1.jpg',
    album: 'Basanta Utsav 2024',
    title: 'Basanta Utsav 2024',
    category: 'event',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
  {
    id: 'nub-basanta-2',
    file: '/assets/nub/basanta-utsav-2.jpg',
    album: 'Basanta Utsav 2024',
    title: 'Basanta Utsav 2024',
    category: 'event',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
  {
    id: 'nub-basanta-3',
    file: '/assets/nub/basanta-utsav-3.jpg',
    album: 'Basanta Utsav 2024',
    title: 'Basanta Utsav 2024',
    category: 'event',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
  {
    id: 'nub-convocation-1',
    file: '/assets/nub/convocation-2015-1.jpg',
    album: '3rd Convocation 2015',
    title: '3rd Convocation 2015',
    category: 'ceremony',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/lphkszu8/3rd-convocation-2015',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
  {
    id: 'nub-convocation-2',
    file: '/assets/nub/convocation-2015-2.jpg',
    album: '3rd Convocation 2015',
    title: '3rd Convocation 2015',
    category: 'ceremony',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/lphkszu8/3rd-convocation-2015',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
  {
    id: 'nub-graduation-dinner',
    file: '/assets/nub/graduation-dinner-law.jpg',
    album: 'Graduation Dinner',
    title: 'Graduation Dinner (Law)',
    category: 'event',
    sourceUrl: 'https://nub.ac.bd/gallery/picture/rnlp7vqn/graduation-dinner',
    origin: 'nub.ac.bd',
    permission: 'official-public-website',
  },
];

/** Look up a bundled NUB photo by registry id. */
export function nubPhotoById(id: string): NubPhotoAsset | undefined {
  return NUB_PHOTO_ASSETS.find((a) => a.id === id);
}

/** Bundled photos of a given category, registry order. */
export function nubPhotosByCategory(category: NubAssetCategory): readonly NubPhotoAsset[] {
  return NUB_PHOTO_ASSETS.filter((a) => a.category === category);
}
