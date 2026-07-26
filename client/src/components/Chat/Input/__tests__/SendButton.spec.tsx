import React from 'react';
import { useForm } from 'react-hook-form';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SendButton from '../SendButton';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

function Harness({ text = '', disabled = false, hasFiles = false }: {
  text?: string;
  disabled?: boolean;
  hasFiles?: boolean;
}) {
  const { control } = useForm<{ text: string }>({ defaultValues: { text } });
  return <SendButton control={control} disabled={disabled} hasFiles={hasFiles} />;
}

describe('SendButton', () => {
  it('is disabled when there is no text and no attached files', () => {
    render(<Harness text="" hasFiles={false} />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('is enabled when text is present', () => {
    render(<Harness text="Bonjour" hasFiles={false} />);
    expect(screen.getByTestId('send-button')).toBeEnabled();
  });

  it('is enabled when a file is attached even without text (regression #113)', () => {
    render(<Harness text="" hasFiles />);
    expect(screen.getByTestId('send-button')).toBeEnabled();
  });

  it('stays disabled for whitespace-only text with no files (anti whitespace-only regression)', () => {
    render(<Harness text="   " hasFiles={false} />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('remains disabled when props.disabled is true regardless of files', () => {
    render(<Harness text="" hasFiles disabled />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });
});
