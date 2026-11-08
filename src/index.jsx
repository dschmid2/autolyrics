import { createRoot } from 'react-dom/client';
import App from './app.jsx';

window.__autolyrics_loaded = true;
const root = createRoot(document.getElementById('root'));
root.render(<App />);
