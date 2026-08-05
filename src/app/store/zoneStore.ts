export type ZoneStatus = 'active' | 'inactive' | 'maintenance';
export type AccessLevel = 'standard' | 'premium';

export interface Zone {
  id: string;
  name: string;
  description: string;
  capacity: number;
  current: number;
  status: ZoneStatus;
  accessLevel: AccessLevel;
  color: string;
  minAge: number;
  maxAge: number;
  timeBonus: number; // extra minutes granted when upgrading to this zone (premium)
}

let zones: Zone[] = [
  {
    id: 'zone-1', name: 'Trampoline Area', description: 'High-energy jumping and bouncing fun for kids',
    capacity: 15, current: 12, status: 'active', accessLevel: 'standard',
    color: 'ocean-blue', minAge: 4, maxAge: 15, timeBonus: 0,
  },
  {
    id: 'zone-2', name: 'Ball Pit', description: 'Classic ball pit play area for young children',
    capacity: 20, current: 8, status: 'active', accessLevel: 'standard',
    color: 'emerald-green', minAge: 2, maxAge: 10, timeBonus: 0,
  },
  {
    id: 'zone-3', name: 'Toddler Zone', description: 'Safe soft-play area designed for toddlers',
    capacity: 10, current: 6, status: 'active', accessLevel: 'standard',
    color: 'sky-blue', minAge: 1, maxAge: 5, timeBonus: 0,
  },
  {
    id: 'zone-4', name: 'Climbing Area', description: 'Adventure climbing walls and obstacle courses',
    capacity: 12, current: 10, status: 'active', accessLevel: 'standard',
    color: 'warning', minAge: 5, maxAge: 15, timeBonus: 0,
  },
  {
    id: 'zone-5', name: 'Arcade Area', description: 'Arcade games and interactive entertainment',
    capacity: 8, current: 6, status: 'active', accessLevel: 'standard',
    color: 'sky-blue', minAge: 3, maxAge: 99, timeBonus: 0,
  },
  {
    id: 'zone-6', name: 'VR Experience Zone', description: 'Immersive virtual reality gaming and adventures',
    capacity: 6, current: 2, status: 'active', accessLevel: 'premium',
    color: 'ocean-blue', minAge: 7, maxAge: 99, timeBonus: 30,
  },
  {
    id: 'zone-7', name: 'VIP Lounge', description: 'Exclusive premium play area with premium amenities',
    capacity: 10, current: 3, status: 'active', accessLevel: 'premium',
    color: 'emerald-green', minAge: 0, maxAge: 99, timeBonus: 60,
  },
];

const listeners: (() => void)[] = [];
function notify() { listeners.forEach(fn => fn()); }

export function getZones(): Zone[] { return zones; }
export function getActiveZones(): Zone[] { return zones.filter(z => z.status === 'active'); }
export function getPremiumZones(): Zone[] { return zones.filter(z => z.accessLevel === 'premium' && z.status === 'active'); }
export function getStandardZones(): Zone[] { return zones.filter(z => z.accessLevel === 'standard' && z.status === 'active'); }

export function addZone(zone: Omit<Zone, 'id' | 'current'>) {
  zones = [...zones, { ...zone, id: `zone-${Date.now()}`, current: 0 }];
  notify();
}

export function updateZone(id: string, updates: Partial<Zone>) {
  zones = zones.map(z => z.id === id ? { ...z, ...updates } : z);
  notify();
}

export function deleteZone(id: string) {
  zones = zones.filter(z => z.id !== id);
  notify();
}

export function subscribeZones(fn: () => void) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
}
