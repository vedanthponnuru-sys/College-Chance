import { loadCatalog, catalogCourseFor, findCatalogCourse } from "./catalog.js";

let guidanceCache = null;

export async function loadCourseGuidance() {
  if (guidanceCache) return guidanceCache;
  const response = await fetch("data/course-guidance.json");
  if (!response.ok) {
    throw new Error(`Could not load course guidance data (status ${response.status})`);
  }
  guidanceCache = await response.json();
  return guidanceCache;
}

export const GUIDANCE_FOOTER_NOTE =
  "General guidance. Your school may not offer every course — check with your school counselor and each college's requirements.";

export const CORE_REQUIREMENTS = [
  {
    subject: "English",
    years: 4,
    selectiveYears: 4,
    recommendation: "4 years of English; competitive colleges expect honors or AP/IB English along the way.",
    selectiveNote: null,
    beyondNote: null
  },
  {
    subject: "Math",
    years: 4,
    selectiveYears: 4,
    recommendation: "4 years of math, including at least one course beyond Algebra II; selective colleges like to see Calculus.",
    selectiveNote: "Selective colleges like to see Calculus.",
    beyondNote: "Include at least one course beyond Algebra II (Pre-Calculus or higher)."
  },
  {
    subject: "Science",
    years: 3,
    selectiveYears: 4,
    recommendation: "3–4 years of lab science covering Biology, Chemistry and Physics; selective colleges like to see 4.",
    selectiveNote: "Selective colleges like to see 4 years, including a 4th lab science.",
    beyondNote: null
  },
  {
    subject: "Social Studies",
    years: 3,
    selectiveYears: 4,
    recommendation: "3–4 years of social studies including US History; selective colleges like to see 4.",
    selectiveNote: "Selective colleges like to see 4 years.",
    beyondNote: null
  },
  {
    subject: "World Language",
    years: 2,
    selectiveYears: 3,
    recommendation: "2–3 years of the same world language; selective colleges like to see 3–4.",
    selectiveNote: "Selective colleges like to see 3-4 years of the same language.",
    beyondNote: null
  }
];

function distinctYears(courses, subject) {
  const years = new Set(courses.filter((c) => c.subject === subject).map((c) => c.schoolYear));
  return years.size;
}

function nameIncludes(course, text) {
  return course.name.toLowerCase().includes(text.toLowerCase());
}

function statusFor(yearsLogged, yearsRequired) {
  if (yearsLogged >= yearsRequired) return "on-track";
  if (yearsLogged === yearsRequired - 1) return "one-more-year";
  return "missing";
}

function trackStep(catalog, courses, track) {
  let best = 0;
  courses.forEach((course) => {
    const entry = catalogCourseFor(catalog, course);
    if (entry && entry.track === track && entry.step > best) best = entry.step;
  });
  return best;
}

function nextInTrack(catalog, track, step) {
  if (!catalog) return null;
  const next = catalog.courses.find((c) => c.track === track && c.step === step + 1);
  return next ? next.name : null;
}

function suggestEnglish(courses, catalog) {
  const englishCourses = courses.filter((c) => c.subject === "English");
  const step = trackStep(catalog, englishCourses, "english");
  if (step >= 4) return null;
  if (step > 0) return nextInTrack(catalog, "english", step);
  if (englishCourses.length === 0) return "English 9";

  const grades = englishCourses
    .map((c) => {
      const match = c.name.match(/\b(9|10|11|12)\b/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((g) => g !== null);
  if (grades.length === 0) return "the next English course for your grade";
  const highest = Math.max(...grades);
  return highest < 12 ? `English ${highest + 1}` : null;
}

const MATH_FALLBACK_CHAIN = ["Algebra I", "Geometry", "Algebra II", "Pre-Calculus", "AP Calculus AB", "AP Calculus BC"];

function mathStep(courses, catalog) {
  const mathCourses = courses.filter((c) => c.subject === "Math");
  let step = trackStep(catalog, mathCourses, "math");
  mathCourses.forEach((course) => {
    MATH_FALLBACK_CHAIN.forEach((name, index) => {
      if (nameIncludes(course, name) && index + 1 > step) step = index + 1;
    });
  });
  return step;
}

function suggestMath(courses, catalog) {
  const step = mathStep(courses, catalog);
  if (step >= 6) return null;
  return nextInTrack(catalog, "math", step) || MATH_FALLBACK_CHAIN[step] || null;
}

const SCIENCE_TRACKS = [
  { track: "biology", name: "Biology" },
  { track: "chemistry", name: "Chemistry" },
  { track: "physics", name: "Physics" }
];

function hasScienceTrack(courses, catalog, { track, name }) {
  const scienceCourses = courses.filter((c) => c.subject === "Science");
  return trackStep(catalog, scienceCourses, track) > 0 || scienceCourses.some((c) => nameIncludes(c, name));
}

function suggestScience(courses, catalog) {
  const missing = SCIENCE_TRACKS.find((t) => !hasScienceTrack(courses, catalog, t));
  if (missing) return missing.name;

  const scienceCourses = courses.filter((c) => c.subject === "Science");
  const hasAdvanced = SCIENCE_TRACKS.some((t) => trackStep(catalog, scienceCourses, t.track) >= 2) ||
    scienceCourses.some((c) => /^(AP|IB) /i.test(c.name));
  return hasAdvanced ? null : "an AP or IB science course (e.g. AP Biology, AP Chemistry or AP Physics 1: Algebra-Based)";
}

function hasUsHistory(courses, catalog) {
  const socialCourses = courses.filter((c) => c.subject === "Social Studies");
  return trackStep(catalog, socialCourses, "us-history") > 0 ||
    socialCourses.some((c) => nameIncludes(c, "US History") || nameIncludes(c, "U.S. History"));
}

function suggestSocialStudies(courses, catalog) {
  if (!hasUsHistory(courses, catalog)) return "US History";
  return "a Social Studies elective (e.g. AP United States Government and Politics, AP Psychology or AP Macroeconomics)";
}

const LANGUAGE_LEVELS = ["I", "II", "III", "IV", "V"];

function suggestWorldLanguage(courses, catalog) {
  const languageCourses = courses.filter((c) => c.subject === "World Language");
  if (languageCourses.length === 0) {
    return "Level I of a world language your school offers (e.g. Spanish I or French I)";
  }

  let bestTrack = null;
  let bestStep = 0;
  languageCourses.forEach((course) => {
    const entry = catalogCourseFor(catalog, course);
    if (entry && entry.track && entry.step > bestStep) {
      bestStep = entry.step;
      bestTrack = entry.track;
    }
  });
  if (bestTrack) {
    if (bestStep >= 5) return null;
    return nextInTrack(catalog, bestTrack, bestStep);
  }

  let bestLanguage = null;
  let bestLevelIndex = -1;
  languageCourses.forEach((course) => {
    const match = course.name.match(/^(.*?)\s+(I|II|III|IV|V)\b/i);
    if (!match) return;
    const levelIndex = LANGUAGE_LEVELS.indexOf(match[2].toUpperCase());
    if (levelIndex > bestLevelIndex) {
      bestLevelIndex = levelIndex;
      bestLanguage = match[1].trim();
    }
  });

  if (bestLanguage === null) return "the next level of the language you're already taking";
  if (bestLevelIndex >= LANGUAGE_LEVELS.length - 1) return null;
  return `${bestLanguage} ${LANGUAGE_LEVELS[bestLevelIndex + 1]}`;
}

const SUGGESTERS = {
  "English": suggestEnglish,
  "Math": suggestMath,
  "Science": suggestScience,
  "Social Studies": suggestSocialStudies,
  "World Language": suggestWorldLanguage
};

export function buildCorePlan(courses, catalog) {
  return CORE_REQUIREMENTS.map((requirement) => {
    const yearsLogged = distinctYears(courses, requirement.subject);
    return {
      subject: requirement.subject,
      yearsLogged,
      yearsRequired: requirement.years,
      selectiveYears: requirement.selectiveYears,
      recommendation: requirement.recommendation,
      selectiveNote: requirement.selectiveNote,
      beyondNote: requirement.subject === "Math" && mathStep(courses, catalog) >= 4 ? null : requirement.beyondNote,
      status: statusFor(yearsLogged, requirement.years),
      nextCourse: SUGGESTERS[requirement.subject](courses, catalog)
    };
  });
}

function isLabScience(course, catalog) {
  if (course.isLabScience) return true;
  const entry = catalogCourseFor(catalog, course);
  if (entry) return Boolean(entry.lab);
  return SCIENCE_TRACKS.some((t) => nameIncludes(course, t.name));
}

export function buildNcCheck(courses, profile, catalog) {
  if (!profile || profile.state !== "NC") return null;

  const englishYears = distinctYears(courses, "English");
  const mathYears = distinctYears(courses, "Math");
  const scienceYears = distinctYears(courses, "Science");
  const socialYears = distinctYears(courses, "Social Studies");

  const hasLab = courses.some((c) => c.subject === "Science" && isLabScience(c, catalog));
  const usHistory = hasUsHistory(courses, catalog);

  return {
    items: [
      {
        label: "English (4 units)",
        met: englishYears >= 4,
        detail: `${englishYears} of 4 years logged.`
      },
      {
        label: "Math (4 units: NC Math 1, 2, 3 and one course beyond)",
        met: mathYears >= 4,
        detail: `${mathYears} of 4 years logged.`
      },
      {
        label: "Science (3 units, including at least one lab course)",
        met: scienceYears >= 3 && hasLab,
        detail: `${scienceYears} of 3 years logged${hasLab ? "" : " — no lab science found yet"}.`
      },
      {
        label: "Social Studies (2 units, including US History)",
        met: socialYears >= 2 && usHistory,
        detail: `${socialYears} of 2 years logged${usHistory ? "" : ", and US History hasn't been added yet"}.`
      }
    ],
    languageNote:
      "Starting with the class of 2025, world language is no longer required for UNC System admission, but many colleges still recommend it and some require it to graduate.",
    disclaimer:
      "Meeting these minimums doesn't guarantee admission — competitive schools like UNC Chapel Hill expect much more.",
    source: "https://www.northcarolina.edu/students/admission/"
  };
}

const RIGOR_CORE_SUBJECTS = ["English", "Math", "Science", "Social Studies", "World Language"];

export function buildRigorSuggestions(courses, majorGuidance) {
  const regularSubjects = RIGOR_CORE_SUBJECTS.filter((subject) =>
    courses.some((c) => c.subject === subject && c.level === "Regular")
  );

  const prioritySubjects = (majorGuidance && majorGuidance.prioritySubjects) || [];
  const sorted = [...regularSubjects].sort((a, b) => {
    const aPriority = prioritySubjects.includes(a) ? 0 : 1;
    const bPriority = prioritySubjects.includes(b) ? 0 : 1;
    return aPriority - bPriority;
  });

  return {
    subjects: sorted,
    balanceNote:
      "Challenge yourself, but don't overload — strong grades in hard classes beat low grades in many hard classes."
  };
}

export function findMajorGuidance(guidanceData, major) {
  const text = (major || "").trim().toLowerCase();
  if (!text) return guidanceData.undecided;

  const match = guidanceData.majors.find((entry) =>
    entry.keywords.some((keyword) => text.includes(keyword.trim()))
  );
  return match || guidanceData.undecided;
}

export function buildMajorSuggestions(majorGuidance, courses, catalog) {
  const haveIds = new Set(courses.map((c) => (catalogCourseFor(catalog, c) || {}).id).filter(Boolean));
  const haveNames = new Set(courses.map((c) => c.name.trim().toLowerCase()));
  const suggestedCourses = (majorGuidance.courses || []).filter((name) => {
    const entry = findCatalogCourse(catalog, name);
    if (entry && haveIds.has(entry.id)) return false;
    return !haveNames.has(name.trim().toLowerCase());
  });

  return {
    label: majorGuidance.label,
    courses: suggestedCourses,
    note: majorGuidance.note || null
  };
}

export function buildSeniorNote(grade) {
  if (grade === 11 || grade === 12) {
    return "Keep a challenging schedule senior year — colleges see it, and can rescind offers if your grades drop.";
  }
  return null;
}

export async function buildRecommendations({ courses, profile, identity }) {
  const [guidanceData, catalog] = await Promise.all([loadCourseGuidance(), loadCatalog()]);
  const majorGuidance = findMajorGuidance(guidanceData, identity.major);

  return {
    corePlan: buildCorePlan(courses, catalog),
    ncCheck: buildNcCheck(courses, profile, catalog),
    rigor: buildRigorSuggestions(courses, majorGuidance),
    majorSuggestions: buildMajorSuggestions(majorGuidance, courses, catalog),
    seniorNote: buildSeniorNote(identity.grade),
    footerNote: GUIDANCE_FOOTER_NOTE
  };
}
