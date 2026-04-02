'use client';

import { Header } from '@/components/header';
import { UploadView } from '@/components/upload-view';
import { AnalyzingView } from '@/components/analyzing-view';
import { ResultsView } from '@/components/results-view';
import { SharedView } from '@/components/shared-view';
import { PerformanceView } from '@/components/performance-view';
import { useAppStore } from '@/lib/store';

export default function Home() {
  const { currentView } = useAppStore();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {currentView === 'upload' && <UploadView />}
        {currentView === 'analyzing' && <AnalyzingView />}
        {currentView === 'results' && <ResultsView />}
        {currentView === 'shared' && <SharedView />}
        {currentView === 'performance' && <PerformanceView />}
      </main>
    </div>
  );
}
