import { memo, useMemo, useRef, useState } from 'react';
import { Folder, Upload } from 'lucide-react';
import * as Ariakit from '@ariakit/react';
import { useFormContext } from 'react-hook-form';
import { SharePointIcon, DropdownPopup } from '@librechat/client';
import { EModelEndpoint, EToolResources, AgentCapabilities } from 'librechat-data-provider';
import type { ExtendedFile, AgentForm } from '~/common';
import { useSharePointFileHandlingNoChatContext } from '~/hooks/Files/useSharePointFileHandling';
import { useFileHandlingNoChatContext } from '~/hooks/Files/useFileHandling';
import { useAgentFileConfig, useLocalize, useLazyEffect } from '~/hooks';
import { SharePointPickerDialog } from '~/components/SharePoint';
import FileRow from '~/components/Chat/Input/Files/FileRow';
import { useGetStartupConfig } from '~/data-provider';
import FileSearchCheckbox from './FileSearchCheckbox';
import { isEphemeralAgent } from '~/common';
import { cn } from '~/utils';

function FileSearch({
  agent_id,
  files: _files,
}: {
  agent_id: string;
  files?: [string, ExtendedFile][];
}) {
  const localize = useLocalize();
  const { watch, setValue } = useFormContext<AgentForm>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Map<string, ExtendedFile>>(new Map());
  const fileHandlingState = useMemo(() => ({ files, setFiles, conversation: null }), [files]);
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const [isSharePointDialogOpen, setIsSharePointDialogOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);

  // Get startup configuration for SharePoint feature flag
  const { data: startupConfig } = useGetStartupConfig();
  const { endpointFileConfig, providerValue, endpointType } = useAgentFileConfig();
  const endpointOverride = providerValue || EModelEndpoint.agents;

  const { handleFileChange, handleFiles } = useFileHandlingNoChatContext(
    {
      additionalMetadata: { agent_id, tool_resource: EToolResources.file_search },
      endpointOverride,
      endpointTypeOverride: endpointType,
      fileSetter: setFiles,
    },
    fileHandlingState,
  );

  const { handleSharePointFiles, isProcessing, downloadProgress } =
    useSharePointFileHandlingNoChatContext(
      {
        additionalMetadata: { agent_id, tool_resource: EToolResources.file_search },
        endpointOverride,
        endpointTypeOverride: endpointType,
        fileSetter: setFiles,
      },
      fileHandlingState,
    );

  useLazyEffect(
    () => {
      if (_files) {
        setFiles(new Map(_files));
      }
    },
    [_files],
    750,
  );

  const fileSearchChecked = watch(AgentCapabilities.file_search);
  const isUploadDisabled = endpointFileConfig?.disabled ?? false;

  const sharePointEnabled = startupConfig?.sharePointFilePickerEnabled;
  // The dropzone stays interactive when file_search is unchecked: dropping/clicking
  // a file auto-activates the capability (see enableFileSearchIfNeeded). It is only
  // disabled for ephemeral agents, which cannot own persisted file_search resources.
  const disabledUploadButton = isEphemeralAgent(agent_id);

  /** Any deliberate file hand-off (drop or click) counts as intent to enable file search. */
  const enableFileSearchIfNeeded = () => {
    if (fileSearchChecked === false) {
      setValue(AgentCapabilities.file_search, true, { shouldDirty: true });
    }
  };

  const handleSharePointFilesSelected = async (sharePointFiles: any[]) => {
    try {
      enableFileSearchIfNeeded();
      await handleSharePointFiles(sharePointFiles);
      setIsSharePointDialogOpen(false);
    } catch (error) {
      console.error('SharePoint file processing error:', error);
    }
  };
  if (isUploadDisabled) {
    return null;
  }

  const handleButtonClick = () => {
    enableFileSearchIfNeeded();
    // necessary to reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleLocalFileClick = () => {
    enableFileSearchIfNeeded();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabledUploadButton) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabledUploadButton) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabledUploadButton) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    if (disabledUploadButton) {
      return;
    }
    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) {
      return;
    }
    enableFileSearchIfNeeded();
    // Same pipeline as the click path (input onChange -> handleFileChange -> handleFiles):
    // no tool_resource arg is passed; it is set on the upload via additionalMetadata.
    handleFiles(droppedFiles);
  };

  const dropdownItems = [
    {
      label: localize('com_files_upload_local_machine'),
      onClick: handleLocalFileClick,
      icon: <Folder className="icon-md" />,
    },
    {
      label: localize('com_files_upload_sharepoint'),
      onClick: () => setIsSharePointDialogOpen(true),
      icon: <SharePointIcon className="icon-md" />,
    },
  ];

  const dropzoneClassName = cn(
    'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-light px-4 py-6 text-text-secondary transition-colors hover:border-border-heavy hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50',
    isDragActive && 'border-border-heavy bg-surface-hover text-text-primary',
  );

  const dropzoneLabel = localize(
    isDragActive ? 'com_agents_file_search_drop_active' : 'com_ui_drop_files_here',
  );

  const menuTrigger = (
    <Ariakit.MenuButton disabled={disabledUploadButton} className={dropzoneClassName}>
      <Upload className="h-6 w-6" aria-hidden="true" />
      <span className="text-sm font-medium">{dropzoneLabel}</span>
    </Ariakit.MenuButton>
  );

  return (
    <div className="w-full">
      <FileSearchCheckbox />
      <div className="flex flex-col gap-3">
        {/* File Search (RAG API) Files */}
        <FileRow
          files={files}
          setFiles={setFiles}
          agent_id={agent_id}
          tool_resource={EToolResources.file_search}
          Wrapper={({ children }) => <div className="flex flex-wrap gap-2">{children}</div>}
        />
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          {sharePointEnabled ? (
            <DropdownPopup
              gutter={2}
              menuId="file-search-upload-menu"
              isOpen={isPopoverActive}
              setIsOpen={setIsPopoverActive}
              trigger={menuTrigger}
              items={dropdownItems}
              modal={true}
              unmountOnHide={true}
            />
          ) : (
            <button
              type="button"
              disabled={disabledUploadButton}
              className={dropzoneClassName}
              onClick={handleButtonClick}
            >
              <Upload className="h-6 w-6" aria-hidden="true" />
              <span className="text-sm font-medium">{dropzoneLabel}</span>
            </button>
          )}
          <input
            multiple={true}
            type="file"
            style={{ display: 'none' }}
            tabIndex={-1}
            ref={fileInputRef}
            disabled={disabledUploadButton}
            onChange={handleFileChange}
          />
        </div>
        {/* Disabled Message */}
        {agent_id ? null : (
          <div className="text-xs text-text-secondary">
            {localize('com_agents_file_search_disabled')}
          </div>
        )}
      </div>

      <SharePointPickerDialog
        isOpen={isSharePointDialogOpen}
        onOpenChange={setIsSharePointDialogOpen}
        onFilesSelected={handleSharePointFilesSelected}
        disabled={disabledUploadButton}
        isDownloading={isProcessing}
        downloadProgress={downloadProgress}
        maxSelectionCount={endpointFileConfig?.fileLimit}
      />
    </div>
  );
}

const MemoizedFileSearch = memo(FileSearch);
MemoizedFileSearch.displayName = 'FileSearch';

export default MemoizedFileSearch;
