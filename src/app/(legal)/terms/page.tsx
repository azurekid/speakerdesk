import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, Section } from "@/components/legal";
import { OPERATOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of use" };

// Draft for legal review — see src/lib/legal.ts.
export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of use"
      intro={<p>These terms apply when you use SpeakerDesk as a speaker, an event organizer or a sponsor. Please read them together with our <Link href="/privacy">privacy notice</Link>, which explains what we do with your personal data.</p>}
    >
      <Section title="1. Who we are">
        <p>
          SpeakerDesk is operated by {OPERATOR.name}, {OPERATOR.address}{OPERATOR.registration && ` (${OPERATOR.registration})`}. You can reach us at <a href={`mailto:${OPERATOR.contactEmail}`}>{OPERATOR.contactEmail}</a>.
        </p>
      </Section>

      <Section title="2. The service">
        <p>SpeakerDesk helps speakers keep their profile and sessions in one place and submit them to calls for papers, helps organizers run a call for papers, review proposals and plan an event, and lets sponsors request sponsorship packages from organizers.</p>
        <p>We may change, add or remove features. We aim to keep the service available but don&apos;t guarantee that it is uninterrupted or error-free.</p>
      </Section>

      <Section title="3. Your account">
        <ul>
          <li>You must be at least 16 years old to create an account.</li>
          <li>Give accurate details and keep your sign-in methods secure. You are responsible for activity under your account; tell us straight away if you think someone else has access.</li>
          <li>One person per account. Organizations add people to their event team instead of sharing an account.</li>
          <li>You can delete your account at any time under <strong>Account → Delete account</strong>. What happens to your data is described in the privacy notice.</li>
        </ul>
      </Section>

      <Section title="4. Your content">
        <p>You keep all rights to what you put on SpeakerDesk, such as your bio, photos, session abstracts, event descriptions and so on. You give us a non-exclusive, worldwide, royalty-free licence to store, copy, display and transmit that content only as needed to run the service the way you direct it, for example:</p>
        <ul>
          <li>showing your public speaker page and published talks, if you choose to publish them;</li>
          <li>sending a proposal, as a snapshot, to the organizers of the event you submit it to;</li>
          <li>showing a published call for papers, programme or sponsor list on the public event page.</li>
        </ul>
        <p>You confirm you have the right to share the content you upload, including photos of other people and material owned by your employer.</p>
      </Section>

      <Section title="5. Organizers">
        <ul>
          <li>Proposals, speaker profiles and sponsor details you receive through SpeakerDesk may only be used to run your event. You are responsible for handling that personal data lawfully, including telling speakers and sponsors how you use it.</li>
          <li>You decide which proposals to accept and how you communicate decisions. SpeakerDesk is not responsible for those decisions.</li>
          <li>Only invite people to your team who need access, and remove them when they no longer do.</li>
        </ul>
      </Section>

      <Section title="6. Sponsors">
        <p>Sponsorship agreements are made directly between the sponsor and the event organizer. SpeakerDesk records requests and their status but is not a party to the agreement, does not process payments and is not responsible for delivery of sponsorship benefits.</p>
      </Section>

      <Section title="7. Acceptable use">
        <p>Don&apos;t use SpeakerDesk to:</p>
        <ul>
          <li>break the law or infringe anyone&apos;s rights, including privacy and intellectual property;</li>
          <li>publish content that is hateful, harassing, discriminatory, sexually explicit or misleading;</li>
          <li>send spam or unsolicited invitations, or scrape other users&apos; data;</li>
          <li>probe, overload or break the service&apos;s security, or access accounts or events that aren&apos;t yours. Security researchers: please report issues to {OPERATOR.contactEmail}.</li>
        </ul>
        <p>We may remove content or suspend accounts that break these rules. Where reasonable we tell you why and give you a chance to respond.</p>
      </Section>

      <Section title="8. Liability">
        <p>SpeakerDesk is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect or consequential loss, lost profits or lost data, and our total liability is limited to the amount you paid us in the twelve months before the claim (or €100 if you paid nothing). Nothing in these terms limits liability that cannot be limited by law, such as for intent or gross negligence.</p>
        <p>Keep your own copies of important content; you can export your data at any time under <strong>Export</strong>.</p>
      </Section>

      <Section title="9. Changes to these terms">
        <p>When we change these terms materially, we publish a new version here, update the version number at the top, and ask you to review and accept it the next time you sign in. If you don&apos;t agree, you can delete your account.</p>
      </Section>

      <Section title="10. Governing law">
        <p>These terms are governed by the law of {OPERATOR.governingLaw}. Disputes go to the competent courts there, unless consumer protection law gives you the right to go to court where you live.</p>
      </Section>
    </LegalDoc>
  );
}
