import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Admin from './Admin.jsx';

function isAdminRoute() {
  return window.location.hash === '#/admin' || window.location.pathname.endsWith('/admin');
}

function Root() {
  const [isAdmin, setIsAdmin] = useState(isAdminRoute());

  useEffect(() => {
    const handler = () => setIsAdmin(isAdminRoute());
    window.addEventListener('hashchange', handler);
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('hashchange', handler);
      window.removeEventListener('popstate', handler);
    };
  }, []);

  return isAdmin ? <Admin /> : <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
