import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { User, Phone, School, ChevronDown, ArrowRight } from 'lucide-react';

const OnboardingPage = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Fetch colleges
    getDocs(collection(db, 'colleges')).then(snap => {
      setColleges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Safety check: If profile is already complete, redirect to Home
    const checkStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().profile_complete === true) {
          navigate('/', { replace: true });
        }
      }
    };
    checkStatus();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!college) { setError('Please select your college.'); return; }
    if (!phone.trim() || phone.length < 10) { setError('Please enter a valid 10-digit phone number.'); return; }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const selectedCollegeObj = colleges.find(c => c.id === college);
      const collegeName = selectedCollegeObj ? selectedCollegeObj.name : college;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        name: name.trim(),
        phone: phone.trim(),
        college_id: college,
        college_name: collegeName,
        profile_complete: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'student'
      });
      localStorage.setItem('userName', name.trim());
      localStorage.setItem('userCollegeId', college);
      localStorage.setItem('userCollegeName', collegeName);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '13px 13px 13px 42px',
    borderRadius: '12px', border: '1.5px solid var(--border-color)',
    outline: 'none', fontSize: '1rem', background: 'var(--card-bg)',
    color: 'var(--text-main)',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', background: 'var(--primary-gradient)', padding: '14px 20px', borderRadius: '20px', marginBottom: '16px', boxShadow: '0 10px 25px rgba(255, 81, 47, 0.3)' }}>
          <span style={{ fontSize: '1.5rem', color: 'white', fontWeight: 900, letterSpacing: '-1px' }}>Zappit</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', margin: '0 0 8px' }}>Complete Your Profile</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
          Just a few details so we know where to deliver your food!
        </p>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
        {['Login', 'Profile', 'Order'].map((step, i) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: i === 1 ? 'var(--primary-gradient)' : i < 1 ? '#10B981' : '#E5E7EB', color: i <= 1 ? 'white' : '#9CA3AF', fontWeight: 700, fontSize: '0.8rem' }}>
              {i < 1 ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: i === 1 ? 'var(--primary)' : 'var(--text-muted)' }}>{step}</span>
            {i < 2 && <div style={{ width: 20, height: 2, background: i < 1 ? '#10B981' : '#E5E7EB', borderRadius: 2 }} />}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '24px', boxShadow: 'var(--shadow-md)' }}>
        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '12px', borderRadius: '10px', fontSize: '0.875rem', marginBottom: '16px', fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', top: '50%', left: '13px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Dhruv Sharma"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Phone Number
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} style={{ position: 'absolute', top: '50%', left: '13px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                required
                maxLength={10}
                style={inputStyle}
              />
              {phone.length === 10 && (
                <span style={{ position: 'absolute', top: '50%', right: '13px', transform: 'translateY(-50%)', color: '#10B981', fontWeight: 700, fontSize: '0.8rem' }}>✓</span>
              )}
            </div>
          </div>

          {/* College */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              College / University
            </label>
            <div style={{ position: 'relative' }}>
              <School size={18} style={{ position: 'absolute', top: '50%', left: '13px', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
              <ChevronDown size={16} style={{ position: 'absolute', top: '50%', right: '13px', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <select
                value={college}
                onChange={e => setCollege(e.target.value)}
                required
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', color: college ? 'var(--text-main)' : '#9CA3AF' }}
              >
                <option value="">-- Select your college --</option>
                {colleges.length > 0
                  ? colleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.city ? `, ${c.city}` : ''}</option>
                    ))
                  : (
                    <>
                      <option value="iit_delhi">IIT Delhi</option>
                      <option value="nit_trichy">NIT Trichy</option>
                      <option value="bits_pilani">BITS Pilani</option>
                      <option value="vit_vellore">VIT Vellore</option>
                      <option value="other">Other</option>
                    </>
                  )
                }
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '15px', marginTop: '4px', fontSize: '1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? 'Saving...' : 'Start Ordering'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
