import { useState } from 'react';
import Modal from '../components/Modal';
import { Download, Filter, CheckCircle, Loader2 } from 'lucide-react';
import { addNotification } from '../store/notificationStore';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const ALL_DATA: Record<string, { name: string; visitors: number; revenue: number }[]> = {
  daily: [
    { name: 'Mon', visitors: 45, revenue: 675 }, { name: 'Tue', visitors: 52, revenue: 780 },
    { name: 'Wed', visitors: 48, revenue: 720 }, { name: 'Thu', visitors: 61, revenue: 915 },
    { name: 'Fri', visitors: 75, revenue: 1125 }, { name: 'Sat', visitors: 120, revenue: 1800 },
    { name: 'Sun', visitors: 95, revenue: 1425 },
  ],
  weekly: [
    { name: 'Week 1', visitors: 320, revenue: 4800 }, { name: 'Week 2', visitors: 410, revenue: 6150 },
    { name: 'Week 3', visitors: 390, revenue: 5850 }, { name: 'Week 4', visitors: 480, revenue: 7200 },
  ],
  monthly: [
    { name: 'Jan', visitors: 1240, revenue: 18600 }, { name: 'Feb', visitors: 1380, revenue: 20700 },
    { name: 'Mar', visitors: 1520, revenue: 22800 }, { name: 'Apr', visitors: 1650, revenue: 24750 },
    { name: 'May', visitors: 1890, revenue: 28350 }, { name: 'Jun', visitors: 680, revenue: 10200 },
  ],
  yearly: [
    { name: '2022', visitors: 12400, revenue: 186000 }, { name: '2023', visitors: 15800, revenue: 237000 },
    { name: '2024', visitors: 18900, revenue: 283500 }, { name: '2025', visitors: 21200, revenue: 318000 },
  ],
};

const zoneUsage = [
  { name: 'Kiddie', value: 245, color: '#0EA5E9' },
  { name: 'Bump Car', value: 198, color: '#10B981' },
  { name: 'Skating', value: 176, color: '#38BDF8' },
];

const peakHours = [
  { hour: '10 AM', count: 12 }, { hour: '11 AM', count: 25 }, { hour: '12 PM', count: 42 },
  { hour: '1 PM', count: 55 }, { hour: '2 PM', count: 68 }, { hour: '3 PM', count: 72 },
  { hour: '4 PM', count: 65 }, { hour: '5 PM', count: 48 }, { hour: '6 PM', count: 35 },
];

export default function AnalyticsReports() {
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartData, setChartData] = useState(ALL_DATA.monthly);
  const [exportType, setExportType] = useState<'pdf' | 'excel' | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleApplyFilters = () => setChartData(ALL_DATA[period] ?? ALL_DATA.monthly);

  const openExport = (type: 'pdf' | 'excel') => { setExportType(type); setExportDone(false); setIsExporting(false); };
  const closeExport = () => { setExportType(null); setExportDone(false); setIsExporting(false); };

  const handleDownload = () => {
    if (!exportType) return;
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportDone(true);
      addNotification({ type: 'success', title: `${exportType.toUpperCase()} Exported`, message: `Analytics report exported as ${exportType.toUpperCase()} (${period} data).`, role: 'admin' });
      toast.success(`${exportType.toUpperCase()} export ready`, { description: `${chartData.length} entries · ${period} report` });
    }, 800);
  };

  return (
    <>
    <div className="p-8">
        <div className="mb-8">
          <h1 className="text-dark-slate mb-2">Analytics & Reports</h1>
          <p className="text-gray">Comprehensive insights and data analysis</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block mb-2 text-gray">Time Period</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                className="px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-gray">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block mb-2 text-gray">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors" />
            </div>
            <button onClick={handleApplyFilters}
              className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2">
              <Filter className="w-4 h-4" /> Apply Filters
            </button>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => openExport('pdf')}
                className="px-6 py-3 border-2 border-ocean-blue text-ocean-blue rounded-xl hover:bg-ocean-blue hover:text-white transition-all flex items-center gap-2">
                <Download className="w-4 h-4" /> Export PDF
              </button>
              <button onClick={() => openExport('excel')}
                className="px-6 py-3 border-2 border-emerald-green text-emerald-green rounded-xl hover:bg-emerald-green hover:text-white transition-all flex items-center gap-2">
                <Download className="w-4 h-4" /> Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Shared SVG gradient defs */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id="analyticsMonthlyVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" /><stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="analyticsPeakHours" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#34D399" />
            </linearGradient>
          </defs>
        </svg>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <h3 className="text-dark-slate mb-6">Visitors ({period.charAt(0).toUpperCase() + period.slice(1)})</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#64748B" /><YAxis stroke="#64748B" /><Tooltip />
                <Bar dataKey="visitors" fill="url(#analyticsMonthlyVisitors)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <h3 className="text-dark-slate mb-6">Zone Usage Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={zoneUsage} cx="50%" cy="50%" labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100} dataKey="value">
                  {zoneUsage.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <h3 className="text-dark-slate mb-6">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#64748B" /><YAxis stroke="#64748B" /><Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <h3 className="text-dark-slate mb-6">Peak Activity Hours</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#64748B" /><YAxis stroke="#64748B" /><Tooltip />
                <Bar dataKey="count" fill="url(#analyticsPeakHours)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {exportType && (
        <Modal title={`Export ${exportType === 'pdf' ? 'PDF' : 'Excel'} Report`} onClose={closeExport} size="sm">
          {!exportDone ? (
            <div className="space-y-4">
              <p className="text-gray">Export analytics data as a <strong className="text-dark-slate">{exportType === 'pdf' ? 'PDF' : 'Excel'}</strong> file.</p>
              <div className="p-4 bg-light-gray rounded-xl space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray">Period:</span><span className="text-dark-slate capitalize">{period}</span></div>
                {startDate && <div className="flex justify-between"><span className="text-gray">From:</span><span className="text-dark-slate">{startDate}</span></div>}
                {endDate && <div className="flex justify-between"><span className="text-gray">To:</span><span className="text-dark-slate">{endDate}</span></div>}
                <div className="flex justify-between"><span className="text-gray">Records:</span><span className="text-dark-slate">{chartData.length} entries</span></div>
                <div className="border-t border-gray/20 pt-2 space-y-1">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray">{d.name}</span>
                      <span className="text-dark-slate">{d.visitors} visitors</span>
                      <span className="text-emerald-green">₱{d.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleDownload} disabled={isExporting}
                  className={`flex-1 py-3 text-white rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${
                    exportType === 'pdf' ? 'bg-gradient-to-r from-ocean-blue to-sky-blue' : 'bg-gradient-to-r from-emerald-green to-mint-green'
                  }`}>
                  {isExporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Download className="w-4 h-4" /> Download {exportType === 'pdf' ? 'PDF' : 'Excel'}</>}
                </button>
                <button onClick={closeExport} className="px-4 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h4 className="text-dark-slate mb-2">Export Ready!</h4>
              <p className="text-gray mb-6">Your {exportType === 'pdf' ? 'PDF' : 'Excel'} report has been generated successfully.</p>
              <button onClick={closeExport} className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all">Done</button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
