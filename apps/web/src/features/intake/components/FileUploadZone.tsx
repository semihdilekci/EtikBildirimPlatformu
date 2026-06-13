import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  ALLOWED_UPLOAD_RULES,
  MAX_SINGLE_FILE_BYTES,
  MAX_TOTAL_REPORT_ATTACHMENT_BYTES,
} from '@ethics/shared';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { PendingAttachment } from '@/features/intake/hooks/useReportForm';

const ALLOWED_EXTENSIONS = new Set(
  ALLOWED_UPLOAD_RULES.map((rule) => rule.extension.toLowerCase()),
);

const ALLOWED_MIME_TYPES = new Set(ALLOWED_UPLOAD_RULES.flatMap((rule) => rule.mimeTypes));

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? (parts.at(-1)?.toLowerCase() ?? '') : '';
}

type FileUploadZoneProps = {
  attachments: PendingAttachment[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
};

export function FileUploadZone({ attachments, onAdd, onRemove }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalBytes = useMemo(
    () => attachments.reduce((sum, item) => sum + item.file.size, 0),
    [attachments],
  );

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      const accepted: File[] = [];
      let runningTotal = totalBytes;

      for (const file of files) {
        const extension = getFileExtension(file.name);
        if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.type)) {
          setErrorMessage(
            'İzin verilmeyen dosya türü. Lütfen desteklenen formatlardan birini seçin.',
          );
          continue;
        }

        if (file.size > MAX_SINGLE_FILE_BYTES) {
          setErrorMessage('Tek dosya boyutu 50 MB sınırını aşamaz.');
          continue;
        }

        if (runningTotal + file.size > MAX_TOTAL_REPORT_ATTACHMENT_BYTES) {
          setErrorMessage('Toplam dosya boyutu 200 MB sınırını aşamaz.');
          continue;
        }

        runningTotal += file.size;
        accepted.push(file);
      }

      if (accepted.length > 0) {
        setErrorMessage(null);
      }

      return accepted;
    },
    [totalBytes],
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) {
        return;
      }

      const accepted = validateFiles(Array.from(fileList));
      if (accepted.length > 0) {
        onAdd(accepted);
      }
    },
    [onAdd, validateFiles],
  );

  return (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom>
        Kanıt ve Ek Dosyalar
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        PDF, DOCX, XLSX, JPG, PNG, MP4, MOV, ZIP ve TXT dosyaları yükleyebilirsiniz. Tek dosya en
        fazla 50 MB, toplam en fazla 200 MB.
      </Typography>

      <Box
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => {
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => {
          inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Dosya yükleme alanı"
        sx={{
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
        }}
      >
        <CloudUploadOutlinedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
        <Typography variant="body1">
          Dosyaları sürükleyip bırakın veya seçmek için tıklayın
        </Typography>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </Box>

      {errorMessage ? (
        <Alert severity="error" sx={{ mt: 2 }} role="alert">
          {errorMessage}
        </Alert>
      ) : null}

      {attachments.length > 0 ? (
        <List dense sx={{ mt: 2 }}>
          {attachments.map((item) => (
            <ListItem
              key={item.id}
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label={`${item.file.name} dosyasını kaldır`}
                  onClick={() => {
                    onRemove(item.id);
                  }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              }
            >
              <ListItemText primary={item.file.name} secondary={formatBytes(item.file.size)} />
            </ListItem>
          ))}
        </List>
      ) : null}

      {attachments.length > 0 ? (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Toplam: {formatBytes(totalBytes)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min((totalBytes / MAX_TOTAL_REPORT_ATTACHMENT_BYTES) * 100, 100)}
            sx={{ mt: 0.5 }}
          />
        </Box>
      ) : null}
    </Box>
  );
}
