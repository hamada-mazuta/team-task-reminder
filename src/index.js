import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Auth from './Auth';
import { supabase } from './supabaseClient';

function Root() {
  const [session, setSession] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#5f5e5a', fontSize: 14 }}>
      Memuat...
    </div>
  );

  return session ? <App session={session} /> : <Auth />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
