// Emotion-aware responses — detect user sentiment and adjust AI behavior

const FRUSTRATION_PATTERNS = [
  /stupid|dumb|hate|awful|terrible|worst|broken|useless/i,
  /wtf|omg|ffs|ugh|argh|damn|hell/i,
  /not working|won't work|doesn't work|can't fix|keeps failing|still broken/i,
  /i give up|i quit|forget it|never mind/i,
  /why (is|does|won't|can't|doesn't)/i,
  /been trying|been at this|hours|forever/i,
];

const EXCITEMENT_PATTERNS = [
  /awesome|amazing|perfect|great|love|brilliant|incredible|wow/i,
  /thank|thanks|thx|ty|appreciate/i,
  /works|working|fixed|solved|nailed it/i,
  /!{2,}/,
];

const CONFUSION_PATTERNS = [
  /confused|don't understand|makes no sense|what does .+ mean/i,
  /how (do|does|can|should|would)/i,
  /what (is|are|does|should)/i,
  /explain|help me understand|i'm lost|no idea/i,
  /\?{2,}/,
];

const URGENCY_PATTERNS = [
  /asap|urgent|deadline|emergency|production|down|crash/i,
  /right now|immediately|hurry|quick|fast/i,
  /boss|client|meeting|demo|presentation/i,
];

export function detectSentiment(text) {
  const sentiments = {
    frustrated: FRUSTRATION_PATTERNS.some(p => p.test(text)),
    excited: EXCITEMENT_PATTERNS.some(p => p.test(text)),
    confused: CONFUSION_PATTERNS.some(p => p.test(text)),
    urgent: URGENCY_PATTERNS.some(p => p.test(text)),
  };

  // Determine primary mood
  if (sentiments.frustrated) return { mood: 'frustrated', instruction: 'The user seems frustrated. Be extra patient, explain step-by-step, be encouraging. Start with acknowledging the difficulty.' };
  if (sentiments.urgent) return { mood: 'urgent', instruction: 'The user is in a hurry. Give the most direct solution first, skip explanations unless asked. Be fast and focused.' };
  if (sentiments.confused) return { mood: 'confused', instruction: 'The user is confused. Use simple language, give examples, explain concepts before diving into code.' };
  if (sentiments.excited) return { mood: 'excited', instruction: 'The user is positive. Match their energy, suggest next steps, build on their enthusiasm.' };

  return { mood: 'neutral', instruction: '' };
}

export function getSentimentPrompt(userInput) {
  const { mood, instruction } = detectSentiment(userInput);
  if (mood === 'neutral') return '';
  return `\n[User mood: ${mood}. ${instruction}]`;
}
