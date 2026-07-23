import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { Input, Button, TextareaAutosize, useToastContext } from '@librechat/client';
import {
  InvocationMode,
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_DISPLAY_TITLE_MAX_LENGTH,
} from 'librechat-data-provider';
import type { TSkill, TCreateSkill, TSkillWarning } from 'librechat-data-provider';
import { useCreateSkillMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import SkillContentEditor from './SkillContentEditor';
import InvocationModePicker from './InvocationModePicker';
import CategorySelector from './CategorySelector';
import {
  slugifySkillName,
  withSlugSuffix,
  isSkillNameConflict,
  SLUG_COLLISION_MAX_ATTEMPTS,
} from '../utils';
import { cn } from '~/utils';

const DEFAULT_BODY = `# Overview

Describe what this skill does and how it should be applied.

## When to use

- List concrete signals that should trigger this skill
- Add examples that make the trigger unambiguous

## How to apply

Walk through the steps the agent should take.
`;

interface CreateSkillFormValues {
  displayTitle: string;
  description: string;
  body: string;
  category: string;
  invocationMode: InvocationMode;
}

const DEFAULT_VALUES: CreateSkillFormValues = {
  displayTitle: '',
  description: '',
  body: DEFAULT_BODY,
  category: '',
  invocationMode: InvocationMode.auto,
};

interface CreateSkillFormProps {
  /**
   * Pre-populated field values — used by the upload path to seed the form
   * with parsed SKILL.md frontmatter. Shape is a subset of the form values
   * (partial) because the upload parser may only extract `name` +
   * `description`; `invocationMode` is accepted for shape compatibility
   * with the original UI PR but ignored for now (the backend doesn't
   * persist it yet).
   */
  defaultValues?: Partial<CreateSkillFormValues> & { invocationMode?: unknown };
  onCancel?: () => void;
  onSuccess?: (skill: TSkill) => void;
}

export default function CreateSkillForm({
  defaultValues,
  onCancel,
  onSuccess,
}: CreateSkillFormProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const [isEditingContent, setIsEditingContent] = useState(true);

  const methods = useForm<CreateSkillFormValues>({
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
    mode: 'onChange',
  });
  const {
    control,
    handleSubmit,
    formState: { isSubmitting, isValid, errors },
  } = methods;

  const createSkill = useCreateSkillMutation({
    onSuccess: (skill) => {
      const warnings: TSkillWarning[] | undefined = skill.warnings;
      showToast({
        status: warnings && warnings.length > 0 ? 'warning' : 'success',
        message: localize('com_ui_skill_created'),
      });
      if (onSuccess) {
        onSuccess(skill);
      } else {
        navigate(`/skills/${skill._id}`);
      }
    },
    onError: (error: unknown) => {
      // Name collisions (409) are handled by the suffix-retry loop in
      // `onSubmit` and must not surface a toast mid-retry.
      if (isSkillNameConflict(error)) {
        return;
      }
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        localize('com_ui_skill_create_error');
      showToast({ status: 'error', message });
    },
  });

  // `useCallback` would be a no-op here: `createSkill` is a React Query
  // mutation result with an unstable identity, and `handleSubmit` from
  // react-hook-form doesn't use `onSubmit` as a dependency anywhere.
  const onSubmit = async (values: CreateSkillFormValues) => {
    if (createSkill.isLoading) {
      return;
    }
    const displayTitle = values.displayTitle.trim();
    const basePayload: Omit<TCreateSkill, 'name'> = {
      displayTitle,
      description: values.description.trim(),
      body: values.body,
      category: values.category || undefined,
      // `invocationMode` is deliberately NOT forwarded — phase 1 backend
      // doesn't persist it. Kept in form state only so the picker has a
      // selection.
    };
    const baseSlug = slugifySkillName(displayTitle);
    for (let attempt = 1; attempt <= SLUG_COLLISION_MAX_ATTEMPTS; attempt++) {
      const name = attempt === 1 ? baseSlug : withSlugSuffix(baseSlug, attempt);
      try {
        await createSkill.mutateAsync({ ...basePayload, name });
        return;
      } catch (error) {
        if (isSkillNameConflict(error)) {
          continue;
        }
        return;
      }
    }
    showToast({ status: 'error', message: localize('com_ui_skill_name_conflict') });
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  const createDisabled = !isValid || isSubmitting || createSkill.isLoading;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full px-4 py-2"
        aria-label={localize('com_ui_skill_create_title')}
      >
        <h1 className="sr-only">{localize('com_ui_skill_create_title')}</h1>
        <div className="mb-1 flex flex-col items-center justify-between font-bold sm:text-xl md:mb-0 md:text-2xl">
          <div className="flex w-full flex-col items-center justify-between sm:flex-row">
            <Controller
              name="displayTitle"
              control={control}
              rules={{
                required: localize('com_ui_skill_name_required'),
                maxLength: {
                  value: SKILL_DISPLAY_TITLE_MAX_LENGTH,
                  message: localize('com_ui_skill_name_too_long', {
                    0: String(SKILL_DISPLAY_TITLE_MAX_LENGTH),
                  }),
                },
              }}
              render={({ field }) => (
                <div className="relative mb-1 flex w-full flex-col sm:w-auto md:mb-0">
                  <Input
                    {...field}
                    id="skill-name"
                    type="text"
                    className="peer mr-2 w-full border border-border-medium p-2 text-2xl text-text-primary"
                    placeholder=" "
                    tabIndex={0}
                    aria-label={localize('com_ui_name')}
                    aria-required="true"
                    aria-invalid={errors.displayTitle ? 'true' : 'false'}
                    aria-describedby={errors.displayTitle ? 'skill-name-error' : undefined}
                  />
                  <label
                    htmlFor="skill-name"
                    className="pointer-events-none absolute -top-1 left-3 origin-[0] translate-y-3 scale-100 rounded bg-presentation px-1 text-base text-text-secondary transition-transform duration-200 peer-placeholder-shown:translate-y-3 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-text-primary peer-[:not(:placeholder-shown)]:-translate-y-2 peer-[:not(:placeholder-shown)]:scale-75"
                  >
                    {localize('com_ui_name')}*
                  </label>
                  <div
                    id="skill-name-error"
                    className={cn(
                      'mt-1 w-56 text-sm',
                      errors.displayTitle ? 'visible h-auto text-red-500' : 'invisible h-0',
                    )}
                    role={errors.displayTitle ? 'alert' : undefined}
                  >
                    {errors.displayTitle ? errors.displayTitle.message : ' '}
                  </div>
                </div>
              )}
            />
            <div className="flex items-center gap-2">
              <CategorySelector />
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 md:mt-[1.075rem]">
          <Controller
            name="description"
            control={control}
            rules={{
              required: localize('com_ui_skill_description_required'),
              maxLength: {
                value: SKILL_DESCRIPTION_MAX_LENGTH,
                message: localize('com_ui_skill_description_too_long', {
                  0: String(SKILL_DESCRIPTION_MAX_LENGTH),
                }),
              },
            }}
            render={({ field }) => (
              <div className="flex flex-col">
                <label
                  htmlFor="skill-description"
                  className="mb-1 text-sm font-medium text-text-secondary"
                >
                  {localize('com_ui_description')}
                  <span className="ml-0.5 text-red-500">*</span>
                </label>
                <TextareaAutosize
                  {...field}
                  id="skill-description"
                  minRows={2}
                  maxRows={6}
                  placeholder={localize('com_ui_skill_description_placeholder')}
                  aria-label={localize('com_ui_description')}
                  aria-invalid={errors.description ? 'true' : 'false'}
                  aria-describedby={errors.description ? 'skill-description-error' : undefined}
                  className="w-full resize-none rounded-xl border border-border-medium bg-transparent p-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                />
                <p className="mt-1 text-xs text-text-secondary">
                  {localize('com_ui_skill_description_field_hint')}
                </p>
                {errors.description && (
                  <p
                    id="skill-description-error"
                    className="mt-1 text-sm text-red-500"
                    role="alert"
                  >
                    {errors.description.message}
                  </p>
                )}
              </div>
            )}
          />

          <SkillContentEditor
            name="body"
            isEditing={isEditingContent}
            setIsEditing={setIsEditingContent}
          />

          {createSkill.error != null && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{localize('com_ui_skill_create_error')}</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {localize('com_ui_cancel')}
            </Button>
            <Button
              aria-label={localize('com_ui_skill_create_title')}
              type="submit"
              disabled={createDisabled}
              aria-disabled={createDisabled || undefined}
              className={cn('w-full sm:w-auto', createDisabled && 'opacity-50')}
            >
              {localize('com_ui_skill_create_title')}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
