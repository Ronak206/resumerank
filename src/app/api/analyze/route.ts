import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { storage } from '@/lib/storage';

const execFileAsync = promisify(execFile);

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || '';
const PYTHON_BIN = process.env.PYTHON_BIN || '/home/z/.venv/bin/python3';
const SCORER_SCRIPT = join(process.cwd(), 'python-backend', 'scorer_cli.py');

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const jobDescription = formData.get('jobDescription') as string;
    const jobTitle = formData.get('jobTitle') as string | null;
    const resumeFiles = formData.getAll('resumes') as File[];

    if (!jobDescription?.trim()) {
      return NextResponse.json({ error: 'Please provide a job description.' }, { status: 400 });
    }
    if (resumeFiles.length === 0) {
      return NextResponse.json({ error: 'Please upload at least one resume.' }, { status: 400 });
    }
    if (resumeFiles.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 resumes per analysis.' }, { status: 400 });
    }

    let scoredResults: Record<string, unknown>;
    const useRemote = PYTHON_BACKEND_URL && isValidUrl(PYTHON_BACKEND_URL);

    if (useRemote) {
      // ── Remote mode: call Python backend via HTTP (Railway) ──
      const backendUrl = PYTHON_BACKEND_URL.replace(/\/+$/, '');
      const remoteForm = new FormData();
      remoteForm.append('jobDescription', jobDescription);
      if (jobTitle) remoteForm.append('jobTitle', jobTitle);
      for (const file of resumeFiles) {
        remoteForm.append('resumes', file);
      }

      console.log(`[Analyze] Calling remote Python backend: ${backendUrl}/analyze`);
      const res = await fetch(`${backendUrl}/analyze`, {
        method: 'POST',
        body: remoteForm,
        signal: AbortSignal.timeout(300_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Backend returned ${res.status}: ${errText || res.statusText}`);
      }

      scoredResults = await res.json();
    } else {
      // ── Local mode: call Python CLI via subprocess ──
      let workDir: string | null = null;
      try {
        workDir = await mkdtemp(join(tmpdir(), 'resumerank_'));

        const resumeEntries: { name: string; path: string }[] = [];
        for (const file of resumeFiles) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const filePath = join(workDir, file.name);
          await writeFile(filePath, buffer);
          resumeEntries.push({ name: file.name, path: filePath });
        }

        const inputPath = join(workDir, 'input.json');
        const outputPath = join(workDir, 'output.json');
        await writeFile(inputPath, JSON.stringify({ jobDescription, resumes: resumeEntries }));

        console.log(`[Analyze] Calling local Python scorer for ${resumeFiles.length} resumes...`);
        const { stdout, stderr } = await execFileAsync(PYTHON_BIN, [SCORER_SCRIPT, inputPath, outputPath], {
          timeout: 300_000,
          env: { ...process.env, TRANSFORMERS_CACHE: '/tmp/hf_cache', HF_HUB_CACHE: '/tmp/hf_cache' },
          maxBuffer: 10 * 1024 * 1024,
        });

        if (stderr) console.log(`[Analyze] Python stderr: ${stderr.slice(-500)}`);
        console.log(`[Analyze] Python stdout: ${stdout.trim()}`);

        const { readFile } = await import('fs/promises');
        const outputRaw = await readFile(outputPath, 'utf-8');
        scoredResults = JSON.parse(outputRaw);

        await cleanupDir(workDir);
      } catch (error) {
        if (workDir) await cleanupDir(workDir).catch(() => {});
        throw error;
      }
    }

    if (!scoredResults.results || (scoredResults.results as unknown[]).length === 0) {
      return NextResponse.json(
        { error: 'Could not parse any resumes. Please ensure files are valid PDF, DOCX, or TXT.' },
        { status: 400 }
      );
    }

    const session = storage.createSession({
      jobTitle: jobTitle || null,
      jobDescription,
      totalResumes: resumeFiles.length,
      results: (scoredResults.results as Record<string, unknown>[]).map((r) => ({
        resumeName: r.resumeName,
        rawScore: r.rawScore,
        normalizedScore: r.normalizedScore,
        rank: r.rank,
        matchSummary: r.matchSummary,
        skillsMatched: JSON.stringify(r.skillsMatched),
        skillsMissing: JSON.stringify(r.skillsMissing),
      })),
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      results: scoredResults.results,
      failedResumes: scoredResults.failedResumes || [],
      totalProcessed: scoredResults.totalProcessed,
      totalFailed: scoredResults.totalFailed || 0,
    });
  } catch (error) {
    console.error('Analysis error:', error);

    const isLocal = !PYTHON_BACKEND_URL || !isValidUrl(PYTHON_BACKEND_URL);
    const hint = isLocal
      ? ' Python backend not connected. Set PYTHON_BACKEND_URL env var on Vercel to your Railway URL (e.g. https://your-app.up.railway.app).'
      : '';

    return NextResponse.json(
      { error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}.${hint}` },
      { status: 500 }
    );
  }
}

async function cleanupDir(dir: string) {
  try {
    const { rm } = await import('fs/promises');
    await rm(dir, { recursive: true, force: true });
  } catch {}
}
