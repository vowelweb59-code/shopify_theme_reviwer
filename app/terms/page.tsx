import type { Metadata } from "next";
import { LegalPage } from "@/app/_components/LegalPage";
import { LEGAL_APP_NAME, LEGAL_CONTACT, LEGAL_OPERATOR } from "@/lib/legal/pages";

export const metadata: Metadata = { title: `Terms of service · ${LEGAL_APP_NAME}` };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        {LEGAL_APP_NAME} is an internal tool of {LEGAL_OPERATOR}. By signing in or connecting a Google account you agree to these terms.
      </p>

      <section>
        <h2>Who may use it</h2>
        <p>
          The app is for {LEGAL_OPERATOR} team members who have been given a login. Do not share the login or use the app for anything outside the team&apos;s
          work.
        </p>
      </section>

      <section>
        <h2>What it does</h2>
        <p>
          The app reads data the team already produces (such as hours reported in Google Chat) and turns it into reports. Figures shown are reported hours, not
          verified billing, and may contain errors. Check anything important at its source before relying on it.
        </p>
      </section>

      <section>
        <h2>Connected accounts</h2>
        <p>
          Connecting a Google account gives the app read-only access as described in the <a href="/privacy">privacy policy</a>. You can remove that access at
          any time.
        </p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          The app is provided as it is, without any promise that it will be available or error-free. {LEGAL_OPERATOR} is not liable for decisions made from its
          figures.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>These terms may be updated from time to time; the date at the top shows the latest version.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
        </p>
      </section>
    </LegalPage>
  );
}
