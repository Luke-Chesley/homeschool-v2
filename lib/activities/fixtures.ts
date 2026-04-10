/**
 * Fixture activity sessions and definitions for local development.
 *
 * These give the learner activity engine something to render without a live
 * database. Replace with real session queries once plan 02 is merged.
 */

import type { ActivitySession } from "./types";

export const FIXTURE_SESSIONS: ActivitySession[] = [
  // --- Structured chess board ---
  {
    id: "session-chess-001",
    learnerId: "learner-demo",
    activityId: "activity-chess-001",
    status: "not_started",
    estimatedMinutes: 6,
    standardIds: [],
    definition: {
      schemaVersion: "2",
      title: "Find the checking move",
      purpose: "Study the position and play the queen move that gives check.",
      activityKind: "guided_practice",
      linkedObjectiveIds: [],
      linkedSkillTitles: ["forcing check"],
      estimatedMinutes: 6,
      interactionMode: "digital",
      components: [
        {
          type: "interactive_widget",
          id: "mate-in-one",
          prompt: "White to move. Find the queen move that gives check.",
          required: true,
          widget: {
            version: "1",
            surfaceKind: "board_surface",
            engineKind: "chess",
            surface: { orientation: "white" },
            state: { fen: "4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1" },
            interaction: {
              mode: "move_input",
            },
            evaluation: {
              expectedMoves: ["Qb5+", "e2b5"],
            },
            annotations: {
              highlightSquares: ["e2", "b5", "e8"],
              arrows: [],
            },
          },
        },
      ],
      completionRules: { strategy: "all_interactive_components" },
      evidenceSchema: {
        captureKinds: ["answer_response"],
        requiresReview: false,
        autoScorable: true,
      },
      scoringModel: {
        mode: "correctness_based",
        masteryThreshold: 0.8,
        reviewThreshold: 0.6,
      },
      adaptationRules: {
        hintStrategy: "on_request",
        allowSkip: false,
        allowRetry: true,
      },
      teacherSupport: {
        setupNotes: "Let the learner inspect checks, captures, and threats before moving.",
        discussionQuestions: ["What line does the queen use to give check?"],
        masteryIndicators: ["Learner finds the checking move from the board position."],
      },
    } as unknown as ActivitySession["definition"],
  },

  // --- Quiz ---
  {
    id: "session-quiz-001",
    learnerId: "learner-demo",
    activityId: "activity-quiz-001",
    status: "not_started",
    estimatedMinutes: 10,
    lessonId: "00000000-0000-0000-0000-000000000020",
    standardIds: ["CCSS.MATH.CONTENT.4.NBT.A.1"],
    definition: {
      kind: "quiz",
      title: "Place Value Quiz",
      instructions: "Answer each question. You can review your answers before submitting.",
      immediateFeeback: false,
      passingScore: 0.7,
      questions: [
        {
          id: "q1",
          kind: "multiple_choice",
          prompt: { text: "What is the value of the digit 4 in the number 34,827?" },
          choices: [
            { id: "a", text: "4" },
            { id: "b", text: "40" },
            { id: "c", text: "400" },
            { id: "d", text: "4,000" },
          ],
          correctChoiceIds: ["d"],
          hint: "Think about which place the 4 is in.",
        },
        {
          id: "q2",
          kind: "multiple_choice",
          prompt: { text: "Which number has a 7 in the ten-thousands place?" },
          choices: [
            { id: "a", text: "7,213" },
            { id: "b", text: "17,500" },
            { id: "c", text: "70,100" },
            { id: "d", text: "710" },
          ],
          correctChoiceIds: ["c"],
        },
        {
          id: "q3",
          kind: "short_answer",
          prompt: { text: "Write 52,304 in expanded form." },
          rubric: "Expected: 50,000 + 2,000 + 300 + 4",
        },
      ],
    },
  },

  // --- Flashcards ---
  {
    id: "session-flash-001",
    learnerId: "learner-demo",
    activityId: "activity-flash-001",
    status: "not_started",
    estimatedMinutes: 8,
    standardIds: ["CCSS.MATH.CONTENT.4.NBT.A.2"],
    definition: {
      kind: "flashcards",
      title: "Place Value Vocabulary",
      randomize: true,
      cards: [
        {
          id: "fc1",
          front: { text: "Digit" },
          back: { text: "Any of the symbols 0–9 used to write numbers." },
        },
        {
          id: "fc2",
          front: { text: "Place value" },
          back: { text: "The value of a digit based on its position in a number." },
        },
        {
          id: "fc3",
          front: { text: "Standard form" },
          back: { text: "A number written with one digit for each place value (e.g. 52,304)." },
        },
        {
          id: "fc4",
          front: { text: "Expanded form" },
          back: { text: "A way to write a number showing the value of each digit (e.g. 50,000 + 2,000 + 300 + 4)." },
        },
        {
          id: "fc5",
          front: { text: "Word form" },
          back: { text: "A number written in words (e.g. fifty-two thousand, three hundred four)." },
        },
      ],
    },
  },

  // --- Matching ---
  {
    id: "session-match-001",
    learnerId: "learner-demo",
    activityId: "activity-match-001",
    status: "not_started",
    standardIds: [],
    estimatedMinutes: 5,
    definition: {
      kind: "matching",
      title: "Match the Number Forms",
      instructions: "Connect each number in standard form to its word form.",
      pairs: [
        { id: "p1", prompt: "10,000", answer: "ten thousand" },
        { id: "p2", prompt: "100,000", answer: "one hundred thousand" },
        { id: "p3", prompt: "52,304", answer: "fifty-two thousand, three hundred four" },
        { id: "p4", prompt: "7,090", answer: "seven thousand, ninety" },
      ],
    },
  },

  // --- Sequencing ---
  {
    id: "session-seq-001",
    learnerId: "learner-demo",
    activityId: "activity-seq-001",
    status: "not_started",
    standardIds: [],
    estimatedMinutes: 5,
    definition: {
      kind: "sequencing",
      title: "Order the Steps",
      prompt: "Put the steps for rounding a number in the correct order.",
      items: [
        { id: "s1", text: "Identify the rounding place.", correctIndex: 0 },
        { id: "s2", text: "Look at the digit to the right of the rounding place.", correctIndex: 1 },
        { id: "s3", text: "If that digit is 5 or more, round up.", correctIndex: 2 },
        { id: "s4", text: "If that digit is less than 5, keep the rounding digit the same.", correctIndex: 3 },
        { id: "s5", text: "Replace all digits to the right of the rounding place with zeros.", correctIndex: 4 },
      ],
    },
  },

  // --- Guided practice ---
  {
    id: "session-guided-001",
    learnerId: "learner-demo",
    activityId: "activity-guided-001",
    status: "not_started",
    standardIds: [],
    estimatedMinutes: 15,
    definition: {
      kind: "guided_practice",
      title: "Rounding to the Nearest Thousand",
      workedExample: {
        text: "Round 34,827 to the nearest thousand.\n1. Rounding place: thousands → digit is 4.\n2. Look right: hundreds digit is 8 (≥ 5).\n3. Round up: 4 → 5.\n4. Result: 35,000.",
      },
      steps: [
        {
          id: "step1",
          instruction: { text: "Round 62,341 to the nearest thousand. What is the thousands digit?" },
          expectedValue: "2",
          hint: "Look at the number in the thousands place.",
        },
        {
          id: "step2",
          instruction: { text: "What digit is to the right of the thousands place?" },
          expectedValue: "3",
          hint: "That is the hundreds digit.",
        },
        {
          id: "step3",
          instruction: { text: "Since 3 < 5, do we round up or keep the same?" },
          expectedValue: "keep the same",
          hint: "If the digit is less than 5, we keep the rounding digit the same.",
        },
        {
          id: "step4",
          instruction: { text: "Write the final rounded number." },
          expectedValue: "62,000",
        },
      ],
    },
  },

  // --- Reflection ---
  {
    id: "session-reflect-001",
    learnerId: "learner-demo",
    activityId: "activity-reflect-001",
    status: "not_started",
    standardIds: [],
    estimatedMinutes: 5,
    definition: {
      kind: "reflection",
      title: "Lesson Reflection",
      prompts: [
        {
          id: "r1",
          prompt: { text: "What is one thing you learned today about place value?" },
          responseKind: "text",
        },
        {
          id: "r2",
          prompt: { text: "How confident do you feel about reading large numbers?" },
          responseKind: "rating",
          ratingLabels: ["Not confident", "Very confident"],
        },
        {
          id: "r3",
          prompt: { text: "What would you like more practice on?" },
          responseKind: "text",
        },
      ],
    },
  },
];
