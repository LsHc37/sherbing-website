import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp } from '@/lib/services/rateLimitService';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  addJobApplicationToSheet,
  deleteJobApplicationFromSheet,
  listJobApplicationsFromSheet,
  updateJobApplicationInSheet,
} from '@/lib/services/googleSheetsService';

const ALLOWED_STATUSES = new Set(['new', 'reviewing', 'interview', 'hired', 'rejected']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
  'text/rtf',
]);

function normalizeField(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function normalizeFileName(name: string) {
  return name
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'resume';
}

function statusLabel(status: string) {
  return ALLOWED_STATUSES.has(status) ? status : 'new';
}

async function saveResumeFile(applicationId: string, resumeFile: File) {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'job-applications');
  await mkdir(uploadsDir, { recursive: true });

  const originalName = resumeFile.name || 'resume';
  const safeBaseName = normalizeFileName(originalName);
  const extensionFromName = path.extname(originalName).toLowerCase();
  const fallbackExtension = resumeFile.type === 'application/pdf' ? '.pdf' : '';
  const extension = extensionFromName || fallbackExtension || '.bin';
  const fileName = `${applicationId}-${safeBaseName}${extension}`;
  const filePath = path.join(uploadsDir, fileName);

  const fileBytes = Buffer.from(await resumeFile.arrayBuffer());
  await writeFile(filePath, fileBytes);

  return {
    fileName,
    filePath,
    url: `/uploads/job-applications/${fileName}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const limit = checkRateLimit(`job-applications:ip:${ip}`, 8, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many application submissions. Please try again later.' }, { status: 429 });
    }

    const formData = await request.formData();
    const fullName = normalizeField(formData.get('full_name'));
    const phone = normalizeField(formData.get('phone'));
    const email = normalizeField(formData.get('email'));
    const cityZip = normalizeField(formData.get('city_zip'));
    const previousExperience = normalizeField(formData.get('previous_experience')) === 'yes' ? 'yes' : 'no';
    const previousExperienceDetails = normalizeField(formData.get('previous_experience_details'));
    const equipmentKnown = formData
      .getAll('equipment_known')
      .map((value) => String(value).trim())
      .filter(Boolean);
    const canLift = normalizeField(formData.get('can_lift_50_plus_lbs')) === 'no' ? 'no' : 'yes';
    const hasTransportation = normalizeField(formData.get('has_valid_license_and_transportation')) === 'no' ? 'no' : 'yes';
    const availableStartDate = normalizeField(formData.get('available_start_date'));
    const generalAvailability = normalizeField(formData.get('general_availability'));
    const whyWork = normalizeField(formData.get('why_work_for_sherbing'));
    const ownEquipment = normalizeField(formData.get('own_equipment'));
    const resumeEntry = formData.get('resume');

    if (!fullName) return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    if (!email) return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    if (!cityZip) return NextResponse.json({ error: 'City and ZIP code is required' }, { status: 400 });
    if (previousExperience === 'yes' && !previousExperienceDetails) {
      return NextResponse.json({ error: 'Please describe your previous experience' }, { status: 400 });
    }
    if (equipmentKnown.length === 0) {
      return NextResponse.json({ error: 'At least one equipment option is required' }, { status: 400 });
    }
    if (!availableStartDate) return NextResponse.json({ error: 'Available start date is required' }, { status: 400 });
    if (!generalAvailability) return NextResponse.json({ error: 'General availability is required' }, { status: 400 });
    if (!whyWork) return NextResponse.json({ error: 'Please answer why you want to work for Sherbing' }, { status: 400 });
    if (!ownEquipment) return NextResponse.json({ error: 'Please describe any equipment you can bring' }, { status: 400 });
    if (!(resumeEntry instanceof File) || resumeEntry.size === 0) {
      return NextResponse.json({ error: 'Resume upload is required' }, { status: 400 });
    }
    if (resumeEntry.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Resume file must be 10MB or smaller' }, { status: 400 });
    }
    if (resumeEntry.type && !ALLOWED_MIME_TYPES.has(resumeEntry.type)) {
      return NextResponse.json({ error: 'Resume must be a PDF, Word document, text file, or RTF' }, { status: 400 });
    }

    const applicationId = `JOBAPP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const savedResume = await saveResumeFile(applicationId, resumeEntry);

    const sheetResult = await addJobApplicationToSheet({
      id: applicationId,
      full_name: fullName,
      phone,
      email,
      city_zip: cityZip,
      previous_experience: previousExperience,
      previous_experience_details: previousExperienceDetails,
      equipment_known: equipmentKnown,
      can_lift_50_plus_lbs: canLift,
      has_valid_license_and_transportation: hasTransportation,
      available_start_date: availableStartDate,
      general_availability: generalAvailability,
      why_work_for_sherbing: whyWork,
      own_equipment: ownEquipment,
      resume_file_name: savedResume.fileName,
      resume_url: `/api/job-applications/${encodeURIComponent(applicationId)}/resume`,
      resume_mime_type: resumeEntry.type || 'application/octet-stream',
      status: 'new',
    });

    if (!sheetResult.success) {
      return NextResponse.json(
        { error: sheetResult.error || 'Unable to save your application right now. Please try again.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        application_id: applicationId,
        resume_url: savedResume.url,
        status: 'new',
        message: 'Application submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to submit application', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const applications = await listJobApplicationsFromSheet();
    return NextResponse.json(applications);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load job applications', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { application_id?: string; status?: string };
    const applicationId = normalizeField(body.application_id || null);
    const status = statusLabel(String(body.status || '').toLowerCase());

    if (!applicationId) {
      return NextResponse.json({ error: 'application_id is required' }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const result = await updateJobApplicationInSheet(applicationId, {
      status: status as 'new' | 'reviewing' | 'interview' | 'hired' | 'rejected',
      reviewed_by: session.full_name,
      reviewed_at: new Date().toISOString(),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update application' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update application', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const applicationId = normalizeField(body.application_id || null);
    if (!applicationId) {
      return NextResponse.json({ error: 'application_id is required' }, { status: 400 });
    }

    const result = await deleteJobApplicationFromSheet(applicationId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete application' }, { status: 400 });
    }

    if (result.resumeFileName) {
      const resumePath = path.join(process.cwd(), 'public', 'uploads', 'job-applications', result.resumeFileName);
      try {
        await unlink(resumePath);
      } catch {
        // Ignore missing local files.
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete application', details: (error as Error).message },
      { status: 500 }
    );
  }
}
