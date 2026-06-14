import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ALLOWED_UPLOAD_RULES,
  DOCUMENT_CATEGORY_VALUES,
  MAX_SINGLE_FILE_BYTES,
  type DocumentCategoryCode,
} from '@ethics/shared';
import { initiateCaseDocumentBodySchema } from '@ethics/dto';
import { useCallback, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { getDocumentCategoryLabel } from '@/features/documents/constants/document-category-labels';
import { useUploadCaseDocumentMutation } from '@/features/documents/hooks/useDocuments';
import { getDocumentErrorMessage } from '@/features/documents/utils/document-error.util';
import { computeFileSha256 } from '@/features/intake/utils/file-hash.util';

const ALLOWED_EXTENSIONS = new Set(
  ALLOWED_UPLOAD_RULES.map((rule) => rule.extension.toLowerCase()),
);

const ALLOWED_MIME_TYPES = new Set(ALLOWED_UPLOAD_RULES.flatMap((rule) => rule.mimeTypes));

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? (parts.at(-1)?.toLowerCase() ?? '') : '';
}

const documentUploadFormSchema = initiateCaseDocumentBodySchema
  .pick({
    documentCategory: true,
    title: true,
  })
  .extend({
    documentCategory: z.enum(DOCUMENT_CATEGORY_VALUES as [string, ...string[]]),
    title: z.string().trim().min(1, 'Doküman adı zorunludur.').max(255),
  });

type DocumentUploadFormValues = z.infer<typeof documentUploadFormSchema>;

type DocumentUploadDialogProps = {
  caseId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function DocumentUploadDialog({
  caseId,
  open,
  onClose,
  onSuccess,
  onError,
}: DocumentUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useUploadCaseDocumentMutation(caseId);

  const form = useForm<DocumentUploadFormValues>({
    resolver: zodResolver(documentUploadFormSchema),
    defaultValues: {
      title: '',
      documentCategory: DOCUMENT_CATEGORY_VALUES[0],
    },
    mode: 'onTouched',
  });

  const resetState = useCallback(() => {
    form.reset();
    setSelectedFile(null);
    setFileError(null);
    setUploadProgress(0);
  }, [form]);

  const handleClose = () => {
    if (uploadMutation.isPending) {
      return;
    }

    resetState();
    onClose();
  };

  const validateFile = (file: File): string | null => {
    const extension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.type)) {
      return 'İzin verilmeyen dosya türü. Lütfen desteklenen formatlardan birini seçin.';
    }

    if (file.size > MAX_SINGLE_FILE_BYTES) {
      return 'Tek dosya boyutu 50 MB sınırını aşamaz.';
    }

    return null;
  };

  const handleFileSelect = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      setSelectedFile(null);
      return;
    }

    setFileError(null);
    setSelectedFile(file);

    if (!form.getValues('title')) {
      form.setValue('title', file.name.replace(/\.[^.]+$/, ''), { shouldValidate: true });
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!selectedFile) {
      setFileError('Lütfen bir dosya seçin.');
      return;
    }

    setUploadProgress(0);

    try {
      const contentSha256 = await computeFileSha256(selectedFile);
      await uploadMutation.mutateAsync({
        body: {
          originalFilename: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
          contentSha256,
          documentCategory: values.documentCategory,
          title: values.title,
        },
        file: selectedFile,
        onProgress: setUploadProgress,
      });

      resetState();
      onClose();
      onSuccess('Doküman yüklendi. Güvenlik taraması devam ediyor.');
    } catch (error) {
      onError(getDocumentErrorMessage(error, 'Doküman yüklenemedi.'));
    }
  });

  const isSubmitting = uploadMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="document-upload-title"
    >
      <DialogTitle id="document-upload-title">Doküman Yükle</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Doküman Adı"
                required
                fullWidth
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="documentCategory"
            control={form.control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth required error={Boolean(fieldState.error)}>
                <InputLabel id="document-category-label">Kategori</InputLabel>
                <Select
                  {...field}
                  labelId="document-category-label"
                  label="Kategori"
                  value={field.value}
                >
                  {DOCUMENT_CATEGORY_VALUES.map((category: DocumentCategoryCode) => (
                    <MenuItem key={category} value={category}>
                      {getDocumentCategoryLabel(category)}
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error ? (
                  <FormHelperText>{fieldState.error.message}</FormHelperText>
                ) : null}
              </FormControl>
            )}
          />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              PDF, DOCX, XLSX, JPG, PNG, MP4, MOV, ZIP ve TXT dosyaları desteklenir (maks. 50 MB).
            </Typography>

            <Box
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
              aria-label="Dosya seç"
              sx={{
                border: 2,
                borderStyle: 'dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2">
                {selectedFile ? selectedFile.name : 'Dosya seçmek için tıklayın'}
              </Typography>
              <input
                ref={inputRef}
                type="file"
                hidden
                disabled={isSubmitting}
                onChange={(event) => {
                  handleFileSelect(event.target.files);
                  event.target.value = '';
                }}
              />
            </Box>

            {fileError ? (
              <Alert severity="error" sx={{ mt: 1.5 }} role="alert">
                {fileError}
              </Alert>
            ) : null}
          </Box>

          {isSubmitting ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Yükleniyor… %{uploadProgress}
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          İptal
        </Button>
        <Button
          variant="contained"
          disabled={isSubmitting}
          onClick={() => {
            void handleSubmit();
          }}
        >
          Yükle
        </Button>
      </DialogActions>
    </Dialog>
  );
}
