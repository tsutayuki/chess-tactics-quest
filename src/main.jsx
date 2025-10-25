import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Admin from './Admin.jsx';
import Home from './pages/Home.jsx';
import Select from './pages/Select.jsx';

function parseRoute() {
  const hash = window.location.hash || '#/';
  const [path, query = ''] = hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  return { path: `#${path}`, params };
}

function Root() {
  const [route, setRoute] = useState(parseRoute());

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handler);
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('hashchange', handler);
      window.removeEventListener('popstate', handler);
    };
  }, []);

  const element = useMemo(() => {
    switch (route.path) {
      case '#/admin':
        return <Admin />;
      case '#/select':
        return <Select />;
      case '#/play':
        return <App />;
      case '#/':
      default:
        return <Home />;
    }
  }, [route.path]);

  return element;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
