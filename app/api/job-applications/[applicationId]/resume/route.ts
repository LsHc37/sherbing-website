import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { findJobApplicationById } from '@/lib/services/googleSheetsService';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { applicationId } = await context.params;
    const application = await findJobApplicationById(applicationId);
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const resumeFileName = path.basename(application.resume_file_name || '');
    if (!resumeFileName) {
      return NextResponse.json({ error: 'Resume not available' }, { status: 404 });
    }

    const resumePath = path.join(process.cwd(), 'public', 'uploads', 'job-applications', resumeFileName);
    let fileBytes: Buffer;
    try {
      fileBytes = await readFile(resumePath);
    } catch {
      return NextResponse.json({ error: 'Resume file not found' }, { status: 404 });
    }

    return new NextResponse(fileBytes, {
      status: 200,
      headers: {
        'Content-Type': application.resume_mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${resumeFileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load resume', details: (error as Error).message },
      { status: 500 }
    );
  }
}
