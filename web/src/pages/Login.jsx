import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for redirect result when the page loads
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const user = result.user;
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().profile_complete) {
            localStorage.setItem('userName', userDoc.data().name || user.displayName);
            localStorage.setItem('userCollegeName', userDoc.data().college_name);
            navigate('/');
          } else {
            navigate('/onboarding');
          }
        }
      } catch (err) {
        console.error("Redirect Error:", err);
        setError(err.message.replace('Firebase: ', ''));
      }
    };
    checkRedirect();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    console.log("Google Login Clicked");
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Use popup for more immediate feedback
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Login Success:", user.email);

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().profile_complete) {
        localStorage.setItem('userName', userDoc.data().name || user.displayName);
        localStorage.setItem('userCollegeName', userDoc.data().college_name);
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', background: 'var(--bg-color)' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ display: 'inline-flex', background: 'var(--primary-gradient)', padding: '16px 20px', borderRadius: '24px', marginBottom: '16px', boxShadow: '0 10px 25px rgba(255, 81, 47, 0.3)' }}>
          <span style={{ fontSize: '1.75rem', color: 'white', fontWeight: 900, letterSpacing: '-1px' }}>Zappit</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Welcome to Zappit</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          The fastest campus delivery at your doorstep.
        </p>
      </div>

      <div className="card" style={{ padding: '32px 24px', boxShadow: 'var(--shadow-md)', textAlign: 'center' }}>
        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '24px', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <p style={{ marginBottom: '24px', color: 'var(--text-main)', fontWeight: 500 }}>
          Sign in or create an account to start ordering.
        </p>

        <button 
          onClick={handleGoogleLogin} 
          className="btn" 
          style={{ 
            width: '100%', 
            padding: '14px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px',
            background: 'white',
            color: '#374151',
            border: '1px solid #D1D5DB',
            fontWeight: 600,
            borderRadius: '12px',
            transition: 'all 0.2s'
          }} 
          disabled={loading}
        >
          <img src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png" alt="Google" style={{ width: '20px' }} />
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        <div style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          By continuing, you agree to Zappit's <br />
          <span style={{ textDecoration: 'underline' }}>Terms of Service</span> and <span style={{ textDecoration: 'underline' }}>Privacy Policy</span>.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
