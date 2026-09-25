// Google's API clients set no request timeout by default, so one hung call
// would hang its caller indefinitely — for the GA4 scheduler, that stalls
// every later tick. A GA4 report or Sheets batch normally takes seconds.
export const GOOGLE_API_TIMEOUT_MS = 60_000;
