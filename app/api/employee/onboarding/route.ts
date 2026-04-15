import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { findUserByEmail, updateUserInSheet } from '@/lib/services/googleSheetsService';

type EmployeeOnboardingAction =
  | 'sign_form'
  | 'complete_training'
  | 'set_shadow_mentor'
  | 'complete_shadow'
  | 'clock_in'
  | 'clock_out';

type SignableForm = 'terms_of_service' | 'work_contract' | 'job_description' | 'pay_terms';

function parseIsoDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toBool(value?: string) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function formsStatus(user: Awaited<ReturnType<typeof findUserByEmail>>) {
  return {
    terms_of_service: Boolean(user?.forms_terms_signed_at),
    work_contract: Boolean(user?.forms_work_contract_signed_at),
    job_description: Boolean(user?.forms_job_description_signed_at),
    pay_terms: Boolean(user?.forms_pay_terms_signed_at),
  };
}

function allRequiredFormsSigned(user: Awaited<ReturnType<typeof findUserByEmail>>) {
  return Object.values(formsStatus(user)).every(Boolean);
}

function serializeOnboarding(user: Awaited<ReturnType<typeof findUserByEmail>>) {
  if (!user) return null;

  const forms = formsStatus(user);

  const allFormsSigned = Object.values(forms).every(Boolean);
  const trainingCompleted = Boolean(user.training_completed_at);
  const shadowRequired = toBool(user.shadow_required || 'true');
  const shadowCompleted = Boolean(user.shadow_completed_at);
  const clockReady = allFormsSigned && trainingCompleted && (!shadowRequired || shadowCompleted);
  const completedSteps = [
    allFormsSigned,
    trainingCompleted,
    !shadowRequired || shadowCompleted,
    clockReady,
  ].filter(Boolean).length;

  const onboardingStage = !allFormsSigned
    ? 'forms'
    : !trainingCompleted
      ? 'training'
      : (shadowRequired && !shadowCompleted)
        ? 'shadow'
        : 'ready_to_work';

  const trackedMinutes = Math.max(0, Number(user.tracked_minutes_total || 0));

  return {
    email: user.email,
    full_name: user.full_name,
    forms,
    all_forms_signed: allFormsSigned,
    forms_terms_signed_at: user.forms_terms_signed_at || '',
    forms_work_contract_signed_at: user.forms_work_contract_signed_at || '',
    forms_job_description_signed_at: user.forms_job_description_signed_at || '',
    forms_pay_terms_signed_at: user.forms_pay_terms_signed_at || '',
    training_completed_at: user.training_completed_at || '',
    shadow_required: shadowRequired,
    shadow_completed_at: user.shadow_completed_at || '',
    shadow_mentor_email: user.shadow_mentor_email || '',
    can_clock_in: clockReady,
    onboarding_stage: onboardingStage,
    completion_percent: Math.round((completedSteps / 4) * 100),
    clock_in_at: user.clock_in_at || '',
    clock_out_at: user.clock_out_at || '',
    tracked_minutes_total: String(Number.isFinite(trackedMinutes) ? trackedMinutes : 0),
    tracked_hours_total: (trackedMinutes / 60).toFixed(2),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ onboarding: serializeOnboarding(user) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load onboarding data', details: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: EmployeeOnboardingAction;
      form?: SignableForm;
      mentor_email?: string;
    };

    const action = body.action;
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    if (action === 'sign_form') {
      const form = body.form;
      if (!form) {
        return NextResponse.json({ error: 'form is required for sign_form' }, { status: 400 });
      }

      const formFieldMap: Record<SignableForm, 'forms_terms_signed_at' | 'forms_work_contract_signed_at' | 'forms_job_description_signed_at' | 'forms_pay_terms_signed_at'> = {
        terms_of_service: 'forms_terms_signed_at',
        work_contract: 'forms_work_contract_signed_at',
        job_description: 'forms_job_description_signed_at',
        pay_terms: 'forms_pay_terms_signed_at',
      };

      const targetField = formFieldMap[form];
      const alreadySigned = Boolean(String(user[targetField] || '').trim());
      if (alreadySigned) {
        const refreshed = await findUserByEmail(session.email);
        return NextResponse.json({ success: true, onboarding: serializeOnboarding(refreshed) });
      }

      const result = await updateUserInSheet(user.email, {
        [targetField]: nowIso,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Unable to sign form' }, { status: 400 });
      }
    }

    if (action === 'complete_training') {
      const allFormsSigned = Object.values(formsStatus(user)).every(Boolean);
      if (!allFormsSigned) {
        return NextResponse.json({ error: 'All required forms must be signed before training can be completed.' }, { status: 400 });
      }

      const result = await updateUserInSheet(user.email, {
        training_completed_at: nowIso,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Unable to update training status' }, { status: 400 });
      }
    }

    if (action === 'set_shadow_mentor') {
      const mentorEmail = String(body.mentor_email || '').trim().toLowerCase();
      if (!mentorEmail) {
        return NextResponse.json({ error: 'mentor_email is required' }, { status: 400 });
      }
      if (!/.+@.+\..+/.test(mentorEmail)) {
        return NextResponse.json({ error: 'mentor_email must be a valid email address' }, { status: 400 });
      }

      const result = await updateUserInSheet(user.email, {
        shadow_mentor_email: mentorEmail,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Unable to update shadow mentor' }, { status: 400 });
      }
    }

    if (action === 'complete_shadow') {
      const allFormsSigned = allRequiredFormsSigned(user);
      if (!allFormsSigned) {
        return NextResponse.json({ error: 'All required forms must be signed before shadow can be completed.' }, { status: 400 });
      }

      if (!String(user.training_completed_at || '').trim()) {
        return NextResponse.json({ error: 'Complete training before marking shadow requirement complete.' }, { status: 400 });
      }

      if (!String(user.shadow_mentor_email || '').trim()) {
        return NextResponse.json({ error: 'Set a shadow mentor before completing shadow training' }, { status: 400 });
      }

      const result = await updateUserInSheet(user.email, {
        shadow_completed_at: nowIso,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Unable to update shadow status' }, { status: 400 });
      }
    }

    if (action === 'clock_in') {
      const formsSigned = allRequiredFormsSigned(user);
      if (!formsSigned) {
        return NextResponse.json({ error: 'All required forms must be signed before clock-in.' }, { status: 400 });
      }
      if (!String(user.training_completed_at || '').trim()) {
        return NextResponse.json({ error: 'Training must be completed before clock-in.' }, { status: 400 });
      }

      const shadowRequired = toBool(user.shadow_required || 'true');
      if (shadowRequired && !String(user.shadow_completed_at || '').trim()) {
        return NextResponse.json({ error: 'Shadow training must be completed before solo clock-in.' }, { status: 400 });
      }

      if (String(user.clock_in_at || '').trim() && !String(user.clock_out_at || '').trim()) {
        return NextResponse.json({ error: 'You are already clocked in.' }, { status: 400 });
      }

      const result = await updateUserInSheet(user.email, {
        clock_in_at: nowIso,
        clock_out_at: '',
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Unable to clock in' }, { status: 400 });
      }
    }

    if (action === 'clock_out') {
      const clockInDate = parseIsoDate(user.clock_in_at);
      if (!clockInDate) {
        return NextResponse.json({ error: 'You must clock in first.' }, { status: 400 });
      }

      const minutesWorked = Math.max(1, Math.round((Date.now() - clockInDate.getTime()) / (1000 * 60)));
      const currentMinutes = Math.max(0, Number(user.tracked_minutes_total || 0));
      const totalMinutes = currentMinutes + minutesWorked;

      const result = await updateUserInSheet(user.email, {
        clock_out_at: nowIso,
        clock_in_at: '',
        tracked_minutes_total: String(totalMinutes),
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Unable to clock out' }, { status: 400 });
      }
    }

    const refreshed = await findUserByEmail(session.email);
    return NextResponse.json({ success: true, onboarding: serializeOnboarding(refreshed) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update onboarding data', details: (error as Error).message }, { status: 500 });
  }
}
