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

        <span className="inline-block bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold mb-6">
          Effective: February 15, 2026
        </span>

        <p>Duet (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the app&rdquo;) is an always-on voice communication app that lets you stay connected with the people who matter most. This Privacy Policy explains what information we collect, how we use it, and your choices.</p>

        <h2>1. Information We Collect</h2>

        <h3>Account Information</h3>
        <p>When you create an account, we collect:</p>
        <ul>
          <li><strong>Display name</strong> you choose or from your Google account</li>
          <li><strong>Email address</strong> if you sign in with email or Google</li>
          <li><strong>Profile photo</strong> if you choose to upload one</li>
          <li><strong>Authentication method</strong> (Google, email, or guest)</li>
        </ul>
        <p>You can also use Duet as a guest without providing any personal information.</p>

        <h3>Voice and Audio Data</h3>
        <p>Duet requires microphone access to enable real-time voice communication. <strong>Your audio is transmitted directly between devices using peer-to-peer (WebRTC) technology.</strong> We do not record, store, or have access to the content of your voice conversations. Audio data never passes through our servers.</p>

        <h3>Camera and Photos</h3>
        <p>Duet requests camera and photo library access only to let you set a profile picture. Photos are not accessed for any other purpose. Your profile picture is stored securely in Firebase Storage and is visible to your friends and room partners.</p>

        <h3>Connection and Room Data</h3>
        <p>When you create or join a room, we temporarily store:</p>
        <ul>
          <li>Room codes and membership information</li>
          <li>Technical connection data (WebRTC signaling) needed to establish the peer-to-peer link</li>
        </ul>
        <p>This data is automatically deleted when the room is closed or after 24 hours of inactivity.</p>

        <h3>Social Features</h3>
        <p>If you use our friends and connections features, we store:</p>
        <ul>
          <li>Your friends list and pending friend requests</li>
          <li>Your recent connections (last 20 partners you connected with)</li>
          <li>Your online/offline presence status</li>
        </ul>

        <h3>Device Information</h3>
        <p>We collect limited device information for app functionality:</p>
        <ul>
          <li><strong>Push notification token</strong> to send you notifications when your partner joins, when you receive a friend request, or when you&apos;re invited to a room</li>
          <li><strong>Platform</strong> (iOS, Android, or Web) for delivering notifications</li>
        </ul>

        <h3>Crash Reports</h3>
        <p>We use Firebase Crashlytics to collect crash reports and error logs. These include technical information about the error but do not contain personal data or audio content. Crash reporting helps us identify and fix bugs to improve app stability.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide and maintain the voice communication service</li>
          <li>Enable you to create and join rooms with other users</li>
          <li>Display your profile to friends and room partners</li>
          <li>Send push notifications about room activity, friend requests, and invitations</li>
          <li>Diagnose and fix technical issues via crash reports</li>
          <li>Display advertisements to support the free service</li>
        </ul>

        <h2>3. Advertising</h2>
        <p>Duet uses Google AdMob to display advertisements, including banner ads and interstitial ads. Google AdMob may collect and use data in accordance with <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google&apos;s Privacy Policy</a>. This may include device identifiers and ad interaction data to serve relevant ads. We do not share your personal information (name, email, or profile data) with advertisers.</p>

        <h2>4. Data Sharing</h2>
        <p>We do not sell your personal information. We share data only in the following limited ways:</p>
        <ul>
          <li><strong>With other Duet users:</strong> Your display name, profile photo, and online status are visible to your friends and room partners.</li>
          <li><strong>Firebase (Google):</strong> We use Firebase for authentication, database, storage, messaging, and crash reporting. Data is processed in accordance with <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">Firebase&apos;s privacy practices</a>.</li>
          <li><strong>Google AdMob:</strong> Ad-related data is processed by Google as described in Section 3.</li>
          <li><strong>WebRTC STUN/TURN servers:</strong> Technical connection data (IP addresses, network information) is used by STUN and TURN servers to establish peer-to-peer connections. This data is not stored.</li>
        </ul>

        <h2>5. Data Retention</h2>
        <ul>
          <li><strong>Room data:</strong> Automatically deleted after 24 hours of inactivity or when the room is closed.</li>
          <li><strong>Account data:</strong> Retained as long as your account exists.</li>
          <li><strong>Friend and connection data:</strong> Retained until you remove the friendship or delete your account.</li>
          <li><strong>Crash reports:</strong> Retained by Firebase Crashlytics per Google&apos;s retention policy (typically 90 days).</li>
          <li><strong>Push tokens:</strong> Removed when you sign out or delete your account.</li>
        </ul>

        <h2>6. Data Security</h2>
        <p>We use industry-standard security measures to protect your data:</p>
        <ul>
          <li>All data in transit is encrypted using TLS/HTTPS</li>
          <li>Voice audio is transmitted peer-to-peer with DTLS-SRTP encryption (WebRTC standard)</li>
          <li>Firebase Authentication handles credential security</li>
          <li>Profile images are stored in Firebase Storage with access controls</li>
        </ul>

        <h2>7. Your Choices and Rights</h2>
        <ul>
          <li><strong>Account deletion:</strong> You can request deletion of your account and associated data by contacting us.</li>
          <li><strong>Profile management:</strong> You can update your display name and profile photo at any time in the app.</li>
          <li><strong>Permissions:</strong> You can revoke camera, microphone, or notification permissions through your device or browser settings. Note that microphone access is required for the core voice communication feature.</li>
          <li><strong>Guest mode:</strong> You can use Duet without creating an account by continuing as a guest.</li>
          <li><strong>Friends:</strong> You can remove friends and decline friend requests at any time.</li>
        </ul>

        <h2>8. Children&apos;s Privacy</h2>
        <p>Duet is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us and we will delete it.</p>

        <h2>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or by updating the effective date at the top of this page. Your continued use of Duet after changes are posted constitutes your acceptance of the revised policy.</p>

        <h2>10. Contact Us</h2>
        <p>If you have questions about this Privacy Policy or your data, please contact us at:</p>
        <p><strong>Email:</strong> hello@getduet.app</p>
        <p>To request account deletion, visit our <Link href="/delete">account deletion page</Link>.</p>
      </div>

      {/* Footer */}
      <div className="text-center py-8 px-5 text-[#8a99a8] text-sm border-t border-[#e0dbd5]">
        <p>&copy; 2026 Duet. All rights reserved. | <Link href="/" className="text-primary hover:underline">Home</Link> | <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> | <Link href="/delete" className="text-primary hover:underline">Delete Account</Link></p>
      </div>
    </div>
  );
}
