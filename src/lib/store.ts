import { create } from 'zustand';

export type AppView = 'upload' | 'analyzing' | 'results' | 'shared' | 'performance';

export interface ResumeScore {
  resumeName: string;
  rawScore: number;
  normalizedScore: number;
  matchSummary: string;
  skillsMatched: string[];
  skillsMissing: string[];
  rank: number;
  method?: 'bert' | 'llm';
  semanticScore?: number;
  keywordScore?: number;
}

export interface SharedResult {
  jobTitle: string | null;
  jobDescription: string;
  totalResumes: number;
  createdAt: string;
  results: ResumeScore[];
}

interface AppState {
  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Analysis state
  jobDescription: string;
  jobTitle: string;
  setJobDescription: (desc: string) => void;
  setJobTitle: (title: string) => void;

  // Results
  results: ResumeScore[];
  sessionId: string | null;
  totalProcessed: number;
  totalFailed: number;
  failedResumes: { name: string; error: string }[];
  setResults: (results: ResumeScore[], sessionId: string, processed: number, failed: number, failedResumes: { name: string; error: string }[]) => void;

  // Filters
  filterMode: 'all' | 'topN' | 'topPercent';
  topNValue: number;
  topPercentValue: number;
  setFilterMode: (mode: 'all' | 'topN' | 'topPercent') => void;
  setTopNValue: (value: number) => void;
  setTopPercentValue: (value: number) => void;
  getFilteredResults: () => ResumeScore[];

  // Share
  shareCode: string | null;
  setShareCode: (code: string | null) => void;

  // Shared view
  sharedResult: SharedResult | null;
  setSharedResult: (result: SharedResult | null) => void;

  // Analyzing state
  analysisProgress: string;
  setAnalysisProgress: (progress: string) => void;

  // Reset
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'upload',
  setView: (view) => set({ currentView: view }),

  jobDescription: '',
  jobTitle: '',
  setJobDescription: (desc) => set({ jobDescription: desc }),
  setJobTitle: (title) => set({ jobTitle: title }),

  results: [],
  sessionId: null,
  totalProcessed: 0,
  totalFailed: 0,
  failedResumes: [],
  setResults: (results, sessionId, processed, failed, failedResumes) =>
    set({ results, sessionId, totalProcessed: processed, totalFailed: failed, failedResumes }),

  filterMode: 'all',
  topNValue: 5,
  topPercentValue: 20,
  setFilterMode: (mode) => set({ filterMode: mode }),
  setTopNValue: (value) => set({ topNValue: value }),
  setTopPercentValue: (value) => set({ topPercentValue: value }),
  getFilteredResults: () => {
    const { results, filterMode, topNValue, topPercentValue } = get();
    if (filterMode === 'topN') {
      return results.slice(0, Math.min(topNValue, results.length));
    } else if (filterMode === 'topPercent') {
      const count = Math.max(1, Math.ceil((topPercentValue / 100) * results.length));
      return results.slice(0, count);
    }
    return results;
  },

  shareCode: null,
  setShareCode: (code) => set({ shareCode: code }),

  sharedResult: null,
  setSharedResult: (result) => set({ sharedResult: result }),

  analysisProgress: 'Uploading resumes...',
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),

  reset: () =>
    set({
      currentView: 'upload',
      jobDescription: '',
      jobTitle: '',
      results: [],
      sessionId: null,
      totalProcessed: 0,
      totalFailed: 0,
      failedResumes: [],
 filterMode: 'all',
      shareCode: null,
      sharedResult: null,
      analysisProgress: 'Uploading resumes...',
    }),
}));
