import { useState } from 'react';
import { ShieldCheck, CheckCircle, XCircle, CreditCard } from 'lucide-react';

export default function AccessValidation() {
  const [scanResult, setScanResult] = useState<any>(null);

  const recentValidations = [
    { id: 1, rfid: 'RFID-001', name: 'Emma Johnson', result: 'granted', reason: 'Valid access', time: '2:45 PM', zone: 'Trampoline Area' },
    { id: 2, rfid: 'RFID-099', name: 'Unknown', result: 'denied', reason: 'Invalid RFID', time: '2:40 PM', zone: 'Ball Pit' },
    { id: 3, rfid: 'RFID-002', name: 'Liam Smith', result: 'granted', reason: 'Valid access', time: '2:38 PM', zone: 'Climbing Area' },
    { id: 4, rfid: 'RFID-010', name: 'Mason Lee', result: 'denied', reason: 'Time expired', time: '2:35 PM', zone: 'Arcade Area' },
  ];

  const handleScan = () => {
    setScanResult({
      rfid: 'RFID-001',
      name: 'Emma Johnson',
      package: '2 Hour Play',
      timeRemaining: '45 minutes',
      zone: 'All Zones',
      status: 'granted'
    });
  };

  return (
    <>
    <div className="p-8">
        <div className="mb-8">
          <h1 className="text-dark-slate mb-2">Access Validation</h1>
          <p className="text-gray">Verify RFID card access and permissions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-8">
            <h3 className="text-dark-slate mb-6">RFID Scanner</h3>
            <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-ocean-blue/5 to-emerald-green/5 rounded-2xl border-2 border-dashed border-ocean-blue/30 mb-6">
              <div className="w-32 h-32 bg-gradient-to-br from-ocean-blue to-sky-blue rounded-full flex items-center justify-center mb-6 animate-pulse">
                <CreditCard className="w-16 h-16 text-white" />
              </div>
              <h4 className="text-dark-slate mb-2">Scan RFID Card</h4>
              <p className="text-gray text-center mb-6">Place card near reader to validate access</p>
              <button
                onClick={handleScan}
                className="px-8 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all"
              >
                Scan Now
              </button>
            </div>

            {/* Scan Result */}
            {scanResult && (
              <div className={`p-6 rounded-2xl border-2 ${
                scanResult.status === 'granted' ? 'bg-success/5 border-success' : 'bg-error/5 border-error'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-dark-slate">Validation Result</h4>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    scanResult.status === 'granted' ? 'bg-success' : 'bg-error'
                  }`}>
                    {scanResult.status === 'granted' ?
                      <CheckCircle className="w-6 h-6 text-white" /> :
                      <XCircle className="w-6 h-6 text-white" />
                    }
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray">RFID Number:</span>
                    <span className="text-dark-slate font-mono">{scanResult.rfid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray">Child Name:</span>
                    <span className="text-dark-slate">{scanResult.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray">Package Type:</span>
                    <span className="text-dark-slate">{scanResult.package}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray">Time Remaining:</span>
                    <span className="text-dark-slate">{scanResult.timeRemaining}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray">Zone Access:</span>
                    <span className="text-dark-slate">{scanResult.zone}</span>
                  </div>
                  <div className="pt-3 border-t border-gray/20">
                    <p className={`text-lg text-center ${
                      scanResult.status === 'granted' ? 'text-success' : 'text-error'
                    }`}>
                      {scanResult.status === 'granted' ? '✓ Access Granted' : '✗ Access Denied'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Validations */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <h3 className="text-dark-slate mb-6">Recent Validations</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {recentValidations.map((validation) => (
                <div key={validation.id} className={`p-4 rounded-xl border-l-4 ${
                  validation.result === 'granted' ? 'bg-success/5 border-success' : 'bg-error/5 border-error'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-dark-slate">{validation.name}</p>
                      <p className="text-xs text-gray font-mono">{validation.rfid}</p>
                    </div>
                    {validation.result === 'granted' ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-error" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray">{validation.zone}</span>
                    <span className="text-gray">{validation.time}</span>
                  </div>
                  <p className={`text-xs mt-2 ${
                    validation.result === 'granted' ? 'text-success' : 'text-error'
                  }`}>
                    {validation.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
