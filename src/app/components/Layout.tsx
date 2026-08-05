import { Outlet } from 'react-router';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Toaster } from 'sonner';

interface LayoutProps {
  role: 'admin' | 'cashier';
  username: string;
}

export default function Layout({ role, username }: LayoutProps) {
  return (
    <div className="flex h-screen bg-light-gray">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar role={role} username={username} />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
