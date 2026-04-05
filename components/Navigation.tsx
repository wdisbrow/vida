'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/',        label: 'Today',   emoji: '🏠' },
  { href: '/tasks',   label: 'Tasks',   emoji: '✅' },
  { href: '/summary', label: 'Summary', emoji: '📊' },
  { href: '/goals',   label: 'Goals',   emoji: '🎯' },
  { href: '/profile', label: 'Profile', emoji: '👤' },
];

export default function Navigation() {
  const pathname = usePathname();

  // Don't show nav on the login page
  if (pathname === '/login') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors
                ${active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <span className="text-2xl">{tab.emoji}</span>
              <span className={`text-xs font-medium ${active ? 'text-blue-600' : ''}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
