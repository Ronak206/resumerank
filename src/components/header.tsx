'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

export function Header() {
  const [open, setOpen] = useState(false);
  const { currentView, setView, reset } = useAppStore();

  const handleNav = (view: string) => {
    if (view === 'upload') reset();
    setView(view as 'upload' | 'performance');
    setOpen(false);
  };

  const navItems: { view: string; label: string }[] = [
    { view: 'upload', label: 'Screen Resumes' },
    { view: 'performance', label: 'Performance' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 items-center justify-between px-5 max-w-6xl">
        <button
          onClick={() => handleNav('upload')}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-70"
        >
          <img src="/logo.svg" alt="ResumeRank" width="32" height="32" className="rounded" />
          <span className="text-lg font-bold tracking-tight text-gray-900">ResumeRank</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Button
              key={item.view}
              variant={currentView === item.view ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleNav(item.view)}
              className="text-sm"
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div className="border-t md:hidden">
          <div className="mx-auto flex flex-col gap-1 p-4 max-w-6xl">
            {navItems.map((item) => (
              <Button key={item.view} variant={currentView === item.view ? 'secondary' : 'ghost'} className="justify-start text-sm" onClick={() => handleNav(item.view)}>
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
