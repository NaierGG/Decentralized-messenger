import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import App from './App';

describe('web app onboarding flow', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (typeof indexedDB === 'undefined') {
      return;
    }
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('veil_messenger_db');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });

  it('renders onboarding first', () => {
    render(<App />);
    expect(screen.getByTestId('onboarding-screen')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Secure\s+Local\s+Identity/i
      })
    ).toBeInTheDocument();
  });

  it('creates profile and moves to contacts', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alice/i), {
      target: {value: 'Tester'}
    });
    fireEvent.click(screen.getByRole('button', {name: /Generate Identity/i}));
    expect(await screen.findByTestId('contacts-screen')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /Session/i})).toBeInTheDocument();
  });
});
