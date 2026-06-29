import { api } from "./api";

export interface QuizQ {
  q: string;
  options: string[];
  answer: string; // must equal one of options
}

// Built-in mixed bank — works offline / when no AI key is set.
const LOCAL_BANK: QuizQ[] = [
  { q: "What is the capital of Australia?", options: ["Sydney", "Canberra", "Melbourne", "Perth"], answer: "Canberra" },
  { q: "Which planet is the largest in our solar system?", options: ["Saturn", "Jupiter", "Neptune", "Earth"], answer: "Jupiter" },
  { q: "How many strings does a standard violin have?", options: ["4", "5", "6", "7"], answer: "4" },
  { q: "What gas do plants primarily absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], answer: "Carbon dioxide" },
  { q: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], answer: "Leonardo da Vinci" },
  { q: "Which country won the first ever FIFA World Cup in 1930?", options: ["Brazil", "Argentina", "Uruguay", "Italy"], answer: "Uruguay" },
  { q: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], answer: "Au" },
  { q: "Mount Everest sits on the border of Nepal and which other country?", options: ["India", "China", "Bhutan", "Pakistan"], answer: "China" },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: "6" },
  { q: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: "Pacific" },
  { q: "In which city would you find the Colosseum?", options: ["Athens", "Rome", "Madrid", "Cairo"], answer: "Rome" },
  { q: "What is the hardest natural substance on Earth?", options: ["Quartz", "Diamond", "Titanium", "Granite"], answer: "Diamond" },
  { q: "Who wrote 'Romeo and Juliet'?", options: ["Charles Dickens", "Jane Austen", "William Shakespeare", "Mark Twain"], answer: "William Shakespeare" },
  { q: "Which metal is liquid at room temperature?", options: ["Mercury", "Lead", "Iron", "Tin"], answer: "Mercury" },
  { q: "How many minutes are in a full day?", options: ["1200", "1440", "1800", "2400"], answer: "1440" },
  { q: "What is the largest mammal in the world?", options: ["Elephant", "Blue whale", "Giraffe", "Orca"], answer: "Blue whale" },
  { q: "Which country is home to the kangaroo?", options: ["South Africa", "Brazil", "Australia", "India"], answer: "Australia" },
  { q: "What does 'www' stand for?", options: ["World Wide Web", "Web Wide World", "Wide World Web", "World Web Wide"], answer: "World Wide Web" },
  { q: "How many colours are in a rainbow?", options: ["5", "6", "7", "8"], answer: "7" },
  { q: "Which is the smallest prime number?", options: ["0", "1", "2", "3"], answer: "2" },
  { q: "What is the currency of Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], answer: "Yen" },
  { q: "Which famous scientist developed the theory of general relativity?", options: ["Newton", "Einstein", "Galileo", "Hawking"], answer: "Einstein" },
  { q: "What is the longest river in the world?", options: ["Amazon", "Nile", "Yangtze", "Mississippi"], answer: "Nile" },
  { q: "Approximately what % of the human body is water?", options: ["40%", "60%", "75%", "90%"], answer: "60%" },
  { q: "Which Tour de France jersey is worn by the overall leader?", options: ["Green", "Polka dot", "White", "Yellow"], answer: "Yellow" },
  { q: "What does FTP stand for in cycling?", options: ["Full Throttle Power", "Functional Threshold Power", "Final Time Pace", "Forward Torque Pull"], answer: "Functional Threshold Power" },
  { q: "Cadence on a bike is measured in what?", options: ["Watts", "RPM", "BPM", "km/h"], answer: "RPM" },
  { q: "Which muscle group does a kettlebell swing primarily target?", options: ["Biceps", "Posterior chain", "Calves", "Forearms"], answer: "Posterior chain" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Load a quiz set: fresh AI questions when the server can produce them, mixed
 * with the local bank for variety; always falls back to the local bank offline.
 */
export async function loadQuiz(): Promise<QuizQ[]> {
  let ai: QuizQ[] = [];
  try {
    const res = await api.quiz();
    ai = (res.questions || []).filter(
      (x) => x && x.q && Array.isArray(x.options) && x.options.includes(x.answer)
    );
  } catch {
    /* offline / no key — local bank only */
  }
  const merged = ai.length ? shuffle([...ai, ...shuffle(LOCAL_BANK).slice(0, 8)]) : shuffle(LOCAL_BANK);
  return merged;
}
