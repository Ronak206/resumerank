'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-500';
}

function getScoreVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  if (score >= 40) return 'outline';
  return 'destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Strong Match';
  if (score >= 60) return 'Good Fit';
  if (score >= 40) return 'Weak';
  return 'Poor';
}

function ResumeCard({ result, isExpanded, onToggle }: {
  result: { rank: number; resumeName: string; rawScore: number; normalizedScore: number; matchSummary: string; skillsMatched: string[]; skillsMissing: string[]; method?: string; semanticScore?: number; keywordScore?: number };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={result.rank === 1 ? 'border-emerald-300' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {result.rank <= 3 ? (
                <Badge variant={result.rank === 1 ? 'default' : result.rank === 2 ? 'secondary' : 'outline'}>
                  #{result.rank}
                </Badge>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">#{result.rank}</span>
              )}
              <span className="truncate text-sm font-medium">{result.resumeName}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>Score: <strong className={getScoreColor(result.rawScore)}>{result.rawScore}</strong>/100</span>
              <Badge variant="outline" className="h-5 text-xs px-1.5">{getScoreLabel(result.rawScore)}</Badge>
              <span>Norm: {Math.round(result.normalizedScore * 100)}%</span>
              {result.semanticScore !== undefined && (
                <>
                  <span>· Semantic {result.semanticScore}%</span>
                  <span>· Keywords {result.keywordScore}%</span>
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle} className="shrink-0 h-8 w-8 p-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <Progress value={result.rawScore} className="mt-2 h-1.5" />
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <Separator className="mb-3" />
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{result.matchSummary}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-xs font-medium">Matched Skills</p>
              <div className="flex flex-wrap gap-1">
                {result.skillsMatched.length > 0 ? result.skillsMatched.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs h-5">{s}</Badge>
                )) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium">Missing Skills</p>
              <div className="flex flex-wrap gap-1">
                {result.skillsMissing.length > 0 ? result.skillsMissing.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs h-5">{s}</Badge>
                )) : <span className="text-xs text-muted-foreground">All matched</span>}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function ResultsView() {
  const {
    results, totalProcessed, totalFailed, failedResumes,
    sessionId,
    filterMode, topNValue, topPercentValue,
    setFilterMode, setTopNValue, setTopPercentValue,
    reset,
  } = useAppStore();

  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set([0]));

  const filteredResults = (() => {
    if (filterMode === 'topN') {
      return results.slice(0, Math.min(topNValue, results.length));
    } else if (filterMode === 'topPercent') {
      const count = Math.max(1, Math.ceil((topPercentValue / 100) * results.length));
      return results.slice(0, count);
    }
    return results;
  })();
  const toggleCard = (i: number) => setExpandedCards((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const handleExport = () => {
    const h = ['Rank', 'Name', 'Score', 'Normalized', 'Summary', 'Matched', 'Missing'];
    const rows = filteredResults.map((r) => [r.rank, r.resumeName, r.rawScore, Math.round(r.normalizedScore * 100), `"${r.matchSummary.replace(/"/g, '""')}"`, `"${r.skillsMatched.join(', ')}"`, `"${r.skillsMissing.join(', ')}"`]);
    const blob = new Blob([[h, ...rows].map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'results.csv'; a.click();
    toast.success('Exported');
  };

  if (results.length === 0) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">No results.</p>
        <Button variant="outline" size="sm" onClick={reset} className="mt-3">New Analysis</Button>
      </div>
    </div>
  );

  const avg = Math.round(results.reduce((a, b) => a + b.rawScore, 0) / results.length);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Summary */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Results</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalProcessed} resumes · avg {avg}/100{totalFailed > 0 ? ` · ${totalFailed} failed` : ''}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={handleExport}>
              <Download className="h-3 w-3" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={reset}>
              <RotateCcw className="h-3 w-3" /> New
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Card className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Top Score</p>
            <p className="text-lg font-bold">{results[0]?.rawScore || 0}</p>
          </Card>
          <Card className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-lg font-bold">{avg}</p>
          </Card>
          <Card className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{totalProcessed}</p>
          </Card>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Hybrid scoring: 70% BERT semantic similarity + 30% keyword overlap. Scores normalized (raw &divide; highest).
        </p>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Show:</span>
        {(['all', 'topN', 'topPercent'] as const).map((m) => (
          <Button
            key={m}
            variant={filterMode === m ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilterMode(m)}
          >
            {m === 'all' ? `All (${results.length})` : m === 'topN' ? 'Top N' : 'Top %'}
          </Button>
        ))}
        {filterMode === 'topN' && (
          <Input type="number" min={1} max={results.length} value={topNValue}
            onChange={(e) => setTopNValue(Math.max(1, Math.min(results.length, parseInt(e.target.value) || 1)))}
            className="h-7 w-16 text-xs" />
        )}
        {filterMode === 'topPercent' && (
          <>
            <Input type="number" min={1} max={100} value={topPercentValue}
              onChange={(e) => setTopPercentValue(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="h-7 w-16 text-xs" />
            <span className="text-xs text-muted-foreground">%</span>
            <span className="text-xs text-muted-foreground">({Math.max(1, Math.ceil((topPercentValue / 100) * results.length))})</span>
          </>
        )}
      </div>

      {/* Warnings */}
      {failedResumes.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-xs font-medium text-amber-800">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {failedResumes.length} file{failedResumes.length > 1 ? 's' : ''} failed to parse
          </p>
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {filteredResults.map((result, i) => (
          <ResumeCard key={result.resumeName} result={result} isExpanded={expandedCards.has(i)} onToggle={() => toggleCard(i)} />
        ))}
      </div>

      {filteredResults.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No results match the current filter.</p>
      )}
    </div>
  );
}
