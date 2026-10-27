import { catalogCourseFor } from "./catalog.js";

export const SUBJECT_ICONS = {
  "English": "📖",
  "Math": "📐",
  "Science": "🔬",
  "Social Studies": "🌎",
  "World Language": "🗣️",
  "Arts": "🎨",
  "Computer Science": "💻",
  "Electives": "⭐"
};

export const EXPLORE_SUBJECTS = [
  {
    subject: "Arts",
    recommendation: "No set requirement, but many colleges like to see at least one year of visual or performing arts, and some state universities require it."
  },
  {
    subject: "Computer Science",
    recommendation: "No set requirement. Computer science is a great choice if you're curious about tech, and it's especially useful for STEM majors."
  }
];

export const PLAN_STATUS_LABELS = {
  "on-track": "On track",
  "one-more-year": "Needs 1 more year",
  "missing": "Missing"
};

export const CATALOG_GROUPS = ["Core", "Electives", "Honors", "AP", "IB"];

export function groupCatalogCourses(catalog, subject) {
  const inSubject = catalog ? catalog.courses.filter((course) => course.subject === subject) : [];
  return {
    Core: inSubject.filter((course) => course.type === "Core"),
    Electives: inSubject.filter((course) => course.type === "Elective"),
    Honors: inSubject.filter((course) => (course.type === "Core" || course.type === "Elective") && course.levels.includes("Honors")),
    AP: inSubject.filter((course) => course.type === "AP"),
    IB: inSubject.filter((course) => course.type === "IB")
  };
}

export function studentCatalogIds(catalog, courses) {
  return new Set(courses.map((course) => (catalogCourseFor(catalog, course) || {}).id).filter(Boolean));
}

export function yearsText(yearsLogged, yearsRequired) {
  return yearsLogged > yearsRequired
    ? `${yearsLogged} years (${yearsRequired} needed)`
    : `${yearsLogged} of ${yearsRequired} years`;
}

export function progressPercent(yearsLogged, yearsRequired) {
  if (!yearsRequired) return 0;
  return Math.min(100, Math.round((yearsLogged / yearsRequired) * 100));
}
