const englishStrings = new Map<string, string>([
  [
    "DemoEnd_ThankYou",
    "Thank you for playing the demo of Patrick's Parabox! :)",
  ],
  [
    "DemoEnd_FullGame",
    "The full game gradually reveals many more mechanics and recursive twists as you delve deeper into the system, and features over 350 hand-crafted puzzles which each have a new idea.",
  ],
  [
    "DemoEnd_Follow",
    "If you enjoyed the demo, the full game is available for purchase now!",
  ],
  ["DemoEnd_Store", "Steam store page"],
  [
    "Tip_TheseAreTipsMenu",
    "These are some general\npuzzle-solving tips that I\nfind useful.",
  ],
  [
    "Tip_TheseAreTipsWorld",
    "These are some general puzzle-solving tips that I find useful! You can also access these at any time in the menu under Extras -> Tips.",
  ],
  [
    "Tip_Undo",
    "Undo, Redo, and Reset are useful tools. Don't be afraid to use them often!",
  ],
  [
    "Tip_WorkBackwards",
    "It can be helpful to imagine how the puzzle would look when solved, and work backwards from there.",
  ],
  [
    "Tip_NarrowOptions",
    "Figuring out things that don't work can be helpful, to narrow down your options.",
  ],
  [
    "Tip_TryAnotherPuzzle",
    "Trying a different puzzle and coming back later can give you a fresh view if you're stuck.",
  ],
  [
    "Tip_Challenging",
    "The puzzles are meant to be challenging. There is no expectation of solving them quickly!",
  ],
  [
    "Sign_Congratulations",
    "Congratulations on\nreaching the end!\n\nThank you for playing! :)",
  ],
  [
    "Sign_100Percent",
    "Congratulations on solving\nall the puzzles!\n\nThank you for playing! :)",
  ],
]);

export function localizeEnglish(key: string): string {
  return englishStrings.get(key) ?? key;
}
