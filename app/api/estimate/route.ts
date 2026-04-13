import { AI_PRICING_CONTEXT } from '@/lib/ai/pricingContext';
import { calculateMultiServiceEstimate, SERVICE_PACKAGES, SERVICE_PRICING } from '@/lib/services/pricingService';
import { NextRequest, NextResponse } from 'next/server';

type EstimatePayload = {
  service_ids: string[];
  package_id?: string;
  lawn_mowing_frequency?: 'weekly' | 'bi_weekly';
  lawn_initial_overgrowth?: boolean;
  lawn_bag_clippings?: boolean;
  lawn_heavy_pet_waste?: boolean;
  lawn_access_blocked?: boolean;
  window_count?: number;
  window_scope?: 'exterior' | 'interior_exterior';
  window_screen_track_count?: number;
  gutter_length_ft?: number;
  gutter_story_count?: number;
  gutter_downspout_count?: number;
  gutter_has_guards?: boolean;
  gutter_pricing_mode?: 'linear_foot' | 'flat_rate';
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
  return calculateMultiServiceEstimate(payload.service_ids, propertySqft, yardSqft, payload.package_id, {
    lawnMowing: {
      frequency: payload.lawn_mowing_frequency,
      initialOvergrowth: payload.lawn_initial_overgrowth,
      bagClippings: payload.lawn_bag_clippings,
      heavyPetWaste: payload.lawn_heavy_pet_waste,
      accessBlocked: payload.lawn_access_blocked,
    },
    windowCleaning: {
      windowCount: payload.window_count,
      scope: payload.window_scope,
      screenTrackCount: payload.window_screen_track_count,
    },
    gutterCleaning: {
      lengthFt: payload.gutter_length_ft,
      storyCount: payload.gutter_story_count,
      downspoutCount: payload.gutter_downspout_count,
      hasGuards: payload.gutter_has_guards,
      pricingMode: payload.gutter_pricing_mode,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<EstimatePayload>;
    const service_ids = Array.isArray(body.service_ids) ? body.service_ids : [];
    const package_id = body.package_id || undefined;
    const lawn_mowing_frequency = body.lawn_mowing_frequency || undefined;
    const lawn_initial_overgrowth = typeof body.lawn_initial_overgrowth === 'boolean' ? body.lawn_initial_overgrowth : undefined;
    const lawn_bag_clippings = typeof body.lawn_bag_clippings === 'boolean' ? body.lawn_bag_clippings : undefined;
    const lawn_heavy_pet_waste = typeof body.lawn_heavy_pet_waste === 'boolean' ? body.lawn_heavy_pet_waste : undefined;
    const lawn_access_blocked = typeof body.lawn_access_blocked === 'boolean' ? body.lawn_access_blocked : undefined;
    const window_count = Number(body.window_count || 0) || undefined;
    const window_scope = body.window_scope || undefined;
    const window_screen_track_count = Number(body.window_screen_track_count || 0) || undefined;
    const gutter_length_ft = Number(body.gutter_length_ft || 0) || undefined;
    const gutter_story_count = Number(body.gutter_story_count || 0) || undefined;
    const gutter_downspout_count = Number(body.gutter_downspout_count || 0) || undefined;
    const gutter_has_guards = typeof body.gutter_has_guards === 'boolean' ? body.gutter_has_guards : undefined;
    const gutter_pricing_mode = body.gutter_pricing_mode || undefined;
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
      lawn_mowing_frequency,
      lawn_initial_overgrowth,
      lawn_bag_clippings,
      lawn_heavy_pet_waste,
      lawn_access_blocked,
      window_count,
      window_scope,
      window_screen_track_count,
      gutter_length_ft,
      gutter_story_count,
      gutter_downspout_count,
      gutter_has_guards,
      gutter_pricing_mode,
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
      'Lawn mowing pricing uses the following tiers: Small/Patio under 4000 sqft = $35 weekly or $45 bi-weekly; Standard Subdivision 4000-7000 sqft = $45 weekly or $55 bi-weekly; Large/Corner Lot 7000-10000 sqft = $55 weekly or $70 bi-weekly; Estate/Oversized 10000-13000 sqft = $65 weekly or $85 bi-weekly; Acreage/Custom 13000+ sqft = $65 weekly plus $10 per extra 3000 sqft, and bi-weekly should be custom-priced higher because of overgrowth risk. Add 1.5x for initial overgrowth cuts, +$10 for bagging clippings, +$15 for heavy pet waste, and treat blocked access or locked gates as full-charge jobs.',
      'Window cleaning pricing uses a $30 trip charge, $5 per exterior window, $8 per interior-and-exterior window, and $2 per screen/track add-on.',
      'Gutter cleaning pricing uses either $1.25 per linear foot for single-story homes or $2.00 per linear foot for two-story homes, or a flat size-based estimate: small under 1500 sqft = $90-$120 single-story or $130-$170 two-story, medium 1500-2500 sqft = $120-$160 single-story or $170-$250 two-story, large 2500+ sqft = $160-$250+ single-story or $250-$350+ two-story. Add $15 per downspout and double the standard rate for gutter guards.',
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
      calculateMultiServiceEstimate(service_ids, inferred_property_sqft, inferred_yard_sqft, package_id, {
        lawnMowing: {
          frequency: lawn_mowing_frequency,
          initialOvergrowth: lawn_initial_overgrowth,
          bagClippings: lawn_bag_clippings,
          heavyPetWaste: lawn_heavy_pet_waste,
          accessBlocked: lawn_access_blocked,
        },
        windowCleaning: {
          windowCount: window_count,
          scope: window_scope,
          screenTrackCount: window_screen_track_count,
        },
        gutterCleaning: {
          lengthFt: gutter_length_ft,
          storyCount: gutter_story_count,
          downspoutCount: gutter_downspout_count,
          hasGuards: gutter_has_guards,
          pricingMode: gutter_pricing_mode,
        },
      })
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
