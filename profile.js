const STORAGE_KEY = "collegeChance.profile";

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankProfile();
    const parsed = JSON.parse(raw);
    return { ...blankProfile(), ...parsed };
  } catch (err) {
    console.warn("Could not load profile from localStorage:", err);
    return blankProfile();
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch (err) {
    console.warn("Could not save profile to localStorage:", err);
    return false;
  }
}

function blankProfile() {
  return {
    gpa: null,
    sat: null,
    act: null,
    state: ""
  };
}

const LIST_KEY = "collegeChance.myList";

export function loadMyList() {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not load college list from localStorage:", err);
    return [];
  }
}

export function saveMyList(idList) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(idList));
    return true;
  } catch (err) {
    console.warn("Could not save college list to localStorage:", err);
    return false;
  }
}
