/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';
import { describe, it, expect } from 'vitest';
import React from 'react';

describe('App', () => {
  it('renders Bug-to-Proof text', () => {
    render(<App />);
    expect(screen.getByText(/Bug-to-Proof/i)).toBeInTheDocument();
  });
});
