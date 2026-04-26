import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Eye, EyeOff, LogIn } from 'lucide-react';

const StaffLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?type=store  OR  ?type=delivery
  const loginType = searchParams.get('type') || 'store';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isStore = loginType === 'store';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Fetch the staff profile from Firestore
      const snap = await getDoc(doc(db, 'staff', uid));
      if (!snap.exists()) {
        await signOut(auth);
        setError('No staff profile found for this account. Contact your admin.');
        setLoading(false);
        return;
      }

      const profile = snap.data();
      const expectedRole = isStore ? 'store_owner' : 'delivery';

      if (profile.role !== expectedRole) {
        await signOut(auth);
        setError(`This account is not a ${isStore ? 'store owner' : 'delivery partner'}. Use the correct login page.`);
        setLoading(false);
        return;
      }

      // Store the staff profile in sessionStorage for dashboards to read
      sessionStorage.setItem('staff_uid', uid);
      sessionStorage.setItem('staff_role', profile.role);
      sessionStorage.setItem('staff_name', profile.name || '');

      if (isStore) {
        sessionStorage.setItem('staff_store_id', profile.store_id || '');
        sessionStorage.setItem('staff_store_name', profile.store_name || '');
        navigate('/store-dashboard');
      } else {
        sessionStorage.setItem('staff_college_id', profile.college_id || '');
        sessionStorage.setItem('staff_college_name', profile.college_name || '');
        navigate('/delivery-dashboard');
      }

    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0B132B 0%, #1E293B 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>
          {isStore ? '🏪' : '🛵'}
        </div>
        <h1 style={{ color: 'white', margin: '0 0 4px', fontSize: '1.75rem', fontWeight: 900 }}>
          Zappit
        </h1>
        <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.9rem' }}>
          {isStore ? 'Store Owner Portal' : 'Delivery Partner Portal'}
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: '#1E293B',
        borderRadius: 20,
        padding: '32px 24px',
        width: '100%',
        maxWidth: 400,
        border: '1px solid #334155'
      }}>
        <h2 style={{ color: 'white', margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800 }}>
          {isStore ? 'Store Login' : 'Delivery Login'}
        </h2>
        <p style={{ color: '#94A3B8', margin: '0 0 24px', fontSize: '0.85rem' }}>
          Your credentials are assigned by the admin.
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', padding: '12px', borderRadius: 10, fontSize: '0.875rem', marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="staff@zappit.in"
              required
              style={{
                width: '100%', padding: '13px 14px', borderRadius: 10,
                border: '1.5px solid #334155', background: '#0B132B',
                color: 'white', fontSize: '1rem', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '13px 44px 13px 14px', borderRadius: 10,
                  border: '1.5px solid #334155', background: '#0B132B',
                  color: 'white', fontSize: '1rem', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading ? '#334155' : 'linear-gradient(135deg, #FFC107 0%, #FF8F00 100%)',
              color: loading ? '#94A3B8' : '#0B132B',
              border: 'none', borderRadius: 12,
              fontWeight: 800, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 4, transition: 'all 0.2s'
            }}
          >
            {loading ? 'Signing in...' : (
              <>
                <LogIn size={18} />
                {isStore ? 'Enter Store Dashboard' : 'Enter Delivery Dashboard'}
              </>
            )}
          </button>
        </form>

        {/* Switch type link */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a
            href={`/staff-login?type=${isStore ? 'delivery' : 'store'}`}
            style={{ color: '#64748B', fontSize: '0.8rem', textDecoration: 'none' }}
          >
            {isStore ? '🛵 I am a Delivery Partner →' : '🏪 I am a Store Owner →'}
          </a>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;
