// In-memory storage — no database needed
// Sessions expire after 1 hour automatically

interface AnalysisResult {
  resumeName: string;
  rawScore: number;
  normalizedScore: number;
  rank: number;
  matchSummary: string;
  skillsMatched: string;
  skillsMissing: string;
}

interface AnalysisSession {
  id: string;
  jobTitle: string | null;
  jobDescription: string;
  totalResumes: number;
  results: AnalysisResult[];
  createdAt: Date;
}

interface SharedLink {
  shortCode: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
}

const sessions = new Map<string, AnalysisSession>();
const sharedLinks = new Map<string, SharedLink>();

// Auto-cleanup: remove entries older than 1 hour
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  for (const [id, session] of sessions) {
    if (now - session.createdAt.getTime() > ONE_HOUR) {
      sessions.delete(id);
    }
  }

  for (const [code, link] of sharedLinks) {
    if (link.expiresAt.getTime() < now) {
      sharedLinks.delete(code);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

export const storage = {
  // Sessions
  createSession(data: {
    jobTitle: string | null;
    jobDescription: string;
    totalResumes: number;
    results: Omit<AnalysisResult, 'rank'>[];
  }): AnalysisSession {
    const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const resultsWithRank = data.results
      .sort((a, b) => b.rawScore - a.rawScore)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    // Normalize scores
    const highest = resultsWithRank[0]?.rawScore || 1;
    const normalized = resultsWithRank.map((r) => ({
      ...r,
      normalizedScore: Math.round((r.rawScore / highest) * 100) / 100,
    }));

    const session: AnalysisSession = {
      id,
      jobTitle: data.jobTitle,
      jobDescription: data.jobDescription,
      totalResumes: data.totalResumes,
      results: normalized,
      createdAt: new Date(),
    };

    sessions.set(id, session);
    return session;
  },

  getSession(id: string): AnalysisSession | undefined {
    return sessions.get(id);
  },

  // Shared Links
  createSharedLink(sessionId: string): string {
    const shortCode = Math.random().toString(36).substring(2, 10);
    const link: SharedLink = {
      shortCode,
      sessionId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
    sharedLinks.set(shortCode, link);
    return shortCode;
  },

  getSharedLink(code: string): { link: SharedLink; session: AnalysisSession } | null {
    const link = sharedLinks.get(code);
    if (!link) return null;
    if (link.expiresAt < new Date()) {
      sharedLinks.delete(code);
      return null;
    }
    const session = sessions.get(link.sessionId);
    if (!session) return null;
    return { link, session };
  },
};
