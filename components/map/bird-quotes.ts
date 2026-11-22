// Things the popup bird says when you hover it. Niche McGill / Montreal lore, Gen Z edition.
export const BIRD_QUOTES = [
  "fun fact: the McGill martlet has no feet. it's heraldry. it simply never lands 💅",
  "Montreal has two seasons: winter and construction 🚧",
  "orange cones are the city's official bird. i'm just the unofficial one",
  "Leacock 132 fits ~600 people and somehow zero working outlets",
  "the Redpath Museum has actual mummies. no further questions",
  "July 1st is Moving Day. the whole city plays musical chairs with couches",
  "St-Viateur or Fairmount? choose wisely, this decides your whole personality",
  "Mount Royal is technically a big hill but we let it have this one",
  "Sunday tam-tams on the mountain: free drum circle, infinite vibes",
  "La Banquise is open 24/7 because poutine is a human right",
  "the metro runs on rubber tires so it hums like a lil menace",
  "the Orange Julep is a 3-storey orange. it's a building. it's fine.",
  "some pilgrims climb the Oratory steps on their knees. respect the grind",
  "Rutherford did his radioactivity research at McGill. we peaked in 1902",
  "James Naismith was a McGill grad. basketball is technically our fault",
  "first organized indoor hockey game: Montreal, 1875. you're welcome Canada",
  "Old Port in summer: 40% tourists, 60% e-scooters, 100% chaos",
  "Montreal winter makes you say \"it's only -15\" completely unironically",
  "Burnside Hall elevators are a test of faith",
  "walking up Peel at -20 hits different (it hits your face)",
  "\"tabarnak\" is a complete sentence and a lifestyle",
  "the Lower Field is a beach if you squint and it's 30°C",
  "McLennan at 2am during finals = main character arc unlocked",
  "Schulich library silent floor: you can hear someone's laptop fan judging you",
  "Milton-Parc rent is lowkey the hardest course at McGill",
  "frosh week survivors get a free personality trait",
  "Montreal bagels are boiled in honey water. NYC could never",
] as const;

export function randomQuote(): string {
  return BIRD_QUOTES[Math.floor(Math.random() * BIRD_QUOTES.length)];
}
