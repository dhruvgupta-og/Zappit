import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-color)',
      color: 'var(--text-main)',
      fontFamily: 'Outfit, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Link to="/" style={{ color: 'white', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={22} />
        </Link>
        <Shield size={22} color="white" />
        <h1 style={{ color: 'white', margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
          Privacy Policy
        </h1>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
            borderRadius: 16,
            padding: '12px 24px',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: 2 }}>⚡ ZAPPIT</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Last updated: June 21, 2026
          </p>
        </div>

        {/* Intro */}
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
            Welcome to Zappit ("we", "our", or "us"). We are a campus food and delivery platform designed to connect students with their favourite campus stores for quick, convenient delivery. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use the Zappit web application available at{' '}
            <a href="https://zappit.shop" style={{ color: 'var(--primary)' }}>zappit.shop</a>.
          </p>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 0 }}>
            By using our service, you agree to the terms described in this policy. If you do not agree, please discontinue use of our platform.
          </p>
        </Section>

        <SectionTitle>1. Information We Collect</SectionTitle>
        <Section>
          <SubTitle>1.1 Information You Provide Directly</SubTitle>
          <BulletList items={[
            'Full name and phone number (collected during onboarding)',
            'Email address (obtained from your Google account via Firebase Authentication)',
            'Delivery address (provided at checkout)',
            'Your college / university affiliation',
            'Order history and preferences',
          ]} />

          <SubTitle>1.2 Information Collected Automatically</SubTitle>
          <BulletList items={[
            'Firebase Authentication tokens and user identifiers (UID)',
            'FCM (Firebase Cloud Messaging) tokens for push notification delivery',
            'Device and browser information (user agent, IP address)',
            'Usage patterns and page navigation data',
            'Order metadata including timestamps, store IDs, and payment status',
          ]} />

          <SubTitle>1.3 Payment Information</SubTitle>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
            Zappit does not store your card details, UPI credentials, or any raw payment instrument data. All payment processing is handled securely by <strong style={{ color: 'var(--text-main)' }}>Razorpay</strong>, a PCI DSS-compliant payment gateway. We only store the Razorpay Order ID and Payment ID for order tracking and dispute resolution.
          </p>
        </Section>

        <SectionTitle>2. How We Use Your Information</SectionTitle>
        <Section>
          <BulletList items={[
            'To authenticate your account securely via Google Sign-In',
            'To process and fulfil your food delivery orders',
            'To send you real-time order status push notifications (FCM)',
            'To send order confirmation emails (via Resend)',
            'To calculate and display applicable delivery fees and platform charges',
            'To apply coupon codes and discounts correctly',
            'To allow store owners and delivery staff to manage orders assigned to them',
            'To prevent fraud, abuse, and unauthorised access',
            'To improve our platform and resolve technical issues',
          ]} />
        </Section>

        <SectionTitle>3. How We Share Your Information</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            We do not sell your personal information to any third party. We share data only in the following limited circumstances:
          </p>
          <BulletList items={[
            'With campus store owners: Your name, delivery address, order items, and order ID are shared with the relevant store to fulfil your order.',
            'With delivery partners: Your delivery address and order details are shared with delivery staff assigned to your college.',
            'With Razorpay: Transaction data is shared with Razorpay solely for payment processing.',
            'With Firebase / Google: Authentication and push notification services are provided by Google Firebase.',
            'With Resend: Your email address and order details are processed by Resend to deliver order confirmation emails.',
            'When required by law: We may disclose information if legally obligated by a court order, government authority, or to prevent harm.',
          ]} />
        </Section>

        <SectionTitle>4. Data Storage and Security</SectionTitle>
        <Section>
          <BulletList items={[
            'User profiles and order records are stored in a MongoDB database hosted on MongoDB Atlas with encryption at rest.',
            'Authentication is managed by Google Firebase, which is SOC 2 Type II and ISO 27001 certified.',
            'All communications between your browser and our servers use HTTPS/TLS encryption.',
            'Access to your data is restricted by role-based access control — customers can only see their own orders, store owners can only see their own store\'s orders, and delivery staff can only see orders assigned to their college.',
            'We regularly review access controls to prevent unauthorised data access.',
          ]} />
        </Section>

        <SectionTitle>5. Cookies and Local Storage</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            Zappit uses browser local storage (not traditional cookies) to remember user preferences such as your delivery address and college name between sessions. This data is stored locally on your device and is not transmitted to our servers independently. Firebase Authentication may use session cookies to keep you signed in.
          </p>
        </Section>

        <SectionTitle>6. Push Notifications</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            With your permission, we send push notifications to update you on your order status (e.g. "Order Accepted", "Out for Delivery", "Delivered"). Notifications are powered by Firebase Cloud Messaging (FCM). Your FCM device token is stored securely in our database and is used solely for delivering order-related notifications. You may revoke notification permission at any time via your browser settings.
          </p>
        </Section>

        <SectionTitle>7. Data Retention</SectionTitle>
        <Section>
          <BulletList items={[
            'Your account and profile data is retained for as long as you have an active Zappit account.',
            'Order records are retained for a minimum of 1 year for accounting, dispute resolution, and legal compliance purposes.',
            'If you request account deletion, we will remove your personal profile data within 30 days, subject to any legal retention obligations.',
          ]} />
        </Section>

        <SectionTitle>8. Your Rights</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            Depending on your location, you may have the following rights regarding your personal data:
          </p>
          <BulletList items={[
            'Right to access: Request a copy of the personal data we hold about you.',
            'Right to correction: Request that we correct inaccurate or incomplete data.',
            'Right to deletion: Request that we delete your account and personal data.',
            'Right to restrict processing: Ask us to pause the processing of your data.',
            'Right to withdraw consent: Withdraw push notification permissions at any time via browser settings.',
          ]} />
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 0 }}>
            To exercise any of these rights, please contact us at{' '}
            <a href="mailto:zappit.shop@gmail.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>zappit.shop@gmail.com</a>.
          </p>
        </Section>

        <SectionTitle>9. Children's Privacy</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
            Zappit is designed for use by university and college students. Our services are not directed at children under the age of 13. We do not knowingly collect personal data from children under 13. If you believe we have inadvertently collected such information, please contact us immediately so we can delete it.
          </p>
        </Section>

        <SectionTitle>10. Third-Party Services</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            Our platform integrates with the following third-party services, each with their own privacy policies:
          </p>
          <BulletList items={[
            'Google Firebase (Authentication, Cloud Messaging) — firebase.google.com/support/privacy',
            'Razorpay (Payment Processing) — razorpay.com/privacy',
            'MongoDB Atlas (Database Hosting) — mongodb.com/legal/privacy-policy',
            'Resend (Transactional Email) — resend.com/legal/privacy-policy',
            'Render (Backend Hosting) — render.com/privacy',
            'Vercel (Frontend Hosting) — vercel.com/legal/privacy-policy',
          ]} />
        </Section>

        <SectionTitle>11. Changes to This Policy</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
            We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. For significant changes, we will notify you via the app or email. Continued use of Zappit after changes constitutes your acceptance of the updated policy.
          </p>
        </Section>

        <SectionTitle>12. Contact Us</SectionTitle>
        <Section>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please reach out to us:
          </p>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,193,7,0.1) 0%, rgba(255,152,0,0.1) 100%)',
            border: '1px solid rgba(255,193,7,0.3)',
            borderRadius: 12,
            padding: '20px 24px',
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: 'var(--text-main)' }}>⚡ Zappit</p>
            <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>
              📧 <a href="mailto:zappit.shop@gmail.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>zappit.shop@gmail.com</a>
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              🌐 <a href="https://zappit.shop" style={{ color: 'var(--primary)', fontWeight: 600 }}>zappit.shop</a>
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
};

// ── Helper Components ──

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    margin: '28px 0 10px',
    paddingLeft: 12,
    borderLeft: '3px solid var(--primary)',
  }}>
    {children}
  </h2>
);

const SubTitle = ({ children }) => (
  <h3 style={{
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-main)',
    margin: '18px 0 8px',
  }}>
    {children}
  </h3>
);

const Section = ({ children }) => (
  <div style={{
    background: 'var(--card-bg, rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '18px 20px',
    marginBottom: 4,
  }}>
    {children}
  </div>
);

const BulletList = ({ items }) => (
  <ul style={{ margin: '8px 0', paddingLeft: 20, color: 'var(--text-muted)', lineHeight: 2 }}>
    {items.map((item, i) => (
      <li key={i} style={{ marginBottom: 4 }}>{item}</li>
    ))}
  </ul>
);

export default PrivacyPolicy;
