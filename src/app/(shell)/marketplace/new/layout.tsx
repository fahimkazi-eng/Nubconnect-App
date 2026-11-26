import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Listing',
  description: 'Sell to verified NUB students — photo-only listings with pickup areas and ৳ prices.',
};

export default function NewListingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
