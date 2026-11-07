import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, ShieldCheck, Smartphone, HelpCircle, ArrowRight, Sparkles } from 'lucide-react';
import api from '../utils/api';

const DownloadPage = () => {
  const [versionData, setVersionData] = useState({
    latestVersion: '1.0.1',
    downloadUrl: 'https://api.zappit.shop/download/zappit-latest.apk',
    releaseNotes: 'Faster tracking, loud kitchen alerts, star ratings, and 1-tap re-order!',
  });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/api/app-version')
      .then((res) => {
        if (res.data?.success) {
          setVersionData({
            latestVersion: res.data.latestVersion || '1.0.1',
            downloadUrl: res.data.downloadUrl || 'https://api.zappit.shop/download/zappit-latest.apk',
            releaseNotes: res.data.releaseNotes || 'New version available with improvements!',
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    // If the downloadUrl points to this page itself, default to a direct apk or drive link
    let url = versionData.downloadUrl;
    if (!url || url.includes('zappit.shop/download')) {
      url = 'https://github.com/dhruvgupta-og/Zappit/releases/latest';
    }
    window.location.href = url;
    setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #070B19 0%, #0F172A 100%)',
      color: 'white',
      fontFamily: "'Inter', sans-serif",
      padding: '24px 16px 80px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Header Badge */}
      <div style={{
        marginTop: '20px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(255, 193, 7, 0.12)',
        border: '1px solid rgba(255, 193, 7, 0.3)',
        padding: '6px 14px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#FFC107',
      }}>
        <Sparkles size={15} />
        <span>Official Android App Release</span>
      </div>

      {/* Hero Icon */}
      <div style={{
        marginTop: '24px',
        width: '84px',
        height: '84px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, #FFC107 0%, #FF8F00 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 36px rgba(255, 193, 7, 0.35)',
      }}>
        <span style={{ fontSize: '42px' }}>⚡</span>
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '2rem',
        fontWeight: '900',
        textAlign: 'center',
        margin: '18px 0 8px',
        letterSpacing: '-0.5px',
      }}>
        Get Zappit for Android
      </h1>
      <p style={{
        fontSize: '15px',
        color: '#94A3B8',
        textAlign: 'center',
        maxWidth: '420px',
        lineHeight: '1.6',
        margin: '0 0 24px',
      }}>
        Zero canteen waiting lines. Order snacks, biryani, and coffee directly to your hostel block across ITM GOI & MITS.
      </p>

      {/* Version Tag */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        color: '#64748B',
        marginBottom: '20px',
      }}>
        <span>Version <strong>v{versionData.latestVersion}</strong></span>
        <span>•</span>
        <span>Direct APK</span>
        <span>•</span>
        <span>Fast & 100% Virus-Free</span>
      </div>

      {/* Big Download Button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'linear-gradient(135deg, #FFC107 0%, #FFA000 100%)',
          color: '#0B132B',
          border: 'none',
          padding: '18px 24px',
          borderRadius: '16px',
          fontSize: '17px',
          fontWeight: '900',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          boxShadow: '0 8px 28px rgba(255, 193, 7, 0.4)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <Download size={22} />
        <span>{downloading ? 'Starting Download...' : 'Download Android APK'}</span>
      </button>

      {/* What's New Box */}
      <div style={{
        marginTop: '28px',
        width: '100%',
        maxWidth: '380px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '18px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFC107', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          What's New in v{versionData.latestVersion}
        </div>
        <p style={{ fontSize: '14px', color: '#CBD5E1', margin: 0, lineHeight: '1.5' }}>
          {versionData.releaseNotes}
        </p>
      </div>

      {/* 3 Step Installation Guide */}
      <div style={{
        marginTop: '28px',
        width: '100%',
        maxWidth: '380px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
          Easy 3-Step Installation
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: '#FFC107', color: '#0B132B', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>Download the APK</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Tap the gold button above. Chrome may show "File might be harmful" — tap <strong>Download anyway</strong>.</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: '#FFC107', color: '#0B132B', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>Allow Installation</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Open the downloaded file. When prompted, tap Settings and enable <strong>"Allow from this source"</strong>.</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: '#FFC107', color: '#0B132B', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>Sign in & Start Ordering</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Select ITM GOI or MITS and enjoy fast delivery to your block!</div>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Help Section */}
      <div style={{
        marginTop: '32px',
        padding: '16px',
        borderRadius: '14px',
        backgroundColor: 'rgba(37, 211, 102, 0.1)',
        border: '1px solid rgba(37, 211, 102, 0.25)',
        width: '100%',
        maxWidth: '380px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>💬</span>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px' }}>Need help installing?</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>WhatsApp our campus team directly</div>
          </div>
        </div>
        <a
          href="https://wa.me/918463037671?text=Hi%20Zappit%20Team%2C%20I%20need%20help%20installing%20the%20APK"
          target="_blank"
          rel="noreferrer"
          style={{
            backgroundColor: '#25D366',
            color: 'white',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: '800',
            padding: '8px 14px',
            borderRadius: '20px',
          }}
        >
          Chat Now →
        </a>
      </div>
    </div>
  );
};

export default DownloadPage;
