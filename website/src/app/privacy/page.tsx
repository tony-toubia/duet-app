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
          Effective: February 20, 2026
        </span>

        <p>Duet (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the app&rdquo;) is a voice communication app that keeps you connected with the people who matter most. This Privacy Policy explains what we collect, how we use it, and your choices.</p>

        <h2>1. Information We Collect</h2>

        <h3>Account Information</h3>
        <p>When you create an account, we collect your display name, email address, and profile photo (if you choose to add one). You can also use Duet as a guest without providing any personal information.</p>

        <h3>Voice and Audio</h3>
        <p>Duet requires microphone access for voice communication. <strong>Your audio is sent directly between devices using peer-to-peer technology and never passes through our servers.</strong> We do not record, store, or have access to the content of your conversations.</p>

        <h3>Camera and Photos</h3>
        <p>Camera and photo library access is used only for setting a profile picture. Your profile photo is stored securely and visible to your friends and room partners.</p>

        <h3>Room Data</h3>
        <p>When you create or join a room, we temporarily store room codes, membership, and the technical data needed to establish your connection. This data is automatically deleted when the room closes or after 24 hours of inactivity.</p>

        <h3>Social Features</h3>
        <p>If you use our social features, we store your friends list, recent connections, and online status.</p>

        <h3>Device Information</h3>
        <p>We collect your push notification token and device platform (iOS, Android, or Web) so we can notify you about room activity, friend requests, and invitations.</p>

        <h3>Crash Reports</h3>
        <p>We collect anonymous crash reports and error logs to help us find and fix bugs. These do not contain personal data or audio content.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide and maintain the voice communication service</li>
          <li>Enable you to create and join rooms</li>
          <li>Display your profile to friends and room partners</li>
          <li>Send push notifications about room activity and friend requests</li>
          <li>Diagnose and fix technical issues</li>
          <li>Display advertisements to support the free service</li>
        </ul>

        <h2>3. Advertising</h2>
        <p>Duet displays ads to support the free service, including banner ads, interstitial ads, and rewarded video ads. On mobile, ads are served by Google AdMob. On the web, ads may be served using the Google Interactive Media Ads (IMA) SDK or Google AdSense. These services may collect device identifiers and ad interaction data in accordance with <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google&apos;s Privacy Policy</a>. We do not share your personal information (name, email, or profile data) with advertisers.</p>

        <h2>4. Data Sharing</h2>
        <p>We do not sell your personal information. We share data only in the following limited ways:</p>
        <ul>
          <li><strong>With other Duet users:</strong> Your display name, profile photo, and online status are visible to your friends and room partners.</li>
          <li><strong>Service providers:</strong> We use Google Firebase for core app infrastructure (authentication, database, storage, messaging, and crash reporting) and Google&apos;s advertising services as described above. Data is processed in accordance with <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">Google&apos;s privacy practices</a>.</li>
          <li><strong>Connection servers:</strong> Limited network information is used to establish peer-to-peer voice connections and is not stored.</li>
        </ul>

        <h2>5. Data Retention</h2>
        <ul>
          <li><strong>Room data:</strong> Automatically deleted when the room closes or after 24 hours of inactivity.</li>
          <li><strong>Account data:</strong> Retained as long as your account exists.</li>
          <li><strong>Social data:</strong> Retained until you remove the connection or delete your account.</li>
          <li><strong>Crash reports:</strong> Retained per Google&apos;s standard retention policy (typically 90 days).</li>
        </ul>

        <h2>6. Data Security</h2>
        <p>We use industry-standard security measures to protect your data, including encryption for all data in transit and peer-to-peer encryption for voice audio. Account credentials are managed by Firebase Authentication, and stored files are protected with access controls.</p>

        <h2>7. Your Choices and Rights</h2>
        <ul>
          <li><strong>Account deletion:</strong> You can request deletion of your account and all associated data at any time.</li>
          <li><strong>Profile management:</strong> You can update your display name and profile photo within the app.</li>
          <li><strong>Permissions:</strong> You can revoke camera, microphone, or notification permissions through your device or browser settings. Microphone access is required for voice communication.</li>
          <li><strong>Guest mode:</strong> You can use Duet without creating an account.</li>
          <li><strong>Friends:</strong> You can remove friends and decline friend requests at any time.</li>
        </ul>

        <h2>8. Children&apos;s Privacy</h2>
        <p>Duet is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it.</p>

        <h2>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the effective date at the top of this page. Continued use of Duet after changes are posted constitutes acceptance of the revised policy.</p>

        <h2>10. Contact Us</h2>
        <p>If you have questions about this Privacy Policy or your data, contact us at:</p>
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
