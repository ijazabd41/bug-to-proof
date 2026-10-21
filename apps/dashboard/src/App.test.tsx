/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';
import { describe, it, expect } from 'vitest';
import React from 'react';

describe('App', () => {
  it('renders the Proofline workspace', () => {
    render(<App />);
    expect(screen.getByText(/proofline/i)).toBeInTheDocument();
  });
});
