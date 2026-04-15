'use client';

import { useState } from 'react';

const equipmentOptions = [
  'Zero-turn mower',
  'Push mower',
  'Weed whacker/trimmer',
  'Leaf blower',
  'Chainsaw',
  'Hedge trimmer',
  'Skid steer',
  'None',
] as const;

type ApplicationFormState = {
  full_name: string;
  phone: string;
  email: string;
  city_zip: string;
  previous_experience: 'yes' | 'no';
  previous_experience_details: string;
  equipment_known: string[];
  can_lift_50_plus_lbs: 'yes' | 'no';
  has_valid_license_and_transportation: 'yes' | 'no';
  available_start_date: string;
  general_availability: string;
  why_work_for_sherbing: string;
  own_equipment: string;
};

const initialFormState: ApplicationFormState = {
  full_name: '',
  phone: '',
  email: '',
  city_zip: '',
  previous_experience: 'no',
  previous_experience_details: '',
  equipment_known: [],
  can_lift_50_plus_lbs: 'yes',
  has_valid_license_and_transportation: 'yes',
  available_start_date: '',
  general_availability: '',
  why_work_for_sherbing: '',
  own_equipment: '',
};

export default function CareersApplicationForm() {
  const [formData, setFormData] = useState<ApplicationFormState>(initialFormState);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateField = (field: keyof ApplicationFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEquipment = (equipment: string) => {
    setFormData((prev) => {
      if (equipment === 'None') {
        return {
          ...prev,
          equipment_known: prev.equipment_known.includes('None') ? [] : ['None'],
        };
      }

      const nextSelection = prev.equipment_known.filter((item) => item !== 'None');
      if (nextSelection.includes(equipment)) {
        return {
          ...prev,
          equipment_known: nextSelection.filter((item) => item !== equipment),
        };
      }

      return {
        ...prev,
        equipment_known: [...nextSelection, equipment],
      };
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setResumeFile(file);
  };

  const clearForm = () => {
    setFormData(initialFormState);
    setResumeFile(null);
    const fileInput = document.getElementById('resume') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.full_name.trim()) return setError('Please enter your full name.');
    if (!formData.phone.trim()) return setError('Please enter your phone number.');
    if (!formData.email.trim()) return setError('Please enter your email address.');
    if (!formData.city_zip.trim()) return setError('Please enter your city and ZIP code.');
    if (formData.previous_experience === 'yes' && !formData.previous_experience_details.trim()) {
      return setError('Please describe your previous landscaping or lawn care experience.');
    }
    if (formData.equipment_known.length === 0) return setError('Please select at least one equipment option.');
    if (!formData.available_start_date.trim()) return setError('Please choose your available start date.');
    if (!formData.general_availability.trim()) return setError('Please tell us your general availability.');
    if (!formData.why_work_for_sherbing.trim()) return setError('Please share why you want to work for Sherbing.');
    if (!formData.own_equipment.trim()) return setError('Please describe any equipment you can bring.');
    if (!resumeFile) return setError('Please upload your resume.');

    const payload = new FormData();
    payload.append('full_name', formData.full_name.trim());
    payload.append('phone', formData.phone.trim());
    payload.append('email', formData.email.trim());
    payload.append('city_zip', formData.city_zip.trim());
    payload.append('previous_experience', formData.previous_experience);
    payload.append('previous_experience_details', formData.previous_experience_details.trim());
    formData.equipment_known.forEach((equipment) => payload.append('equipment_known', equipment));
    payload.append('can_lift_50_plus_lbs', formData.can_lift_50_plus_lbs);
    payload.append('has_valid_license_and_transportation', formData.has_valid_license_and_transportation);
    payload.append('available_start_date', formData.available_start_date);
    payload.append('general_availability', formData.general_availability.trim());
    payload.append('why_work_for_sherbing', formData.why_work_for_sherbing.trim());
    payload.append('own_equipment', formData.own_equipment.trim());
    payload.append('resume', resumeFile);

    setLoading(true);
    try {
      const response = await fetch('/api/job-applications', {
        method: 'POST',
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Application submission failed.');
        return;
      }

      setSuccess('Your application was submitted successfully. We will review it and follow up soon.');
      clearForm();
    } catch {
      setError('Something went wrong while submitting your application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
      <section className="surface-card p-6 sm:p-8 appear-up">
        <div className="inline-flex rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase">
          Sherbing.com Job Application
        </div>
        <h1 className="mt-5 text-3xl sm:text-4xl font-bold text-slate-900">Join the Sherbing crew</h1>
        <p className="mt-4 text-slate-700 leading-7 max-w-2xl">
          Thank you for your interest in working with Sherbing.com. Complete the application below and our team will review your background, equipment, and availability.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-semibold text-emerald-900">What we look for</p>
            <p className="mt-2 text-sm text-emerald-900/80">Professional communication, reliable transportation, and the ability to complete outdoor work safely and consistently.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Resume upload</p>
            <p className="mt-2 text-sm text-slate-600">Upload a resume in PDF, DOC, DOCX, TXT, or RTF format.</p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">About The Opportunity</p>
          <h2 className="mt-3 text-xl font-bold text-slate-900">Independent Contractor Position</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700 leading-7">
            <p>
              This role is structured as an independent contractor opportunity. You operate as your own service professional while partnering with Sherbing for customer demand and scheduling support.
            </p>
            <p>
              Contractors are expected to bring and use their own equipment. Sherbing helps fill your schedule by connecting you with clients and coordinating appointments through the platform.
            </p>
            <p>
              In short, Sherbing acts as the booking and operations partner so you can stay focused on delivering quality work in the field.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>First and Last Name *</span>
              <input
                value={formData.full_name}
                onChange={(event) => updateField('full_name', event.target.value)}
                className="field-shell"
                type="text"
                autoComplete="name"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Phone Number *</span>
              <input
                value={formData.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                className="field-shell"
                type="tel"
                autoComplete="tel"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Email Address *</span>
              <input
                value={formData.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="field-shell"
                type="email"
                autoComplete="email"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>City and Zip Code *</span>
              <input
                value={formData.city_zip}
                onChange={(event) => updateField('city_zip', event.target.value)}
                className="field-shell"
                type="text"
                placeholder="Boise, 83702"
              />
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Do you have previous landscaping or lawn care experience? *</p>
            <div className="flex gap-3">
              {(['yes', 'no'] as const).map((choice) => (
                <label key={choice} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="previous_experience"
                    value={choice}
                    checked={formData.previous_experience === choice}
                    onChange={() => updateField('previous_experience', choice)}
                  />
                  {choice === 'yes' ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
          </div>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>If yes, please briefly describe your past experience.</span>
            <textarea
              value={formData.previous_experience_details}
              onChange={(event) => updateField('previous_experience_details', event.target.value)}
              className="field-shell min-h-28 resize-y"
              placeholder="Tell us about the crews, equipment, and duties you've handled."
            />
          </label>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Which of the following equipment do you know how to operate? *</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {equipmentOptions.map((option) => {
                const checked = formData.equipment_known.includes(option);
                return (
                  <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEquipment(option)}
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Can you safely lift 50+ lbs repeatedly throughout the day? *</p>
              <div className="flex gap-3">
                {(['yes', 'no'] as const).map((choice) => (
                  <label key={choice} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="can_lift_50_plus_lbs"
                      value={choice}
                      checked={formData.can_lift_50_plus_lbs === choice}
                      onChange={() => updateField('can_lift_50_plus_lbs', choice)}
                    />
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Do you have a valid driver&apos;s license and reliable transportation to work? *</p>
              <div className="flex gap-3">
                {(['yes', 'no'] as const).map((choice) => (
                  <label key={choice} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="has_valid_license_and_transportation"
                      value={choice}
                      checked={formData.has_valid_license_and_transportation === choice}
                      onChange={() => updateField('has_valid_license_and_transportation', choice)}
                    />
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>What is your available start date? *</span>
              <input
                value={formData.available_start_date}
                onChange={(event) => updateField('available_start_date', event.target.value)}
                className="field-shell"
                type="date"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>What is your general availability? *</span>
              <input
                value={formData.general_availability}
                onChange={(event) => updateField('general_availability', event.target.value)}
                className="field-shell"
                type="text"
                placeholder="Weekdays after 3 PM, weekends open, etc."
              />
            </label>
          </div>

          <label className="space-y-2 text-sm font-medium text-slate-700 block">
            <span>Why do you want to work for Sherbing.com? *</span>
            <textarea
              value={formData.why_work_for_sherbing}
              onChange={(event) => updateField('why_work_for_sherbing', event.target.value)}
              className="field-shell min-h-32 resize-y"
              placeholder="Tell us what interests you about the role and the team."
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 block">
            <span>This is an independent contractor position. What equipment do you own and are willing to use on jobs? *</span>
            <textarea
              value={formData.own_equipment}
              onChange={(event) => updateField('own_equipment', event.target.value)}
              className="field-shell min-h-28 resize-y"
              placeholder="List any mowers, trimmers, trailers, hand tools, or other equipment you can bring."
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 block">
            <span>Please upload your resume *</span>
            <input
              id="resume"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf"
              onChange={handleFileChange}
              className="field-shell file:mr-4 file:rounded-full file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-800"
            />
            {resumeFile && <p className="text-xs text-slate-500">Selected file: {resumeFile.name}</p>}
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>
      </section>

      <aside className="surface-card p-6 sm:p-8 appear-up stagger-2 lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Application details</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">What happens next</h2>
        <div className="mt-6 space-y-4 text-sm text-slate-700 leading-7">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="font-semibold text-slate-900">1. Submit the form</p>
            <p className="mt-1">Your answers and resume are saved for the main employee/admin account to review.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="font-semibold text-slate-900">2. We review your fit</p>
            <p className="mt-1">Sherbing checks equipment experience, availability, and work readiness before reaching out.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="font-semibold text-slate-900">3. Staff follow up</p>
            <p className="mt-1">If the team wants to move forward, you’ll hear from us with next steps.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
