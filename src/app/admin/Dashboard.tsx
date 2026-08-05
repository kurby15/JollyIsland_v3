import { useState } from 'react';
import { useNavigate } from 'react-router';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import { Users, DollarSign, Activity, Radio, TrendingUp, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const dailyVisitors = [
  { name: 'Mon', visitors: 45 }, { name: 'Tue', visitors: 52 }, { name: 'Wed', visitors: 48 },
  { name: 'Thu', visitors: 61 }, { name: 'Fri', visitors: 75 }, { name: 'Sat', visitors: 120 }, { name: 'Sun', visitors: 95 },
];
const revenueData = [
  { name: 'Mon', revenue: 675 }, { name: 'Tue', revenue: 780 }, { name: 'Wed', revenue: 720 },
  { name: 'Thu', revenue: 915 }, { name: 'Fri', revenue: 1125 }, { name: 'Sat', revenue: 1800 }, { name: 'Sun', revenue: 1425 },
];
const allCustomers = [
  { name: 'Emma Johnson', package: 'Kiddie A', zone: 'Trampoline Area', date: '2026-07-20', amount: '₱99' },
  { name: 'Liam Smith', package: 'Skating B', zone: 'Skating Area', date: '2026-07-20', amount: '₱99' },
  { name: 'Olivia Brown', package: 'Kiddie C', zone: 'Climbing Area', date: '2026-07-19', amount: '₱180' },
  { name: 'Noah Davis', package: 'Bump Car A', zone: 'Arcade Area', date: '2026-07-19', amount: '₱100' },
  { name: 'Ava Wilson', package: 'Kiddie B', zone: 'Toddler Zone', date: '2026-07-18', amount: '₱130' },
];
const revenueDetails = [
  { source: 'Kiddie Packages', amount: '₱18,450', pct: 52 },
  { source: 'Skating Packages', amount: '₱9,870', pct: 28 },
  { source: 'Bump Car Packages', amount: '₱7,100', pct: 20 },
];
const activeSessions = [
  { rfid: 'RFID-001', name: 'Emma Johnson', zone: 'Trampoline Area', remaining: '45 min', status: 'active' },
  { rfid: 'RFID-002', name: 'Liam Smith', zone: 'Ball Pit', remaining: '12 min', status: 'warning' },
  { rfid: 'RFID-003', name: 'Olivia Brown', zone: 'Climbing Area', remaining: '1 hr 20 min', status: 'active' },
];
const rfidInventory = [
  { id: 'RFID-001', status: 'assigned', customer: 'Emma Johnson' },
  { id: 'RFID-002', status: 'assigned', customer: 'Liam Smith' },
  { id: 'RFID-004', status: 'available', customer: '-' },
  { id: 'RFID-005', status: 'available', customer: '-' },
  { id: 'RFID-006', status: 'lost', customer: '-' },
];

type ModalType = 'customers' | 'revenue' | 'sessions' | 'rfid' | null;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
    <div className="p-8">
        <div className="mb-8">
          <h1 className="text-dark-slate mb-2">Admin Dashboard</h1>
          <p className="text-gray">System overview and analytics</p>
        </div>

        {/* KPI Stats — each clickable */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button className="text-left" onClick={() => setModal('customers')}>
            <StatCard title="Total Customers" value={1245} icon={Users} color="blue" trend="+12%" />
          </button>
          <button className="text-left" onClick={() => setModal('revenue')}>
            <StatCard title="Monthly Revenue" value="₱35,420" icon={DollarSign} color="green" trend="+18%" />
          </button>
          <button className="text-left" onClick={() => setModal('sessions')}>
            <StatCard title="Active Sessions" value={activeSessions.length} icon={Activity} color="purple" />
          </button>
          <button className="text-left" onClick={() => setModal('rfid')}>
            <StatCard title="RFID Cards" value={rfidInventory.length} icon={Radio} color="orange" />
          </button>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-dark-slate">Daily Visitors (This Week)</h3>
              <button onClick={() => navigate('/analytics')} className="text-xs text-ocean-blue hover:underline">Full Report →</button>
            </div>
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <linearGradient id="adminVisitorsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0EA5E9" /><stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyVisitors}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#64748B" /><YAxis stroke="#64748B" /><Tooltip />
                <Bar dataKey="visitors" fill="url(#adminVisitorsGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-dark-slate">Revenue Trend</h3>
              <button onClick={() => navigate('/analytics')} className="text-xs text-ocean-blue hover:underline">Full Report →</button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#64748B" /><YAxis stroke="#64748B" /><Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone Traffic & Peak Hours */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-dark-slate">Zone Popularity</h3>
              <button onClick={() => navigate('/analytics')} className="text-xs text-ocean-blue hover:underline">Details →</button>
            </div>
            <div className="space-y-4">
              {[{ zone: 'Kiddie', visits: 245, percentage: 85 }, { zone: 'Bump Car', visits: 198, percentage: 70 }, { zone: 'Skating', visits: 176, percentage: 62 }].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-ocean-blue" />
                      <span className="text-dark-slate">{item.zone}</span>
                    </div>
                    <span className="text-gray">{item.visits} visits</span>
                  </div>
                  <div className="h-2 bg-gray/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-ocean-blue to-sky-blue" style={{ width: `${item.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-dark-slate">Peak Activity Hours</h3>
              <button onClick={() => navigate('/analytics')} className="text-xs text-ocean-blue hover:underline">Details →</button>
            </div>
            <div className="space-y-4">
              {[
                { time: '2:00 PM - 4:00 PM', activity: 'Very High', percentage: 95, color: 'error' },
                { time: '12:00 PM - 2:00 PM', activity: 'High', percentage: 80, color: 'warning' },
                { time: '4:00 PM - 6:00 PM', activity: 'High', percentage: 75, color: 'warning' },
                { time: '10:00 AM - 12:00 PM', activity: 'Medium', percentage: 60, color: 'success' },
                { time: '6:00 PM - 8:00 PM', activity: 'Medium', percentage: 50, color: 'success' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-slate">{item.time}</span>
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      item.color === 'error' ? 'bg-error/10 text-error' :
                      item.color === 'warning' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                    }`}>{item.activity}</span>
                  </div>
                  <div className="h-2 bg-gray/10 rounded-full overflow-hidden">
                    <div className={`h-full ${
                      item.color === 'error' ? 'bg-error' : item.color === 'warning' ? 'bg-warning' : 'bg-emerald-green'
                    }`} style={{ width: `${item.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Total Customers */}
      {modal === 'customers' && (
        <Modal title="Customer Records" onClose={() => setModal(null)} size="lg">
          <div className="space-y-3">
            {allCustomers.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-light-gray rounded-xl">
                <div>
                  <p className="text-dark-slate font-medium">{c.name}</p>
                  <p className="text-xs text-gray">{c.package} · {c.zone}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-green font-medium">{c.amount}</p>
                  <p className="text-xs text-gray">{c.date}</p>
                </div>
              </div>
            ))}
            <button onClick={() => { setModal(null); navigate('/analytics'); }}
              className="w-full py-3 mt-2 border-2 border-ocean-blue text-ocean-blue rounded-xl hover:bg-ocean-blue hover:text-white transition-all">
              View Full Analytics →
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Monthly Revenue */}
      {modal === 'revenue' && (
        <Modal title="Monthly Revenue Breakdown" onClose={() => setModal(null)}>
          <div className="space-y-3">
            {revenueDetails.map((r, i) => (
              <div key={i} className="p-4 bg-light-gray rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-dark-slate">{r.source}</p>
                  <p className="text-emerald-green font-medium">{r.amount}</p>
                </div>
                <div className="h-2 bg-gray/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-green to-mint-green" style={{ width: `${r.pct}%` }}></div>
                </div>
                <p className="text-xs text-gray mt-1">{r.pct}% of total</p>
              </div>
            ))}
            <div className="pt-3 border-t border-gray/20 flex justify-between font-medium">
              <p className="text-dark-slate">Total</p>
              <p className="text-emerald-green">₱35,420</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Active Sessions */}
      {modal === 'sessions' && (
        <Modal title="Active Sessions" onClose={() => setModal(null)}>
          <div className="space-y-3">
            {activeSessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-light-gray rounded-xl">
                <div>
                  <p className="text-dark-slate font-medium">{s.name}</p>
                  <p className="text-xs text-gray font-mono">{s.rfid} · {s.zone}</p>
                </div>
                <div className="text-right">
                  <p className="text-dark-slate">{s.remaining}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.status === 'active' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}>{s.status}</span>
                </div>
              </div>
            ))}
            <button onClick={() => { setModal(null); navigate('/live-monitoring'); }}
              className="w-full py-3 mt-2 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all">
              Open Live Monitoring →
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: RFID Cards */}
      {modal === 'rfid' && (
        <Modal title="RFID Card Inventory" onClose={() => setModal(null)}>
          <div className="space-y-3">
            {rfidInventory.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-light-gray rounded-xl">
                <div>
                  <p className="text-dark-slate font-mono">{r.id}</p>
                  <p className="text-xs text-gray">{r.customer}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${
                  r.status === 'assigned' ? 'bg-ocean-blue/10 text-ocean-blue' :
                  r.status === 'available' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                }`}>{r.status}</span>
              </div>
            ))}
            <button onClick={() => { setModal(null); navigate('/rfid-management'); }}
              className="w-full py-3 mt-2 border-2 border-ocean-blue text-ocean-blue rounded-xl hover:bg-ocean-blue hover:text-white transition-all">
              Manage All RFID Cards →
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
