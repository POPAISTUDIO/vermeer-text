import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  OGDialog,
  OGDialogContent,
  TextareaAutosize,
  useToastContext,
} from '@librechat/client';
import {
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_DISPLAY_TITLE_MAX_LENGTH,
} from 'librechat-data-provider';
import { useCreateSkillMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import {
  slugifySkillName,
  withSlugSuffix,
  isSkillNameConflict,
  SLUG_COLLISION_MAX_ATTEMPTS,
} from '../utils';
import { cn } from '~/utils';

interface CreateSkillDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  defaultName?: string;
  defaultDescription?: string;
  defaultBody?: string;
}

interface FormValues {
  displayTitle: string;
  description: string;
  body: string;
}

/**
 * Minimal create-skill dialog matching Claude.ai's "Write skill instructions"
 * modal: name, description, instructions. No category, no invocation mode.
 *
 * The user types a free-form name (`displayTitle`); the machine-readable
 * kebab-case `name` identifier the model sees is derived silently via
 * `slugifySkillName`, with numeric suffixes retried on collision.
 */
export default function CreateSkillDialog({
  isOpen,
  setIsOpen,
  defaultName = '',
  defaultDescription = '',
  defaultBody = '',
}: CreateSkillDialogProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { showToast } = useToastContext();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: {
      displayTitle: defaultName,
      description: defaultDescription,
      body: defaultBody,
    },
    mode: 'onChange',
  });

  const createSkill = useCreateSkillMutation({
    onSuccess: (skill) => {
      showToast({ status: 'success', message: localize('com_ui_skill_created') });
      setIsOpen(false);
      reset();
      navigate(`/skills/${skill._id}`);
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

  const onSubmit = async (data: FormValues) => {
    if (createSkill.isLoading) {
      return;
    }
    const displayTitle = data.displayTitle.trim();
    const description = data.description.trim();
    const baseSlug = slugifySkillName(displayTitle);
    for (let attempt = 1; attempt <= SLUG_COLLISION_MAX_ATTEMPTS; attempt++) {
      const name = attempt === 1 ? baseSlug : withSlugSuffix(baseSlug, attempt);
      try {
        await createSkill.mutateAsync({ name, displayTitle, description, body: data.body });
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

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const submitDisabled = !isValid || isSubmitting || createSkill.isLoading;

  return (
    <OGDialog open={isOpen} onOpenChange={setIsOpen}>
      <OGDialogContent className="w-11/12 max-w-5xl overflow-hidden">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex max-h-[80vh] min-w-0 flex-col gap-3 overflow-hidden p-1 sm:gap-4 sm:p-2"
        >
          <h2 className="text-lg font-bold text-text-primary">
            {localize('com_ui_create_skill')}
          </h2>

          {/* Skill name (free-form; slug derived automatically) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-skill-name" className="text-sm font-medium text-text-secondary">
              {localize('com_ui_name')}
            </label>
            <input
              id="create-skill-name"
              placeholder={localize('com_ui_skill_name_placeholder')}
              aria-invalid={errors.displayTitle ? 'true' : 'false'}
              autoComplete="off"
              className="flex h-10 w-full rounded-xl border border-border-medium bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              {...register('displayTitle', {
                required: localize('com_ui_skill_name_required'),
                maxLength: {
                  value: SKILL_DISPLAY_TITLE_MAX_LENGTH,
                  message: localize('com_ui_skill_name_too_long', {
                    0: String(SKILL_DISPLAY_TITLE_MAX_LENGTH),
                  }),
                },
              })}
            />
            {errors.displayTitle && (
              <p className="text-xs text-red-500">{errors.displayTitle.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="create-skill-description"
              className="text-sm font-medium text-text-secondary"
            >
              {localize('com_ui_description')}
            </label>
            <TextareaAutosize
              id="create-skill-description"
              minRows={2}
              maxRows={4}
              placeholder={localize('com_ui_skill_description_placeholder')}
              aria-label={localize('com_ui_description')}
              className="w-full resize-none rounded-xl border border-border-medium bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
              {...register('description', {
                required: localize('com_ui_skill_description_required'),
                maxLength: {
                  value: SKILL_DESCRIPTION_MAX_LENGTH,
                  message: localize('com_ui_skill_description_too_long', {
                    0: String(SKILL_DESCRIPTION_MAX_LENGTH),
                  }),
                },
              })}
            />
          </div>

          {/* Instructions (body) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-skill-body" className="text-sm font-medium text-text-secondary">
              {localize('com_ui_skill_instructions')}
            </label>
            <TextareaAutosize
              id="create-skill-body"
              minRows={6}
              maxRows={12}
              placeholder={localize('com_ui_skill_instructions_placeholder')}
              aria-label={localize('com_ui_skill_instructions')}
              className="w-full resize-none rounded-xl border border-border-medium bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
              {...register('body')}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {localize('com_ui_cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitDisabled}
              className={cn(submitDisabled && 'opacity-50')}
            >
              {localize('com_ui_create')}
            </Button>
          </div>
        </form>
      </OGDialogContent>
    </OGDialog>
  );
}
