'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function AnalyzingView() {
  const { analysisProgress } = useAppStore();

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-medium">{analysisProgress}</p>
        <p className="mt-1 text-xs text-muted-foreground">This may take a moment for large batches.</p>
      </div>
    </div>
  );
}
