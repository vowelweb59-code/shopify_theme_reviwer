import type { Metadata } from "next";
import { LegalPage } from "@/app/_components/LegalPage";
import { LEGAL_APP_NAME, LEGAL_CONTACT, LEGAL_OPERATOR } from "@/lib/legal/pages";

export const metadata: Metadata = { title: `Privacy policy · ${LEGAL_APP_NAME}` };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        {LEGAL_APP_NAME} is an internal tool run by {LEGAL_OPERATOR} for its own team. It helps the team follow its project work and the performance of the
        Shopify themes it publishes. It is not offered to the public, and only people the team has given a login can use it.
      </p>

      <section>
        <h2>What data the app reads</h2>
        <p>When a team member connects a Google account, the app asks for read-only access to:</p>
        <ul>
          <li>the account&apos;s email address, to show which account is connected;</li>
          <li>the messages of the Google Chat spaces the team uses to report work hours and new projects;</li>
          <li>the member lists of those spaces, to match names to team members.</li>
        </ul>
        <p>
          The app never sends messages, edits or deletes anything in Google Chat, and never reads any space the connected account is not already a member of.
        </p>
      </section>

      <section>
        <h2>How the data is used</h2>
        <p>
          Chat messages are read to produce the team&apos;s internal reports: hours worked per project, project status and team performance. The data is used
          only for that purpose.
        </p>
      </section>

      <section>
        <h2>Where it is stored and who sees it</h2>
        <ul>
          <li>The information is stored in the app&apos;s own database, which only the team&apos;s signed-in members can open.</li>
          <li>The Google access credentials are stored encrypted.</li>
          <li>We do not sell, rent or share this data with anyone outside {LEGAL_OPERATOR}, and we do not use it for advertising.</li>
          <li>We do not use Google user data to develop, improve or train generalised AI or machine-learning models.</li>
        </ul>
      </section>

      <section>
        <h2>Limited use of Google data</h2>
        <p>
          {LEGAL_APP_NAME}&apos;s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including its
          Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>Disconnecting and deleting</h2>
        <p>
          The connection can be removed at any time by removing the app&apos;s access in your Google Account security page (Third-party apps with account
          access), or by asking us. To have stored data deleted, write to {LEGAL_CONTACT}.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about this policy: <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
