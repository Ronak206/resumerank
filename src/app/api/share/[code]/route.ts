import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    const session = storage.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Analysis session not found.' }, { status: 404 });
    }

    const shortCode = storage.createSharedLink(sessionId);

    return NextResponse.json({ success: true, shortCode });
  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json({ error: 'Failed to create share link.' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const result = storage.getSharedLink(code);
    if (!result) {
      return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    }

    const { session } = result;
    const results = session.results.map((r) => ({
      resumeName: r.resumeName,
      rawScore: r.rawScore,
      normalizedScore: r.normalizedScore,
      rank: r.rank,
      matchSummary: r.matchSummary,
      skillsMatched: JSON.parse(r.skillsMatched || '[]'),
      skillsMissing: JSON.parse(r.skillsMissing || '[]'),
    }));

    return NextResponse.json({
      success: true,
      jobTitle: session.jobTitle,
      jobDescription: session.jobDescription,
      totalResumes: session.totalResumes,
      createdAt: session.createdAt,
      results,
    });
  } catch (error) {
    console.error('Share retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve shared results.' }, { status: 500 });
  }
}
