// Daily quote and joke (feed sidebar). Picked by the day in Montreal, so everyone sees the same
// pair and it changes at local midnight. Quotes are public sayings with attribution; jokes are ours.

export const QUOTES = [
  { text: "The beautiful thing about learning is that nobody can take it away from you.", by: "B.B. King" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", by: "Mahatma Gandhi" },
  { text: "It always seems impossible until it's done.", by: "Nelson Mandela" },
  { text: "The expert in anything was once a beginner.", by: "Helen Hayes" },
  { text: "Education is not the filling of a pail, but the lighting of a fire.", by: "attributed to W.B. Yeats" },
  { text: "Alone we can do so little; together we can do so much.", by: "Helen Keller" },
  { text: "There is a crack in everything. That's how the light gets in.", by: "Leonard Cohen, McGill alumnus" },
  { text: "Nothing in life is to be feared, it is only to be understood.", by: "Marie Curie" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", by: "attributed to Ralph Waldo Emerson" },
  { text: "The best way to predict the future is to create it.", by: "attributed to Peter Drucker" },
  { text: "Grandescunt aucta labore: by work, all things increase and grow.", by: "McGill's motto" },
  { text: "Whether you think you can, or you think you can't, you're right.", by: "attributed to Henry Ford" },
  { text: "Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit.", by: "Ralph Marston" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", by: "attributed to Benjamin Franklin" },
  { text: "Courage doesn't always roar. Sometimes it's the quiet voice at the end of the day saying, 'I will try again tomorrow.'", by: "Mary Anne Radmacher" },
  { text: "Friendship is born at that moment when one person says to another, 'What! You too?'", by: "C.S. Lewis" },
] as const;

export const JOKES = [
  { setup: "Why did the martlet never skip class?", punch: "It has no feet. It literally can't walk out." },
  { setup: "What's the steepest course at McGill?", punch: "The walk up University Street to Rutherford." },
  { setup: "How do McGill students stay warm in February?", punch: "They walk the tunnels between Burnside and Leacock like it's a lifestyle." },
  { setup: "Why did the student bring a ladder to Redpath?", punch: "They heard the cyberthèque was on another level." },
  { setup: "What's a Montrealer's favourite season?", punch: "Construction." },
  { setup: "Why don't COMP 251 students ever get lost?", punch: "They always take the shortest path. Dijkstra said so." },
  { setup: "How many McGill students does it take to change a lightbulb?", punch: "One, but they'll book a study room in Bronfman to plan it." },
  { setup: "What did the squirrel on lower field say to the student?", punch: "\"Nice sandwich. It's mine now.\"" },
  { setup: "Why is the Arts Building so calm during finals?", punch: "Everyone already accepted their fate in the Arts Lounge." },
  { setup: "What do you call a bagel from St-Viateur at 3 a.m.?", punch: "A study group." },
  { setup: "Why did the physics student stop arguing on the Rutherford steps?", punch: "They lost their momentum." },
  { setup: "What's the difference between Minerva and a maze?", punch: "A maze has an exit." },
  { setup: "Why did the martlet join the hockey team?", punch: "Great at flying down the wing, terrible at standing on skates." },
  { setup: "How do you know someone's in Engineering at McGill?", punch: "Don't worry, their jacket will tell you." },
] as const;

/** Days since epoch in Montreal, so the pick flips at local midnight for everyone. */
export function montrealDayNumber(now = new Date()): number {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);
}

export function dailyPicks(now = new Date()) {
  const day = montrealDayNumber(now);
  // Different strides so the same quote and joke don't always appear together.
  return { quote: QUOTES[day % QUOTES.length], joke: JOKES[(day * 5) % JOKES.length] };
}
