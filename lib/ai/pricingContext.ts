export const AI_PRICING_CONTEXT = {
  company: 'Sherbing',
  market: 'Boise, Idaho',
  currency: 'USD',
  services: [
    { id: 'lawn_mowing', label: 'Lawn Mowing', targetRange: [35, 85] },
    { id: 'lawn_treatment', label: 'Lawn Treatment', targetRange: [45, 75] },
    { id: 'dog_waste_removal', label: 'Dog Waste Pickup', targetRange: [20, 20] },
    { id: 'gutter_cleaning', label: 'Gutter Cleaning', targetRange: [90, 350] },
    { id: 'hedge_trimming', label: 'Hedge Trimming', targetRange: [20, 45] },
    { id: 'window_cleaning', label: 'Window Cleaning', targetRange: [30, 250] },
    { id: 'snow_removal', label: 'Snow Removal', targetRange: [60, 140] },
  ],
  packageNotes: [
    'Starter Bundle applies a small discount for basic recurring work.',
    'Curb Appeal Bundle applies a larger discount for multiple exterior services.',
    'Premium Property Bundle applies the largest discount for multi-service visits.',
  ],
  sizeExamples: [
    {
      addressHint: 'Suburban Boise lot',
      houseSqftRange: [1500, 2600],
      lotSqftRange: [5000, 10000],
      usableYardSqftRange: [3500, 7000],
    },
    {
      addressHint: 'Given sample: 6263 S Basalt Trail Pl, Boise, ID',
      houseSqftApprox: 1840,
      lotSqftApprox: 8276,
      usableYardSqftRange: [5000, 7000],
    },
  ],
  outputRules: [
    'Always return valid JSON only.',
    'Infer property_sqft and yard_sqft from address context when not provided.',
    'Use selected services and package discount impact.',
    'Keep prices competitive for Boise market.',
    'Never output less than $25 as customer price.',
    'Sherbing fee model: $20 base. For $50-$100 add 10% of (price - $20). For over $100 add 20% of (price - $20).',
  ],
};
