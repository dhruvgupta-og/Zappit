import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { Mail, Lock, ArrowRight, School, ChevronDown } from 'lucide-react';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('');
  const [colleges, setColleges] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getDocs(collection(db, 'colleges')).then(snap => {
      setColleges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin && !college) { setError('Please select your college.'); return; }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Save user profile with college to Firestore
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email,
          college,
          created_at: new Date().toISOString(),
          role: 'student'
        });
        localStorage.setItem('userName', user.displayName || user.email.split('@')[0]);
        localStorage.setItem('userCollege', college);
      }
      navigate('/');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px',
    border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem', 
    background: 'var(--card-bg)', color: 'var(--text-main)'
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', background: 'var(--bg-color)' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ display: 'inline-flex', background: 'var(--primary-gradient)', padding: '16px 20px', borderRadius: '24px', marginBottom: '16px', boxShadow: '0 10px 25px rgba(255, 81, 47, 0.3)' }}>
          <span style={{ fontSize: '1.75rem', color: 'white', fontWeight: 900, letterSpacing: '-1px' }}>Zappit</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>{isLogin ? 'Welcome back!' : 'Create account'}</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          {isLogin ? 'Sign in to your campus food account.' : 'Get started with campus delivery.'}
        </p>
      </div>

      <div className="card" style={{ padding: '24px', boxShadow: 'var(--shadow-md)' }}>
        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '16px', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="college.email@edu.in" required style={inputStyle} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={inputStyle} />
            </div>
          </div>

          {/* College selector (sign up only) */}
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Select Your College</label>
              <div style={{ position: 'relative' }}>
                <School size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <ChevronDown size={16} style={{ position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <select
                  value={college}
                  onChange={e => setCollege(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none', paddingRight: '36px', cursor: 'pointer', color: college ? 'var(--text-main)' : 'var(--text-muted)' }}
                >
                  <option value="">-- Select college --</option>
                  {colleges.length > 0 ? colleges.map(c => (
                    <option key={c.id} value={c.name}>{c.name}{c.city ? `, ${c.city}` : ''}</option>
                  )) : (
                    <>
                      <option value="IIT Delhi">IIT Delhi</option>
                      <option value="NIT Trichy">NIT Trichy</option>
                      <option value="BITS Pilani">BITS Pilani</option>
                      <option value="VIT Vellore">VIT Vellore</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '4px', padding: '14px', gap: '8px' }} disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>


      </div>
    </div>
  );
};

export default LoginPage;
