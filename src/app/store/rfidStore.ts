export interface RFIDCard {
  id: string;
  pagerNumber?: string;
  status: 'available' | 'assigned' | 'lost' | 'disabled';
  customer: string;
  assignedDate: string;
}

// Shared in-memory store — admin manages cards, cashier reads available ones
let rfidCards: RFIDCard[] = [
  { id: 'RFID-001', pagerNumber: 'P-101', status: 'assigned', customer: 'Emma Johnson', assignedDate: '2026-06-08' },
  { id: 'RFID-002', pagerNumber: 'P-102', status: 'assigned', customer: 'Liam Smith', assignedDate: '2026-06-08' },
  { id: 'RFID-003', pagerNumber: 'P-103', status: 'assigned', customer: 'Olivia Brown', assignedDate: '2026-06-08' },
  { id: 'RFID-004', pagerNumber: 'P-104', status: 'available', customer: '-', assignedDate: '-' },
  { id: 'RFID-005', pagerNumber: 'P-105', status: 'available', customer: '-', assignedDate: '-' },
  { id: 'RFID-006', pagerNumber: 'P-106', status: 'lost', customer: '-', assignedDate: '2026-06-05' },
  { id: 'RFID-007', pagerNumber: 'P-107', status: 'disabled', customer: '-', assignedDate: '-' },
  { id: 'RFID-008', pagerNumber: 'P-108', status: 'available', customer: '-', assignedDate: '-' },
  { id: 'RFID-009', pagerNumber: 'P-109', status: 'available', customer: '-', assignedDate: '-' },
  { id: 'RFID-010', pagerNumber: 'P-110', status: 'available', customer: '-', assignedDate: '-' },
];

const listeners: (() => void)[] = [];

function notify() {
  listeners.forEach(fn => fn());
}

export function getCards(): RFIDCard[] {
  return rfidCards;
}

export function getAvailableCards(): RFIDCard[] {
  return rfidCards.filter(c => c.status === 'available');
}

export function addCard(card: RFIDCard) {
  rfidCards = [...rfidCards, card];
  notify();
}

export function updateCard(id: string, updates: Partial<RFIDCard>) {
  rfidCards = rfidCards.map(c => c.id === id ? { ...c, ...updates } : c);
  notify();
}

export function deleteCard(id: string) {
  rfidCards = rfidCards.filter(c => c.id !== id);
  notify();
}

export function assignCard(id: string, customer: string) {
  updateCard(id, { status: 'assigned', customer, assignedDate: new Date().toISOString().slice(0, 10) });
}

export function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
}