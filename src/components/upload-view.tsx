'use client';

import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Upload,
  FileText,
  X,
  ArrowRight,
  AlertCircle,
  Briefcase,
  Zap,
  Cpu,
} from 'lucide-react';
import { toast } from 'sonner';

export function UploadView() {
  const {
    jobDescription,
    setJobDescription,
    jobTitle,
    setJobTitle,
    setView,
    setResults,
    setAnalysisProgress,
  } = useAppStore();

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => /\.(pdf|docx|doc|txt)$/i.test(f.name));
    const invalid = arr.filter((f) => !/\.(pdf|docx|doc|txt)$/i.test(f.name));

    if (invalid.length > 0) {
      toast.error(`${invalid.length} file(s) skipped — only PDF, DOCX, or TXT are supported.`);
    }
    if (valid.length === 0 && invalid.length === 0) return;

    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const toAdd = valid.filter((f) => !existing.has(f.name));
      return [...prev, ...toAdd];
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    const newErrors: string[] = [];
    if (!jobDescription.trim()) newErrors.push('Please provide a job description.');
    if (files.length === 0) newErrors.push('Please upload at least one resume.');
    if (files.length > 50) newErrors.push('Maximum 50 resumes per analysis.');
    setErrors(newErrors); if (newErrors.length > 0) return;

    setIsAnalyzing(true); setView('analyzing');
    try {
      setAnalysisProgress('Uploading files...');
      const formData = new FormData();
      formData.append('jobDescription', jobDescription);
      formData.append('jobTitle', jobTitle);
      files.forEach((file) => formData.append('resumes', file));
      setTimeout(() => setAnalysisProgress('Parsing documents...'), 800);
      setTimeout(() => setAnalysisProgress('Computing similarity scores...'), 2500);
      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');
      await new Promise((resolve) => setTimeout(resolve, 600));
      setResults(data.results, data.sessionId, data.totalProcessed, data.totalFailed, data.failedResumes || []);
      setView('results');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong.');
      setView('upload');
    } finally { setIsAnalyzing(false); }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Screen Resumes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the job description, upload candidate resumes, and get a ranked shortlist.
          Powered by BERT embeddings (384-dim) with hybrid semantic + keyword scoring.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertCircle className="h-4 w-4" /> Fix the following:</div>
          <ul className="mt-1.5 ml-6 list-disc text-sm text-destructive/80">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4" /> Job Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="jobTitle">Job Title <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="jobTitle" placeholder="e.g. Senior Frontend Developer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="jobDesc">Description <span className="text-destructive">*</span></Label>
            <Textarea id="jobDesc" placeholder={`Paste the full job description here...\n\nResponsibilities, requirements, qualifications, etc.`} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="mt-1 min-h-[180px]" />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4" /> How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-3 bg-muted/30">
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2"><Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">BERT embeddings</strong> (all-MiniLM-L6-v2, 384-dim) — local model, no API costs</span></li>
              <li className="flex items-start gap-2"><Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" /><span><strong className="text-foreground">70% semantic</strong> + <strong>30% keyword</strong> hybrid scoring for robust matching</span></li>
              <li className="flex items-start gap-2"><Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-600" /><span><strong className="text-foreground">~50ms per resume</strong> — 50 resumes in ~3 seconds, no GPU needed</span></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" /> Resumes</CardTitle>
          <CardDescription className="text-xs">PDF, DOCX, or TXT — up to 50 files</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onDragEnd={() => setIsDragging(false)}
            className={`
              relative rounded-lg border-2 border-dashed p-8 text-center transition-all cursor-pointer select-none
              ${isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'
              }
            `}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`rounded-full p-3 transition-colors ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
                <Upload className={`h-6 w-6 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              {isDragging ? (
                <div>
                  <p className="text-sm font-medium text-primary">Drop your files here</p>
                  <p className="text-xs text-muted-foreground mt-1">Release to upload</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">
                    Drag &amp; drop resumes here, or{' '}
                    <span className="text-primary underline underline-offset-2">click to browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Supports PDF, DOCX, and TXT files</p>
                </div>
              )}
            </div>
          </div>

          {/* Choose Files button below drop zone */}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              <Upload className="h-4 w-4" />
              Choose Files
            </Button>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={() => setFiles([])}>Clear All</Button>
              </div>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(index); }} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${file.name}`}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={isAnalyzing || files.length === 0} size="lg" className="w-full gap-2">
        {isAnalyzing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : null}
        {isAnalyzing ? 'Processing...' : 'Analyze Resumes'}
        {!isAnalyzing && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
