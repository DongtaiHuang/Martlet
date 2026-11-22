// Student guide (/guide): WikiHow-style how-tos and quick tips for McGill students.
// Keep steps general and link to the official McGill page for details that change (dates, fees,
// office hours). Check links when editing; never invent specific deadlines or phone numbers.

export type Guide = {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  tags: string[];
  steps: { title: string; body: string }[];
  link?: { label: string; href: string };
};

export const GUIDES: Guide[] = [
  {
    id: "first-week",
    emoji: "🎒",
    title: "How to set yourself up in your first week",
    summary: "The accounts and cards you need before classes get busy.",
    tags: ["new student", "accounts", "id card"],
    steps: [
      { title: "Activate your McGill account", body: "Your McGill username and password unlock email, Minerva, myCourses and Wi-Fi. Set up multi-factor authentication right away." },
      { title: "Get your student ID card", body: "Bring government photo ID to Service Point. Your card gets you into libraries, exams and some buildings." },
      { title: "Log in to myCourses", body: "Your course pages, slides and assignments live there. Check each course in the first week; some post readings before the first class." },
      { title: "Save the key dates", body: "Add/drop, withdrawal and exam dates are on McGill's Important Dates page. Put them in your calendar now." },
    ],
    link: { label: "McGill Service Point", href: "https://www.mcgill.ca/servicepoint/" },
  },
  {
    id: "build-schedule",
    emoji: "🗓️",
    title: "How to build your schedule and register",
    summary: "Plan in the Visual Schedule Builder, then register in Minerva.",
    tags: ["registration", "minerva", "courses"],
    steps: [
      { title: "Check your program requirements", body: "Open your program in the eCalendar so you know which courses are required and which are complementary." },
      { title: "Try combinations in the Visual Schedule Builder", body: "Add courses and let it show schedules without conflicts. Lock the sections you like." },
      { title: "Register in Minerva", body: "In Minerva, use the registration menu to add the CRNs from your plan. Fix any errors it shows, such as missing prerequisites." },
      { title: "Have a backup", body: "Popular sections fill up. Keep a second option for each course and check waitlists if your faculty uses them." },
    ],
    link: { label: "Visual Schedule Builder", href: "https://vsb.mcgill.ca/" },
  },
  {
    id: "add-drop",
    emoji: "🔁",
    title: "How to add, drop or withdraw from a course",
    summary: "Change your mind without losing money or getting a bad mark.",
    tags: ["registration", "minerva", "deadlines"],
    steps: [
      { title: "Find the right deadline", body: "Add/drop (no record, usually refundable) comes before withdrawal (a W on your transcript). Both dates are on the Important Dates page." },
      { title: "Make the change in Minerva", body: "Use the registration menu to drop a section, or follow your faculty's withdrawal process after add/drop ends." },
      { title: "Check your fee account", body: "Changes can affect fees. Look at your account summary in Minerva a few days later." },
      { title: "Talk to an advisor if unsure", body: "Dropping below full-time can affect scholarships, loans or immigration status. Ask your faculty advising office first." },
    ],
    link: { label: "Important Dates", href: "https://www.mcgill.ca/importantdates/" },
  },
  {
    id: "study-spots",
    emoji: "📚",
    title: "How to find a good study spot",
    summary: "Quiet floors, group rooms and places that aren't full by 10 a.m.",
    tags: ["library", "study", "campus"],
    steps: [
      { title: "Pick the noise level first", body: "Libraries have silent floors and group areas. Decide which you need before you walk over." },
      { title: "Book a group room", body: "Group study rooms can be booked online through the Library. Book a few days ahead during midterms and finals." },
      { title: "Try a branch library", body: "Smaller branch libraries are often calmer than the big ones. Explore a few early in the term." },
      { title: "Make it social", body: "Post a Study meetup on Martlet with your course code so classmates can join you." },
    ],
    link: { label: "McGill Library", href: "https://www.mcgill.ca/library/" },
  },
  {
    id: "wellness",
    emoji: "💚",
    title: "How to get support when you're struggling",
    summary: "Where to go for health, mental health and academic stress.",
    tags: ["wellness", "health", "support"],
    steps: [
      { title: "Start with the Student Wellness Hub", body: "It's McGill's front door for medical and mental health care. You can book appointments and find workshops there." },
      { title: "Talk to someone in your faculty", body: "Advisors can help with extensions, deferrals and course load when life gets hard. Reach out early." },
      { title: "Use peer support", body: "Student-run peer support and listening services are there if you'd rather talk to another student." },
      { title: "In an emergency", body: "Call 911. McGill Security Services can also help on campus; their contact details are on the McGill website." },
    ],
    link: { label: "Student Wellness Hub", href: "https://www.mcgill.ca/wellness-hub/" },
  },
  {
    id: "winter",
    emoji: "❄️",
    title: "How to survive your first Montreal winter",
    summary: "Stay warm, stay upright and still enjoy the snow.",
    tags: ["winter", "montreal", "new student"],
    steps: [
      { title: "Dress in layers", body: "A base layer, something warm and a windproof coat beat one giant coat. Add a hat, mitts and a scarf when it's below −10 °C." },
      { title: "Fix your footing", body: "Waterproof boots with good grip are worth it. Slip-on ice cleats help on the hill up to campus." },
      { title: "Watch the wind chill", body: "Check the 'feels like' temperature, not just the number. Cover exposed skin on very cold days." },
      { title: "Go outside on purpose", body: "Skating, sledding on Mount Royal and winter festivals make the season. Post a meetup and bring friends." },
    ],
  },
  {
    id: "getting-around",
    emoji: "🚇",
    title: "How to get around Montreal on a student budget",
    summary: "Metro, bus, bike and walking.",
    tags: ["montreal", "transit", "money"],
    steps: [
      { title: "Get an OPUS card", body: "Montreal's metro and buses use the OPUS card. Eligible full-time students can get a reduced fare; check the STM site for requirements." },
      { title: "Learn the nearby stations", body: "McGill and Peel metro stations are a short walk from the downtown campus." },
      { title: "Bike in the warm months", body: "BIXI bike share and the protected bike lanes make short trips quick from spring to fall." },
      { title: "Walk the Underground City", body: "Indoor passages downtown connect metro stations and malls, handy on stormy days." },
    ],
    link: { label: "STM fares", href: "https://www.stm.info/en/info/fares" },
  },
  {
    id: "use-martlet",
    emoji: "🐦",
    title: "How to make friends with Martlet",
    summary: "Turn this app into actual plans.",
    tags: ["martlet", "social", "meetups"],
    steps: [
      { title: "Peck a meetup", body: "Open the Feed and tap “Peck to join” on something that looks fun. The host sees you're coming." },
      { title: "Host something small", body: "Coffee, a study session or a walk to the lookout. Small and specific gets the most people." },
      { title: "Unlock landmarks", body: "Visit campus landmarks, post a photo and see what other students shared there." },
      { title: "Add your courses", body: "On your Profile, add your courses so Study meetups for your classes show up first." },
    ],
  },
];

export const TIPS: { tip: string; tag: string }[] = [
  { tip: "Office hours are underused. Go once in the first month, even just to say hi.", tag: "academics" },
  { tip: "Read the course outline twice: once at the start and again before the midterm.", tag: "academics" },
  { tip: "Back up your assignments to the cloud. Laptops die during finals, always.", tag: "academics" },
  { tip: "Your student email gets you free or cheap software. Check before you buy anything.", tag: "money" },
  { tip: "Cook in batches on Sunday. Future you, at 9 p.m. on a Wednesday, says thanks.", tag: "money" },
  { tip: "Carry a reusable bottle. There are water fountains in most campus buildings.", tag: "campus" },
  { tip: "Mount Royal is a 15-minute walk from campus. Go up at sunset at least once.", tag: "montreal" },
  { tip: "Learn a few words of French. Bonjour-hi gets you far, and people appreciate the effort.", tag: "montreal" },
  { tip: "Join one club you're curious about and one you're good at.", tag: "social" },
  { tip: "Say yes to the first few invitations, even the awkward ones.", tag: "social" },
  { tip: "Sleep is a study strategy. All-nighters cost more marks than they buy.", tag: "wellness" },
  { tip: "Book appointments before you're in crisis. Wait times are shortest early in the term.", tag: "wellness" },
  { tip: "Take a photo of your schedule and set it as your lock screen for week one.", tag: "new student" },
  { tip: "Walk the route to your classrooms the day before term starts.", tag: "new student" },
];
