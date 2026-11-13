// Static content: trigger library, symptom lists, rewards.

export const TRIGGER_GROUPS = [
  {
    id: 'hormones', label: 'Hormones',
    items: [
      ['ovulation', 'Mid-cycle / ovulation'],
      ['hrt_change', 'HRT dose changed'],
      ['hrt_missed', 'Missed HRT or pill'],
      ['pill_break', 'Pill-free week'],
    ],
  },
  {
    id: 'sleep', label: 'Sleep',
    items: [
      ['sleep_short', 'Too little sleep'],
      ['sleep_long', 'Slept in / too much sleep'],
      ['sleep_broken', 'Broken sleep'],
      ['late_night', 'Late night'],
      ['jet_lag', 'Jet lag / shift change'],
      ['nap', 'Long daytime nap'],
    ],
  },
  {
    id: 'stress', label: 'Stress & emotions',
    items: [
      ['busy_day', 'Very busy day'],
      ['worry', 'Worry or anxiety'],
      ['upset', 'Emotional upset / crying'],
      ['conflict', 'Argument or conflict'],
      ['overstimulated', 'Overstimulated'],
      ['excitement', 'Big event / excitement'],
    ],
  },
  {
    id: 'food', label: 'Food & drink',
    items: [
      ['skipped_meal', 'Skipped or late meal'],
      ['dehydrated', 'Not enough water'],
      ['alcohol', 'Alcohol'],
      ['red_wine', 'Red wine'],
      ['caffeine_more', 'More caffeine than usual'],
      ['caffeine_less', 'Less caffeine than usual'],
      ['chocolate', 'Chocolate'],
      ['aged_cheese', 'Aged cheese'],
      ['cured_meat', 'Cured / processed meat'],
      ['msg', 'MSG / takeaway food'],
      ['sweetener', 'Artificial sweeteners'],
      ['sugar', 'Lots of sugar'],
      ['citrus', 'Citrus fruit'],
      ['cold_food', 'Ice-cold food or drink'],
      ['fasting', 'Fasting'],
    ],
  },
  {
    id: 'environment', label: 'Surroundings',
    items: [
      ['weather_change', 'Weather change'],
      ['storm', 'Storm / pressure drop'],
      ['heat', 'Heat or humidity'],
      ['cold_wind', 'Cold or wind'],
      ['bright_light', 'Bright or flickering light'],
      ['sun_glare', 'Sun glare'],
      ['screen_time', 'Long screen time'],
      ['loud_noise', 'Loud noise'],
      ['strong_smell', 'Strong smells / perfume'],
      ['smoke', 'Smoke'],
      ['stuffy_room', 'Stuffy room'],
      ['altitude', 'Altitude / flying'],
    ],
  },
  {
    id: 'body', label: 'Body',
    items: [
      ['neck_tension', 'Neck or shoulder tension'],
      ['posture', 'Long sitting / poor posture'],
      ['hard_exercise', 'Intense exercise'],
      ['no_movement', 'Hardly moved today'],
      ['jaw', 'Jaw clenching / teeth grinding'],
      ['eye_strain', 'Eye strain'],
      ['illness', 'Cold, flu or infection'],
      ['allergies', 'Allergies / blocked sinuses'],
      ['travel', 'Travel / long drive'],
      ['overexertion', 'Physical overexertion'],
      ['smoking', 'Smoking'],
    ],
  },
];

// Triggers switched on for a new user: a short, relevant starter set.
export const DEFAULT_TRIGGERS = [
  'sleep_short', 'sleep_broken', 'busy_day', 'worry', 'skipped_meal', 'dehydrated',
  'alcohol', 'caffeine_more', 'weather_change', 'bright_light', 'screen_time',
  'strong_smell', 'neck_tension', 'hard_exercise',
];

export const PERIOD_LEVELS = [
  ['none', 'None'], ['spotting', 'Spotting'], ['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy'],
];

export const HEADACHE_TYPES = [
  ['migraine', 'Migraine'], ['tension', 'Tension'], ['cluster', 'Cluster'], ['sinus', 'Sinus'], ['unsure', 'Not sure'],
];

export const DURATIONS = [
  ['lt1', 'Under 1 hour'], ['1to4', '1 to 4 hours'], ['4to12', '4 to 12 hours'], ['12to24', '12 to 24 hours'], ['gt24', 'Over a day'],
];

export const LOCATIONS = [
  ['left', 'Left side'], ['right', 'Right side'], ['both', 'Both sides'], ['forehead', 'Forehead'],
  ['temples', 'Temples'], ['eyes', 'Behind the eyes'], ['back', 'Back of head'], ['neck', 'Neck'],
];

export const HEADACHE_SYMPTOMS = [
  ['aura', 'Aura / visual changes'], ['nausea', 'Nausea'], ['vomiting', 'Vomiting'],
  ['light', 'Light sensitivity'], ['sound', 'Sound sensitivity'], ['smell', 'Smell sensitivity'],
  ['dizzy', 'Dizziness'], ['throbbing', 'Throbbing'], ['pressing', 'Pressing / tight band'],
  ['fog', 'Brain fog'], ['tingling', 'Tingling or numbness'],
];

export const IMPACT = [
  ['none', 'Carried on as normal'], ['slowed', 'Slowed me down'], ['rest', 'Had to rest or lie down'],
];

export const RELIEF = [
  ['none', 'No relief'], ['little', 'A little'], ['mostly', 'Mostly'], ['full', 'Completely'],
];

export const DEFAULT_MEDS = ['Paracetamol', 'Ibuprofen', 'Naproxen', 'Aspirin', 'Triptan', 'Anti-nausea'];

export const MENO_SYMPTOMS = [
  ['hot_flash', 'Hot flashes'], ['night_sweats', 'Night sweats'], ['insomnia', 'Trouble sleeping'],
  ['mood_swings', 'Mood swings'], ['low_mood', 'Low mood'], ['anxious', 'Anxiety'],
  ['irritable', 'Irritability'], ['palpitations', 'Heart palpitations'], ['meno_fog', 'Brain fog'],
  ['fatigue', 'Fatigue'], ['joint_aches', 'Joint aches'], ['breast_tender', 'Breast tenderness'],
  ['bloating', 'Bloating'], ['dryness', 'Vaginal dryness'],
];

export const STAGES = [
  ['regular', 'My periods are fairly regular'],
  ['irregular', 'My periods are changing or irregular'],
  ['none', 'I no longer have periods'],
];

// Labels for factors the app derives itself (not picked by the user).
export const DERIVED_LABELS = {
  period: 'your period',
  perimenstrual: 'the start of your period (from two days before to two days after)',
  stress_high: 'high stress',
  sleep_poor: 'poor sleep',
  hrt_taken: 'HRT',
};

export const MILESTONES = [
  { at: 1, title: 'First bloom', text: 'You planted your very first flower.' },
  { at: 3, title: 'Taking root', text: 'Three check-ins. A habit is starting to grow.' },
  { at: 7, title: 'A week of care', text: 'Seven check-ins. Poppies now grow in your garden.' },
  { at: 14, title: 'Two weeks in', text: 'Clary can start looking for your patterns now.' },
  { at: 30, title: 'A month of you', text: 'Thirty check-ins. Lavender has arrived.' },
  { at: 60, title: 'In full flower', text: 'Sixty check-ins. Tulips join the garden.' },
  { at: 100, title: 'One hundred blooms', text: 'A hundred moments of looking after yourself.' },
  { at: 180, title: 'Half a year', text: 'Six months of insight. Peonies are in bloom.' },
  { at: 365, title: 'A full year', text: 'Every season, recorded. This garden is all yours.' },
];

// Flower species and the check-in count that unlocks each one.
export const SPECIES = [
  { id: 'daisy', name: 'daisy', at: 1 },
  { id: 'poppy', name: 'poppy', at: 7 },
  { id: 'lavender', name: 'lavender sprig', at: 30 },
  { id: 'tulip', name: 'tulip', at: 60 },
  { id: 'peony', name: 'peony', at: 180 },
];

export const CARDS = [
  'Drink a full glass of water before your next cup of tea or coffee.',
  'Drop your shoulders away from your ears. Hold for three slow breaths.',
  'Step outside for five minutes. Daylight helps set tonight’s sleep.',
  'You do not have to earn rest. It is allowed simply because you need it.',
  'Unclench your jaw. Let your tongue rest behind your top teeth.',
  'Eat something within an hour of waking. A steady start helps a steady head.',
  'Look at something far away for twenty seconds. Your eyes will thank you.',
  'Say no to one thing this week. Notice how it feels.',
  'A cool cloth on the back of the neck can calm a hot flash and a tense head.',
  'Keep tomorrow’s bedtime close to tonight’s. Rhythm is kind to hormones.',
  'Stretch your neck gently: ear to shoulder, each side, slowly.',
  'This phase of life is a transition, not a decline. You are still becoming.',
  'Put your phone down thirty minutes before bed tonight.',
  'A short walk counts. Ten minutes is enough to matter.',
  'Notice one thing your body did well today.',
  'Breathe in for four, out for six. Five rounds. That is all.',
  'Keep a snack in your bag. Skipped meals are a common trigger.',
  'Tracking is not about being perfect. It is about being curious.',
  'Call the friend who makes you laugh.',
  'Dim the lights an hour before sleep. Your brain reads it as dusk.',
  'On hard days, doing less is doing well.',
  'Layer your clothes. Being able to cool down fast is a small superpower.',
  'Write down one thing that is worrying you, then close the notebook.',
  'Your patterns are yours. What triggers someone else may not trigger you.',
  'Stand up, roll your shoulders back, and take up a little more space.',
  'A warm shower on tight shoulders is medicine of its own kind.',
  'Bring your notes to your next appointment. You know your body best.',
  'Rest your eyes: palms over closed eyes, one quiet minute.',
  'Have your last coffee before early afternoon and see how you sleep.',
  'You showed up for yourself today. That is the whole point.',
  'Open a window. Fresh air clears a stuffy room and a stuffy head.',
  'Slow down the first ten minutes of tomorrow morning.',
  'Be as gentle with yourself as you would be with a friend.',
  'Magnesium-rich foods like nuts, seeds and leafy greens are worth a place on your plate.',
  'Something quiet for yourself tonight: a book, a bath, some music.',
  'Hot flash passing through? It will pass. Breathe slowly until it does.',
];
