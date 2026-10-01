import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Duet',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] text-lobby-dark">
      {/* Header */}
      <div className="bg-lobby-dark text-white py-10 px-5 text-center">
        <h1 className="text-3xl font-bold mb-1">Duet Privacy Policy</h1>
        <p className="text-sm opacity-70">
          <Link href="/" className="text-primary hover:underline">getduet.app</Link>
        </p>
      </div>

      {/* Content */}
      <div className="max-w-[720px] mx-auto px-5 py-10 pb-20 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:mt-9 [&_h2]:mb-3 [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[#2d3e50] [&_p]:text-[15px] [&_p]:text-[#3d4f5f] [&_p]:mb-3 [&_ul]:pl-6 [&_ul]:mb-4 [&_li]:text-[15px] [&_li]:text-[#3d4f5f] [&_li]:mb-1.5 [&_a]:text-primary [&_a]:no-underline [&_a:hover]:underline">

        {/* NEEDS COUNSEL: confirm the effective date for this revision, and whether
            users must be notified of the changes (e.g. by email or in-app). */}
        <span className="inline-block bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold mb-6">
          Last updated: October 1, 2026
        </span>

        {/* NEEDS COUNSEL: the policy does not name the legal entity (data
            controller), its address, legal bases for processing, international
            data transfers, or region-specific rights (GDPR/UK GDPR, CCPA/CPRA). */}
        <p>Duet (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the app&rdquo;) is a voice communication app that keeps you connected with the people who matter most. This Privacy Policy explains what we collect, how we use it, and your choices.</p>

        <h2>1. Information We Collect</h2>

        <h3>Account Information</h3>
        <p>When you create an account, we collect your display name, email address, profile photo (if you add one), and how you signed in (Apple, Google, or email). We also give you a friend code so others can add you. You can use Duet as a guest without providing any personal information; guests get an anonymous account ID.</p>

        <h3>Microphone and Voice Audio</h3>
        <p>Duet needs microphone access to carry your voice. While you&apos;re in a room, the microphone stays on, including when Duet is in the background or your screen is locked, so you can keep talking hands-free. Your phone shows its usual microphone indicator, and on Android a notification stays visible while you&apos;re in a room. You can mute at any time.</p>
        <p><strong>Your audio goes directly between your phone and the other person&apos;s phone whenever possible. When a direct connection isn&apos;t possible, for example on some mobile or workplace networks, it passes through our own relay server, encrypted, so the relay can&apos;t listen to it. Your audio is never recorded or stored.</strong></p>

        <h3>Camera and Photos</h3>
        <p>Camera and photo library access is used only for setting a profile picture. Your profile photo is stored in Google Firebase Storage and shown to your friends and room partners.</p>

        <h3>Room Data</h3>
        <p>When you create or join a room, we store the room code, who is in the room, and the technical details needed to connect you. This data is deleted when everyone leaves the room. If a room is left behind (for example, after an app crash), it is deleted automatically once no one has been connected to it for a while, normally within a day.</p>

        <h3>Social Features</h3>
        <p>If you use social features, we store your friends list and pending friend requests, room invitations, your recent connections (who you talked with, when, and the room code), the last person you connected with (for quick reconnect), and your online status and last-seen time.</p>

        <h3>Safety: Blocking and Reports</h3>
        <p>If you block someone, we store that on your account so they can&apos;t send you friend requests or invitations or join rooms you create; they aren&apos;t told. If you report someone, we store your report (who you reported, the reason, any details you add, the room code if it happened in a room, and when) so our team can review it. The person you report isn&apos;t told who reported them. Audio is never recorded, so reports are based on what you tell us.</p>

        <h3>Device Information</h3>
        <p>We store a push notification token for each device you use and its platform (iOS, Android, or Web), so we can notify you about room activity, friend requests, and invitations.</p>

        <h3>Usage Information</h3>
        <p>We record how the app is used: for example sign-ins, rooms created or joined, whether connections succeed, how long sessions last, and whether notifications are opened. These events are stored with your account ID in our database and sent to Google Analytics for Firebase. We use them to keep Duet working, improve it, and decide which emails to send you.</p>

        <h3>Crash Reports</h3>
        <p>When the app crashes or hits an error, Google Firebase Crashlytics collects a report with device and app details and recent technical logs, which can include room codes and account IDs. Crash reports don&apos;t include your name, email address, or any audio.</p>

        <h3>Email</h3>
        <p>If your account has an email address, we send emails through our email provider, Resend: a welcome email, tips, occasional reminders if you haven&apos;t used Duet in a while, and announcements. These emails contain links that tell us when an email is opened or a link is clicked. Every one of them includes an unsubscribe link, and you can turn them off in your Duet profile settings.</p>

        <h3>Content Hub</h3>
        <p>The Content Hub shows podcasts, music, and sports items that our servers collect from Spotify, Podcast Index, and TheSportsDB. We don&apos;t send those services anything about you. Images in the Content Hub load directly from those services, which see your device&apos;s IP address as any website would. Opening an item takes you to that service&apos;s app or website, where its own privacy policy applies.</p>

        <h3>Location</h3>
        {/* NEEDS COUNSEL: earlier app versions looked up the user's city from their
            IP address via ipapi.co without disclosing it. That lookup has been
            removed; decide whether the past processing needs to be disclosed. */}
        <p>Duet does not use GPS or ask for your location. Like any internet service, the services listed in this policy see your IP address when your device connects to them.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide and maintain the voice communication service</li>
          <li>Enable you to create and join rooms</li>
          <li>Display your profile to friends and room partners</li>
          <li>Send push notifications about room activity, friend requests, and invitations</li>
          <li>Send the emails described above</li>
          <li>Understand how Duet is used and improve it</li>
          <li>Prevent abuse, such as limiting how many rooms or invitations an account can create</li>
          <li>Diagnose and fix technical issues</li>
          <li>Display advertisements to support the free service</li>
        </ul>

        <h2>3. Advertising</h2>
        {/* NEEDS COUNSEL: whether personalized ads (with consent) count as "selling"
            or "sharing" under CCPA/CPRA, and whether a "Do Not Sell or Share" link and
            US-state privacy messages (AdMob Privacy & messaging) are required. The
            consent messages themselves are configured in the AdMob and AdSense
            dashboards, not in this code. */}
        <p>Duet displays ads to support the free service. On mobile, Google AdMob serves native, full-screen, and rewarded video ads. On the web, Google AdSense serves display ads. Google may collect device identifiers (such as your device&apos;s advertising ID), your IP address, and ad interaction data, as described in <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google&apos;s Privacy Policy</a>. We do not give advertisers your name, email address, or profile.</p>
        <p>Where the law requires it (for example in the European Economic Area, the UK and Switzerland), we ask for your consent before ads are personalized, using Google&apos;s consent message; you can change your choice at any time with <strong>Ad Privacy Choices</strong> in your Profile. On iPhone, ads use your device&apos;s advertising identifier only if you allow tracking when asked; you can change this in iOS Settings &gt; Privacy &amp; Security &gt; Tracking. Users under 18 only ever see non-personalized ads and are never asked to allow tracking.</p>

        <h2>4. Data Sharing</h2>
        {/* NEEDS COUNSEL: "We do not sell your personal information" must be checked
            against how ad data is used (see section 3). */}
        <p>We do not sell your personal information. We share data only in the following ways:</p>
        <ul>
          <li><strong>With other Duet users:</strong> Your display name and profile photo are shown to your friends and room partners. Someone who already knows your exact email address or friend code can find you to send a friend request; they see only your display name and photo, never your email address. Only your accepted friends can see your online status and last-seen time, and if you have push notifications on, your friends may be notified when you come online.</li>
          <li><strong>Service providers:</strong> Google Firebase runs our core infrastructure (sign-in, database, file storage, server functions, push notifications, analytics, and crash reporting); see <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">Firebase&apos;s privacy information</a>. Google also provides our advertising, as described above. Resend sends our emails, and Vercel hosts this website.</li>
          <li><strong>Connection servers:</strong> To find a direct connection, the app contacts Google&apos;s public STUN servers, which see your IP address but never your audio. When audio passes through our own relay server, the relay sees your IP address and encrypted audio it can&apos;t decrypt. It keeps short technical logs, such as IP addresses, connection times and your account ID (relay access is issued per account and expires after 24 hours), and never stores audio.</li>
        </ul>

        <h2>5. Data Retention</h2>
        {/* NEEDS COUNSEL / OPS: confirm retention periods for usage events (currently
            kept for the life of the account), Google Analytics (set in the Firebase
            console), email open/click records, and relay server logs (log rotation is
            not configured), then state them here. */}
        <ul>
          <li><strong>Room data:</strong> Deleted when everyone leaves the room, and automatically once no one has been connected to it for a while (normally within a day).</li>
          <li><strong>Account data:</strong> Retained as long as your account exists.</li>
          <li><strong>Social data:</strong> Retained until you remove the connection or delete your account. Your block list is deleted with your account.</li>
          {/* NEEDS COUNSEL: retention period for safety reports and moderation records */}
          <li><strong>Safety reports:</strong> Kept for as long as needed to review them and keep Duet safe, including after the reporter or the reported person deletes their account.</li>
          <li><strong>Usage information:</strong> Retained as long as your account exists.</li>
          <li><strong>Crash reports:</strong> Retained by Firebase Crashlytics for 90 days.</li>
        </ul>

        <h2>6. Data Security</h2>
        <p>Data sent between the app and our services is encrypted in transit. Voice audio is encrypted between the two phones, including when it passes through our relay. Sign-in is handled by Firebase Authentication, and access to stored data is restricted by security rules.</p>

        <h2>7. Your Choices and Rights</h2>
        {/* NEEDS COUNSEL: region-specific rights (access, correction, portability,
            objection, appeal) and how to exercise them. */}
        <ul>
          <li><strong>Account deletion:</strong> You can delete your account and associated data at any time, immediately, from your Profile in the app or on the web (guests too). If you can&apos;t sign in, use our <Link href="/delete">account deletion page</Link> or email us.</li>
          <li><strong>Profile management:</strong> You can update your display name and profile photo within the app.</li>
          <li><strong>Emails and notifications:</strong> You can unsubscribe from emails using the link in any email, and turn emails or push notifications off in your Duet profile settings.</li>
          <li><strong>Permissions:</strong> You can revoke camera, microphone, or notification permissions through your device or browser settings. Microphone access is required for voice communication.</li>
          <li><strong>Guest mode:</strong> You can use Duet without creating an account.</li>
          <li><strong>Friends:</strong> You can remove friends and decline friend requests at any time.</li>
          <li><strong>Blocking and reporting:</strong> You can block or report someone from a room or your friends list, and unblock them from your friends list.</li>
        </ul>

        <h2>8. Children&apos;s Privacy</h2>
        {/* NEEDS COUNSEL: confirm 13 as the minimum age for every market (the age of
            digital consent is up to 16 in parts of the EU), whether an existing
            account must be deleted when the gate shows the user is under 13, and
            that the store age ratings match. */}
        <p>Duet is for people 13 and over. The first time you open Duet, we ask for your birth month and year. We keep only an age range (under 16, 16 to 17, or 18 and over) on your device, not your birth date, and use it to keep ads age-appropriate: users under 18 only see non-personalized ads. If you are under 13, you can&apos;t use Duet. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it.</p>

        <h2>9. Changes to This Policy</h2>
        {/* NEEDS COUNSEL: whether "continued use constitutes acceptance" is enough
            notice for material changes. */}
        <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the date at the top of this page. Continued use of Duet after changes are posted constitutes acceptance of the revised policy.</p>

        <h2>10. Contact Us</h2>
        <p>If you have questions about this Privacy Policy or your data, contact us at:</p>
        <p><strong>Email:</strong> hello@getduet.app</p>
        <p>To delete your account, use <strong>Delete Account</strong> in your Profile, or visit our <Link href="/delete">account deletion page</Link>.</p>
      </div>

      {/* Footer */}
      <div className="text-center py-8 px-5 text-[#8a99a8] text-sm border-t border-[#e0dbd5]">
        <p>&copy; 2026 Duet. All rights reserved. | <Link href="/" className="text-primary hover:underline">Home</Link> | <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> | <Link href="/delete" className="text-primary hover:underline">Delete Account</Link></p>
      </div>
    </div>
  );
}
