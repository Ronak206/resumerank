'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Trophy,
  FileText,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done' };

function CardExpandButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </Button>
  );
}

function ResultCard({
  result,
  expanded,
  onToggle,
}: {
  result: {
    rank: number;
    resumeName: string;
    rawScore: number;
    matchSummary: string;
    skillsMatched: string[];
    skillsMissing: string[];
  };
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={result.rank === 1 ? 'overflow-hidden ring-2 ring-emerald-500' : 'overflow-hidden'}>
      <div className={`${getScoreBg(result.rawScore)} px-4 py-2 text-white`}>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Score: {result.rawScore}/100</span>
          <span>Rank #{result.rank}</span>
        </div>
      </div>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {result.rank === 1 ? (
              <Badge className="gap-1 bg-yellow-500 text-white">
                <Trophy className="h-3 w-3" /> #1
              </Badge>
            ) : (
              <Badge variant="secondary">#{result.rank}</Badge>
            )}
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {result.resumeName}
            </CardTitle>
          </div>
          <CardExpandButton expanded={expanded} onClick={onToggle} />
        </div>
        <Progress value={result.rawScore} className="mt-3 h-2" />
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          <p className="mb-4 text-sm text-muted-foreground">{result.matchSummary}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-emerald-600">
                <Check className="h-4 w-4" /> Skills Matched
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.skillsMatched.map((s, i) => (
                  <Badge key={i} variant="secondary" className="bg-emerald-50 text-xs text-emerald-700">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-600">
                <AlertTriangle className="h-4 w-4" /> Skills Missing
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.skillsMissing.map((s, i) => (
                  <Badge key={i} variant="secondary" className="bg-amber-50 text-xs text-amber-700">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function SharedView() {
  const { sharedResult, setSharedResult, setView } = useAppStore();
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || window.location.pathname.split('/s/')[1];

    if (!code) {
      // Trigger async to satisfy lint rule
      Promise.resolve().then(() => {
        if (!cancelled) setFetchState({ status: 'error', message: 'Invalid share link.' });
      });
      return;
    }

    fetch(`/api/share/${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setSharedResult({
            jobTitle: data.jobTitle,
            jobDescription: data.jobDescription,
            totalResumes: data.totalResumes,
            createdAt: data.createdAt,
            results: data.results,
          });
          setFetchState({ status: 'done' });
        } else {
          setFetchState({ status: 'error', message: data.error || 'Failed to load results.' });
        }
      })
      .catch(() => {
        if (!cancelled) setFetchState({ status: 'error', message: 'Failed to load results.' });
      });

    return () => { cancelled = true; };
  }, [setSharedResult]);

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (fetchState.status === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-muted-foreground">Loading shared results...</p>
        </div>
      </div>
    );
  }

  if (fetchState.status === 'error') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="mb-2 text-xl font-bold">Link Error</h2>
          <p className="text-muted-foreground">{fetchState.message}</p>
          <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setView('upload')}>
            Start New Analysis
          </Button>
        </div>
      </div>
    );
  }

  if (!sharedResult) return null;

  const avgScore = Math.round(
    sharedResult.results.reduce((a, b) => a + b.rawScore, 0) / sharedResult.results.length
  );
  const topScore = sharedResult.results[0]?.rawScore || 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <section className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              Shared Results
            </div>
            <h2 className="text-2xl font-bold">
              {sharedResult.jobTitle || 'Resume Analysis Results'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {sharedResult.totalResumes} resumes analyzed &middot; Avg score: {avgScore}/100
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <Trophy className="h-4 w-4" /> Top Score
                </div>
                <p className="mt-1 text-3xl font-bold text-emerald-700">{topScore}</p>
              </div>
              <div className="rounded-xl border bg-blue-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <TrendingUp className="h-4 w-4" /> Average
                </div>
                <p className="mt-1 text-3xl font-bold text-blue-700">{avgScore}</p>
              </div>
              <div className="rounded-xl border bg-purple-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                  <Users className="h-4 w-4" /> Total
                </div>
                <p className="mt-1 text-3xl font-bold text-purple-700">{sharedResult.results.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-6">
        <div className="space-y-4">
          {sharedResult.results.map((result, index) => (
            <ResultCard
              key={result.resumeName}
              result={result}
              expanded={expandedCards.has(index)}
              onToggle={() => toggleCard(index)}
            />
          ))}
        </div>
      </section>

      <section className="border-t bg-white">
        <div className="container mx-auto max-w-6xl px-4 py-8 text-center">
          <p className="mb-1 text-muted-foreground">Want to analyze your own resumes?</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Scores powered by BERT embeddings (all-MiniLM-L6-v2, 384-dim) with hybrid scoring (70% semantic + 30% keyword).
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setView('upload')}>
            Try ResumeRank
          </Button>
        </div>
      </section>
    </div>
  );
}
