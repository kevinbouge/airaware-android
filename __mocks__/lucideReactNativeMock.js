const React = require('react');

function createIcon(name) {
  const Icon = (props) => React.createElement('svg', { ...props, 'data-lucide': name });
  Icon.displayName = name;
  return Icon;
}

const iconNames = [
  'Activity',
  'ArrowLeft',
  'Bell',
  'BellOff',
  'Calendar',
  'Camera',
  'ChartColumn',
  'ChevronRight',
  'Clock',
  'Drone',
  'ExternalLink',
  'Gauge',
  'Gem',
  'HardHat',
  'Info',
  'LocateFixed',
  'MapPin',
  'MapPinned',
  'Minus',
  'Pencil',
  'Plus',
  'RefreshCw',
  'RotateCcw',
  'Settings',
  'Share2',
  'Shield',
  'Sprout',
  'Telescope',
  'Trash2',
  'UserRound',
  'X',
];

module.exports = Object.fromEntries(iconNames.map((name) => [name, createIcon(name)]));
