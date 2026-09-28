import { normalizeVertical } from './vertical';

export const SIGNUP_CATEGORY_KEY = 'signupCategory';

export function readSignupCategory() {
  try {
    return normalizeVertical(sessionStorage.getItem(SIGNUP_CATEGORY_KEY));
  } catch {
    return '';
  }
}

export function saveSignupCategory(value) {
  const id = normalizeVertical(value);
  if (!id) return;
  try {
    sessionStorage.setItem(SIGNUP_CATEGORY_KEY, id);
  } catch {
    // sessionStorage can be unavailable (e.g. Safari private mode).
  }
}

export function clearSignupCategory() {
  try {
    sessionStorage.removeItem(SIGNUP_CATEGORY_KEY);
  } catch {
    // sessionStorage can be unavailable (e.g. Safari private mode).
  }
}

/**
 * Priority: `?category=` URL parameter > sessionStorage > no preselection.
 * An unknown `?category=` value means no preselection, even if one was stored.
 */
export function initialSignupCategory(searchParams) {
  if (searchParams?.has('category')) return normalizeVertical(searchParams.get('category'));
  return readSignupCategory();
}
