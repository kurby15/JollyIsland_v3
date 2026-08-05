import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'orange' | 'purple';
  trend?: string;
}

export default function StatCard({ title, value, icon: Icon, color = 'blue', trend }: StatCardProps) {
  const colorClasses = {
    blue: 'from-ocean-blue to-sky-blue',
    green: 'from-emerald-green to-mint-green',
    orange: 'from-orange-500 to-orange-400',
    purple: 'from-purple-500 to-purple-400',
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray/10 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <span className="text-xs text-success bg-success/10 px-2 py-1 rounded-lg">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-gray mb-1">{title}</p>
        <p className="text-3xl text-dark-slate">{value}</p>
      </div>
    </div>
  );
}
