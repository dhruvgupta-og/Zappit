import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { auth } from '../firebase';
import {
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
} from 'firebase/auth';
import { User, Phone, School, ChevronDown, ArrowRight, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

// ── Shared input style factory ─────────────────────────────────────────────────
const mkInputStyle = () => ({
  width: '100%', padding: '13px 13px 13px 44px',
  borderRadius: '12px', border: '1.5px solid var(--border-color)',
  outline: 'none', fontSize: '1rem', background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-main)', fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box',
});

// ── Step indicator ─────────────────────────────────────────────────────────────
const StepIndicator = ({ steps, current }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
    {steps.map((step, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%',
            background: done ? '#10B981' : active ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.08)',
            color: (done || active) ? 'white' : '#6B7280',
            fontWeight: 700, fontSize: '0.8rem',
            transition: 'all 0.3s',
            boxShadow: active ? '0 0 0 3px rgba(255,193,7,0.25)' : 'none',
          }}>
            {done ? '✓' : i + 1}
          </div>
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            color: active ? 'var(--primary)' : done ? '#10B981' : 'var(--text-muted)',
          }}>
            {step}
          </span>
          {i < steps.length - 1 && (
            <div style={{
              width: 20, height: 2,
              background: done ? '#10B981' : 'rgba(255,255,255,0.1)',
              borderRadius: 2, transition: 'background 0.3s',
            }} />
          )}
        </div>
      );
    })}
  </div>
);

// ── Main Onboarding Page ───────────────────────────────────────────────────────
const OnboardingPage = () => {
  const [step, setStep] = useState(0); // 0 = profile info, 1 = set password (Google users only)
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  // Step 0 fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [colleges, setColleges] = useState([]);

  // Step 1 fields (set password for Google users)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const inputStyle = mkInputStyle();

  useEffect(() => {
    // Fetch colleges from public MongoDB API
    api.get('/api/stores/colleges/all').then(res => {
      if (res.data.success) setColleges(res.data.colleges);
    }).catch(() => {});

    // Check if profile complete → redirect home
    const checkStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const res = await api.get(`/api/users/${user.uid}`);
        if (res.data.success && res.data.exists && res.data.user?.profile_complete === true) {
          window.location.href = '/';
          return;
        }
      } catch (e) {
        // If can't check, allow onboarding to proceed
      }

      // Determine sign-in method
      const providerIds = user.providerData.map(p => p.providerId);
      setIsGoogleUser(
        providerIds.includes('google.com') && !providerIds.includes('password')
      );

      // Pre-fill name from Google
      if (user.displayName) setName(user.displayName);
    };
    checkStatus();
  }, [navigate]);

  // ── STEP 0: Save profile info ──
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!college) { setError('Please select your college.'); return; }
    if (!phone.trim() || phone.length < 10) { setError('Please enter a valid 10-digit phone number.'); return; }

    if (isGoogleUser) {
      // Don't save to Firestore yet — go to password step first
      setStep(1);
      return;
    }

    // Email/password user — save directly
    await saveProfileToFirestore();
  };

  // ── STEP 1: Set password (Google users) ──
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPassword) { setError('Please enter a password.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const user = auth.currentUser;

      // Link email+password credential to the Google account
      const credential = EmailAuthProvider.credential(user.email, newPassword);
      try {
        await linkWithCredential(user, credential);
        console.log('[Zappit] Password linked to Google account.');
      } catch (linkErr) {
        // If credential already linked (e.g. re-onboarding), update password instead
        if (linkErr.code === 'auth/provider-already-linked' ||
            linkErr.code === 'auth/email-already-in-use') {
          await updatePassword(user, newPassword);
          console.log('[Zappit] Password updated for Google account.');
        } else {
          throw linkErr;
        }
      }

      await saveProfileToFirestore();
    } catch (err) {
      setError(err.message?.replace('Firebase: ', '') || 'Failed to set password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared: save profile to MongoDB + localStorage ──
  const saveProfileToFirestore = async () => {
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      const selectedCollege = colleges.find(c => c.id === college);
      const collegeName = selectedCollege ? selectedCollege.name : college;

      await api.post(`/api/users/${user.uid}`, {
        uid: user.uid,
        email: user.email || '',
        name: name.trim(),
        phone: phone.trim(),
        college_id: college,
        college: collegeName,
        college_name: collegeName,
        address: 'Engineering Block A',
        profile_complete: true,
        auth_method: isGoogleUser ? 'google' : 'email',
        updated_at: new Date().toISOString(),
      });

      localStorage.setItem('userName', name.trim());
      localStorage.setItem('userCollegeId', college);
      localStorage.setItem('userCollegeName', collegeName);
      localStorage.setItem('userCollege', collegeName);
      localStorage.setItem('userAddress', 'Engineering Block A');

      // Send welcome email
      try {
        await api.post('/api/send-welcome-email', {
          email: user.email || '',
          name: name.trim(),
          college: collegeName,
        });
      } catch (emailErr) {
        console.error('[Zappit] Welcome email failed:', emailErr);
      }

      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  // Steps array — Google users have an extra password step
  const steps = isGoogleUser ? ['Profile', 'Password', 'Order'] : ['Profile', 'Order'];
  const currentStep = isGoogleUser ? step : Math.min(step, 0);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-color)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px',
    }}>
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          display: 'inline-flex', background: 'var(--primary-gradient)',
          padding: '12px 20px', borderRadius: '20px', marginBottom: '14px',
          boxShadow: '0 10px 25px rgba(255,193,7,0.3)',
        }}>
          <span style={{ fontSize: '1.4rem', color: 'white', fontWeight: 900, letterSpacing: '-1px' }}>
            ⚡ Zappit
          </span>
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '0 0 6px' }}>
          {step === 0 ? 'Complete Your Profile' : 'Set Your Password'}
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          {step === 0
            ? 'Just a few details so we know where to deliver!'
            : 'Secure your account with a password.'}
        </p>
      </div>

      {/* ── Step Indicator ── */}
      <StepIndicator steps={steps} current={currentStep} />

      {/* ── Card ── */}
      <div className="card" style={{ padding: '24px', boxShadow: 'var(--shadow-md)' }}>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', color: '#FCA5A5',
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '12px 14px', borderRadius: '10px',
            fontSize: '0.875rem', marginBottom: '16px', fontWeight: 500,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ══ STEP 0: Profile Info ══ */}
        {step === 0 && (
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Full Name */}
            <div>
              <label style={labelStyle}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={iconStyle} />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Dhruv Sharma"
                  required
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={iconStyle} />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  required
                  maxLength={10}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                {phone.length === 10 && (
                  <CheckCircle size={16} style={{ position: 'absolute', top: '50%', right: 13, transform: 'translateY(-50%)', color: '#10B981' }} />
                )}
              </div>
            </div>

            {/* College */}
            <div>
              <label style={labelStyle}>College / University</label>
              <div style={{ position: 'relative' }}>
                <School size={18} style={{ ...iconStyle, zIndex: 1 }} />
                <ChevronDown size={16} style={{ position: 'absolute', top: '50%', right: 13, transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <select
                  value={college}
                  onChange={e => setCollege(e.target.value)}
                  required
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', color: college ? 'var(--text-main)' : '#6B7280' }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                >
                  <option value="">-- Select your college --</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.city ? `, ${c.city}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '15px', marginTop: '4px', fontSize: '1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {loading ? 'Saving...' : isGoogleUser ? (
                <>Next: Set Password <ArrowRight size={18} /></>
              ) : (
                <>Start Ordering <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        )}

        {/* ══ STEP 1: Set Password (Google users only) ══ */}
        {step === 1 && isGoogleUser && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)',
              borderRadius: '10px', padding: '12px 14px', marginBottom: '4px',
              fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5,
            }}>
              🔐 <strong style={{ color: 'var(--text-main)' }}>Set a password</strong>{' '}
              so you can sign in with email + password anytime, not just Google.
            </div>

            {/* New Password */}
            <div>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={iconStyle} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', top: '50%', right: 13, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={iconStyle} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', top: '50%', right: 13, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {confirmPassword && newPassword === confirmPassword && (
                  <CheckCircle size={16} style={{ position: 'absolute', top: '50%', right: 44, transform: 'translateY(-50%)', color: '#10B981' }} />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '15px', marginTop: '4px', fontSize: '1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {loading ? (
                <>
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Saving...
                </>
              ) : (
                <>Set Password & Start Ordering <ArrowRight size={18} /></>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep(0)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0', marginTop: '-4px' }}
            >
              ← Back to profile
            </button>
          </form>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Shared micro-styles ────────────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px',
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const iconStyle = {
  position: 'absolute', top: '50%', left: '13px',
  transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
};

const focusStyle = (e) => {
  e.target.style.borderColor = 'var(--primary)';
  e.target.style.boxShadow = '0 0 0 3px rgba(255,193,7,0.15)';
};

const blurStyle = (e) => {
  e.target.style.borderColor = 'var(--border-color)';
  e.target.style.boxShadow = 'none';
};

export default OnboardingPage;
