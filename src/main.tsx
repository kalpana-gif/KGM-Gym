import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><MotionConfig reducedMotion="user"><App/></MotionConfig></React.StrictMode>);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load',()=>{ void navigator.serviceWorker.register('/sw.js').catch(()=>{}); });
}
