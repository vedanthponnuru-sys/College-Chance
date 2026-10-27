let catalogCache = null;

export async function loadCatalog() {
  if (catalogCache) return catalogCache;
  const response = await fetch("data/course-catalog.json");
  if (!response.ok) {
    throw new Error(`Could not load course catalog (status ${response.status})`);
  }
  catalogCache = await response.json();
  return catalogCache;
}

function normalize(text) {
  return (text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function findCatalogCourse(catalog, nameOrId) {
  if (!catalog || !nameOrId) return null;
  const text = normalize(nameOrId);
  return catalog.courses.find((course) =>
    course.id === nameOrId ||
    normalize(course.name) === text ||
    (course.aliases || []).some((alias) => normalize(alias) === text)
  ) || null;
}

export function catalogCourseFor(catalog, course) {
  if (!catalog || !course) return null;
  if (course.catalogId) {
    const byId = catalog.courses.find((c) => c.id === course.catalogId);
    if (byId) return byId;
  }
  return findCatalogCourse(catalog, course.name);
}

export function coursesForSubject(catalog, subject) {
  if (!catalog) return [];
  return subject ? catalog.courses.filter((course) => course.subject === subject) : catalog.courses;
}

export function describeGrades(grades) {
  if (!grades || grades.length === 0) return "";
  const lo = Math.min(...grades);
  const hi = Math.max(...grades);
  return lo === hi ? `Grade ${lo}` : `Grades ${lo}–${hi}`;
}

export function comboboxOptionsFor(catalog, subject) {
  return coursesForSubject(catalog, subject).map((course) => ({
    value: course.name,
    detail: subject ? describeGrades(course.grades) : course.subject,
    keywords: course.aliases || []
  }));
}
