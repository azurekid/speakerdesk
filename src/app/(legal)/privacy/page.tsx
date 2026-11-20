import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, Section } from "@/components/legal";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit-constants";
import { OPERATOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy notice" };

// Draft for legal review — keep in sync with what the code actually does (see src/lib/legal.ts).
export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy notice"
      intro={<p>What personal data SpeakerDesk keeps, why, who sees it, how long we keep it, and what you can do about it. It applies under the EU General Data Protection Regulation (GDPR).</p>}
    >
      <Section title="Who is responsible">
        <p>
          {OPERATOR.name}, {OPERATOR.address}, is the controller for the personal data in your SpeakerDesk account. Questions and requests: <a href={`mailto:${OPERATOR.contactEmail}`}>{OPERATOR.contactEmail}</a>.
        </p>
        <p>When you submit a proposal or sponsorship request, or join an event team, the event&apos;s organizers receive the details needed for that and use them for their event as a separate controller. Their own privacy notice applies to that use.</p>
      </Section>

      <Section title="What we collect and why">
        <table>
          <thead><tr><th>Data</th><th>Why</th><th>Legal basis</th></tr></thead>
          <tbody>
            <tr><td>Email address, name, password (stored hashed) or linked sign-in provider</td><td>Your account and signing in</td><td>Contract</td></tr>
            <tr><td>Profile: pronouns, country, city, timezone, company, job title, bios, headshots, links, home airport, T-shirt size, travel notes</td><td>What you choose to keep and share with organizers or publish</td><td>Contract; all optional fields are up to you</td></tr>
            <tr><td>Sessions, submissions, proposals, reviews, events, team roles, runbook tasks, sponsor company and deals</td><td>The features you use</td><td>Contract</td></tr>
            <tr><td>Sign-in sessions: IP address, browser and device</td><td>Keeping you signed in, showing &ldquo;where you&apos;re signed in&rdquo;, spotting misuse</td><td>Legitimate interest (security)</td></tr>
            <tr><td>Audit log: who did what and when (sign-ins and failed attempts, account changes, which records and fields were changed — never the values — and admin actions), with IP address and browser</td><td>Security, investigating abuse, accountability for admin access</td><td>Legitimate interest (security); legal obligations</td></tr>
            <tr><td>Emails we send you (sign-in codes are removed from our copy once delivered)</td><td>Delivering sign-in codes and notices, troubleshooting delivery</td><td>Contract; legitimate interest</td></tr>
          </tbody>
        </table>
        <p>We don&apos;t ask for health information, dietary needs, religion or other special categories of data, and we ask you not to put them in free-text fields. Organizers who need such details for travel or catering should collect them directly, with your explicit consent.</p>
        <p>We don&apos;t sell your data, show ads, or use tracking or analytics cookies.</p>
      </Section>

      <Section title="Who can see it">
        <ul>
          <li><strong>Everyone</strong>: only what you publish — your public speaker page and published talks (if you opt in), and published calls for papers, programmes and sponsor lists.</li>
          <li><strong>Event organizers and their team</strong>: proposals you submit to their event (a snapshot), your profile details shown with them, sponsorship requests to their event, and team membership. Reviewers can be prevented from seeing speaker names (anonymous review).</li>
          <li><strong>SpeakerDesk administrators</strong>: account data and the audit log, for support and security. Support access to your account (&ldquo;View as&rdquo;) is shown to you with a banner and is logged.</li>
          <li><strong>Our processors</strong>, under data processing agreements: Microsoft (Azure hosting, database, file storage, email delivery and map search, in the EU — region North Europe). If you sign in with GitHub, Google, LinkedIn or Microsoft, that provider confirms your identity to us.</li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        <ul>
          <li><strong>Account data</strong>: until you delete your account (or ask us to). Then it is deleted immediately; encrypted database backups roll off within 14 days.</li>
          <li><strong>Sign-in sessions</strong>: until they expire (7 days of inactivity) or you sign out.</li>
          <li><strong>Audit log and server logs</strong>: {AUDIT_RETENTION_DAYS} days, then deleted automatically. After you delete your account, entries about it remain only until they reach that age.</li>
          <li><strong>Sent-email records</strong>: {AUDIT_RETENTION_DAYS} days; deleted straight away when you delete your account.</li>
        </ul>
      </Section>

      <Section title="Your rights">
        <ul>
          <li><strong>Access and portability</strong>: download everything under <Link href="/export">Export</Link> (JSON, Markdown, CSV).</li>
          <li><strong>Correction</strong>: edit your <Link href="/profile">profile</Link> and <Link href="/account">account</Link> at any time.</li>
          <li><strong>Erasure</strong>: <Link href="/account">Account → Delete account</Link> removes your account and data straight away.</li>
          <li><strong>Restriction and objection</strong>: email us and we&apos;ll respond within one month.</li>
          <li><strong>Complaints</strong>: you can complain to the Dutch data protection authority (<a href="https://autoriteitpersoonsgegevens.nl">Autoriteit Persoonsgegevens</a>) or the authority where you live.</li>
        </ul>
      </Section>

      <Section title="Cookies">
        <p>SpeakerDesk uses only strictly necessary cookies: a session cookie that keeps you signed in, and short-lived cookies that protect sign-in with a social account. Your light/dark theme choice is stored in your browser, not sent to us. No consent banner is needed because nothing else is stored.</p>
      </Section>

      <Section title="Security">
        <p>Data is encrypted in transit (HTTPS) and at rest. Sign-in attempts are rate-limited, passwords are hashed, sign-in codes expire after 10 minutes, and every change is recorded in the audit log. If a breach puts your data at risk we will tell you and the supervisory authority as the law requires.</p>
      </Section>

      <Section title="Changes">
        <p>When this notice changes materially we update the version at the top and ask you to review it the next time you sign in.</p>
      </Section>
    </LegalDoc>
  );
}
