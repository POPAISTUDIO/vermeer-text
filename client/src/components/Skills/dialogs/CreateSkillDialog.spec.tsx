/**
 * Locks in the #82 wiring: the create-skill modal now hosts the shared
 * `CategorySelector` inside a `FormProvider`. The selector reaches the form via
 * `useFormContext`, so a missing provider (or a selector that stops writing the
 * `category` field) would fail SILENTLY — no crash, just a category that never
 * reaches the create payload. This test drives the real selector (real
 * `DropdownPopup`/Ariakit, `portal={false}`) end to end and asserts the chosen
 * category lands in the `mutateAsync` payload.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

const mockMutateAsync = jest.fn().mockResolvedValue({ _id: 'skill-1' });
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

/**
 * Keep `@librechat/client` real (we exercise the actual `DropdownPopup`,
 * `OGDialog`, `Button`), overriding only `TextareaAutosize`: its
 * `react-textarea-autosize` default export hits a CJS/ESM interop breakage
 * under this transform. Same targeted stub as Bookmarks/BookmarkForm.test.tsx.
 */
jest.mock('@librechat/client', () => {
  const actual = jest.requireActual<typeof import('@librechat/client')>('@librechat/client');
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    TextareaAutosize: R.forwardRef<
      HTMLTextAreaElement,
      React.TextareaHTMLAttributes<HTMLTextAreaElement>
    >((props, ref) => R.createElement('textarea', { ref, ...props })),
  };
});

jest.mock('~/data-provider', () => ({
  useCreateSkillMutation: (opts?: { onSuccess?: (skill: unknown) => void }) => ({
    mutateAsync: (payload: unknown) =>
      mockMutateAsync(payload).then((skill: unknown) => {
        opts?.onSuccess?.(skill);
        return skill;
      }),
    isLoading: false,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useCategories: () => ({
    categories: [
      { label: 'Idée', value: 'idea', icon: null },
      { label: 'Code', value: 'code', icon: null },
    ],
    emptyCategory: { label: 'com_ui_empty_category', value: '' },
  }),
}));

import CreateSkillDialog from './CreateSkillDialog';

describe('CreateSkillDialog — category on create (#82)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends the chosen category in the create payload (FormProvider/useFormContext wiring)', async () => {
    const user = userEvent.setup();
    render(<CreateSkillDialog isOpen={true} setIsOpen={jest.fn()} />);

    await user.type(screen.getByPlaceholderText('com_ui_skill_name_placeholder'), 'My Skill');
    await user.type(
      screen.getByPlaceholderText('com_ui_skill_description_placeholder'),
      'A useful skill',
    );
    await user.type(
      screen.getByPlaceholderText('com_ui_skill_instructions_placeholder'),
      'Do the thing',
    );

    /* Open the real selector and pick a category — proves the selector, mounted
       inside FormProvider, writes `category` into the form via setValue. */
    await user.click(screen.getByRole('button', { name: 'com_ui_category' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Code' }));

    await user.click(screen.getByRole('button', { name: 'com_ui_create' }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        displayTitle: 'My Skill',
        description: 'A useful skill',
        body: 'Do the thing',
        category: 'code',
      }),
    );
  });

  it('omits category from the payload when none is chosen (optional field)', async () => {
    const user = userEvent.setup();
    render(<CreateSkillDialog isOpen={true} setIsOpen={jest.fn()} />);

    await user.type(
      screen.getByPlaceholderText('com_ui_skill_name_placeholder'),
      'No Category Skill',
    );
    await user.type(
      screen.getByPlaceholderText('com_ui_skill_description_placeholder'),
      'Still valid',
    );
    await user.type(
      screen.getByPlaceholderText('com_ui_skill_instructions_placeholder'),
      'Body text',
    );

    await user.click(screen.getByRole('button', { name: 'com_ui_create' }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('category', expect.anything());
    expect(mockMutateAsync.mock.calls[0][0].category).toBeUndefined();
  });
});
