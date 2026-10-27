export const SUBJECTS = [
  "English",
  "Math",
  "Science",
  "Social Studies",
  "World Language",
  "Arts",
  "Computer Science",
  "Electives"
];

export const LEVELS = ["Regular", "Honors", "AP", "IB SL", "IB HL", "IB", "Dual Enrollment"];

export const SEMESTERS = ["Fall", "Spring", "Full year"];

export const STATUSES = ["Completed", "In progress", "Planned"];

export const LETTER_GRADES = ["A", "B", "C", "D", "F"];

export const SCHOOL_YEARS = [9, 10, 11, 12];

export const SCHOOL_YEAR_LABELS = { 9: "9th Grade", 10: "10th Grade", 11: "11th Grade", 12: "12th Grade" };

const AP_HONORS_LEVELS = ["Honors", "AP", "IB", "IB SL", "IB HL", "Dual Enrollment"];

const STORAGE_KEY = "collegeChance.courses";

export function loadCourses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((course) => (course.subject === "Other" ? { ...course, subject: "Electives" } : course));
  } catch (err) {
    console.warn("Could not load courses from localStorage:", err);
    return [];
  }
}

export function saveCourses(courses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    return true;
  } catch (err) {
    console.warn("Could not save courses to localStorage:", err);
    return false;
  }
}

export function nextCourseId(courses) {
  return courses.reduce((max, course) => Math.max(max, course.id), 0) + 1;
}

export function getAllowedStatuses(grade) {
  if (typeof grade !== "number" || grade <= 8) return ["Planned"];
  if (grade === 9) return ["In progress", "Planned"];
  return ["Completed", "In progress", "Planned"];
}

export function describeCourseTier(grade) {
  if (typeof grade !== "number" || grade <= 8) {
    return "Log the courses you're planning to take starting in 9th grade.";
  }
  if (grade === 9) {
    return "Log the courses you're currently taking and the ones you're planning to take. You'll be able to mark courses Completed starting next year.";
  }
  return "Log courses you've completed (with your final grade), courses you're taking now, and courses you're planning to take.";
}

export function countApHonorsCourses(courses) {
  return courses.filter(
    (course) =>
      AP_HONORS_LEVELS.includes(course.level) &&
      (course.status === "Completed" || course.status === "In progress")
  ).length;
}

export function groupCoursesByYear(courses) {
  const groups = {};
  courses.forEach((course) => {
    if (!groups[course.schoolYear]) groups[course.schoolYear] = [];
    groups[course.schoolYear].push(course);
  });
  return groups;
}
