export const ACTIVITY_CATEGORIES = [
  "Academic club",
  "Arts",
  "Athletics",
  "Community service",
  "Work/job",
  "Leadership/student government",
  "Research",
  "Starting something",
  "Family responsibilities",
  "Other"
];

export const ACTIVITY_GRADES = [9, 10, 11, 12];

export const ACTIVITY_FOOTER_NOTE =
  "Colleges care about what you do and how much you commit, not how many clubs you join. Ideas are general guidance.";

export const JOBS_AND_FAMILY_NOTE =
  "Jobs and family responsibilities (like caring for siblings) count as real activities — add them too.";

const STORAGE_KEY = "collegeChance.activities";

const LOW_HOURS_PER_WEEK = 3;

export function loadActivities() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not load activities from localStorage:", err);
    return [];
  }
}

export function saveActivities(activities) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    return true;
  } catch (err) {
    console.warn("Could not save activities to localStorage:", err);
    return false;
  }
}

export function nextActivityId(activities) {
  return activities.reduce((max, activity) => Math.max(max, activity.id), 0) + 1;
}

export function hoursPerYear(activity) {
  if (!activity.weeksPerYear) return null;
  return Math.round(activity.hoursPerWeek * activity.weeksPerYear);
}

export function defaultActivityGrades(grade) {
  return ACTIVITY_GRADES.includes(grade) ? [grade] : [];
}

export const IDEAS_SHOWN_AT_FIRST = 3;

export function describeGrades(grades) {
  if (!grades || grades.length === 0) return "";
  const sorted = [...grades].sort((a, b) => a - b);
  return `Grade${sorted.length === 1 ? "" : "s"} ${sorted.join(", ")}`;
}

let ideasCache = null;

export async function loadActivityIdeas() {
  if (ideasCache) return ideasCache;
  const response = await fetch("data/activity-ideas.json");
  if (!response.ok) {
    throw new Error(`Could not load activity ideas (status ${response.status})`);
  }
  ideasCache = await response.json();
  return ideasCache;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startsAWord(text, keyword) {
  return new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}`).test(text);
}

export function findIdeaBucket(ideasData, majorText) {
  const text = (majorText || "").trim().toLowerCase();
  if (!text) return null;
  return ideasData.majors.find((bucket) => bucket.keywords.some((keyword) => startsAWord(text, keyword))) || null;
}

function activityText(activity) {
  return [activity.name, activity.role, activity.achievement].join(" ").toLowerCase();
}

function isRelatedToBucket(activity, bucket) {
  if (bucket.relatedCategories.includes(activity.category)) return true;
  const text = activityText(activity);
  return bucket.relatedKeywords.some((keyword) => startsAWord(text, keyword));
}

function biggestActivity(activities) {
  return activities.reduce((best, activity) => (hoursPerYear(activity) > hoursPerYear(best) ? activity : best));
}

export function gradeStage(grade) {
  if (grade === 12) {
    return {
      title: "Senior year: finish strong and document your impact",
      text: "Keep your commitments all year and show what you accomplished."
    };
  }
  if (grade === 11) {
    return {
      title: "Junior year: go deeper and lead",
      text: "Take bigger roles in what you care about most, rather than adding new things."
    };
  }
  return {
    title: grade === 8 || grade === null || grade === undefined
      ? "Before and early high school: explore"
      : "9th–10th grade: explore",
    text: "Try a few things and keep what you enjoy. It's fine to drop what doesn't click."
  };
}

function depthIdea(activities) {
  const lowHours = activities.filter((a) => a.hoursPerWeek < LOW_HOURS_PER_WEEK);
  if (activities.length < 5 || lowHours.length < 3) return null;
  return {
    title: "Depth over breadth",
    text: `You have ${activities.length} activities, and ${lowHours.length} of them take less than ${LOW_HOURS_PER_WEEK} hours a week. Consider focusing on the 2–3 you care about most and growing your role and impact there.`
  };
}

function leadershipIdea(activities, grade) {
  if (activities.length === 0 || activities.some((a) => a.leadership)) return null;
  const top = biggestActivity(activities);
  const early = typeof grade !== "number" || grade <= 10;
  return {
    title: "Take on a leadership role",
    text: `In ${top.name}, you could run for an officer role, lead a project or event, or mentor younger members.` +
      (early ? " You don't need a title yet — helping organize or train newer members counts too." : "")
  };
}

function majorIdea(activities, bucket, majorText, undecided) {
  if (!bucket) {
    if (activities.length > 0 && !majorText) return null;
    return {
      title: majorText ? "Explore what interests you" : "Explore to find your direction",
      text: "Not sure where you're headed yet? That's normal. A few ways to explore:",
      examples: undecided.ideas
    };
  }
  if (activities.some((activity) => isRelatedToBucket(activity, bucket))) return null;
  return {
    title: `Connect an activity to ${bucket.label}`,
    text: `None of your activities relate to your intended major yet. Ideas that would:`,
    examples: bucket.ideas
  };
}

function communityIdea(activities, bucket, undecided) {
  if (activities.some((a) => a.category === "Community service")) return null;
  return {
    title: "Give back to your community",
    text: (bucket || undecided).serviceIdea + " Service tied to your interests means more than random hours."
  };
}

function impactIdea(activities) {
  const missing = activities.filter((a) => !a.achievement);
  if (missing.length === 0) return null;
  return {
    title: "Show your impact with numbers",
    text: `Add specifics to ${missing.length === 1 ? `"${missing[0].name}"` : `activities like "${missing[0].name}"`}: people helped, money raised, hours, members, results. "Tutored 12 students weekly" is stronger than "Tutor."`
  };
}

function summerIdea(bucket, undecided, grade) {
  const options = (bucket || undecided).summerIdea;
  if (grade === 12) {
    return {
      title: "Count your summers",
      text: "Summer jobs, programs and projects you've already done count as activities — make sure they're on this list."
    };
  }
  return {
    title: grade === 11 ? "Make next summer count" : "Use your summers",
    text: `Try ${options}. Paid jobs count just as much as programs that cost money.`
  };
}

function furtherIdea(bucket) {
  if (!bucket) return null;
  return {
    title: `Take ${bucket.label} further`,
    text: "You already have an activity connected to your major. A next step could be:",
    examples: bucket.ideas.slice(0, 2)
  };
}

const KEEP_UP_IDEA = {
  title: "Keep your list up to date",
  text: "Update hours, roles and achievements each semester so your application is easy to fill in when the time comes."
};

const ORDER_BY_STAGE = {
  explore: ["major", "community", "summer", "leadership", "depth", "impact"],
  deepen: ["leadership", "depth", "major", "impact", "community", "summer"],
  finish: ["impact", "depth", "leadership", "community", "major", "summer"]
};

const MIN_IDEAS = 3;
const MAX_IDEAS = 5;

export function buildActivityIdeas({ activities, grade, majorText, ideasData }) {
  const bucket = findIdeaBucket(ideasData, majorText);
  const undecided = ideasData.undecided;

  const candidates = {
    major: majorIdea(activities, bucket, majorText, undecided),
    community: communityIdea(activities, bucket, undecided),
    summer: summerIdea(bucket, undecided, grade),
    leadership: leadershipIdea(activities, grade),
    depth: depthIdea(activities),
    impact: impactIdea(activities)
  };
  const stageKey = grade === 12 ? "finish" : grade === 11 ? "deepen" : "explore";
  const ideas = ORDER_BY_STAGE[stageKey]
    .map((key) => candidates[key])
    .filter(Boolean)
    .slice(0, MAX_IDEAS);

  const extras = [candidates.major ? null : furtherIdea(bucket), KEEP_UP_IDEA];
  extras.forEach((extra) => {
    if (extra && ideas.length < MIN_IDEAS) ideas.push(extra);
  });

  return {
    stage: gradeStage(grade),
    ideas,
    jobsNote: JOBS_AND_FAMILY_NOTE,
    footerNote: ACTIVITY_FOOTER_NOTE
  };
}
