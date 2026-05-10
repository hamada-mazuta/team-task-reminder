import { useState } from 'react';
import { supabase } from './supabaseClient';

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '0.5px solid #d1d0c8', background: '#f5f5f3',
  color: '#1a1a18', fontSize: 14, boxSizing: 'border-box', marginBottom: 12
};
const btnStyle = {
  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
  background: '#1a1a18', color: '#fff', fontSize: 14,
  fontWeight: 500, cursor: 'pointer', marginBottom: 8
};

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Nama lengkap wajib diisi.'); return; }
    setLoading(true); setError(''); setMessage('');
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
    if (error) setError(error.message);
    else setMessage('Berhasil daftar! Cek email kamu untuk konfirmasi, lalu login.');
    setLoading(false);
  }

  async function handleForgot(e) {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) setError(error.message);
    else setMessage('Link reset password sudah dikirim ke email kamu.');
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#f5f5f3' }}>
      <div style={{ width: 360, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: '#1a1a18' }}>Team Task Reminder</h1>
          <p style={{ fontSize: 13, color: '#5f5e5a', margin: '6px 0 0' }}>
            {mode === 'login' ? 'Masuk ke akun kamu' : mode === 'register' ? 'Buat akun baru' : 'Reset password'}
          </p>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 16, padding: '1.5rem' }}>
          {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          {message && <div style={{ background: '#EAF3DE', color: '#3B6D11', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{message}</div>}

          <form onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgot}>
            {mode === 'register' && (
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nama lengkap" required style={inputStyle} />
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required style={inputStyle} />
            {mode !== 'forgot' && (
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password (min. 6 karakter)" required minLength={6} style={inputStyle} />
            )}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar' : 'Kirim Link Reset'}
            </button>
          </form>

          <div style={{ borderTop: '0.5px solid #e0dfd7', paddingTop: 12, marginTop: 4 }}>
            {mode === 'login' && (<>
              <button onClick={() => { setMode('register'); setError(''); setMessage(''); }} style={{ ...btnStyle, background: '#f1efe8', color: '#1a1a18' }}>Belum punya akun? Daftar</button>
              <button onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: '#5f5e5a', fontSize: 12, cursor: 'pointer', width: '100%' }}>Lupa password?</button>
            </>)}
            {mode !== 'login' && (
              <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} style={{ ...btnStyle, background: '#f1efe8', color: '#1a1a18' }}>Sudah punya akun? Masuk</button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#888780', textAlign: 'center', marginTop: 12 }}>
          Data kamu aman dan hanya bisa diakses oleh anggota tim.
        </p>
      </div>
    </div>
  );
}
