import { useState } from 'react';
import Modal from '../components/Modal';
import { addNotification } from '../store/notificationStore';
import { toast } from 'sonner';
import {
  Database, Upload, Activity, Save, CheckCircle, AlertTriangle,
  Download, Filter, Loader2
} from 'lucide-react';

const ALL_ACTIVITY_LOGS = [
  { time: '3:05 PM', date: '2026-07-22', user: 'admin', action: 'Updated package pricing for 2-Hour Play', type: 'settings' },
  { time: '2:48 PM', date: '2026-07-22', user: 'cashier', action: 'Assigned RFID-004 to Noah Davis', type: 'rfid' },
  { time: '2:30 PM', date: '2026-07-22', user: 'admin', action: 'Added new RFID card RFID-011', type: 'rfid' },
  { time: '2:15 PM', date: '2026-07-22', user: 'cashier', action: 'Registered customer Emma Johnson', type: 'customer' },
  { time: '1:55 PM', date: '2026-07-22', user: 'admin', action: 'Exported analytics report (PDF)', type: 'export' },
  { time: '1:30 PM', date: '2026-07-22', user: 'cashier', action: 'Extended session for Liam Smith by 30 min', type: 'session' },
  { time: '1:00 PM', date: '2026-07-22', user: 'admin', action: 'System backup completed successfully', type: 'system' },
  { time: '12:45 PM', date: '2026-07-22', user: 'cashier', action: 'Logged in to cashier dashboard', type: 'auth' },
  { time: '12:30 PM', date: '2026-07-22', user: 'admin', action: 'Disabled RFID-006 (reported lost)', type: 'rfid' },
  { time: '12:00 PM', date: '2026-07-22', user: 'cashier', action: 'Registered customer Liam Smith', type: 'customer' },
  { time: '11:45 AM', date: '2026-07-22', user: 'admin', action: 'Added new package: Birthday Party (3-Hour)', type: 'package' },
  { time: '11:20 AM', date: '2026-07-22', user: 'cashier', action: 'Session expired — Noah Davis (RFID-004)', type: 'session' },
  { time: '10:55 AM', date: '2026-07-22', user: 'admin', action: 'Added cashier account: edavis', type: 'user' },
  { time: '10:30 AM', date: '2026-07-22', user: 'admin', action: 'Logged in to admin dashboard', type: 'auth' },
];

const LOG_TYPE_COLORS: Record<string, string> = {
  settings: 'bg-purple-100 text-purple-600',
  rfid: 'bg-ocean-blue/10 text-ocean-blue',
  customer: 'bg-emerald-green/10 text-emerald-green',
  session: 'bg-warning/10 text-warning',
  export: 'bg-sky-blue/10 text-sky-blue',
  system: 'bg-success/10 text-success',
  auth: 'bg-gray/10 text-gray',
  package: 'bg-pink-100 text-pink-600',
  user: 'bg-indigo-100 text-indigo-600',
};

export default function Settings() {
  const [modal, setModal] = useState<'backup' | 'restore' | 'logs' | 'save' | null>(null);
  const [exportingLogs, setExportingLogs] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupDone, setBackupDone] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreDone, setRestoreDone] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [logUserFilter, setLogUserFilter] = useState<'all' | 'admin' | 'cashier'>('all');
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  const [settings, setSettings] = useState({
    // Center Info
    centerName: 'JollyIsland Play Center',
    contactEmail: 'admin@jollyisland.com',
    phone: '+63 912 345 6789',
    address: '123 Fun Street, Quezon City',
    openTime: '09:00',
    closeTime: '20:00',
    // RFID & Session
    sessionAlertMinutes: '15',
    maxCapacity: '50',
    rfidPrefix: 'RFID',
    autoEndExpiredSessions: true,
    // Packages & Billing
    currency: 'PHP',
    defaultPackage: '1-Hour Play',
    // Notifications
    soundAlerts: true,
    alertBothRoles: false,
    emailNotifications: false,
    // Security
    autoLogout: '30',
    requirePasswordChange: false,
  });

  const closeModal = () => {
    setModal(null);
    setBackupProgress(0);
    setBackupDone(false);
    setRestoreConfirmed(false);
    setRestoreDone(false);
    setSaveDone(false);
  };

  const startBackup = () => {
    setBackupProgress(0);
    addNotification({ type: 'info', title: 'Backup Started', message: 'System data backup has been initiated.', role: 'admin' });
    toast.loading('Backup in progress…', { id: 'backup' });
    const interval = setInterval(() => {
      setBackupProgress(p => {
        if (p >= 100) { clearInterval(interval); setBackupDone(true); addNotification({ type: 'success', title: 'Backup Completed', message: 'System backup completed successfully. Data is secured.', role: 'admin' }); toast.success('Backup complete', { id: 'backup', description: 'All system data has been secured' }); return 100; }
        return p + 20;
      });
    }, 300);
  };

  const handleRestore = () => {
    setRestoreConfirmed(true);
    addNotification({ type: 'warning', title: 'Restore In Progress', message: 'System data restore has been initiated from backup file.', role: 'admin' });
    toast.loading('Restoring data…', { id: 'restore' });
    setTimeout(() => {
      setRestoreDone(true);
      addNotification({ type: 'success', title: 'Restore Completed', message: 'System data has been successfully restored from backup.', role: 'admin' });
      toast.success('Restore complete', { id: 'restore', description: 'System data restored from backup' });
    }, 1200);
  };

  const toggle = (key: string) =>
    setSettings(s => ({ ...s, [key]: !s[key as keyof typeof s] }));

  const filteredLogs = ALL_ACTIVITY_LOGS.filter(l => {
    const matchUser = logUserFilter === 'all' || l.user === logUserFilter;
    const matchType = logTypeFilter === 'all' || l.type === logTypeFilter;
    return matchUser && matchType;
  });

  return (
    <>
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-dark-slate mb-2">Settings</h1>
          <p className="text-gray">System configuration for JollyIsland RFID Play Center</p>
        </div>
        <button onClick={() => { setModal('save'); setSaveDone(false); }}
          className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2">
          <Save className="w-5 h-5" /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Center Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <h3 className="text-dark-slate mb-1">Center Information</h3>
          <p className="text-xs text-gray mb-5">Basic details shown across the system</p>
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-gray text-sm">Center Name</label>
              <input value={settings.centerName}
                onChange={e => setSettings({ ...settings, centerName: e.target.value })}
                className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-gray text-sm">Contact Email</label>
                <input type="email" value={settings.contactEmail}
                  onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm">Phone Number</label>
                <input value={settings.phone}
                  onChange={e => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-gray text-sm">Address</label>
              <input value={settings.address}
                onChange={e => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-gray text-sm">Open Time</label>
                <input type="time" value={settings.openTime}
                  onChange={e => setSettings({ ...settings, openTime: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm">Close Time</label>
                <input type="time" value={settings.closeTime}
                  onChange={e => setSettings({ ...settings, closeTime: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* RFID & Session Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <h3 className="text-dark-slate mb-1">RFID & Session Settings</h3>
          <p className="text-xs text-gray mb-5">Controls how RFID cards and play sessions behave</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-gray text-sm">Session Alert (min before expiry)</label>
                <input type="number" min="5" max="60" value={settings.sessionAlertMinutes}
                  onChange={e => setSettings({ ...settings, sessionAlertMinutes: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm">Max Center Capacity</label>
                <input type="number" min="1" value={settings.maxCapacity}
                  onChange={e => setSettings({ ...settings, maxCapacity: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-gray text-sm">RFID Card ID Prefix</label>
              <div className="flex gap-2 items-center">
                <input value={settings.rfidPrefix}
                  onChange={e => setSettings({ ...settings, rfidPrefix: e.target.value })}
                  className="flex-1 px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
                <span className="text-gray text-sm">e.g. {settings.rfidPrefix}-001</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-gray text-sm">Currency</label>
                <select value={settings.currency}
                  onChange={e => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none">
                  <option value="PHP">PHP — Philippine Peso</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="SGD">SGD — Singapore Dollar</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm">Default Package</label>
                <select value={settings.defaultPackage}
                  onChange={e => setSettings({ ...settings, defaultPackage: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none">
                  <option>1-Hour Play</option>
                  <option>2-Hour Play</option>
                  <option>Unlimited Play</option>
                </select>
              </div>
            </div>
            <div className="space-y-3 pt-1">
              {[
                { key: 'autoEndExpiredSessions', label: 'Auto-end expired sessions', sub: 'Automatically mark sessions as complete when time runs out' },
              ].map(({ key, label, sub }) => (
                <div key={key} className="flex items-start gap-3">
                  <div onClick={() => toggle(key)}
                    className={`w-10 h-6 rounded-full flex-shrink-0 transition-all cursor-pointer mt-0.5 ${settings[key as keyof typeof settings] ? 'bg-ocean-blue' : 'bg-gray/30'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-all ${settings[key as keyof typeof settings] ? 'translate-x-5' : 'translate-x-1'}`}></div>
                  </div>
                  <div>
                    <p className="text-dark-slate text-sm">{label}</p>
                    <p className="text-gray text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications & Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <h3 className="text-dark-slate mb-1">Notifications & Alerts</h3>
          <p className="text-xs text-gray mb-5">Configure how the system notifies staff</p>
          <div className="space-y-4">
            {[
              { key: 'soundAlerts', label: 'Sound alerts for expiring sessions', sub: 'Play a beep when a session is about to expire' },
              { key: 'alertBothRoles', label: 'Notify both Admin and Cashier', sub: 'Session alerts appear in both role dashboards' },
              { key: 'emailNotifications', label: 'Email notifications', sub: 'Send daily summary reports to contact email' },
            ].map(({ key, label, sub }) => (
              <div key={key} className="flex items-start gap-3 py-2 border-b border-gray/10 last:border-0">
                <div onClick={() => toggle(key)}
                  className={`w-10 h-6 rounded-full flex-shrink-0 transition-all cursor-pointer mt-0.5 ${settings[key as keyof typeof settings] ? 'bg-ocean-blue' : 'bg-gray/30'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-all ${settings[key as keyof typeof settings] ? 'translate-x-5' : 'translate-x-1'}`}></div>
                </div>
                <div>
                  <p className="text-dark-slate text-sm">{label}</p>
                  <p className="text-gray text-xs">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <h3 className="text-dark-slate mb-1">Security</h3>
          <p className="text-xs text-gray mb-5">Session and access control settings</p>
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-gray text-sm">Auto-logout after inactivity (minutes)</label>
              <input type="number" min="5" max="120" value={settings.autoLogout}
                onChange={e => setSettings({ ...settings, autoLogout: e.target.value })}
                className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none" />
              <p className="text-xs text-gray mt-1">Applies to both admin and cashier sessions</p>
            </div>
            <div className="flex items-start gap-3 pt-2">
              <div onClick={() => toggle('requirePasswordChange')}
                className={`w-10 h-6 rounded-full flex-shrink-0 transition-all cursor-pointer mt-0.5 ${settings.requirePasswordChange ? 'bg-ocean-blue' : 'bg-gray/30'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-all ${settings.requirePasswordChange ? 'translate-x-5' : 'translate-x-1'}`}></div>
              </div>
              <div>
                <p className="text-dark-slate text-sm">Require password change on first login</p>
                <p className="text-gray text-xs">New cashier accounts must reset their password</p>
              </div>
            </div>
            <div className="p-4 bg-light-gray rounded-xl mt-2">
              <p className="text-xs text-gray mb-2 font-medium">Current System Accounts</p>
              {[
                { user: 'admin', role: 'Admin', status: 'Active' },
                { user: 'manager', role: 'Admin', status: 'Active' },
                { user: 'cashier', role: 'Cashier', status: 'Active' },
                { user: 'staff', role: 'Cashier', status: 'Active' },
              ].map(a => (
                <div key={a.user} className="flex justify-between items-center py-1.5 border-b border-gray/10 last:border-0">
                  <span className="text-dark-slate text-sm font-mono">{a.user}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.role === 'Admin' ? 'bg-purple-100 text-purple-600' : 'bg-ocean-blue/10 text-ocean-blue'}`}>{a.role}</span>
                    <span className="text-xs text-success">{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <h3 className="text-dark-slate mb-1">Data Management</h3>
          <p className="text-xs text-gray mb-5">Admin-only tools for data integrity and audit</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button onClick={() => { setModal('backup'); setBackupProgress(0); setBackupDone(false); }}
              className="p-6 bg-gradient-to-br from-ocean-blue/5 to-sky-blue/5 border-2 border-ocean-blue/20 rounded-2xl hover:border-ocean-blue/50 transition-all text-left group">
              <div className="w-12 h-12 bg-ocean-blue/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-ocean-blue/20 transition-all">
                <Database className="w-6 h-6 text-ocean-blue" />
              </div>
              <h4 className="text-dark-slate mb-1">Backup Database</h4>
              <p className="text-gray text-sm">Export full backup — customers, RFID, packages, logs</p>
            </button>
            <button onClick={() => { setModal('restore'); setRestoreConfirmed(false); setRestoreDone(false); }}
              className="p-6 bg-gradient-to-br from-emerald-green/5 to-mint-green/5 border-2 border-emerald-green/20 rounded-2xl hover:border-emerald-green/50 transition-all text-left group">
              <div className="w-12 h-12 bg-emerald-green/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-green/20 transition-all">
                <Upload className="w-6 h-6 text-emerald-green" />
              </div>
              <h4 className="text-dark-slate mb-1">Restore Database</h4>
              <p className="text-gray text-sm">Restore from a previous backup file</p>
            </button>
            <button onClick={() => { setModal('logs'); setLogUserFilter('all'); setLogTypeFilter('all'); }}
              className="p-6 bg-gradient-to-br from-warning/5 to-orange-50 border-2 border-warning/20 rounded-2xl hover:border-warning/50 transition-all text-left group">
              <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-warning/20 transition-all">
                <Activity className="w-6 h-6 text-warning" />
              </div>
              <h4 className="text-dark-slate mb-1">Admin Activity Logs</h4>
              <p className="text-gray text-sm">Audit trail of all admin and cashier actions</p>
            </button>
          </div>
        </div>

      </div>
    </div>

    {/* Backup Modal */}
    {modal === 'backup' && (
      <Modal title="Backup Database" onClose={closeModal}>
        {!backupDone ? (
          <div className="space-y-4">
            <p className="text-gray text-sm">Creates a complete snapshot of all system data. The file will download automatically.</p>
            <div className="p-4 bg-light-gray rounded-xl">
              <p className="text-xs text-gray mb-3 font-medium">Data included in backup</p>
              {[
                ['Customers', '4 records'],
                ['RFID Cards', '10 cards'],
                ['Packages', '3 active packages'],
                ['Session Logs', "Today's sessions"],
                ['Entry/Exit Logs', 'All time logs'],
                ['Cashier Accounts', '4 users'],
                ['System Settings', 'Current config'],
              ].map(([item, detail]) => (
                <div key={item} className="flex justify-between text-xs py-1.5 border-b border-gray/10 last:border-0">
                  <span className="text-dark-slate">{item}</span>
                  <span className="text-gray">{detail}</span>
                </div>
              ))}
            </div>
            {backupProgress > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray">Backing up...</span>
                  <span className="text-dark-slate font-medium">{backupProgress}%</span>
                </div>
                <div className="h-3 bg-gray/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-ocean-blue to-sky-blue transition-all duration-300 rounded-full"
                    style={{ width: `${backupProgress}%` }}></div>
                </div>
              </div>
            )}
            {backupProgress === 0 && (
              <button onClick={startBackup}
                className="w-full py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2">
                <Database className="w-4 h-4" /> Start Backup
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h4 className="text-dark-slate mb-2">Backup Complete!</h4>
            <p className="text-gray mb-1 text-sm">File: <strong className="text-dark-slate">jollyisland_backup_2026-07-22.zip</strong></p>
            <p className="text-gray mb-6 text-sm">Saved to your downloads folder.</p>
            <button onClick={closeModal} className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all">Done</button>
          </div>
        )}
      </Modal>
    )}

    {/* Restore Modal */}
    {modal === 'restore' && (
      <Modal title="Restore Database" onClose={closeModal} size="sm">
        {!restoreConfirmed ? (
          <div className="space-y-4">
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl flex gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-dark-slate text-sm font-medium">This will overwrite all current data.</p>
                <p className="text-gray text-xs mt-1">All customers, RFID cards, sessions, and logs will be replaced. This cannot be undone.</p>
              </div>
            </div>
            <div>
              <label className="block mb-2 text-gray text-sm">Select Backup File</label>
              <div className="border-2 border-dashed border-gray/30 rounded-xl p-6 text-center hover:border-emerald-green/50 transition-all cursor-pointer">
                <Upload className="w-8 h-8 text-gray mx-auto mb-2" />
                <p className="text-gray text-sm">Click to browse or drag & drop</p>
                <p className="text-gray text-xs mt-1">Supports .zip, .sql, .json</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleRestore}
                className="flex-1 py-3 bg-emerald-green text-white rounded-xl hover:bg-green-600 transition-all">
                Restore Now
              </button>
              <button onClick={closeModal} className="px-4 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all">Cancel</button>
            </div>
          </div>
        ) : !restoreDone ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 border-4 border-emerald-green/20 border-t-emerald-green rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray">Restoring database...</p>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h4 className="text-dark-slate mb-2">Restore Complete!</h4>
            <p className="text-gray mb-6">Database has been restored successfully.</p>
            <button onClick={closeModal} className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all">Done</button>
          </div>
        )}
      </Modal>
    )}

    {/* Activity Logs Modal — admin only, no cashier redirect */}
    {modal === 'logs' && (
      <Modal title="Admin Activity Logs" onClose={closeModal} size="lg">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex bg-light-gray p-1 rounded-xl border border-gray/10">
            {(['all', 'admin', 'cashier'] as const).map(u => (
              <button key={u} onClick={() => setLogUserFilter(u)}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${logUserFilter === u ? 'bg-white text-dark-slate shadow-sm' : 'text-gray hover:text-dark-slate'}`}>
                {u === 'all' ? 'All Users' : u.charAt(0).toUpperCase() + u.slice(1)}
              </button>
            ))}
          </div>
          <select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-light-gray border border-gray/20 rounded-xl text-xs text-gray focus:outline-none focus:border-ocean-blue">
            <option value="all">All Types</option>
            <option value="rfid">RFID</option>
            <option value="customer">Customer</option>
            <option value="session">Session</option>
            <option value="package">Package</option>
            <option value="settings">Settings</option>
            <option value="auth">Auth</option>
            <option value="system">System</option>
            <option value="export">Export</option>
          </select>
          <span className="text-xs text-gray self-center ml-auto">{filteredLogs.length} entries</span>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-gray text-sm">No logs match your filters.</div>
          ) : filteredLogs.map((log, i) => (
            <div key={i} className="flex gap-3 p-3 bg-light-gray rounded-xl hover:bg-gray/10 transition-colors items-start">
              <div className="text-right flex-shrink-0 w-16">
                <span className="text-gray text-xs font-mono">{log.time}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full h-fit flex-shrink-0 font-medium ${
                log.user === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-ocean-blue/10 text-ocean-blue'
              }`}>{log.user}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full h-fit flex-shrink-0 capitalize ${LOG_TYPE_COLORS[log.type]}`}>{log.type}</span>
              <span className="text-dark-slate text-sm flex-1">{log.action}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray/20">
          <span className="text-gray text-xs">Showing {filteredLogs.length} of {ALL_ACTIVITY_LOGS.length} total entries — today only</span>
          <button
            onClick={() => {
              setExportingLogs(true);
              setTimeout(() => {
                const rows = filteredLogs.map(l => `${l.date} ${l.time}\t${l.user}\t${l.type}\t${l.action}`).join('\n');
                const blob = new Blob([`Date\tTime\tUser\tType\tAction\n${rows}`], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'activity_logs.txt'; a.click();
                URL.revokeObjectURL(url);
                setExportingLogs(false);
                addNotification({ type: 'success', title: 'Logs Exported', message: `${filteredLogs.length} activity log entries exported.`, role: 'admin' });
                toast.success('Activity logs exported', { description: `${filteredLogs.length} entries saved as activity_logs.txt` });
              }, 700);
            }}
            disabled={exportingLogs}
            className="flex items-center gap-1.5 px-4 py-2 border-2 border-gray/20 text-gray rounded-xl text-xs hover:bg-gray/10 transition-all disabled:opacity-60">
            {exportingLogs ? <><Loader2 className="w-3 h-3 animate-spin" /> Exporting…</> : <><Download className="w-3 h-3" /> Export Logs</>}
          </button>
        </div>
      </Modal>
    )}

    {/* Save Changes Modal */}
    {modal === 'save' && (
      <Modal title="Save Settings" onClose={closeModal} size="sm">
        {!saveDone ? (
          <div className="space-y-4">
            <p className="text-gray text-sm">The following settings will be applied system-wide:</p>
            <div className="p-4 bg-light-gray rounded-xl space-y-1.5">
              {[
                `Center: ${settings.centerName}`,
                `Hours: ${settings.openTime} – ${settings.closeTime}`,
                `Session alert: ${settings.sessionAlertMinutes} min before expiry`,
                `Max capacity: ${settings.maxCapacity} children`,
                `Currency: ${settings.currency}`,
                `Auto-logout: ${settings.autoLogout} min`,
                `Default package: ${settings.defaultPackage}`,
              ].map((item, i) => (
                <div key={i} className="text-xs text-dark-slate py-0.5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-ocean-blue rounded-full flex-shrink-0"></div>
                  {item}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                setSavingSettings(true);
                setTimeout(() => {
                  setSavingSettings(false);
                  setSaveDone(true);
                  addNotification({ type: 'success', title: 'Settings Saved', message: 'System settings have been saved and applied.', role: 'admin' });
                  toast.success('Settings saved', { description: 'All changes applied system-wide' });
                }, 700);
              }} disabled={savingSettings}
                className="flex-1 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                {savingSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save All Settings'}
              </button>
              <button onClick={closeModal} className="px-4 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h4 className="text-dark-slate mb-2">Settings Saved!</h4>
            <p className="text-gray mb-6 text-sm">All changes have been applied to the JollyIsland system.</p>
            <button onClick={closeModal} className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all">Done</button>
          </div>
        )}
      </Modal>
    )}
    </>
  );
}
