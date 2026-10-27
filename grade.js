export const GRADE_OPTIONS = [
  { value: 8, label: "8th grade or younger" },
  { value: 9, label: "9th grade" },
  { value: 10, label: "10th grade" },
  { value: 11, label: "11th grade" },
  { value: 12, label: "12th grade" }
];

export function isValidGrade(grade) {
  return GRADE_OPTIONS.some((option) => option.value === grade);
}

export function gradeLabel(grade) {
  const option = GRADE_OPTIONS.find((o) => o.value === grade);
  return option ? option.label : "Grade not set";
}

export function gradeBadgeText(grade) {
  if (grade === 8) return "Grade 8 or below";
  return isValidGrade(grade) ? `Grade ${grade}` : "";
}

export function hasGpaYet(grade) {
  return typeof grade === "number" && grade >= 10;
}

export function currentSchoolYear(grade) {
  return typeof grade === "number" && grade >= 9 && grade <= 12 ? grade : null;
}

export function schoolYearsForStatus(status, grade) {
  const current = currentSchoolYear(grade);
  if (status === "Completed") {
    if (!current) return [];
    const years = [];
    for (let year = 9; year <= current; year++) years.push(year);
    return years;
  }
  if (status === "In progress") {
    return current ? [current] : [];
  }
  const start = current || 9;
  const years = [];
  for (let year = start; year <= 12; year++) years.push(year);
  return years;
}

export function schoolYearQuestion(status) {
  if (status === "Completed") return "When did you take it?";
  if (status === "In progress") return "School year";
  return "Which year will you take it?";
}
