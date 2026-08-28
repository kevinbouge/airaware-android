import Activity from 'lucide-react-native/icons/activity';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Bell from 'lucide-react-native/icons/bell';
import BellOff from 'lucide-react-native/icons/bell-off';
import Calendar from 'lucide-react-native/icons/calendar';
import Camera from 'lucide-react-native/icons/camera';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import Drone from 'lucide-react-native/icons/drone';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Gauge from 'lucide-react-native/icons/gauge';
import Gem from 'lucide-react-native/icons/gem';
import HardHat from 'lucide-react-native/icons/hard-hat';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import Info from 'lucide-react-native/icons/info';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import MapPin from 'lucide-react-native/icons/map-pin';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Minus from 'lucide-react-native/icons/minus';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Radiation from 'lucide-react-native/icons/radiation';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Settings from 'lucide-react-native/icons/settings';
import Share2 from 'lucide-react-native/icons/share-2';
import Shield from 'lucide-react-native/icons/shield';
import Sprout from 'lucide-react-native/icons/sprout';
import Telescope from 'lucide-react-native/icons/telescope';
import Trash2 from 'lucide-react-native/icons/trash-2';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TrendingUpDown from 'lucide-react-native/icons/trending-up-down';
import UserRound from 'lucide-react-native/icons/user-round';
import UsersRound from 'lucide-react-native/icons/users-round';
import X from 'lucide-react-native/icons/x';
import type { LucideIcon } from 'lucide-react-native';
import type { ActivityIconName, AppIconName } from './appIconTypes';

export interface AppIconDefinition {
  component: LucideIcon;
  libraryName: string;
}

export const APP_ICON_MAP: Record<AppIconName, AppIconDefinition> = {
  today: { component: Gauge, libraryName: 'Gauge' },
  data: { component: ChartColumn, libraryName: 'ChartColumn' },
  activities: { component: Activity, libraryName: 'Activity' },
  forecast: { component: Calendar, libraryName: 'Calendar' },
  profile: { component: UserRound, libraryName: 'UserRound' },
  pro: { component: Gem, libraryName: 'Gem' },
  settings: { component: Settings, libraryName: 'Settings' },
  location: { component: MapPin, libraryName: 'MapPin' },
  'current-location': { component: LocateFixed, libraryName: 'LocateFixed' },
  'location-management': { component: MapPinned, libraryName: 'MapPinned' },
  notifications: { component: Bell, libraryName: 'Bell' },
  'notifications-off': { component: BellOff, libraryName: 'BellOff' },
  share: { component: Share2, libraryName: 'Share2' },
  refresh: { component: RefreshCw, libraryName: 'RefreshCw' },
  restore: { component: RotateCcw, libraryName: 'RotateCcw' },
  edit: { component: Pencil, libraryName: 'Pencil' },
  delete: { component: Trash2, libraryName: 'Trash2' },
  add: { component: Plus, libraryName: 'Plus' },
  minus: { component: Minus, libraryName: 'Minus' },
  info: { component: Info, libraryName: 'Info' },
  'chevron-right': { component: ChevronRight, libraryName: 'ChevronRight' },
  back: { component: ArrowLeft, libraryName: 'ArrowLeft' },
  close: { component: X, libraryName: 'X' },
  calendar: { component: Calendar, libraryName: 'Calendar' },
  clock: { component: Clock, libraryName: 'Clock' },
  privacy: { component: Shield, libraryName: 'Shield' },
  respiratory: { component: HeartPulse, libraryName: 'HeartPulse' },
  'population-health': { component: UsersRound, libraryName: 'UsersRound' },
  radiological: { component: Radiation, libraryName: 'Radiation' },
  'trend-rising': { component: TrendingUp, libraryName: 'TrendingUp' },
  'trend-falling': { component: TrendingDown, libraryName: 'TrendingDown' },
  'trend-stable': { component: TrendingUpDown, libraryName: 'TrendingUpDown' },
  'external-link': { component: ExternalLink, libraryName: 'ExternalLink' },
  generic: { component: Info, libraryName: 'Info' },
};

export const ACTIVITY_ICON_MAP: Record<ActivityIconName, AppIconDefinition> = {
  agriculture: { component: Sprout, libraryName: 'Sprout' },
  drone_operations: { component: Drone, libraryName: 'Drone' },
  photography: { component: Camera, libraryName: 'Camera' },
  astronomy: { component: Telescope, libraryName: 'Telescope' },
  outdoor_work: { component: HardHat, libraryName: 'HardHat' },
};
