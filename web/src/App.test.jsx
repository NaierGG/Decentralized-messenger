import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import App from './App';

describe('web app onboarding flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders onboarding first', () => {
    render(<App />);
    expect(screen.getByTestId('onboarding-screen')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Secure\s+P2P\s+Chat/i
      })
    ).toBeInTheDocument();
  });

  it('creates profile and moves to contacts', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Who are you/i), {
      target: {value: 'Tester'}
    });
    fireEvent.click(screen.getByRole('button', {name: /Create Profile & Start/i}));
    expect(screen.getByTestId('contacts-screen')).toBeInTheDocument();
    expect(screen.getByText(/P2P Messenger/i)).toBeInTheDocument();
  });
});
