export type ScannerStatus = 'active' | 'inactive' | 'maintenance';

export interface RFIDScanner {
  id: string;
  name: string;
  serialNumber: string;
  model: string;
  status: ScannerStatus;
  zoneId: string | null; // assigned zone
  zoneName: string | null;
}

let scanners: RFIDScanner[] = [
  { id: 'SCN-001', name: 'Entrance Scanner A', serialNumber: 'SN-2024-001', model: 'ACR122U', status: 'active', zoneId: 'zone-1', zoneName: 'Trampoline Area' },
  { id: 'SCN-002', name: 'Ball Pit Reader', serialNumber: 'SN-2024-002', model: 'ACR122U', status: 'active', zoneId: 'zone-2', zoneName: 'Ball Pit' },
  { id: 'SCN-003', name: 'Toddler Zone Gate', serialNumber: 'SN-2024-003', model: 'TRF7970A', status: 'active', zoneId: 'zone-3', zoneName: 'Toddler Zone' },
  { id: 'SCN-004', name: 'Climbing Gate Reader', serialNumber: 'SN-2024-004', model: 'TRF7970A', status: 'active', zoneId: 'zone-4', zoneName: 'Climbing Area' },
  { id: 'SCN-005', name: 'Arcade Scanner', serialNumber: 'SN-2024-005', model: 'ACR122U', status: 'inactive', zoneId: null, zoneName: null },
  { id: 'SCN-006', name: 'Main Exit Scanner', serialNumber: 'SN-2024-006', model: 'PN532', status: 'maintenance', zoneId: null, zoneName: null },
];

const listeners: (() => void)[] = [];
function notify() { listeners.forEach(fn => fn()); }

export function getScanners(): RFIDScanner[] { return scanners; }
export function getActiveScanners(): RFIDScanner[] { return scanners.filter(s => s.status === 'active'); }
export function getUnassignedScanners(): RFIDScanner[] { return scanners.filter(s => s.zoneId === null && s.status === 'active'); }

export function addScanner(scanner: Omit<RFIDScanner, 'id'>) {
  const id = `SCN-${String(scanners.length + 1).padStart(3, '0')}`;
  scanners = [...scanners, { ...scanner, id }];
  notify();
}

export function updateScanner(id: string, updates: Partial<RFIDScanner>) {
  scanners = scanners.map(s => s.id === id ? { ...s, ...updates } : s);
  notify();
}

export function deleteScanner(id: string) {
  scanners = scanners.filter(s => s.id !== id);
  notify();
}

export function assignScannerToZone(scannerId: string, zoneId: string | null, zoneName: string | null) {
  // Unassign any scanner currently on this zone
  if (zoneId) {
    scanners = scanners.map(s => s.zoneId === zoneId ? { ...s, zoneId: null, zoneName: null } : s);
  }
  scanners = scanners.map(s => s.id === scannerId ? { ...s, zoneId, zoneName } : s);
  notify();
}

export function subscribeScanners(fn: () => void) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
}
