// ============================================================================
// NUBCONNECT — icon registry for pin/destination catalog entries.
// nav.ts keeps navigation data pure (string icon keys, no component imports);
// this map resolves those keys to lucide icons at render time.
// ============================================================================
import {
  Activity,
  Bell,
  BookOpen,
  Bookmark,
  Building2,
  Calendar,
  GraduationCap,
  Medal,
  Search,
  Settings,
  Sparkles,
  Stamp,
} from 'lucide-react';

export const PIN_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  pulse: Activity,
  graduation: GraduationCap,
  book: BookOpen,
  calendar: Calendar,
  sparkles: Sparkles,
  search: Search,
  building: Building2,
  bookmark: Bookmark,
  passport: Stamp,
  medal: Medal,
  bell: Bell,
  settings: Settings,
};
