'use client';

import { useEffect, type ReactNode } from 'react';

export function DragDropProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Prevent browser from opening files when dropped outside the drop zone
    document.addEventListener('dragover', preventDefaults);
    document.addEventListener('drop', preventDefaults);

    return () => {
      document.removeEventListener('dragover', preventDefaults);
      document.removeEventListener('drop', preventDefaults);
    };
  }, []);

  return <>{children}</>;
}
