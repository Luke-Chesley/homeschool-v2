/**
 * Seed data for standards browsing.
 *
 * Contains a realistic subset of CCSS Math Grade 4 standards so the UI can
 * be used without a live database. Extend as needed or replace with a real
 * repository once plan 02 is merged.
 */

import type { StandardsFramework, Standard } from "./types";

export const FRAMEWORKS: StandardsFramework[] = [
  {
    id: "ccss-math",
    name: "Common Core State Standards — Mathematics",
    abbreviation: "CCSS Math",
    kind: "ccss",
    subjects: ["math"],
    gradeLevels: ["K", "1", "2", "3", "4", "5", "6", "7", "8"],
    publishedYear: 2010,
    description:
      "The Common Core State Standards for Mathematics define what students should understand and be able to do in their study of mathematics.",
  },
  {
    id: "ccss-ela",
    name: "Common Core State Standards — English Language Arts",
    abbreviation: "CCSS ELA",
    kind: "ccss",
    subjects: ["english", "reading", "writing"],
    gradeLevels: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    publishedYear: 2010,
  },
  {
    id: "custom",
    name: "Custom Household Goals",
    abbreviation: "Custom",
    kind: "custom",
    subjects: [],
    gradeLevels: [],
    description: "Family-defined learning goals not tied to a published framework.",
  },
];

// CCSS Math Grade 4 — Number and Operations in Base Ten (subset)
export const STANDARDS: Standard[] = [
  // Domain
  {
    id: "ccss-math-4-nbt",
    frameworkId: "ccss-math",
    code: "4.NBT",
    title: "Number and Operations in Base Ten",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    depth: 0,
  },
  // Cluster A
  {
    id: "ccss-math-4-nbt-a",
    frameworkId: "ccss-math",
    code: "4.NBT.A",
    title: "Generalize place value understanding for multi-digit whole numbers.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt",
    depth: 1,
  },
  {
    id: "CCSS.MATH.CONTENT.4.NBT.A.1",
    frameworkId: "ccss-math",
    code: "CCSS.MATH.CONTENT.4.NBT.A.1",
    title: "Recognize that in a multi-digit whole number, a digit in one place represents ten times what it represents in the place to its right.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt-a",
    depth: 2,
  },
  {
    id: "CCSS.MATH.CONTENT.4.NBT.A.2",
    frameworkId: "ccss-math",
    code: "CCSS.MATH.CONTENT.4.NBT.A.2",
    title: "Read and write multi-digit whole numbers using base-ten numerals, number names, and expanded form.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt-a",
    depth: 2,
  },
  {
    id: "CCSS.MATH.CONTENT.4.NBT.A.3",
    frameworkId: "ccss-math",
    code: "CCSS.MATH.CONTENT.4.NBT.A.3",
    title: "Use place value understanding to round multi-digit whole numbers to any place.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt-a",
    depth: 2,
  },
  // Cluster B
  {
    id: "ccss-math-4-nbt-b",
    frameworkId: "ccss-math",
    code: "4.NBT.B",
    title: "Use place value understanding and properties of operations to perform multi-digit arithmetic.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt",
    depth: 1,
  },
  {
    id: "CCSS.MATH.CONTENT.4.NBT.B.4",
    frameworkId: "ccss-math",
    code: "CCSS.MATH.CONTENT.4.NBT.B.4",
    title: "Fluently add and subtract multi-digit whole numbers using the standard algorithm.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt-b",
    depth: 2,
  },
  {
    id: "CCSS.MATH.CONTENT.4.NBT.B.5",
    frameworkId: "ccss-math",
    code: "CCSS.MATH.CONTENT.4.NBT.B.5",
    title: "Multiply a whole number of up to four digits by a one-digit whole number, and multiply two two-digit numbers.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt-b",
    depth: 2,
  },
  {
    id: "CCSS.MATH.CONTENT.4.NBT.B.6",
    frameworkId: "ccss-math",
    code: "CCSS.MATH.CONTENT.4.NBT.B.6",
    title: "Find whole-number quotients and remainders with up to four-digit dividends and one-digit divisors.",
    gradeLevel: "4",
    subject: "math",
    domain: "Number and Operations in Base Ten",
    parentId: "ccss-math-4-nbt-b",
    depth: 2,
  },
];
