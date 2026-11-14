import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// PWA: offline e compartilhar; fora do ng serve e fora do iframe do git-calm
if (!isDevMode() && 'serviceWorker' in navigator && window.parent === window) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
