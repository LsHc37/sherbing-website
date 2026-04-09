import { AI_PRICING_CONTEXT } from '@/lib/ai/pricingContext';
import { calculateMultiServiceEstimate, SERVICE_PACKAGES, SERVICE_PRICING } from '@/lib/services/pricingService';
import { NextRequest, NextResponse } from 'next/server';

type EstimatePayload = {
  service_ids: string[];
  package_id?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes?: string;
  property_sqft?: number;
  yard_sqft?: number;
};

function fallbackEstimate(payload: EstimatePayload): number {
  const propertySqft = Number(payload.property_sqft || 1840);
  const yardSqft = Number(payload.yard_sqft || 5500);
  return calculateMultiServiceEstimate(payload.service_ids, propertySqft, yardSqft, payload.package_id);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<EstimatePayload>;
    const service_ids = Array.isArray(body.service_ids) ? body.service_ids : [];
    const package_id = body.package_id || undefined;
    const address = body.address || '';
    const city = body.city || '';
    const state = body.state || '';
    const zip_code = body.zip_code || '';
    const notes = body.notes || '';
    const property_sqft = Number(body.property_sqft || 0);
    const yard_sqft = Number(body.yard_sqft || 0);

    if (!service_ids.length || !address || !city || !state || !zip_code) {
      return NextResponse.json({ error: 'service_ids and full address are required' }, { status: 400 });
    }

    const payload: EstimatePayload = {
      service_ids,
      package_id,
      address,
      city,
      state,
      zip_code,
      notes,
      property_sqft: property_sqft || undefined,
      yard_sqft: yard_sqft || undefined,
    };
    const localEstimate = fallbackEstimate(payload);
    const selectedServices = service_ids
      .map((id) => ({ id, pricing: SERVICE_PRICING[id] }))
      .filter((item) => !!item.pricing)
      .map((item) => ({
        id: item.id,
        name: item.pricing.name,
        rate: item.pricing.pricePerSqft,
        min: item.pricing.minimumPrice,
        max: item.pricing.maximumPrice ?? null,
      }));

    const selectedPackage = package_id
      ? SERVICE_PACKAGES.find((pkg) => pkg.id === package_id) || null
      : null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallbackProperty = property_sqft || 1840;
      const fallbackYard = yard_sqft || 5500;
      return NextResponse.json(
        {
          estimated_price: localEstimate,
          source: 'standard',
          inferred_property_sqft: fallbackProperty,
          inferred_yard_sqft: fallbackYard,
        },
        { status: 200 }
      );
    }

    const addressText = `${address}, ${city}, ${state} ${zip_code}`;
    const prompt = [
      'You are a pricing assistant for a landscaping company.',
      'Return only JSON in this exact shape: {"estimated_price": number, "inferred_property_sqft": number, "inferred_yard_sqft": number, "reasoning": string}.',
      'No markdown, no extra keys.',
      `Address: ${addressText}`,
      `Selected services: ${JSON.stringify(selectedServices)}`,
      `Selected package: ${JSON.stringify(selectedPackage)}`,
      `Customer notes: ${notes || 'none'}`,
      `Known property sqft from user (if any): ${property_sqft || 'unknown'}`,
      `Known yard sqft from user (if any): ${yard_sqft || 'unknown'}`,
      `Standard estimate: ${localEstimate}`,
      `Pricing context and examples: ${JSON.stringify(AI_PRICING_CONTEXT)}`,
      'Infer realistic Boise home/property sizes from the address and apply service complexity and package discount.',
      'Estimated price must be competitive and greater than zero.',
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You return strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ estimated_price: localEstimate, source: 'standard' }, { status: 200 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;

    let estimated_price = localEstimate;
    let inferred_property_sqft = property_sqft || 1840;
    let inferred_yard_sqft = yard_sqft || 5500;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        const parsedValue = Number(parsed?.estimated_price);
        const parsedPropertySqft = Number(parsed?.inferred_property_sqft);
        const parsedYardSqft = Number(parsed?.inferred_yard_sqft);

        if (Number.isFinite(parsedValue) && parsedValue > 0) {
          estimated_price = parsedValue;
        }
        if (Number.isFinite(parsedPropertySqft) && parsedPropertySqft > 0) {
          inferred_property_sqft = parsedPropertySqft;
        }
        if (Number.isFinite(parsedYardSqft) && parsedYardSqft > 0) {
          inferred_yard_sqft = parsedYardSqft;
        }
      } catch {
        const match = content.match(/\d+(?:\.\d+)?/);
        if (match) {
          const parsedValue = Number(match[0]);
          if (Number.isFinite(parsedValue) && parsedValue > 0) {
            estimated_price = parsedValue;
          }
        }
      }
    }

    const safeEstimated = Math.max(
      estimated_price,
      calculateMultiServiceEstimate(service_ids, inferred_property_sqft, inferred_yard_sqft, package_id)
    );

    return NextResponse.json(
      {
        estimated_price: safeEstimated,
        source: 'ai',
        inferred_property_sqft,
        inferred_yard_sqft,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to calculate estimate' }, { status: 500 });
  }
}
