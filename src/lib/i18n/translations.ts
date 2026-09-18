// ─── ChandraCycle i18n dictionary ────────────────────────────────────────────
// Lightweight translation layer for the app chrome (navigation, dashboard,
// settings, common actions). English is the source of truth; hi (हिन्दी) and
// ta (தமிழ்) are first-class supported languages for menstrual-health UI copy.
//
// Usage:
//   const { t } = useLanguage()
//   t('nav.period')                       → "Period Tracker"
//   t('dashboard.dayOfCycle', { day: 15 }) → "Day 15 of Cycle"

export type Lang = 'en' | 'hi' | 'ta'

export const LANGUAGES: { code: Lang; native: string; english: string; short: string }[] = [
  { code: 'en', native: 'English', english: 'English', short: 'EN' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', short: 'हिं' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', short: 'தமி' },
]

export const LANG_STORAGE_KEY = 'chandracycle_lang'

// Keys are stable identifiers. Every language must define every key —
// the LanguageProvider falls back to English for anything missing.
export const translations = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.period': 'Period Tracker',
    'nav.hormone': 'Hormone IQ',
    'nav.symptoms': 'Symptoms',
    'nav.pcos': 'PCOS Care',
    'nav.fertility': 'Fertility',
    'nav.pregnancy': 'Pregnancy',
    'nav.menopause': 'Menopause',
    'nav.coach': 'AI Coach',
    'nav.diet': 'Diet Advisor',
    'nav.doctors': 'Find Doctor',
    'nav.mental': 'Mind & Soul',
    'nav.fitness': 'Move & Flow',
    'nav.beauty': 'Skin & Beauty',
    'nav.marketplace': 'Wellness Market',
    'nav.community': 'Community',
    'nav.reports': 'Reports',
    'nav.insights': 'AI Insights',
    'nav.settings': 'Settings',
    'nav.premium': 'Go Premium',
    'nav.tour': 'Take Tour',
    'nav.install': 'Install app',
    'nav.more': 'More',
    'nav.allModules': 'All Modules',
    'nav.allModulesHint': 'Tap a module to jump straight to it',

    // Mobile module sheet groups
    'group.health': 'Health Tracking',
    'group.ai': 'AI Tools',
    'group.wellness': 'Wellness',
    'group.account': 'Account',

    // Greetings
    'greeting.morning': 'Good Morning',
    'greeting.afternoon': 'Good Afternoon',
    'greeting.evening': 'Good Evening',
    'greeting.hi': 'Hi',

    // Dashboard
    'dashboard.dayOfCycle': 'Day {day} of Cycle',
    'dashboard.phaseBadge': '{phase} Phase',
    'dashboard.inYourPhase': "You're in your",
    'dashboard.phaseSuffix': 'phase',
    'dashboard.phaseHint': 'Log symptoms, mood, and sleep to learn how this phase affects you.',
    'dashboard.daysUntilPeriod': 'Days until period',
    'dashboard.daysToOvulation': 'Days to ovulation',
    'dashboard.cycleDay': 'Cycle Day',
    'dashboard.ofDays': 'of {n} days',
    'dashboard.daysUntilPeriodTitle': 'Days Until Period',
    'dashboard.countdown': 'countdown',
    'dashboard.fertilityStatus': 'Fertility Status',
    'dashboard.nextOvulation': 'Next Ovulation',
    'dashboard.dayCycle': '{n}-day cycle',
    'dashboard.noCycleTitle': 'No cycle logged yet',
    'dashboard.logFirstPeriod': 'Log your first period',

    // Cycle phases
    'phase.menstrual': 'Menstrual',
    'phase.follicular': 'Follicular',
    'phase.ovulation': 'Ovulation',
    'phase.luteal': 'Luteal',

    // Fertility
    'fertility.peak': 'Peak',
    'fertility.rising': 'Rising',
    'fertility.low': 'Low',
    'fertility.highChance': 'High chance',
    'fertility.risingChance': 'Fertility rising',
    'fertility.lowChance': 'Low chance',

    // Quick log actions
    'quicklog.period': 'Log Period',
    'quicklog.mood': 'Log Mood',
    'quicklog.symptoms': 'Log Symptoms',
    'quicklog.water': 'Log Water',
    'quicklog.sleep': 'Log Sleep',

    // Common actions
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.saved': 'Saved',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.signOut': 'Sign out',
    'common.loading': 'Loading…',

    // Language & region (settings card)
    'language.title': 'Language & Region',
    'language.description': 'Choose the language for menus and cycle insights',
    'language.moreComing': 'More Indian languages are on the way — content inside modules stays English for now.',
    'language.switched': 'Language updated',
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.period': 'पीरियड ट्रैकर',
    'nav.hormone': 'हार्मोन आईक्यू',
    'nav.symptoms': 'लक्षण',
    'nav.pcos': 'PCOS देखभाल',
    'nav.fertility': 'प्रजनन',
    'nav.pregnancy': 'गर्भावस्था',
    'nav.menopause': 'रजोनिवृत्ति',
    'nav.coach': 'एआई कोच',
    'nav.diet': 'आहार सलाहकार',
    'nav.doctors': 'डॉक्टर खोजें',
    'nav.mental': 'मन और आत्मा',
    'nav.fitness': 'मूव और फ्लो',
    'nav.beauty': 'त्वचा और सौंदर्य',
    'nav.marketplace': 'वेलनेस मार्केट',
    'nav.community': 'समुदाय',
    'nav.reports': 'रिपोर्ट्स',
    'nav.insights': 'एआई इनसाइट्स',
    'nav.settings': 'सेटिंग्स',
    'nav.premium': 'प्रीमियम लें',
    'nav.tour': 'टूर लें',
    'nav.install': 'ऐप इंस्टॉल करें',
    'nav.more': 'और',
    'nav.allModules': 'सभी मॉड्यूल',
    'nav.allModulesHint': 'सीधे जाने के लिए किसी मॉड्यूल पर टैप करें',

    // Mobile module sheet groups
    'group.health': 'स्वास्थ्य ट्रैकिंग',
    'group.ai': 'एआई उपकरण',
    'group.wellness': 'तंदुरुस्ती',
    'group.account': 'खाता',

    'greeting.morning': 'सुप्रभात',
    'greeting.afternoon': 'शुभ अपराह्न',
    'greeting.evening': 'शुभ संध्या',
    'greeting.hi': 'नमस्ते',

    'dashboard.dayOfCycle': 'चक्र का दिन {day}',
    'dashboard.phaseBadge': '{phase} चरण',
    'dashboard.inYourPhase': 'आप अपने',
    'dashboard.phaseSuffix': 'चरण में हैं',
    'dashboard.phaseHint': 'जानें कि यह चरण आपको कैसे प्रभावित करता है — लक्षण, मूड और नींद लॉग करें।',
    'dashboard.daysUntilPeriod': 'पीरियड तक दिन',
    'dashboard.daysToOvulation': 'ओवुलेशन तक दिन',
    'dashboard.cycleDay': 'चक्र दिवस',
    'dashboard.ofDays': '{n} दिनों में से',
    'dashboard.daysUntilPeriodTitle': 'पीरियड तक दिन',
    'dashboard.countdown': 'काउंटडाउन',
    'dashboard.fertilityStatus': 'प्रजनन स्थिति',
    'dashboard.nextOvulation': 'अगला ओवुलेशन',
    'dashboard.dayCycle': '{n}-दिन का चक्र',
    'dashboard.noCycleTitle': 'अभी तक कोई चक्र लॉग नहीं हुआ',
    'dashboard.logFirstPeriod': 'पहला पीरियड लॉग करें',

    'phase.menstrual': 'मासिक',
    'phase.follicular': 'फॉलिक्युलर',
    'phase.ovulation': 'ओवुलेशन',
    'phase.luteal': 'ल्यूटियल',

    'fertility.peak': 'चरम',
    'fertility.rising': 'बढ़ रही है',
    'fertility.low': 'कम',
    'fertility.highChance': 'अधिक संभावना',
    'fertility.risingChance': 'प्रजनन बढ़ रहा है',
    'fertility.lowChance': 'कम संभावना',

    'quicklog.period': 'पीरियड लॉग',
    'quicklog.mood': 'मूड लॉग',
    'quicklog.symptoms': 'लक्षण लॉग',
    'quicklog.water': 'पानी लॉग',
    'quicklog.sleep': 'नींद लॉग',

    'common.save': 'सहेजें',
    'common.saving': 'सहेज रहे हैं…',
    'common.saved': 'सहेजा गया',
    'common.close': 'बंद करें',
    'common.cancel': 'रद्द करें',
    'common.signOut': 'साइन आउट',
    'common.loading': 'लोड हो रहा है…',

    'language.title': 'भाषा और क्षेत्र',
    'language.description': 'मेनू और साइकल जानकारी के लिए भाषा चुनें',
    'language.moreComing': 'और भारतीय भाषाएँ जल्द आ रही हैं — मॉड्यूल के अंदर की सामग्री फिलहाल अंग्रेज़ी में है।',
    'language.switched': 'भाषा बदल दी गई',
  },
  ta: {
    'nav.dashboard': 'டாஷ்போர்டு',
    'nav.period': 'பீரியட் டிராக்கர்',
    'nav.hormone': 'ஹார்மோன் IQ',
    'nav.symptoms': 'அறிகுறிகள்',
    'nav.pcos': 'PCOS கவனிப்பு',
    'nav.fertility': 'கருவுறுதல்',
    'nav.pregnancy': 'கர்ப்பம்',
    'nav.menopause': 'மாதவிடாய் நிறுத்தம்',
    'nav.coach': 'AI கோச்',
    'nav.diet': 'உணவு ஆலோசகர்',
    'nav.doctors': 'மருத்துவரைத் தேடு',
    'nav.mental': 'மனமும் ஆன்மாவும்',
    'nav.fitness': 'நகர்வும் ஓட்டமும்',
    'nav.beauty': 'தோல் மற்றும் அழகு',
    'nav.marketplace': 'நலச் சந்தை',
    'nav.community': 'சமூகம்',
    'nav.reports': 'அறிக்கைகள்',
    'nav.insights': 'AI நுண்ணறிவு',
    'nav.settings': 'அமைப்புகள்',
    'nav.premium': 'பிரீமியம் பெறுங்கள்',
    'nav.tour': 'டூர் பார்க்க',
    'nav.install': 'ஆப்பை நிறுவு',
    'nav.more': 'மேலும்',
    'nav.allModules': 'அனைத்து தொகுதிகள்',
    'nav.allModulesHint': 'நேரடியாகச் செல்ல ஒரு தொகுதியைத் தட்டவும்',

    // Mobile module sheet groups
    'group.health': 'உடல்நலக் கண்காணிப்பு',
    'group.ai': 'AI கருவிகள்',
    'group.wellness': 'நலம்',
    'group.account': 'கணக்கு',

    'greeting.morning': 'காலை வணக்கம்',
    'greeting.afternoon': 'மதிய வணக்கம்',
    'greeting.evening': 'மாலை வணக்கம்',
    'greeting.hi': 'வணக்கம்',

    'dashboard.dayOfCycle': 'சுழற்சி நாள் {day}',
    'dashboard.phaseBadge': '{phase} நிலை',
    'dashboard.inYourPhase': 'நீங்கள் இப்போது உள்ளது',
    'dashboard.phaseSuffix': 'நிலையில்',
    'dashboard.phaseHint': 'இந்த நிலை உங்களை எப்படி பாதிக்கிறது என்று அறிய அறிகுறிகள், மனநிலை, தூக்கத்தை பதிவு செய்யுங்கள்.',
    'dashboard.daysUntilPeriod': 'பீரியட் வர நாட்கள்',
    'dashboard.daysToOvulation': 'ஓவுலேஷன் வர நாட்கள்',
    'dashboard.cycleDay': 'சுழற்சி நாள்',
    'dashboard.ofDays': '{n} நாட்களில்',
    'dashboard.daysUntilPeriodTitle': 'பீரியட் வர நாட்கள்',
    'dashboard.countdown': 'எண்ணிக்கை',
    'dashboard.fertilityStatus': 'கருவுறுதல் நிலை',
    'dashboard.nextOvulation': 'அடுத்த ஓவுலேஷன்',
    'dashboard.dayCycle': '{n}-நாள் சுழற்சி',
    'dashboard.noCycleTitle': 'இன்னும் சுழற்சி பதிவு செய்யப்படவில்லை',
    'dashboard.logFirstPeriod': 'முதல் பீரியடை பதிவு செய்யுங்கள்',

    'phase.menstrual': 'மாதவிடாய்',
    'phase.follicular': 'ஃபோலிகுலர்',
    'phase.ovulation': 'ஓவுலேஷன்',
    'phase.luteal': 'லூட்டியல்',

    'fertility.peak': 'உச்சம்',
    'fertility.rising': 'உயரும் நிலை',
    'fertility.low': 'குறைவு',
    'fertility.highChance': 'அதிக வாய்ப்பு',
    'fertility.risingChance': 'கருவுறுதல் உயருகிறது',
    'fertility.lowChance': 'குறைந்த வாய்ப்பு',

    'quicklog.period': 'பீரியட் பதிவு',
    'quicklog.mood': 'மனநிலை பதிவு',
    'quicklog.symptoms': 'அறிகுறி பதிவு',
    'quicklog.water': 'தண்ணீர் பதிவு',
    'quicklog.sleep': 'தூக்கம் பதிவு',

    'common.save': 'சேமி',
    'common.saving': 'சேமிக்கிறது…',
    'common.saved': 'சேமிக்கப்பட்டது',
    'common.close': 'மூடு',
    'common.cancel': 'ரத்து',
    'common.signOut': 'வெளியேறு',
    'common.loading': 'ஏற்றுகிறது…',

    'language.title': 'மொழி மற்றும் பகுதி',
    'language.description': 'மெனு மற்றும் சுழற்சி தகவலுக்கு மொழியைத் தேர்வு செய்யுங்கள்',
    'language.moreComing': 'மேலும் இந்திய மொழிகள் விரைவில் — தொகுதிகளுக்குள் உள்ள உள்ளடக்கம் தற்சமயம் ஆங்கிலத்தில் உள்ளது.',
    'language.switched': 'மொழி மாற்றப்பட்டது',
  },
} as const

export type TranslationKey = keyof (typeof translations)['en']

/** Translate `key` into `lang`, interpolating {vars}. Falls back to English. */
export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const dict = translations[lang] as Record<string, string>
  const en = translations.en as Record<string, string>
  let str = dict[key] ?? en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v))
    }
  }
  return str
}
