import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import api from '../utils/api';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Zap } from 'lucide-react';

// ── Reusable input with icon ──────────────────────────────────────────────────
const IconInput = ({ icon: Icon, type, placeholder, value, onChange, rightElement, id }) => (
  <div style={{ position: 'relative' }}>
    <Icon
      size={18}
      style={{
        position: 'absolute', top: '50%', left: '14px',
        transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
      }}
    />
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required
      style={{
        width: '100%', padding: '13px 14px 13px 44px',
        borderRadius: '12px', border: '1.5px solid var(--border-color)',
        outline: 'none', fontSize: '1rem', background: 'rgba(255,255,255,0.04)',
        color: 'var(--text-main)', fontFamily: 'inherit',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,193,7,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
    />
    {rightElement && (
      <div style={{ position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)' }}>
        {rightElement}
      </div>
    )}
  </div>
);

// ── Main Login Page ───────────────────────────────────────────────────────────
const LoginPage = () => {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handle Google redirect result on mount
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          await handlePostLogin(result.user);
        }
      } catch (err) {
        setError(friendlyError(err));
      }
    };
    checkRedirect();
  }, []);

  // ── Post-login: check if profile complete → route accordingly ──
  const handlePostLogin = async (user) => {
    try {
      const res = await api.get(`/api/users/${user.uid}`);
      if (res.data.success && res.data.exists && res.data.user.profile_complete) {
        localStorage.setItem('userName', res.data.user.name || user.displayName || '');
        localStorage.setItem('userCollegeName', res.data.user.college_name || '');
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      console.error('Failed to fetch user profile post-login', err);
      navigate('/onboarding');
    }
  };

  // If user is already logged in, redirect away from login page
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) {
        // Only auto-redirect if there's no pending redirect result, to avoid race conditions
        getRedirectResult(auth).then(res => {
          if (!res) {
             handlePostLogin(user);
          }
        }).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  // ── Google Sign-In ──
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // It redirects the page, so no code runs after this
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Email + Password Sign-In ──
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await handlePostLogin(result.user);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Email + Password Registration ──
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password || !confirmPassword) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Save a partial user doc — onboarding will complete it
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: email.trim(),
        profile_complete: false,
        created_at: new Date().toISOString(),
        auth_method: 'email',
      }, { merge: true });
      navigate('/onboarding');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Helper: humanize Firebase errors ──
  const friendlyError = (err) => {
    const code = err.code || '';
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential'))
      return 'Incorrect email or password. Please try again.';
    if (code.includes('email-already-in-use'))
      return 'An account with this email already exists. Try signing in.';
    if (code.includes('weak-password'))
      return 'Password is too weak. Use at least 6 characters.';
    if (code.includes('invalid-email'))
      return 'Please enter a valid email address.';
    if (code.includes('popup-closed'))
      return 'Google sign-in was cancelled. Please try again.';
    return err.message?.replace('Firebase: ', '') || 'Something went wrong.';
  };

  const eyeBtn = (show, toggle) => (
    <button type="button" onClick={toggle}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
      {show ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '24px', background: 'var(--bg-color)',
      }}
    >
      {/* ── Logo ── */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--primary-gradient)', padding: '14px 22px',
          borderRadius: '24px', marginBottom: '18px',
          boxShadow: '0 12px 30px rgba(255,193,7,0.35)',
        }}>
          <Zap size={22} color="white" fill="white" style={{ marginRight: 6 }} />
          <span style={{ fontSize: '1.75rem', color: 'white', fontWeight: 900, letterSpacing: '-1px' }}>
            Zappit
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Welcome to Zappit</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
          The fastest campus delivery at your doorstep.
        </p>
      </div>

      {/* ── Card ── */}
      <div className="card" style={{ padding: '28px 24px', boxShadow: 'var(--shadow-md)' }}>

        {/* ── Tab switcher ── */}
        <div style={{
          display: 'flex', background: 'var(--bg-color)',
          borderRadius: '12px', padding: '4px', marginBottom: '24px',
          border: '1px solid var(--border-color)',
        }}>
          {[['login', 'Sign In'], ['register', 'Create Account']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); }}
              style={{
                flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
                transition: 'all 0.2s',
                background: tab === key ? 'var(--primary-gradient)' : 'transparent',
                color: tab === key ? 'white' : 'var(--text-muted)',
                boxShadow: tab === key ? '0 2px 8px rgba(255,193,7,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', color: '#FCA5A5',
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '12px 14px', borderRadius: '10px',
            fontSize: '0.875rem', marginBottom: '20px', fontWeight: 500,
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Email / Password Form ── */}
        <form onSubmit={tab === 'login' ? handleEmailLogin : handleEmailRegister}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email Address
            </label>
            <IconInput
              id="auth-email"
              icon={Mail}
              type="email"
              placeholder="you@college.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <IconInput
              id="auth-password"
              icon={Lock}
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              rightElement={eyeBtn(showPass, () => setShowPass(v => !v))}
            />
          </div>

          {/* Confirm Password (register only) */}
          {tab === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirm Password
              </label>
              <IconInput
                id="auth-confirm-password"
                icon={Lock}
                type={showConfirmPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                rightElement={eyeBtn(showConfirmPass, () => setShowConfirmPass(v => !v))}
              />
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '14px', marginTop: '4px',
              fontSize: '1rem', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                {tab === 'login' ? 'Signing In...' : 'Creating Account...'}
              </>
            ) : (
              <>
                {tab === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* ── Divider ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        </div>

        {/* ── Google Sign-In ── */}
        <button
          id="google-signin-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '13px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            background: 'white', color: '#374151',
            border: '1.5px solid #E5E7EB', fontWeight: 700,
            borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', fontSize: '0.95rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <img
            src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png"
            alt="Google"
            style={{ width: '20px', height: '20px' }}
          />
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        {/* ── Terms ── */}
        <p style={{ marginTop: '20px', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          By continuing, you agree to Zappit's{' '}
          <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>
          {' '}and{' '}
          <Link to="/privacy-policy" style={{ textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}>Privacy Policy</Link>.
        </p>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LoginPage;
