// Static content: trigger library, symptom lists, rewards.
// Every label is { en, nl }. labelOf() in app.js picks the current language.

export const TRIGGER_GROUPS = [
  {
    id: 'hormones', label: { en: 'Hormones', nl: 'Hormonen' },
    items: [
      ['ovulation', { en: 'Mid-cycle / ovulation', nl: 'Midden van de cyclus / eisprong' }],
      ['hrt_change', { en: 'HRT dose changed', nl: 'Dosis hormoontherapie aangepast' }],
      ['hrt_missed', { en: 'Missed HRT or pill', nl: 'HRT of pil vergeten' }],
      ['pill_break', { en: 'Pill-free week', nl: 'Stopweek' }],
    ],
  },
  {
    id: 'sleep', label: { en: 'Sleep', nl: 'Slaap' },
    items: [
      ['sleep_short', { en: 'Too little sleep', nl: 'Te weinig geslapen' }],
      ['sleep_long', { en: 'Slept in / too much sleep', nl: 'Uitgeslapen / te veel geslapen' }],
      ['slept_longer', { en: 'Slept longer than usual', nl: 'Langer geslapen dan normaal' }],
      ['slept_deep', { en: 'Slept too deeply', nl: 'Te vast geslapen' }],
      ['sleep_broken', { en: 'Broken sleep', nl: 'Onrustig geslapen' }],
      ['late_night', { en: 'Late night', nl: 'Laat naar bed' }],
      ['jet_lag', { en: 'Jet lag / shift change', nl: 'Jetlag / ploegendienst' }],
      ['nap', { en: 'Long daytime nap', nl: 'Lang gedut overdag' }],
      ['tired', { en: 'Tired', nl: 'Moe' }],
    ],
  },
  {
    id: 'stress', label: { en: 'Stress & emotions', nl: 'Stress en emoties' },
    items: [
      ['busy_day', { en: 'Very busy day', nl: 'Hele drukke dag' }],
      ['busy', { en: 'Busy day', nl: 'Drukke dag' }],
      ['worry', { en: 'Worry or anxiety', nl: 'Zorgen of angst' }],
      ['upset', { en: 'Emotional upset / crying', nl: 'Van streek / gehuild' }],
      ['conflict', { en: 'Argument or conflict', nl: 'Ruzie of conflict' }],
      ['overstimulated', { en: 'Overstimulated', nl: 'Overprikkeld' }],
      ['excitement', { en: 'Big event / excitement', nl: 'Spannende gebeurtenis' }],
    ],
  },
  {
    id: 'food', label: { en: 'Food & drink', nl: 'Eten en drinken' },
    items: [
      ['skipped_meal', { en: 'Skipped or late meal', nl: 'Maaltijd overgeslagen of laat gegeten' }],
      ['dehydrated', { en: 'Not enough water', nl: 'Te weinig gedronken' }],
      ['alcohol', { en: 'Alcohol', nl: 'Alcohol' }],
      ['red_wine', { en: 'Red wine', nl: 'Rode wijn' }],
      ['caffeine_more', { en: 'More caffeine than usual', nl: 'Meer cafeïne dan normaal' }],
      ['caffeine_less', { en: 'Less caffeine than usual', nl: 'Minder cafeïne dan normaal' }],
      ['chocolate', { en: 'Chocolate', nl: 'Chocolade' }],
      ['aged_cheese', { en: 'Aged cheese', nl: 'Belegen kaas' }],
      ['cured_meat', { en: 'Cured / processed meat', nl: 'Gerookt of bewerkt vlees' }],
      ['msg', { en: 'MSG / takeaway food', nl: 'MSG / afhaaleten' }],
      ['sweetener', { en: 'Artificial sweeteners', nl: 'Kunstmatige zoetstoffen' }],
      ['sugar', { en: 'Lots of sugar', nl: 'Veel suiker' }],
      ['citrus', { en: 'Citrus fruit', nl: 'Citrusvruchten' }],
      ['cold_food', { en: 'Ice-cold food or drink', nl: 'IJskoud eten of drinken' }],
      ['fasting', { en: 'Fasting', nl: 'Vasten' }],
    ],
  },
  {
    id: 'environment', label: { en: 'Surroundings', nl: 'Omgeving' },
    items: [
      ['weather_change', { en: 'Weather change', nl: 'Weersomslag' }],
      ['storm', { en: 'Storm / pressure drop', nl: 'Onweer / luchtdrukval' }],
      ['heat', { en: 'Heat or humidity', nl: 'Hitte of vochtigheid' }],
      ['cold_wind', { en: 'Cold or wind', nl: 'Kou of wind' }],
      ['bright_light', { en: 'Bright or flickering light', nl: 'Fel of flikkerend licht' }],
      ['sun_glare', { en: 'Sun glare', nl: 'Felle zon of schittering' }],
      ['screen_time', { en: 'Long screen time', nl: 'Lang beeldschermgebruik' }],
      ['loud_noise', { en: 'Loud noise', nl: 'Harde geluiden' }],
      ['strong_smell', { en: 'Strong smells / perfume', nl: 'Sterke geuren / parfum' }],
      ['smoke', { en: 'Smoke', nl: 'Rook' }],
      ['stuffy_room', { en: 'Stuffy room', nl: 'Bedompte ruimte' }],
      ['altitude', { en: 'Altitude / flying', nl: 'Hoogte / vliegen' }],
    ],
  },
  {
    id: 'body', label: { en: 'Body', nl: 'Lichaam' },
    items: [
      ['neck_tension', { en: 'Neck or shoulder tension', nl: 'Nek- of schouderspanning' }],
      ['posture', { en: 'Long sitting / poor posture', nl: 'Lang zitten / slechte houding' }],
      ['hard_exercise', { en: 'Intense exercise', nl: 'Zware inspanning' }],
      ['no_movement', { en: 'Hardly moved today', nl: 'Nauwelijks bewogen vandaag' }],
      ['jaw', { en: 'Jaw clenching / teeth grinding', nl: 'Kaak op elkaar / tandenknarsen' }],
      ['eye_strain', { en: 'Eye strain', nl: 'Vermoeide ogen' }],
      ['illness', { en: 'Cold, flu or infection', nl: 'Verkoudheid, griep of infectie' }],
      ['allergies', { en: 'Allergies / blocked sinuses', nl: 'Allergieën / verstopte neus' }],
      ['travel', { en: 'Travel / long drive', nl: 'Reizen / lange autorit' }],
      ['overexertion', { en: 'Physical overexertion', nl: 'Lichamelijke overbelasting' }],
      ['smoking', { en: 'Smoking', nl: 'Roken' }],
    ],
  },
];

// Triggers switched on for a new user: a short, relevant starter set.
export const DEFAULT_TRIGGERS = [
  'sleep_short', 'sleep_broken', 'tired', 'slept_longer', 'slept_deep', 'busy_day', 'busy', 'worry',
  'skipped_meal', 'dehydrated', 'alcohol', 'caffeine_more', 'weather_change', 'bright_light', 'screen_time',
  'strong_smell', 'neck_tension', 'hard_exercise',
];

// New default triggers introduced after the first release. Each is added
// once to an already-set-up user's check-in list (not just new sign-ups), so
// nobody has to go find it in the full picker - but never reintroduced if
// they remove it again afterwards. See store.js normalize().
export const TRIGGER_UPDATES = [
  { id: '2026-11-tired-busy-sleep', add: ['tired', 'busy', 'slept_longer', 'slept_deep'] },
];

export const PERIOD_LEVELS = [
  ['none', { en: 'None', nl: 'Geen' }],
  ['spotting', { en: 'Spotting', nl: 'Spotting' }],
  ['light', { en: 'Light', nl: 'Licht' }],
  ['medium', { en: 'Medium', nl: 'Gemiddeld' }],
  ['heavy', { en: 'Heavy', nl: 'Hevig' }],
];

export const HEADACHE_TYPES = [
  ['migraine', { en: 'Migraine', nl: 'Migraine' }],
  ['tension', { en: 'Tension', nl: 'Spanningshoofdpijn' }],
  ['cluster', { en: 'Cluster', nl: 'Clusterhoofdpijn' }],
  ['sinus', { en: 'Sinus', nl: 'Sinushoofdpijn' }],
  ['unsure', { en: 'Not sure', nl: 'Niet zeker' }],
];

export const DURATIONS = [
  ['lt1', { en: 'Under 1 hour', nl: 'Minder dan 1 uur' }],
  ['1to4', { en: '1 to 4 hours', nl: '1 tot 4 uur' }],
  ['4to12', { en: '4 to 12 hours', nl: '4 tot 12 uur' }],
  ['12to24', { en: '12 to 24 hours', nl: '12 tot 24 uur' }],
  ['gt24', { en: 'Over a day', nl: 'Langer dan een dag' }],
];

// How the headache arrived: a sudden onset is worth flagging to a doctor,
// while waking up with one or a slow build are more typical patterns.
export const ONSET = [
  ['woke_with_it', { en: 'Woke up with it', nl: 'Wakker geworden met hoofdpijn' }],
  ['gradual', { en: 'Built up gradually', nl: 'Geleidelijk opgebouwd' }],
  ['sudden', { en: 'Came on suddenly', nl: 'Plotseling opgekomen' }],
];

export const LOCATIONS = [
  ['left', { en: 'Left side', nl: 'Linkerkant' }],
  ['right', { en: 'Right side', nl: 'Rechterkant' }],
  ['both', { en: 'Both sides', nl: 'Beide kanten' }],
  ['forehead', { en: 'Forehead', nl: 'Voorhoofd' }],
  ['temples', { en: 'Temples', nl: 'Slapen' }],
  ['eyes', { en: 'Behind the eyes', nl: 'Achter de ogen' }],
  ['back', { en: 'Back of head', nl: 'Achterhoofd' }],
  ['neck', { en: 'Neck', nl: 'Nek' }],
];

export const HEADACHE_SYMPTOMS = [
  ['felt_coming', { en: 'Felt it coming beforehand', nl: 'Voelde hem van tevoren aankomen' }],
  ['aura', { en: 'Aura / visual changes', nl: 'Aura / lichtflitsen zien' }],
  ['nausea', { en: 'Nausea', nl: 'Misselijkheid' }],
  ['vomiting', { en: 'Vomiting', nl: 'Overgeven' }],
  ['light_sensitivity', { en: 'Light sensitivity', nl: 'Lichtgevoeligheid' }],
  ['sound', { en: 'Sound sensitivity', nl: 'Geluidsgevoeligheid' }],
  ['smell', { en: 'Smell sensitivity', nl: 'Geurgevoeligheid' }],
  ['dizzy', { en: 'Dizziness', nl: 'Duizeligheid' }],
  ['throbbing', { en: 'Throbbing', nl: 'Bonzend gevoel' }],
  ['pressing', { en: 'Pressing / tight band', nl: 'Drukkend gevoel / band om het hoofd' }],
  ['fog', { en: 'Brain fog', nl: 'Mentale mist' }],
  ['tingling', { en: 'Tingling or numbness', nl: 'Tintelingen of een doof gevoel' }],
];

// Ids are unique across every list sharing one lookup map in app.js (labelOf),
// so "none" is reserved for PERIOD_LEVELS alone - these use their own id.
export const IMPACT = [
  ['carried_on', { en: 'Carried on as normal', nl: 'Gewoon doorgegaan' }],
  ['slowed', { en: 'Slowed me down', nl: 'Vertraagde me' }],
  ['rest', { en: 'Had to rest or lie down', nl: 'Moest rusten of liggen' }],
  ['missed_work', { en: 'Could not work, or cancelled plans', nl: 'Kon niet werken, of zegde afspraken af' }],
];

export const RELIEF = [
  ['no_relief', { en: 'No relief', nl: 'Geen verlichting' }],
  ['little', { en: 'A little', nl: 'Een beetje' }],
  ['mostly', { en: 'Mostly', nl: 'Grotendeels' }],
  ['full', { en: 'Completely', nl: 'Helemaal' }],
];

export const DEFAULT_MEDS = {
  en: ['Paracetamol', 'Ibuprofen', 'Naproxen', 'Aspirin', 'Triptan', 'Anti-nausea'],
  nl: ['Paracetamol', 'Ibuprofen', 'Naproxen', 'Aspirine', 'Triptaan', 'Anti-misselijkheid'],
};

// Shown directly in the daily check-in (not only under "More detail"), so
// the most common symptoms actually get logged often enough for patterns
// and the doctor report to say something meaningful about them.
export const QUICK_MENO_SYMPTOMS = ['hot_flash', 'night_sweats', 'insomnia', 'mood_swings'];

// Matches "Triptan"/"Triptaan" (the built-in generic entry) and any named
// triptan ("Sumatriptan", "Rizatriptan", ...), for the medication-overuse
// split: triptans are flagged from 10 days/month, simple analgesics from 15.
export const TRIPTAN_RE = /tript/i; // matches "Triptan", Dutch "Triptaan", and named ones like "Sumatriptan"

// Severity for a logged menopause symptom: 1 (light) to 3 (severe).
export const SEVERITY = [
  [1, { en: 'Light', nl: 'Licht' }],
  [2, { en: 'Moderate', nl: 'Matig' }],
  [3, { en: 'Severe', nl: 'Hevig' }],
];

export const MENO_SYMPTOMS = [
  ['hot_flash', { en: 'Hot flashes', nl: 'Opvliegers' }],
  ['night_sweats', { en: 'Night sweats', nl: 'Nachtzweten' }],
  ['insomnia', { en: 'Trouble sleeping', nl: 'Moeite met slapen' }],
  ['mood_swings', { en: 'Mood swings', nl: 'Stemmingswisselingen' }],
  ['low_mood', { en: 'Low mood', nl: 'Somberheid' }],
  ['anxious', { en: 'Anxiety', nl: 'Angst' }],
  ['irritable', { en: 'Irritability', nl: 'Prikkelbaarheid' }],
  ['palpitations', { en: 'Heart palpitations', nl: 'Hartkloppingen' }],
  ['meno_fog', { en: 'Brain fog', nl: 'Mentale mist' }],
  ['fatigue', { en: 'Fatigue', nl: 'Vermoeidheid' }],
  ['joint_aches', { en: 'Joint aches', nl: 'Gewrichtspijn' }],
  ['breast_tender', { en: 'Breast tenderness', nl: 'Gevoelige borsten' }],
  ['bloating', { en: 'Bloating', nl: 'Opgeblazen gevoel' }],
  ['dryness', { en: 'Vaginal dryness', nl: 'Vaginale droogte' }],
];

export const STAGES = [
  ['regular', { en: 'My periods are fairly regular', nl: 'Mijn menstruatie is redelijk regelmatig' }],
  ['irregular', { en: 'My periods are changing or irregular', nl: 'Mijn menstruatie verandert of is onregelmatig' }],
  ['none', { en: 'I no longer have periods', nl: 'Ik heb geen menstruatie meer' }],
];

// Labels for factors the app derives itself (not picked by the user).
export const DERIVED_LABELS = {
  period: { en: 'your period', nl: 'je menstruatie' },
  perimenstrual: {
    en: 'the start of your period (from two days before to three days after)',
    nl: 'het begin van je menstruatie (van twee dagen ervoor tot drie dagen erna)',
  },
  stress_high: { en: 'high stress', nl: 'hoge stress' },
  sleep_poor: { en: 'poor sleep', nl: 'slechte slaap' },
  hrt_taken: { en: 'HRT', nl: 'HRT' },
};

export const MILESTONES = [
  { at: 1, title: { en: 'First bloom', nl: 'Eerste bloem' },
    text: { en: 'You planted your very first flower.', nl: 'Je plantte je allereerste bloem.' } },
  { at: 3, title: { en: 'Taking root', nl: 'Wortel schieten' },
    text: { en: 'Three check-ins. A habit is starting to grow.', nl: 'Drie check-ins. Een gewoonte begint te groeien.' } },
  { at: 7, title: { en: 'A week of care', nl: 'Een week vol zorg' },
    text: { en: 'Seven check-ins. Poppies now grow in your garden.', nl: 'Zeven check-ins. Er groeien nu klaprozen in je tuin.' } },
  { at: 14, title: { en: 'Two weeks in', nl: 'Twee weken verder' },
    text: { en: 'Clary can start looking for your patterns now.', nl: 'Clary kan nu op zoek naar jouw patronen.' } },
  { at: 30, title: { en: 'A month of you', nl: 'Een maand van jou' },
    text: { en: 'Thirty check-ins. Lavender has arrived.', nl: 'Dertig check-ins. De lavendel is er.' } },
  { at: 60, title: { en: 'In full flower', nl: 'In volle bloei' },
    text: { en: 'Sixty check-ins. Tulips join the garden.', nl: 'Zestig check-ins. Tulpen voegen zich bij de tuin.' } },
  { at: 100, title: { en: 'One hundred blooms', nl: 'Honderd bloemen' },
    text: { en: 'A hundred moments of looking after yourself.', nl: 'Honderd momenten van zorgen voor jezelf.' } },
  { at: 180, title: { en: 'Half a year', nl: 'Een half jaar' },
    text: { en: 'Six months of insight. Peonies are in bloom.', nl: 'Zes maanden aan inzicht. De pioenrozen bloeien.' } },
  { at: 365, title: { en: 'A full year', nl: 'Een heel jaar' },
    text: {
      en: 'Every season, recorded. A protea has bloomed, and your tree has taken root: this garden is all yours.',
      nl: 'Elk seizoen vastgelegd. Er is een protea opengebloeid, en je boom heeft wortel geschoten: deze tuin is helemaal van jou.',
    } },
];

// Flower species and the check-in count that unlocks each one. `meaning` is
// shown only for species chosen specifically for what they symbolise.
export const SPECIES = [
  { id: 'daisy', name: { en: 'daisy', nl: 'madeliefje' }, at: 1 },
  { id: 'poppy', name: { en: 'poppy', nl: 'klaproos' }, at: 7 },
  { id: 'lavender', name: { en: 'lavender sprig', nl: 'lavendeltakje' }, at: 30 },
  { id: 'tulip', name: { en: 'tulip', nl: 'tulp' }, at: 60 },
  { id: 'peony', name: { en: 'peony', nl: 'pioenroos' }, at: 180 },
  {
    id: 'protea', name: { en: 'protea', nl: 'protea' }, at: 365,
    meaning: {
      en: 'Proteas bloom most strongly after fire. A fitting flower for change.',
      nl: 'Protea’s bloeien het mooist na een vuur. Een passende bloem voor verandering.',
    },
  },
];

// Decorative extras layered into the garden once it holds this many flowers,
// never tied to a single check-in the way species are.
export const BUTTERFLY_MILESTONES = [100, 365];
export const TREE_MILESTONE = 365;

export const CARDS = {
  en: [
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
  ],
  nl: [
    'Drink een heel glas water voordat je de volgende kop thee of koffie neemt.',
    'Laat je schouders zakken, weg van je oren. Houd dit drie rustige ademhalingen vol.',
    'Ga vijf minuten naar buiten. Daglicht helpt je vannacht beter te slapen.',
    'Rust hoef je niet te verdienen. Je mag rusten, simpelweg omdat je het nodig hebt.',
    'Ontspan je kaak. Laat je tong rusten tegen je boventanden.',
    'Eet iets binnen een uur na het wakker worden. Een rustige start helpt een rustig hoofd.',
    'Kijk twintig seconden naar iets ver weg. Je ogen zullen je dankbaar zijn.',
    'Zeg deze week ergens nee tegen. Merk op hoe dat voelt.',
    'Een koel washandje in de nek kan een opvlieger en een gespannen hoofd allebei kalmeren.',
    'Houd je bedtijd morgen dicht bij die van vanavond. Ritme is vriendelijk voor je hormonen.',
    'Rek je nek voorzichtig: oor naar schouder, elke kant apart, langzaam.',
    'Deze levensfase is een overgang, geen achteruitgang. Je bent nog steeds in ontwikkeling.',
    'Leg je telefoon vanavond dertig minuten voor het slapengaan weg.',
    'Een korte wandeling telt mee. Tien minuten is al genoeg.',
    'Merk één ding op dat je lichaam vandaag goed heeft gedaan.',
    'Adem vier tellen in, zes tellen uit. Vijf keer. Meer hoeft niet.',
    'Houd een tussendoortje bij je. Een overgeslagen maaltijd is een bekende trigger.',
    'Bijhouden hoeft niet perfect. Het gaat erom nieuwsgierig te blijven.',
    'Bel die ene vriendin die je altijd aan het lachen maakt.',
    'Dim het licht een uur voor het slapengaan. Je brein leest dat als avondschemering.',
    'Op zware dagen is minder doen al genoeg.',
    'Kleed je in laagjes. Snel kunnen afkoelen is een handige kleine superkracht.',
    'Schrijf één zorg op, en sluit daarna het schrift.',
    'Jouw patronen zijn van jou. Wat bij iemand anders een trigger is, hoeft dat bij jou niet te zijn.',
    'Ga rechtop staan, rol je schouders naar achteren en neem wat meer ruimte in.',
    'Een warme douche op gespannen schouders is een medicijn op zich.',
    'Neem je aantekeningen mee naar je volgende afspraak. Jij kent je lichaam het best.',
    'Laat je ogen rusten: handpalmen op je gesloten ogen, één rustige minuut.',
    'Drink je laatste koffie voor de vroege middag en kijk hoe je slaapt.',
    'Je hebt vandaag voor jezelf gezorgd. Daar gaat het om.',
    'Zet een raam open. Frisse lucht verheldert een bedompte kamer en een bedompt hoofd.',
    'Neem de eerste tien minuten van morgenochtend rustig.',
    'Wees net zo zacht voor jezelf als je voor een vriendin zou zijn.',
    'Magnesiumrijke voeding zoals noten, zaden en groene bladgroenten verdient een plek op je bord.',
    'Iets rustigs voor jezelf vanavond: een boek, een bad, wat muziek.',
    'Een opvlieger die opkomt? Hij gaat weer over. Adem rustig tot het zover is.',
  ],
};

// --- "Garden & self-care" pack (optional, paid add-on) ---------------------
// Extra flower species, shown once purchased, interleaved with the free
// SPECIES by their own `at` thresholds. Kept in its own list (not merged
// into SPECIES) so nothing changes in the free garden for anyone who hasn't
// bought the pack.
export const PACK_SPECIES = [
  { id: 'moonflower', name: { en: 'moonflower', nl: 'maanbloem' }, at: 14 },
  {
    id: 'eveningprimrose', name: { en: 'evening primrose', nl: 'teunisbloem' }, at: 45,
    meaning: {
      en: 'Evening primrose only opens at dusk - a flower built for the quieter hours.',
      nl: 'De teunisbloem opent pas bij schemering - een bloem gemaakt voor de rustigere uren.',
    },
  },
  { id: 'iris', name: { en: 'iris', nl: 'iris' }, at: 120 },
];

// Extra self-care cards for the pack: short breathing exercises for use
// during an active headache, and short menopause-education notes. Folded
// into the same daily rotation as CARDS once purchased.
export const PACK_CARDS = {
  en: [
    'In through the nose for four counts, hold for four, out through the mouth for six. Repeat five times.',
    'Breathe in slowly while you count to four fingers on one hand, one finger at a time. Then breathe out the same way.',
    'Picture a candle an arm’s length away. Breathe in gently, then breathe out as if you were making the flame flicker without blowing it out.',
    'Drop your shoulders, unclench your jaw, soften your eyebrows - in that order. Hold each for one breath.',
    'Press your feet flat on the floor. Notice their full weight for five slow breaths. This is called grounding.',
    'Hormone levels shift unevenly in perimenopause, not in one smooth decline - which is part of why some weeks feel harder than others.',
    'Hot flashes are linked to a narrowed "thermoneutral zone" in the brain, so smaller temperature changes trigger a bigger response.',
    'Migraine becomes more common right before menopause for many people, then often eases afterward, as hormone levels settle rather than fluctuate.',
    'Poor sleep and headaches often feed each other - improving one, even slightly, tends to help the other.',
    'None of this is about willpower. Fluctuating hormones genuinely change how your body responds to stress, heat and pain.',
  ],
  nl: [
    'Vier tellen in door je neus, vier tellen vasthouden, zes tellen uit door je mond. Herhaal dit vijf keer.',
    'Adem langzaam in terwijl je met één vinger tegelijk vier vingers van één hand telt. Adem op dezelfde manier weer uit.',
    'Stel je een kaars op armlengte afstand voor. Adem zachtjes in, en blaas dan uit alsof je de vlam laat flakkeren zonder hem uit te blazen.',
    'Laat je schouders zakken, ontspan je kaak, en ontspan je wenkbrauwen - in die volgorde. Houd elke stap één ademhaling vast.',
    'Zet je voeten plat op de grond. Voel vijf rustige ademhalingen lang hun volle gewicht. Dit heet aarden.',
    'Hormoonspiegels schommelen tijdens de perimenopauze ongelijkmatig, niet in één geleidelijke daling - dat is mede waarom sommige weken zwaarder voelen dan andere.',
    'Opvliegers hangen samen met een versmalde "thermoneutrale zone" in de hersenen, waardoor kleinere temperatuurveranderingen al een grotere reactie geven.',
    'Migraine komt bij veel mensen vaker voor vlak voor de menopauze, en neemt daarna vaak weer af, zodra hormoonspiegels zich stabiliseren in plaats van schommelen.',
    'Slechte slaap en hoofdpijn versterken elkaar vaak - het een verbeteren, al is het maar een klein beetje, helpt meestal ook het ander.',
    'Niets hiervan gaat over wilskracht. Schommelende hormonen veranderen daadwerkelijk hoe je lichaam reageert op stress, warmte en pijn.',
  ],
};
