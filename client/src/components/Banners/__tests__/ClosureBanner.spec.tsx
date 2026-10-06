import React from 'react';
import { RecoilRoot } from 'recoil';
import { render, screen } from '@testing-library/react';
import English from '~/locales/en/translation.json';
import French from '~/locales/fr/translation.json';
import { ClosureBanner } from '../ClosureBanner';
import i18n from '~/locales/i18n';

const renderBanner = (onHeightChange?: (height: number) => void) =>
  render(
    <RecoilRoot>
      <ClosureBanner onHeightChange={onHeightChange} />
    </RecoilRoot>,
  );

describe('ClosureBanner', () => {
  const originalResizeObserver = window.ResizeObserver;
  const observe = jest.fn();
  const disconnect = jest.fn();

  beforeEach(async () => {
    observe.mockClear();
    disconnect.mockClear();
    window.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe,
      disconnect,
      unobserve: jest.fn(),
    }));
    await i18n.changeLanguage('en');
  });

  afterAll(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  it('affiche le message de fermeture en EN', () => {
    renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent(English.com_ui_closure_banner_message);
  });

  it('affiche le message de fermeture en FR', async () => {
    await i18n.changeLanguage('fr');
    renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent(French.com_ui_closure_banner_message);
  });

  it("n'est pas fermable", () => {
    renderBanner();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("n'écrit rien en stockage local", () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    renderBanner(jest.fn());
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('remonte sa hauteur au montage, observe ses redimensionnements et nettoie au démontage', () => {
    const onHeightChange = jest.fn();
    const { unmount } = renderBanner(onHeightChange);

    expect(onHeightChange).toHaveBeenCalledWith(expect.any(Number));
    expect(observe).toHaveBeenCalledWith(screen.getByRole('status'));

    const [report] = (window.ResizeObserver as jest.Mock).mock.calls[0];
    onHeightChange.mockClear();
    report();
    expect(onHeightChange).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
  });
});
