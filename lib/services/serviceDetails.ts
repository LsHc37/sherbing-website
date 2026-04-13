// Detailed service information for service detail pages
export const SERVICE_DETAILS: Record<string, {
  fullDescription: string;
  benefits: string[];
  process: string[];
  faqs: Array<{ question: string; answer: string }>;
}> = {
  lawn_mowing: {
    fullDescription: `Professional lawn mowing is the foundation of a well-maintained yard. Our pricing is based on mowable grass size and service frequency so quotes stay simple and fair.

Weekly service starts at $35 for small yards and scales up through standard, large, and estate properties. Bi-weekly service carries a higher rate because the grass is taller and the job takes longer. We also price overgrowth, bagging, pet waste, and blocked access separately so you know exactly what you are paying for.`,
    benefits: [
      'Professional equipment ensuring a clean, even cut',
      'Edge trimming and driveway/sidewalk cleanup included',
      'Weekly and bi-weekly pricing tiers',
      'Add-ons for overgrowth, bagging, and heavy pet waste',
      'Clear policy for blocked access or locked gates',
      'Keeps lawn healthy and prevents overgrowth',
      'Improves curb appeal and property value',
    ],
    process: [
      'Choose weekly or bi-weekly mowing',
      'Select any add-ons needed for the job',
      'We arrive with commercial equipment ready to work',
      'Mow, edge, and trim your entire lawn',
      'Clean up all debris and dispose properly',
      'You enjoy a perfectly manicured yard',
    ],
    faqs: [
      {
        question: 'How is lawn mowing priced?',
        answer: 'We price based on mowable grass size and frequency. Weekly rates are lower than bi-weekly rates, and acreage gets a custom estimate.',
      },
      {
        question: 'Do you provide equipment or do I need my own?',
        answer: 'We provide all professional-grade equipment. You don\'t need to worry about anything except enjoying your lawn.',
      },
      {
        question: 'What if my grass is very overgrown?',
        answer: 'Initial overgrowth cuts are charged at 1.5x the base mowing rate.',
      },
      {
        question: 'Do you mulch clippings or bag them?',
        answer: 'We mulch clippings by default. Bagging clippings is available for an additional $10 per visit.',
      },
      {
        question: 'What about pet waste or blocked access?',
        answer: 'Heavy pet waste adds $15 per visit. If the yard cannot be fully accessed because of a locked gate or blocked entry, the full charge still applies.',
      },
    ],
  },
  lawn_treatment: {
    fullDescription: `Keep your lawn healthy, green, and vibrant year-round with professional lawn treatments. Our experts apply fertilizers, weed control, and specialized treatments tailored to your lawn\'s needs.

From spring green-up to winter dormancy, we understand the Boise climate and adjust treatments accordingly. Whether you\'re dealing with weeds, bare patches, or just want a lush, healthy lawn, our treatments are designed to deliver results.`,
    benefits: [
      'Targeted fertilization for optimal growth',
      'Effective weed control without harsh chemicals',
      'Promotes deep root development',
      'Improves soil health and nutrient retention',
      'Thicker, greener lawn throughout the season',
      'Prevents common lawn diseases and pests',
      'Customized to Boise\'s climate needs',
    ],
    process: [
      'Initial lawn assessment and soil analysis',
      'Design customized treatment plan',
      'Apply seasonal treatments on schedule',
      'Monitor results and adjust as needed',
      'Enjoy a healthier, greener lawn',
    ],
    faqs: [
      {
        question: 'Are your treatments safe for pets and children?',
        answer: 'We use professional-grade products applied according to safety guidelines. We provide pre-treatment instructions to keep your family safe.',
      },
      {
        question: 'How many treatments do I need per year?',
        answer: 'A typical program includes 4-6 treatments spread throughout the year, timed for maximum effectiveness in each season.',
      },
      {
        question: 'When will I see results?',
        answer: 'You\'ll notice improvements within 3-4 weeks. Full results typically visible after 2-3 treatment cycles.',
      },
      {
        question: 'Can I combine lawn treatment with mowing?',
        answer: 'Yes! Many customers bundle treatment with regular mowing for better results and convenience.',
      },
    ],
  },
  landscaping: {
    fullDescription: `Transform your outdoor space into a stunning landscape that reflects your style and enhances your property. Our design team creates custom landscaping solutions that combine beauty, functionality, and durability.

From concept to completion, we handle everything—design consultation, material selection, and professional installation. Whether you want garden beds, hardscaping, raised planters, or complete yard transformations, we bring your vision to life.`,
    benefits: [
      'Custom design tailored to your home and preferences',
      'Increased property value and curb appeal',
      'Low-maintenance landscaping options available',
      'Professional installation ensuring longevity',
      'Native plant options for sustainability',
      'Complete project management from start to finish',
      'Improved outdoor living spaces',
    ],
    process: [
      'Schedule consultation with our design team',
      'Discuss your vision, budget, and timeline',
      'Receive detailed design plan with cost estimate',
      'Approve design and finalize materials',
      'Professional installation at agreed timeline',
      'Final walkthrough and care instructions',
    ],
    faqs: [
      {
        question: 'How long does a landscaping project take?',
        answer: 'Timeline varies by project scope. Small projects may take 1-2 days, while larger transformations can take 1-4 weeks.',
      },
      {
        question: 'Can you work with my existing budget?',
        answer: 'Absolutely. We design solutions at various price points and can phase projects over time.',
      },
      {
        question: 'Do you offer plant guarantees?',
        answer: 'Yes, newly installed plants come with a care guarantee. We provide detailed maintenance instructions.',
      },
      {
        question: 'What if I don\'t like the design?',
        answer: 'We work closely with you through the design phase to ensure you\'re happy before any installation begins.',
      },
    ],
  },
  snow_removal: {
    fullDescription: `Don't let snow and ice catch you off guard. Our rapid-response snow removal team keeps your driveway and walkways clear and safe throughout winter. Whether it's a light dusting or heavy snow, we're equipped to handle it.

Quick response times mean your property is cleared before you need it. We handle everything from snow pushing to ice management, so you can focus on staying safe and warm indoors.`,
    benefits: [
      'Fast response times - we prioritize emergency situations',
      'Professional ice management to prevent hazards',
      'Commercial-grade equipment for efficient clearing',
      'Early morning availability to clear before work',
      'One-time or seasonal contract options',
      'Safer walkways and driveways for family',
      'Peace of mind during winter weather',
    ],
    process: [
      'Alert us when snow is falling or expected',
      'We prioritize based on accumulation and timing',
      'Clear driveways, walkways, and problem areas',
      'Apply ice treatment if needed for safety',
      'Property is ready for safe access',
    ],
    faqs: [
      {
        question: 'How quickly do you respond to snow?',
        answer: 'We dispatch crews within 2-4 hours of significant accumulation, depending on demand during major storms.',
      },
      {
        question: 'Do you offer seasonal contracts?',
        answer: 'Yes! Seasonal contracts provide priority service and better pricing throughout winter.',
      },
      {
        question: 'What about ice melt and salt?',
        answer: 'We use professional ice melt products and can apply salt if requested. Pet-safe options available.',
      },
      {
        question: 'Do you move snow to specific areas?',
        answer: 'We work with your property layout to place snow strategically. Let us know your preferences.',
      },
    ],
  },
  gutter_cleaning: {
    fullDescription: `Clogged gutters lead to water damage, foundation issues, and costly repairs. Our gutter cleaning service uses a pricing model built for real jobs: you can estimate by linear foot or use a fast flat-rate model based on home size and story count.

Single-story homes are priced lower than two-story homes because of the extra ladder work and time. If your gutters have guards, expect a premium because the job takes significantly longer. We also charge extra for difficult downspout clogs that require extra labor.
`,
    benefits: [
      'Prevents water damage to your home',
      'Protects foundation from water intrusion',
      'Extends gutter lifespan significantly',
      'Single-story and two-story pricing options',
      'Additional charges for downspout clogs and gutter guards',
      'Prevents ice dams in winter',
      'Safe professional service using proper equipment',
      'Maintains home value protection',
      'Reduces costly repairs from water damage',
    ],
    process: [
      'Choose linear-foot or flat-rate pricing',
      'Confirm story count, downspouts, and gutter guards',
      'Our team safely accesses all gutters',
      'Remove debris, leaves, and buildup',
      'Flush system to ensure proper drainage',
      'Inspect for damage and advise if repairs needed',
      'Your gutters are clean and flowing properly',
    ],
    faqs: [
      {
        question: 'How is gutter cleaning priced?',
        answer: 'We price by linear foot or by flat-rate size tiers. Single-story homes are cheaper, two-story homes cost more because of ladder work, and gutter guards increase the price because they take extra time.',
      },
      {
        question: 'What adds to the cost?',
        answer: 'Clogged downspouts, gutter guards, and steep or difficult roof access can increase the final price.',
      },
      {
        question: 'What if my house is large?',
        answer: 'Larger homes usually fall into the higher flat-rate tier, or they will cost more by linear foot because there is simply more gutter to clean.',
      },
      {
        question: 'How often should gutters be cleaned?',
        answer: 'Twice yearly is the standard recommendation, and more often if your property has many trees or heavy debris buildup.',
      },
    ],
  },
  hedge_trimming: {
    fullDescription: `Neat, well-maintained hedges enhance your landscaping and define your property boundaries beautifully. Our precision trimming techniques create clean lines and promote healthy growth.

From formal hedges to natural-looking shrub formations, we tailor our trimming to your preferences and plant type. Regular trimming keeps hedges full, dense, and looking their best.`,
    benefits: [
      'Professional precision for clean, defined lines',
      'Promotes denser, healthier growth',
      'Enhances landscape aesthetics',
      'Increases property curb appeal',
      'Prevents overgrowth and property encroachment',
      'Regular trimming prolongs hedge life',
      'Customized to your landscape style',
    ],
    process: [
      'Assess hedges and discuss your desired look',
      'Trim with precision tools for clean lines',
      'Shape according to hedge type and style',
      'Remove all trimmings and debris',
      'Enjoy beautifully manicured hedges',
    ],
    faqs: [
      {
        question: 'How often should hedges be trimmed?',
        answer: 'Most hedges need trimming 1-2 times per year, more frequently during active growth season.',
      },
      {
        question: 'Will trimming hurt my plants?',
        answer: 'Proper trimming promotes health. We know the right techniques for different plant types.',
      },
      {
        question: 'Can you trim hedges into specific shapes?',
        answer: 'Yes! We can create topiary shapes, formal lines, or natural-looking forms based on your preference.',
      },
      {
        question: 'What do you do with the trimmings?',
        answer: 'We remove and dispose of all trimmings, or can chip them for mulch if you prefer.',
      },
    ],
  },
  window_cleaning: {
    fullDescription: `Sparkling clean windows brighten your home and improve your view of the world. Our window cleaning service uses a simple hybrid pricing model that keeps quotes competitive and fair: a base trip charge, a per-window rate, and an optional screens-and-tracks add-on.

Exterior-only jobs are the best value for fast ground-floor cleans. Interior and exterior work takes more time because of the setup, care around the home, and the extra detail involved. We use professional techniques and equipment so your windows shine and let in maximum natural light.`,
    benefits: [
      'Streak-free, sparkling clean windows',
      'Improves natural light throughout home',
      'Safe cleaning of hard-to-reach windows',
      'Professional equipment for thorough results',
      'Flexible exterior-only or interior-and-exterior options',
      'Optional screens-and-tracks add-on for a fuller clean',
      'Enhances curb appeal',
      'One-time or recurring service available',
    ],
    process: [
      'Share your window count and cleaning scope',
      'We confirm the trip charge and per-window pricing',
      'Clean exterior only or both interior and exterior surfaces',
      'Add screens and tracks if requested',
      'Streak-free shine guaranteed',
    ],
    faqs: [
      {
        question: 'How is window cleaning priced?',
        answer: 'We use a base trip charge plus a per-window rate. Exterior-only jobs are priced lower than interior-and-exterior cleans, and screens/tracks are optional add-ons.',
      },
      {
        question: 'Why charge more for interior work?',
        answer: 'Interior work takes more time and care because of entry, protection around furniture, and cleanup, so it is priced higher than exterior-only service.',
      },
      {
        question: 'Do you offer screens and tracks cleaning?',
        answer: 'Yes. Screens and tracks can be added for an additional per-window charge when you want a fuller clean.',
      },
      {
        question: 'Can you handle second-story windows?',
        answer: 'Yes, as long as access is safe. If a job needs ladders or special access, we evaluate it before confirming the quote.',
      },
    ],
  },
  yard_cleanup: {
    fullDescription: `Spring and fall yard cleanup prepares your property for the season and removes accumulated debris. From leaves to branches, we handle all the heavy lifting.

Our comprehensive cleanup service restores order to your yard, removes hazards, and sets the stage for new growth. Say goodbye to raking—we take care of everything.`,
    benefits: [
      'Removes seasonal debris completely',
      'Prevents pest habitats in dead leaves',
      'Reduces fire risk from dried branches',
      'Prepares yard for spring growth or winter dormancy',
      'Heavy lifting handled by professionals',
      'Debris properly disposed or composted',
      'Safer, cleaner outdoor space',
    ],
    process: [
      'Schedule cleanup for spring or fall',
      'Remove all leaves, branches, and debris',
      'Clear gutters and roof if needed',
      'Mulch or haul debris appropriately',
      'Your yard is clean and ready',
    ],
    faqs: [
      {
        question: 'What\'s included in yard cleanup?',
        answer: 'Complete removal of leaves, dead branches, debris. We can include gutter cleaning and mulching.',
      },
      {
        question: 'Can you compost the leaves?',
        answer: 'Yes! We can chip leaves for mulch or compost rather than hauling away.',
      },
      {
        question: 'How long does cleanup take?',
        answer: 'Typical residential cleanup takes 4-8 hours depending on property size and debris volume.',
      },
      {
        question: 'Do you do spring AND fall cleanup?',
        answer: 'Absolutely! Seasonal package pricing available for both spring and fall services.',
      },
    ],
  },
  tree_service: {
    fullDescription: `Professional tree care keeps your trees healthy, safe, and beautiful. From expert trimming to removal of dead trees, our arborists handle all your tree needs.

We trim branches away from homes and power lines, remove hazardous trees, and provide stump grinding. Whether you need routine maintenance or emergency service, we have the expertise and equipment.`,
    benefits: [
      'Removes hazardous branches near structures',
      'Improves tree health through proper pruning',
      'Prevents storm damage from weak branches',
      'Professional stump grinding and removal',
      'Maintains clear sight lines and property access',
      'Emergency tree removal available',
      'Expert arborist assessment',
    ],
    process: [
      'Initial assessment of tree health and hazards',
      'Discuss trimming or removal goals',
      'Professional pruning or safe removal',
      'Complete stump grinding if needed',
      'Haul away brush and debris',
      'Your property is safe and clear',
    ],
    faqs: [
      {
        question: 'How do I know if a tree is hazardous?',
        answer: 'Signs include dead branches, leaning trunks, large cavities, or proximity to structures. We assess free of charge.',
      },
      {
        question: 'Can you work around power lines?',
        answer: 'Yes, we safely work near power lines. We notify utilities when needed for your safety.',
      },
      {
        question: 'Do you grind stumps or just remove trees?',
        answer: 'We offer both stump grinding and removal. Grinding eliminates the stump completely.',
      },
      {
        question: 'What about tree cutting regulations?',
        answer: 'We know local regulations and obtain permits if needed. We handle all compliance.',
      },
    ],
  },
  deck_staining: {
    fullDescription: `Protect and beautify your deck with professional staining and sealing. Our expert team applies quality stains that enhance natural wood grain and protect against elements.

A well-maintained deck lasts decades. Regular staining prevents rot, splinters, and weathering, keeping your outdoor living space safe and beautiful.`,
    benefits: [
      'Protects deck wood from UV damage',
      'Prevents rot and water damage',
      'Enhances natural wood beauty',
      'Eliminates splinters and rough areas prep',
      'Extends deck lifespan significantly',
      'Multiple color options available',
      'Professional preparation and application',
    ],
    process: [
      'Inspect deck condition and plan staining',
      'Sand and prepare deck surface',
      'Apply quality stain in your chosen color',
      'Seal for maximum protection',
      'Your deck is protected and beautiful',
    ],
    faqs: [
      {
        question: 'How often should decks be stained?',
        answer: 'Every 2-3 years is ideal. It depends on sun exposure, weather, and foot traffic.',
      },
      {
        question: 'Do I need to move furniture first?',
        answer: 'We request clear deck space, but can work around some furniture if needed.',
      },
      {
        question: 'How long before I can use the deck?',
        answer: 'Plan 24-48 hours before foot traffic. Full cure time is typically 7 days.',
      },
      {
        question: 'What color options are available?',
        answer: 'We offer natural, semi-transparent, and solid stain colors. We can show samples.',
      },
    ],
  },
  fence_painting: {
    fullDescription: `Refresh your fence and protect your investment with professional painting. Whether restoring an old fence or painting a new one, we deliver quality finishes.

Quality fence painting enhances curb appeal, protects wood from elements, and can last 5-10 years with proper care. Choose from various colors to match your home style.`,
    benefits: [
      'Protects wood from weather and rot',
      'Dramatically improves curb appeal',
      'Covers stains and worn areas',
      'Professional prep and application',
      'Wide color selection available',
      'Long-lasting protection (5-10 years)',
      'Increases property value',
    ],
    process: [
      'Assess fence condition and prepare surface',
      'Power wash and sand if needed',
      'Apply quality primer if required',
      'Paint in your chosen color',
      'Clean up and a beautifully painted fence',
    ],
    faqs: [
      {
        question: 'Should I paint or stain my fence?',
        answer: 'Paint hides wood and offers more color options. Stain shows wood grain. We can help you decide.',
      },
      {
        question: 'How long does fence painting take?',
        answer: 'Typical residential fence takes 2-4 days depending on size and condition.',
      },
      {
        question: 'How long will the paint last?',
        answer: 'Quality exterior paint typically lasts 5-10 years. Climate and maintenance affect longevity.',
      },
      {
        question: 'Do you remove old paint?',
        answer: 'We perform surface prep appropriate to your fence condition. Sometimes we prime over old paint.',
      },
    ],
  },
  fence_staining: {
    fullDescription: `Enhance the natural beauty of your wood fence with professional staining. Stain highlights the wood's natural grain while providing excellent protection.

Unlike paint, stain lets the wood's character show through while protecting against weathering and UV damage. Regular staining keeps your fence looking rich and well-maintained.`,
    benefits: [
      'Highlights natural wood beauty',
      'Shows grain and character of wood',
      'Excellent protection from elements',
      'More natural appearance than paint',
      'Easier to refresh with new coats',
      'Premium wood protection',
      'Variety of depth options (light to dark)',
    ],
    process: [
      'Prepare fence surface thoroughly',
      'Sand and power wash as needed',
      'Apply wood conditioner for even color',
      'Apply quality stain in even coats',
      'Seal for maximum protection',
    ],
    faqs: [
      {
        question: 'What\'s the difference between stain and paint?',
        answer: 'Stain penetrates and shows wood grain. Paint coats surface. Stain looks more natural, paint offers more color options.',
      },
      {
        question: 'How often should fences be restained?',
        answer: 'Every 2-3 years depending on sun exposure and weather. High-traffic areas may need more frequent attention.',
      },
      {
        question: 'Can I stain over old paint?',
        answer: 'We need to remove old paint first for stain to adhere properly. We handle complete prep.',
      },
      {
        question: 'What stain colors are available?',
        answer: 'Natural, golden, cedar, mahogany, dark walnut, and more. We show samples to help you choose.',
      },
    ],
  },
  mulch_installation: {
    fullDescription: `Fresh mulch transforms landscape beds, controls weeds, and retains soil moisture. Our mulch installation service uses quality mulch and professional technique.

Perfect for new beds or refreshing existing ones, mulch installation is one of the highest-impact landscaping improvements. Choose from decorative wood, natural wood, or other mulch varieties.`,
    benefits: [
      'Suppresses weeds naturally',
      'Retains soil moisture in dry seasons',
      'Regulates soil temperature',
      'Adds visual appeal to beds',
      'Biodegradable and eco-friendly',
      'Improves soil as it decomposes',
      'Professional installation ensures even coverage',
    ],
    process: [
      'Measure and calculate mulch needed',
      'Select mulch type and color',
      'Install mulch at proper depth (2-3 inches)',
      'Edge beds for clean, finished look',
      'Landscape beds are refreshed and weed-protected',
    ],
    faqs: [
      {
        question: 'How much mulch do I need?',
        answer: 'We measure your beds and calculate exactly. Most beds need 2-4 inches of depth.',
      },
      {
        question: 'What types of mulch are available?',
        answer: 'Wood chips, natural color, dyed mulch in various colors, and shredded bark options available.',
      },
      {
        question: 'How often do I need new mulch?',
        answer: 'Refresh mulch annually or every 2 years depending on rainfall and decomposition.',
      },
      {
        question: 'Will mulch harm my plants?',
        answer: 'Quality mulch is safe for plants. We ensure proper placement away from plant stems.',
      },
    ],
  },
  rock_installation: {
    fullDescription: `Create stunning hardscape features with professional rock installation. From decorative river rock to large boulders, we design and install rock features that enhance your landscape.

Rock installation is durable, low-maintenance landscaping that adds visual interest and protects soil. Perfect for pathways, accent areas, or complete hardscape designs.`,
    benefits: [
      'Durable, long-lasting landscaping solution',
      'Low maintenance once installed',
      'Excellent drainage and moisture control',
      'Creates visual interest and texture',
      'Prevents soil erosion',
      'Available in many colors and varieties',
      'Professional installation for longevity',
    ],
    process: [
      'Design rock installation layout',
      'Select rock types and colors',
      'Prepare base and install landscape fabric',
      'Place rocks professionally',
      'Your landscape has permanent hardscape beauty',
    ],
    faqs: [
      {
        question: 'What types of rock are available?',
        answer: 'River rock, crushed stone, gravel, decorative boulders, and specialty landscape rock.',
      },
      {
        question: 'How long does rock last?',
        answer: 'Properly installed rock lasts decades. Landscape fabric prevents weeds and soil mixing.',
      },
      {
        question: 'Do I need to add landscape fabric?',
        answer: 'Yes, quality fabric prevents weeds and soil migration. We include it in installation.',
      },
      {
        question: 'Can rock be used with plants?',
        answer: 'Yes! Rock and plants combine beautifully. We design plantings that work with rock.',
      },
    ],
  },
  dog_waste_removal: {
    fullDescription: `Keep your yard clean and safe with flat-rate dog waste pickup. We discretely remove waste from your yard, eliminating odor and health hazards.

  At $20 per visit, this service stays simple and easy to book. Regular removal prevents buildup, keeps your yard hygienic for family and guests, and eliminates the unpleasant task from your to-do list. Perfect for busy pet owners.`,
    benefits: [
      'Flat $20 price per visit',
      'Eliminates yard odor completely',
      'Prevents parasites and contamination',
      'Keeps yard safe for children',
      'Reduces fly and pest attraction',
      'Saves time on yard maintenance',
      'Discreet, professional service',
      'Pet owner peace of mind',
    ],
    process: [
      'Schedule your preferred removal frequency',
      'We visit weekly or as scheduled',
      'Remove and properly dispose of waste',
      'Keep your yard clean and fresh',
    ],
    faqs: [
      {
        question: 'How often should waste be removed?',
        answer: 'Weekly is ideal for most households, and every visit is a flat $20 no matter the yard size.',
      },
      {
        question: 'Where do you dispose of the waste?',
        answer: 'We dispose of waste responsibly and legally in designated facilities.',
      },
      {
        question: 'What if I have multiple dogs?',
        answer: 'No problem! The service stays flat at $20 per visit, though very large or heavily used yards may need more frequent visits.',
      },
      {
        question: 'Do you service in winter?',
        answer: 'Yes! We service year-round, even in snow. Just let us know how to access your yard.',
      },
    ],
  },
  lawn_mow_dog_waste_combo: {
    fullDescription: `Get the best of both services with our combo package—professional lawn mowing plus dog waste removal. Save money with bundled service while keeping your yard pristine.

Perfect for pet owners who want a beautiful, clean yard without the hassle. We coordinate both services for maximum convenience.`,
    benefits: [
      'Complete yard maintenance in one service',
      'Discounted pricing vs. individual services',
      'Coordinated scheduling for convenience',
      'Clean lawn AND clean yard',
      'Perfect for busy pet owners',
      'Flexible frequency options',
      'Recurring pricing discounts',
    ],
    process: [
      'Schedule combination service frequency',
      'Laser focus on lawn mowing and waste removal',
      'Both services completed during same visit',
      'Enjoy a beautiful, clean yard',
    ],
    faqs: [
      {
        question: 'Can I customize the combo service?',
        answer: 'Yes! Choose your mowing frequency (weekly, bi-weekly) and waste removal schedule.',
      },
      {
        question: 'How much do I save with the combo?',
        answer: 'The combo package saves approximately 10-15% compared to booking services separately.',
      },
      {
        question: 'Can I change services later?',
        answer: 'Absolutely. You can upgrade, downgrade, or modify your combo anytime.',
      },
      {
        question: 'What if I only want one service some weeks?',
        answer: 'Discuss your needs—we work with flexible customers to adjust as needed.',
      },
    ],
  },
  pool_cleaning: {
    fullDescription: `Keep your pool crystal clear and safe with professional cleaning and maintenance. Our pool experts handle everything from weekly cleaning to equipment care.

Proper pool maintenance prevents algae, maintains water chemistry, and extends equipment life. Enjoy a perfectly maintained pool without the hassle.`,
    benefits: [
      'Crystal clear water maintained consistently',
      'Proper water chemistry management',
      'Equipment inspection and maintenance',
      'Prevents algae and unhealthy water',
      'Extends pool equipment lifespan',
      'Safety maintained year-round',
      'Weekly or custom service schedules',
    ],
    process: [
      'Schedule your preferred cleaning frequency',
      'Weekly professional cleaning and testing',
      'Maintain proper water chemistry',
      'Equipment inspection for issues',
      'Your pool is always ready for swimming',
    ],
    faqs: [
      {
        question: 'How often should pools be cleaned?',
        answer: 'Weekly cleaning is standard. We adjust frequency based on usage and season.',
      },
      {
        question: 'What does cleaning include?',
        answer: 'Skimming, brushing, vacuuming, filter cleaning, and water chemistry testing.',
      },
      {
        question: 'Do you handle equipment repairs?',
        answer: 'We inspect equipment. For repairs, we recommend trusted technicians.',
      },
      {
        question: 'What about pool opening and closing?',
        answer: 'Seasonal opening and closing services available to prepare your pool.',
      },
    ],
  },
};
