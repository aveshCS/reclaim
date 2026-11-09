/**
 * Optional cloud backup. These values are public identifiers, not secrets.
 *
 * GOOGLE_WEB_CLIENT_ID: the OAuth "Web application" client in Google Cloud project RECLAIM.
 *   Google puts it in the ID token's audience; the server only accepts tokens for it.
 * API_BASE_URL: where the RECLAIM API lives. Dev builds reach a server on this computer
 *   through `adb reverse tcp:3000 tcp:3000`. Release builds have no server until it is
 *   deployed, so backup shows as "coming soon" there.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '903496693852-bvsg7c44oadl377grjbv30a3vsb310eu.apps.googleusercontent.com';

const RELEASE_API_BASE_URL: string | null = null;

export const API_BASE_URL: string | null = __DEV__
  ? 'http://localhost:3000/v1'
  : RELEASE_API_BASE_URL;
